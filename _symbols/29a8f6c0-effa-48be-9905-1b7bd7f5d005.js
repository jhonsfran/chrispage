// Mögliche Inhalte - Updated September 14, 2026
function noop() { }
function run(fn) {
    return fn();
}
function blank_object() {
    return Object.create(null);
}
function run_all(fns) {
    fns.forEach(run);
}
function is_function(thing) {
    return typeof thing === 'function';
}
function safe_not_equal(a, b) {
    return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
}
function is_empty(obj) {
    return Object.keys(obj).length === 0;
}

// Track which nodes are claimed during hydration. Unclaimed nodes can then be removed from the DOM
// at the end of hydration without touching the remaining nodes.
let is_hydrating = false;
function start_hydrating() {
    is_hydrating = true;
}
function end_hydrating() {
    is_hydrating = false;
}
function upper_bound(low, high, key, value) {
    // Return first index of value larger than input value in the range [low, high)
    while (low < high) {
        const mid = low + ((high - low) >> 1);
        if (key(mid) <= value) {
            low = mid + 1;
        }
        else {
            high = mid;
        }
    }
    return low;
}
function init_hydrate(target) {
    if (target.hydrate_init)
        return;
    target.hydrate_init = true;
    // We know that all children have claim_order values since the unclaimed have been detached if target is not <head>
    let children = target.childNodes;
    // If target is <head>, there may be children without claim_order
    if (target.nodeName === 'HEAD') {
        const myChildren = [];
        for (let i = 0; i < children.length; i++) {
            const node = children[i];
            if (node.claim_order !== undefined) {
                myChildren.push(node);
            }
        }
        children = myChildren;
    }
    /*
    * Reorder claimed children optimally.
    * We can reorder claimed children optimally by finding the longest subsequence of
    * nodes that are already claimed in order and only moving the rest. The longest
    * subsequence of nodes that are claimed in order can be found by
    * computing the longest increasing subsequence of .claim_order values.
    *
    * This algorithm is optimal in generating the least amount of reorder operations
    * possible.
    *
    * Proof:
    * We know that, given a set of reordering operations, the nodes that do not move
    * always form an increasing subsequence, since they do not move among each other
    * meaning that they must be already ordered among each other. Thus, the maximal
    * set of nodes that do not move form a longest increasing subsequence.
    */
    // Compute longest increasing subsequence
    // m: subsequence length j => index k of smallest value that ends an increasing subsequence of length j
    const m = new Int32Array(children.length + 1);
    // Predecessor indices + 1
    const p = new Int32Array(children.length);
    m[0] = -1;
    let longest = 0;
    for (let i = 0; i < children.length; i++) {
        const current = children[i].claim_order;
        // Find the largest subsequence length such that it ends in a value less than our current value
        // upper_bound returns first greater value, so we subtract one
        // with fast path for when we are on the current longest subsequence
        const seqLen = ((longest > 0 && children[m[longest]].claim_order <= current) ? longest + 1 : upper_bound(1, longest, idx => children[m[idx]].claim_order, current)) - 1;
        p[i] = m[seqLen] + 1;
        const newLen = seqLen + 1;
        // We can guarantee that current is the smallest value. Otherwise, we would have generated a longer sequence.
        m[newLen] = i;
        longest = Math.max(newLen, longest);
    }
    // The longest increasing subsequence of nodes (initially reversed)
    const lis = [];
    // The rest of the nodes, nodes that will be moved
    const toMove = [];
    let last = children.length - 1;
    for (let cur = m[longest] + 1; cur != 0; cur = p[cur - 1]) {
        lis.push(children[cur - 1]);
        for (; last >= cur; last--) {
            toMove.push(children[last]);
        }
        last--;
    }
    for (; last >= 0; last--) {
        toMove.push(children[last]);
    }
    lis.reverse();
    // We sort the nodes being moved to guarantee that their insertion order matches the claim order
    toMove.sort((a, b) => a.claim_order - b.claim_order);
    // Finally, we move the nodes
    for (let i = 0, j = 0; i < toMove.length; i++) {
        while (j < lis.length && toMove[i].claim_order >= lis[j].claim_order) {
            j++;
        }
        const anchor = j < lis.length ? lis[j] : null;
        target.insertBefore(toMove[i], anchor);
    }
}
function append_hydration(target, node) {
    if (is_hydrating) {
        init_hydrate(target);
        if ((target.actual_end_child === undefined) || ((target.actual_end_child !== null) && (target.actual_end_child.parentNode !== target))) {
            target.actual_end_child = target.firstChild;
        }
        // Skip nodes of undefined ordering
        while ((target.actual_end_child !== null) && (target.actual_end_child.claim_order === undefined)) {
            target.actual_end_child = target.actual_end_child.nextSibling;
        }
        if (node !== target.actual_end_child) {
            // We only insert if the ordering of this node should be modified or the parent node is not target
            if (node.claim_order !== undefined || node.parentNode !== target) {
                target.insertBefore(node, target.actual_end_child);
            }
        }
        else {
            target.actual_end_child = node.nextSibling;
        }
    }
    else if (node.parentNode !== target || node.nextSibling !== null) {
        target.appendChild(node);
    }
}
function insert_hydration(target, node, anchor) {
    if (is_hydrating && !anchor) {
        append_hydration(target, node);
    }
    else if (node.parentNode !== target || node.nextSibling != anchor) {
        target.insertBefore(node, anchor || null);
    }
}
function detach(node) {
    if (node.parentNode) {
        node.parentNode.removeChild(node);
    }
}
function destroy_each(iterations, detaching) {
    for (let i = 0; i < iterations.length; i += 1) {
        if (iterations[i])
            iterations[i].d(detaching);
    }
}
function element(name) {
    return document.createElement(name);
}
function svg_element(name) {
    return document.createElementNS('http://www.w3.org/2000/svg', name);
}
function text(data) {
    return document.createTextNode(data);
}
function space() {
    return text(' ');
}
function attr(node, attribute, value) {
    if (value == null)
        node.removeAttribute(attribute);
    else if (node.getAttribute(attribute) !== value)
        node.setAttribute(attribute, value);
}
function children(element) {
    return Array.from(element.childNodes);
}
function init_claim_info(nodes) {
    if (nodes.claim_info === undefined) {
        nodes.claim_info = { last_index: 0, total_claimed: 0 };
    }
}
function claim_node(nodes, predicate, processNode, createNode, dontUpdateLastIndex = false) {
    // Try to find nodes in an order such that we lengthen the longest increasing subsequence
    init_claim_info(nodes);
    const resultNode = (() => {
        // We first try to find an element after the previous one
        for (let i = nodes.claim_info.last_index; i < nodes.length; i++) {
            const node = nodes[i];
            if (predicate(node)) {
                const replacement = processNode(node);
                if (replacement === undefined) {
                    nodes.splice(i, 1);
                }
                else {
                    nodes[i] = replacement;
                }
                if (!dontUpdateLastIndex) {
                    nodes.claim_info.last_index = i;
                }
                return node;
            }
        }
        // Otherwise, we try to find one before
        // We iterate in reverse so that we don't go too far back
        for (let i = nodes.claim_info.last_index - 1; i >= 0; i--) {
            const node = nodes[i];
            if (predicate(node)) {
                const replacement = processNode(node);
                if (replacement === undefined) {
                    nodes.splice(i, 1);
                }
                else {
                    nodes[i] = replacement;
                }
                if (!dontUpdateLastIndex) {
                    nodes.claim_info.last_index = i;
                }
                else if (replacement === undefined) {
                    // Since we spliced before the last_index, we decrease it
                    nodes.claim_info.last_index--;
                }
                return node;
            }
        }
        // If we can't find any matching node, we create a new one
        return createNode();
    })();
    resultNode.claim_order = nodes.claim_info.total_claimed;
    nodes.claim_info.total_claimed += 1;
    return resultNode;
}
function claim_element_base(nodes, name, attributes, create_element) {
    return claim_node(nodes, (node) => node.nodeName === name, (node) => {
        const remove = [];
        for (let j = 0; j < node.attributes.length; j++) {
            const attribute = node.attributes[j];
            if (!attributes[attribute.name]) {
                remove.push(attribute.name);
            }
        }
        remove.forEach(v => node.removeAttribute(v));
        return undefined;
    }, () => create_element(name));
}
function claim_element(nodes, name, attributes) {
    return claim_element_base(nodes, name, attributes, element);
}
function claim_svg_element(nodes, name, attributes) {
    return claim_element_base(nodes, name, attributes, svg_element);
}
function claim_text(nodes, data) {
    return claim_node(nodes, (node) => node.nodeType === 3, (node) => {
        const dataStr = '' + data;
        if (node.data.startsWith(dataStr)) {
            if (node.data.length !== dataStr.length) {
                return node.splitText(dataStr.length);
            }
        }
        else {
            node.data = dataStr;
        }
    }, () => text(data), true // Text nodes should not update last index since it is likely not worth it to eliminate an increasing subsequence of actual elements
    );
}
function claim_space(nodes) {
    return claim_text(nodes, ' ');
}
function set_data(text, data) {
    data = '' + data;
    if (text.data === data)
        return;
    text.data = data;
}

let current_component;
function set_current_component(component) {
    current_component = component;
}
function get_current_component() {
    if (!current_component)
        throw new Error('Function called outside component initialization');
    return current_component;
}
/**
 * The `onMount` function schedules a callback to run as soon as the component has been mounted to the DOM.
 * It must be called during the component's initialisation (but doesn't need to live *inside* the component;
 * it can be called from an external module).
 *
 * `onMount` does not run inside a [server-side component](/docs#run-time-server-side-component-api).
 *
 * https://svelte.dev/docs#run-time-svelte-onmount
 */
function onMount(fn) {
    get_current_component().$$.on_mount.push(fn);
}

const dirty_components = [];
const binding_callbacks = [];
let render_callbacks = [];
const flush_callbacks = [];
const resolved_promise = /* @__PURE__ */ Promise.resolve();
let update_scheduled = false;
function schedule_update() {
    if (!update_scheduled) {
        update_scheduled = true;
        resolved_promise.then(flush);
    }
}
function add_render_callback(fn) {
    render_callbacks.push(fn);
}
// flush() calls callbacks in this order:
// 1. All beforeUpdate callbacks, in order: parents before children
// 2. All bind:this callbacks, in reverse order: children before parents.
// 3. All afterUpdate callbacks, in order: parents before children. EXCEPT
//    for afterUpdates called during the initial onMount, which are called in
//    reverse order: children before parents.
// Since callbacks might update component values, which could trigger another
// call to flush(), the following steps guard against this:
// 1. During beforeUpdate, any updated components will be added to the
//    dirty_components array and will cause a reentrant call to flush(). Because
//    the flush index is kept outside the function, the reentrant call will pick
//    up where the earlier call left off and go through all dirty components. The
//    current_component value is saved and restored so that the reentrant call will
//    not interfere with the "parent" flush() call.
// 2. bind:this callbacks cannot trigger new flush() calls.
// 3. During afterUpdate, any updated components will NOT have their afterUpdate
//    callback called a second time; the seen_callbacks set, outside the flush()
//    function, guarantees this behavior.
const seen_callbacks = new Set();
let flushidx = 0; // Do *not* move this inside the flush() function
function flush() {
    // Do not reenter flush while dirty components are updated, as this can
    // result in an infinite loop. Instead, let the inner flush handle it.
    // Reentrancy is ok afterwards for bindings etc.
    if (flushidx !== 0) {
        return;
    }
    const saved_component = current_component;
    do {
        // first, call beforeUpdate functions
        // and update components
        try {
            while (flushidx < dirty_components.length) {
                const component = dirty_components[flushidx];
                flushidx++;
                set_current_component(component);
                update(component.$$);
            }
        }
        catch (e) {
            // reset dirty state to not end up in a deadlocked state and then rethrow
            dirty_components.length = 0;
            flushidx = 0;
            throw e;
        }
        set_current_component(null);
        dirty_components.length = 0;
        flushidx = 0;
        while (binding_callbacks.length)
            binding_callbacks.pop()();
        // then, once components are updated, call
        // afterUpdate functions. This may cause
        // subsequent updates...
        for (let i = 0; i < render_callbacks.length; i += 1) {
            const callback = render_callbacks[i];
            if (!seen_callbacks.has(callback)) {
                // ...so guard against infinite loops
                seen_callbacks.add(callback);
                callback();
            }
        }
        render_callbacks.length = 0;
    } while (dirty_components.length);
    while (flush_callbacks.length) {
        flush_callbacks.pop()();
    }
    update_scheduled = false;
    seen_callbacks.clear();
    set_current_component(saved_component);
}
function update($$) {
    if ($$.fragment !== null) {
        $$.update();
        run_all($$.before_update);
        const dirty = $$.dirty;
        $$.dirty = [-1];
        $$.fragment && $$.fragment.p($$.ctx, dirty);
        $$.after_update.forEach(add_render_callback);
    }
}
/**
 * Useful for example to execute remaining `afterUpdate` callbacks before executing `destroy`.
 */
function flush_render_callbacks(fns) {
    const filtered = [];
    const targets = [];
    render_callbacks.forEach((c) => fns.indexOf(c) === -1 ? filtered.push(c) : targets.push(c));
    targets.forEach((c) => c());
    render_callbacks = filtered;
}
const outroing = new Set();
function transition_in(block, local) {
    if (block && block.i) {
        outroing.delete(block);
        block.i(local);
    }
}
function mount_component(component, target, anchor, customElement) {
    const { fragment, after_update } = component.$$;
    fragment && fragment.m(target, anchor);
    if (!customElement) {
        // onMount happens before the initial afterUpdate
        add_render_callback(() => {
            const new_on_destroy = component.$$.on_mount.map(run).filter(is_function);
            // if the component was destroyed immediately
            // it will update the `$$.on_destroy` reference to `null`.
            // the destructured on_destroy may still reference to the old array
            if (component.$$.on_destroy) {
                component.$$.on_destroy.push(...new_on_destroy);
            }
            else {
                // Edge case - component was destroyed immediately,
                // most likely as a result of a binding initialising
                run_all(new_on_destroy);
            }
            component.$$.on_mount = [];
        });
    }
    after_update.forEach(add_render_callback);
}
function destroy_component(component, detaching) {
    const $$ = component.$$;
    if ($$.fragment !== null) {
        flush_render_callbacks($$.after_update);
        run_all($$.on_destroy);
        $$.fragment && $$.fragment.d(detaching);
        // TODO null out other refs, including component.$$ (but need to
        // preserve final state?)
        $$.on_destroy = $$.fragment = null;
        $$.ctx = [];
    }
}
function make_dirty(component, i) {
    if (component.$$.dirty[0] === -1) {
        dirty_components.push(component);
        schedule_update();
        component.$$.dirty.fill(0);
    }
    component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
}
function init(component, options, instance, create_fragment, not_equal, props, append_styles, dirty = [-1]) {
    const parent_component = current_component;
    set_current_component(component);
    const $$ = component.$$ = {
        fragment: null,
        ctx: [],
        // state
        props,
        update: noop,
        not_equal,
        bound: blank_object(),
        // lifecycle
        on_mount: [],
        on_destroy: [],
        on_disconnect: [],
        before_update: [],
        after_update: [],
        context: new Map(options.context || (parent_component ? parent_component.$$.context : [])),
        // everything else
        callbacks: blank_object(),
        dirty,
        skip_bound: false,
        root: options.target || parent_component.$$.root
    };
    append_styles && append_styles($$.root);
    let ready = false;
    $$.ctx = instance
        ? instance(component, options.props || {}, (i, ret, ...rest) => {
            const value = rest.length ? rest[0] : ret;
            if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                if (!$$.skip_bound && $$.bound[i])
                    $$.bound[i](value);
                if (ready)
                    make_dirty(component, i);
            }
            return ret;
        })
        : [];
    $$.update();
    ready = true;
    run_all($$.before_update);
    // `false` as a special case of no DOM component
    $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
    if (options.target) {
        if (options.hydrate) {
            start_hydrating();
            const nodes = children(options.target);
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            $$.fragment && $$.fragment.l(nodes);
            nodes.forEach(detach);
        }
        else {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            $$.fragment && $$.fragment.c();
        }
        if (options.intro)
            transition_in(component.$$.fragment);
        mount_component(component, options.target, options.anchor, options.customElement);
        end_hydrating();
        flush();
    }
    set_current_component(parent_component);
}
/**
 * Base class for Svelte components. Used when dev=false.
 */
class SvelteComponent {
    $destroy() {
        destroy_component(this, 1);
        this.$destroy = noop;
    }
    $on(type, callback) {
        if (!is_function(callback)) {
            return noop;
        }
        const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
        callbacks.push(callback);
        return () => {
            const index = callbacks.indexOf(callback);
            if (index !== -1)
                callbacks.splice(index, 1);
        };
    }
    $set($$props) {
        if (this.$$set && !is_empty($$props)) {
            this.$$.skip_bound = true;
            this.$$set($$props);
            this.$$.skip_bound = false;
        }
    }
}

/* generated by Svelte v3.59.1 */

function get_each_context(ctx, list, i) {
	const child_ctx = ctx.slice();
	child_ctx[6] = list[i];
	child_ctx[8] = i;
	return child_ctx;
}

// (253:14) {:else}
function create_else_block(ctx) {
	let svg;
	let path0;
	let path1;

	return {
		c() {
			svg = svg_element("svg");
			path0 = svg_element("path");
			path1 = svg_element("path");
			this.h();
		},
		l(nodes) {
			svg = claim_svg_element(nodes, "svg", { viewBox: true, class: true });
			var svg_nodes = children(svg);
			path0 = claim_svg_element(svg_nodes, "path", { d: true, class: true });
			children(path0).forEach(detach);
			path1 = claim_svg_element(svg_nodes, "path", { d: true, class: true });
			children(path1).forEach(detach);
			svg_nodes.forEach(detach);
			this.h();
		},
		h() {
			attr(path0, "d", "M4 5h16v11H9l-5 4V5Z");
			attr(path0, "class", "svelte-ul2zr7");
			attr(path1, "d", "M8 9h8M8 12h5");
			attr(path1, "class", "svelte-ul2zr7");
			attr(svg, "viewBox", "0 0 24 24");
			attr(svg, "class", "svelte-ul2zr7");
		},
		m(target, anchor) {
			insert_hydration(target, svg, anchor);
			append_hydration(svg, path0);
			append_hydration(svg, path1);
		},
		d(detaching) {
			if (detaching) detach(svg);
		}
	};
}

// (247:36) 
function create_if_block_4(ctx) {
	let svg;
	let path0;
	let circle;
	let path1;

	return {
		c() {
			svg = svg_element("svg");
			path0 = svg_element("path");
			circle = svg_element("circle");
			path1 = svg_element("path");
			this.h();
		},
		l(nodes) {
			svg = claim_svg_element(nodes, "svg", { viewBox: true, class: true });
			var svg_nodes = children(svg);
			path0 = claim_svg_element(svg_nodes, "path", { d: true, class: true });
			children(path0).forEach(detach);
			circle = claim_svg_element(svg_nodes, "circle", { cx: true, cy: true, r: true, class: true });
			children(circle).forEach(detach);
			path1 = claim_svg_element(svg_nodes, "path", { d: true, class: true });
			children(path1).forEach(detach);
			svg_nodes.forEach(detach);
			this.h();
		},
		h() {
			attr(path0, "d", "M4 3h12v18H4zM8 8h4M8 12h4");
			attr(path0, "class", "svelte-ul2zr7");
			attr(circle, "cx", "17");
			attr(circle, "cy", "16");
			attr(circle, "r", "3");
			attr(circle, "class", "svelte-ul2zr7");
			attr(path1, "d", "m19 18 2 2");
			attr(path1, "class", "svelte-ul2zr7");
			attr(svg, "viewBox", "0 0 24 24");
			attr(svg, "class", "svelte-ul2zr7");
		},
		m(target, anchor) {
			insert_hydration(target, svg, anchor);
			append_hydration(svg, path0);
			append_hydration(svg, circle);
			append_hydration(svg, path1);
		},
		d(detaching) {
			if (detaching) detach(svg);
		}
	};
}

// (242:36) 
function create_if_block_3(ctx) {
	let svg;
	let path0;
	let path1;

	return {
		c() {
			svg = svg_element("svg");
			path0 = svg_element("path");
			path1 = svg_element("path");
			this.h();
		},
		l(nodes) {
			svg = claim_svg_element(nodes, "svg", { viewBox: true, class: true });
			var svg_nodes = children(svg);
			path0 = claim_svg_element(svg_nodes, "path", { d: true, class: true });
			children(path0).forEach(detach);
			path1 = claim_svg_element(svg_nodes, "path", { d: true, class: true });
			children(path1).forEach(detach);
			svg_nodes.forEach(detach);
			this.h();
		},
		h() {
			attr(path0, "d", "M12 3 2.7 20h18.6L12 3Z");
			attr(path0, "class", "svelte-ul2zr7");
			attr(path1, "d", "M12 9v5M12 17.5h.01");
			attr(path1, "class", "svelte-ul2zr7");
			attr(svg, "viewBox", "0 0 24 24");
			attr(svg, "class", "svelte-ul2zr7");
		},
		m(target, anchor) {
			insert_hydration(target, svg, anchor);
			append_hydration(svg, path0);
			append_hydration(svg, path1);
		},
		d(detaching) {
			if (detaching) detach(svg);
		}
	};
}

// (234:36) 
function create_if_block_2(ctx) {
	let svg;
	let circle0;
	let circle1;
	let circle2;
	let circle3;
	let path;

	return {
		c() {
			svg = svg_element("svg");
			circle0 = svg_element("circle");
			circle1 = svg_element("circle");
			circle2 = svg_element("circle");
			circle3 = svg_element("circle");
			path = svg_element("path");
			this.h();
		},
		l(nodes) {
			svg = claim_svg_element(nodes, "svg", { viewBox: true, class: true });
			var svg_nodes = children(svg);
			circle0 = claim_svg_element(svg_nodes, "circle", { cx: true, cy: true, r: true, class: true });
			children(circle0).forEach(detach);
			circle1 = claim_svg_element(svg_nodes, "circle", { cx: true, cy: true, r: true, class: true });
			children(circle1).forEach(detach);
			circle2 = claim_svg_element(svg_nodes, "circle", { cx: true, cy: true, r: true, class: true });
			children(circle2).forEach(detach);
			circle3 = claim_svg_element(svg_nodes, "circle", { cx: true, cy: true, r: true, class: true });
			children(circle3).forEach(detach);
			path = claim_svg_element(svg_nodes, "path", { d: true, class: true });
			children(path).forEach(detach);
			svg_nodes.forEach(detach);
			this.h();
		},
		h() {
			attr(circle0, "cx", "5");
			attr(circle0, "cy", "12");
			attr(circle0, "r", "2");
			attr(circle0, "class", "svelte-ul2zr7");
			attr(circle1, "cx", "12");
			attr(circle1, "cy", "5");
			attr(circle1, "r", "2");
			attr(circle1, "class", "svelte-ul2zr7");
			attr(circle2, "cx", "19");
			attr(circle2, "cy", "12");
			attr(circle2, "r", "2");
			attr(circle2, "class", "svelte-ul2zr7");
			attr(circle3, "cx", "12");
			attr(circle3, "cy", "19");
			attr(circle3, "r", "2");
			attr(circle3, "class", "svelte-ul2zr7");
			attr(path, "d", "m6.5 10.5 4-4M13.5 6.5l4 4M17.5 13.5l-4 4M10.5 17.5l-4-4");
			attr(path, "class", "svelte-ul2zr7");
			attr(svg, "viewBox", "0 0 24 24");
			attr(svg, "class", "svelte-ul2zr7");
		},
		m(target, anchor) {
			insert_hydration(target, svg, anchor);
			append_hydration(svg, circle0);
			append_hydration(svg, circle1);
			append_hydration(svg, circle2);
			append_hydration(svg, circle3);
			append_hydration(svg, path);
		},
		d(detaching) {
			if (detaching) detach(svg);
		}
	};
}

// (232:36) 
function create_if_block_1(ctx) {
	let svg;
	let path;

	return {
		c() {
			svg = svg_element("svg");
			path = svg_element("path");
			this.h();
		},
		l(nodes) {
			svg = claim_svg_element(nodes, "svg", { viewBox: true, class: true });
			var svg_nodes = children(svg);
			path = claim_svg_element(svg_nodes, "path", { d: true, class: true });
			children(path).forEach(detach);
			svg_nodes.forEach(detach);
			this.h();
		},
		h() {
			attr(path, "d", "M3 19 9 12l4 3 8-10M3 4v16h18");
			attr(path, "class", "svelte-ul2zr7");
			attr(svg, "viewBox", "0 0 24 24");
			attr(svg, "class", "svelte-ul2zr7");
		},
		m(target, anchor) {
			insert_hydration(target, svg, anchor);
			append_hydration(svg, path);
		},
		d(detaching) {
			if (detaching) detach(svg);
		}
	};
}

// (230:14) {#if index === 0}
function create_if_block(ctx) {
	let svg;
	let path;

	return {
		c() {
			svg = svg_element("svg");
			path = svg_element("path");
			this.h();
		},
		l(nodes) {
			svg = claim_svg_element(nodes, "svg", { viewBox: true, class: true });
			var svg_nodes = children(svg);
			path = claim_svg_element(svg_nodes, "path", { d: true, class: true });
			children(path).forEach(detach);
			svg_nodes.forEach(detach);
			this.h();
		},
		h() {
			attr(path, "d", "M5 20V11M12 20V5M19 20V8");
			attr(path, "class", "svelte-ul2zr7");
			attr(svg, "viewBox", "0 0 24 24");
			attr(svg, "class", "svelte-ul2zr7");
		},
		m(target, anchor) {
			insert_hydration(target, svg, anchor);
			append_hydration(svg, path);
		},
		d(detaching) {
			if (detaching) detach(svg);
		}
	};
}

// (226:6) {#each topics as topic, index}
function create_each_block(ctx) {
	let div1;
	let article;
	let span;
	let t0;
	let div0;
	let h3;
	let t1_value = /*topic*/ ctx[6].title + "";
	let t1;
	let t2;
	let p;
	let t3_value = /*topic*/ ctx[6].text + "";
	let t3;
	let t4;

	function select_block_type(ctx, dirty) {
		if (/*index*/ ctx[8] === 0) return create_if_block;
		if (/*index*/ ctx[8] === 1) return create_if_block_1;
		if (/*index*/ ctx[8] === 2) return create_if_block_2;
		if (/*index*/ ctx[8] === 3) return create_if_block_3;
		if (/*index*/ ctx[8] === 4) return create_if_block_4;
		return create_else_block;
	}

	let current_block_type = select_block_type(ctx);
	let if_block = current_block_type(ctx);

	return {
		c() {
			div1 = element("div");
			article = element("article");
			span = element("span");
			if_block.c();
			t0 = space();
			div0 = element("div");
			h3 = element("h3");
			t1 = text(t1_value);
			t2 = space();
			p = element("p");
			t3 = text(t3_value);
			t4 = space();
			this.h();
		},
		l(nodes) {
			div1 = claim_element(nodes, "DIV", { class: true });
			var div1_nodes = children(div1);
			article = claim_element(div1_nodes, "ARTICLE", { class: true });
			var article_nodes = children(article);
			span = claim_element(article_nodes, "SPAN", { class: true, "aria-hidden": true });
			var span_nodes = children(span);
			if_block.l(span_nodes);
			span_nodes.forEach(detach);
			t0 = claim_space(article_nodes);
			div0 = claim_element(article_nodes, "DIV", { class: true });
			var div0_nodes = children(div0);
			h3 = claim_element(div0_nodes, "H3", { class: true });
			var h3_nodes = children(h3);
			t1 = claim_text(h3_nodes, t1_value);
			h3_nodes.forEach(detach);
			t2 = claim_space(div0_nodes);
			p = claim_element(div0_nodes, "P", { class: true });
			var p_nodes = children(p);
			t3 = claim_text(p_nodes, t3_value);
			p_nodes.forEach(detach);
			div0_nodes.forEach(detach);
			article_nodes.forEach(detach);
			t4 = claim_space(div1_nodes);
			div1_nodes.forEach(detach);
			this.h();
		},
		h() {
			attr(span, "class", "cg-dl-topic__icon svelte-ul2zr7");
			attr(span, "aria-hidden", "true");
			attr(h3, "class", "svelte-ul2zr7");
			attr(p, "class", "svelte-ul2zr7");
			attr(div0, "class", "svelte-ul2zr7");
			attr(article, "class", "cg-dl-topic svelte-ul2zr7");
			attr(div1, "class", "cg-reveal-item svelte-ul2zr7");
		},
		m(target, anchor) {
			insert_hydration(target, div1, anchor);
			append_hydration(div1, article);
			append_hydration(article, span);
			if_block.m(span, null);
			append_hydration(article, t0);
			append_hydration(article, div0);
			append_hydration(div0, h3);
			append_hydration(h3, t1);
			append_hydration(div0, t2);
			append_hydration(div0, p);
			append_hydration(p, t3);
			append_hydration(div1, t4);
		},
		p(ctx, dirty) {
			if (dirty & /*topics*/ 4 && t1_value !== (t1_value = /*topic*/ ctx[6].title + "")) set_data(t1, t1_value);
			if (dirty & /*topics*/ 4 && t3_value !== (t3_value = /*topic*/ ctx[6].text + "")) set_data(t3, t3_value);
		},
		d(detaching) {
			if (detaching) detach(div1);
			if_block.d();
		}
	};
}

function create_fragment(ctx) {
	let section;
	let div2;
	let div0;
	let h2;
	let t0;
	let t1;
	let p;
	let t2;
	let t3;
	let div1;
	let each_value = /*topics*/ ctx[2];
	let each_blocks = [];

	for (let i = 0; i < each_value.length; i += 1) {
		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
	}

	return {
		c() {
			section = element("section");
			div2 = element("div");
			div0 = element("div");
			h2 = element("h2");
			t0 = text(/*heading*/ ctx[0]);
			t1 = space();
			p = element("p");
			t2 = text(/*note*/ ctx[1]);
			t3 = space();
			div1 = element("div");

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].c();
			}

			this.h();
		},
		l(nodes) {
			section = claim_element(nodes, "SECTION", { class: true, "aria-labelledby": true });
			var section_nodes = children(section);
			div2 = claim_element(section_nodes, "DIV", { class: true });
			var div2_nodes = children(div2);
			div0 = claim_element(div2_nodes, "DIV", { class: true });
			var div0_nodes = children(div0);
			h2 = claim_element(div0_nodes, "H2", { id: true, class: true });
			var h2_nodes = children(h2);
			t0 = claim_text(h2_nodes, /*heading*/ ctx[0]);
			h2_nodes.forEach(detach);
			t1 = claim_space(div0_nodes);
			p = claim_element(div0_nodes, "P", { class: true });
			var p_nodes = children(p);
			t2 = claim_text(p_nodes, /*note*/ ctx[1]);
			p_nodes.forEach(detach);
			div0_nodes.forEach(detach);
			t3 = claim_space(div2_nodes);
			div1 = claim_element(div2_nodes, "DIV", { class: true });
			var div1_nodes = children(div1);

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].l(div1_nodes);
			}

			div1_nodes.forEach(detach);
			div2_nodes.forEach(detach);
			section_nodes.forEach(detach);
			this.h();
		},
		h() {
			attr(h2, "id", "cg-dl-topics-heading");
			attr(h2, "class", "svelte-ul2zr7");
			attr(p, "class", "svelte-ul2zr7");
			attr(div0, "class", "cg-dl-topics__header cg-reveal-item svelte-ul2zr7");
			attr(div1, "class", "cg-dl-topics__grid svelte-ul2zr7");
			attr(div2, "class", "cg-dl-topics__inner svelte-ul2zr7");
			attr(section, "class", "cg-dl-topics svelte-ul2zr7");
			attr(section, "aria-labelledby", "cg-dl-topics-heading");
		},
		m(target, anchor) {
			insert_hydration(target, section, anchor);
			append_hydration(section, div2);
			append_hydration(div2, div0);
			append_hydration(div0, h2);
			append_hydration(h2, t0);
			append_hydration(div0, t1);
			append_hydration(div0, p);
			append_hydration(p, t2);
			append_hydration(div2, t3);
			append_hydration(div2, div1);

			for (let i = 0; i < each_blocks.length; i += 1) {
				if (each_blocks[i]) {
					each_blocks[i].m(div1, null);
				}
			}

			/*section_binding*/ ctx[5](section);
		},
		p(ctx, [dirty]) {
			if (dirty & /*heading*/ 1) set_data(t0, /*heading*/ ctx[0]);
			if (dirty & /*note*/ 2) set_data(t2, /*note*/ ctx[1]);

			if (dirty & /*topics*/ 4) {
				each_value = /*topics*/ ctx[2];
				let i;

				for (i = 0; i < each_value.length; i += 1) {
					const child_ctx = get_each_context(ctx, each_value, i);

					if (each_blocks[i]) {
						each_blocks[i].p(child_ctx, dirty);
					} else {
						each_blocks[i] = create_each_block(child_ctx);
						each_blocks[i].c();
						each_blocks[i].m(div1, null);
					}
				}

				for (; i < each_blocks.length; i += 1) {
					each_blocks[i].d(1);
				}

				each_blocks.length = each_value.length;
			}
		},
		i: noop,
		o: noop,
		d(detaching) {
			if (detaching) detach(section);
			destroy_each(each_blocks, detaching);
			/*section_binding*/ ctx[5](null);
		}
	};
}

function instance($$self, $$props, $$invalidate) {
	let { props } = $$props;
	let { heading } = $$props;
	let { note } = $$props;
	let { topics } = $$props;
	let sectionElement;

	onMount(() => {
		const element = sectionElement;
		if (!element) return;
		element.classList.add("is-ready");
		const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

		if (reducedMotion || !("IntersectionObserver" in window)) {
			element.classList.add("is-visible");
			return;
		}

		const observer = new IntersectionObserver(([entry]) => {
				if (entry.isIntersecting) {
					element.classList.add("is-visible");
					observer.disconnect();
				}
			},
		{ threshold: 0.12 });

		const animationFrame = requestAnimationFrame(() => {
			observer.observe(element);
		});

		return () => {
			cancelAnimationFrame(animationFrame);
			observer.disconnect();
		};
	});

	function section_binding($$value) {
		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
			sectionElement = $$value;
			$$invalidate(3, sectionElement);
		});
	}

	$$self.$$set = $$props => {
		if ('props' in $$props) $$invalidate(4, props = $$props.props);
		if ('heading' in $$props) $$invalidate(0, heading = $$props.heading);
		if ('note' in $$props) $$invalidate(1, note = $$props.note);
		if ('topics' in $$props) $$invalidate(2, topics = $$props.topics);
	};

	return [heading, note, topics, sectionElement, props, section_binding];
}

class Component extends SvelteComponent {
	constructor(options) {
		super();
		init(this, options, instance, create_fragment, safe_not_equal, { props: 4, heading: 0, note: 1, topics: 2 });
	}
}

export { Component as default };

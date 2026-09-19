// google referenzen - Updated September 19, 2026
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
function listen(node, event, handler, options) {
    node.addEventListener(event, handler, options);
    return () => node.removeEventListener(event, handler, options);
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
	child_ctx[13] = list[i];
	return child_ctx;
}

// (399:6) {#if eyebrow}
function create_if_block_6(ctx) {
	let p;
	let t;

	return {
		c() {
			p = element("p");
			t = text(/*eyebrow*/ ctx[1]);
			this.h();
		},
		l(nodes) {
			p = claim_element(nodes, "P", { class: true });
			var p_nodes = children(p);
			t = claim_text(p_nodes, /*eyebrow*/ ctx[1]);
			p_nodes.forEach(detach);
			this.h();
		},
		h() {
			attr(p, "class", "cg-references__eyebrow svelte-nsgk4n");
		},
		m(target, anchor) {
			insert_hydration(target, p, anchor);
			append_hydration(p, t);
		},
		p(ctx, dirty) {
			if (dirty & /*eyebrow*/ 2) set_data(t, /*eyebrow*/ ctx[1]);
		},
		d(detaching) {
			if (detaching) detach(p);
		}
	};
}

// (405:6) {#if heading}
function create_if_block_5(ctx) {
	let h2;
	let t;

	return {
		c() {
			h2 = element("h2");
			t = text(/*heading*/ ctx[2]);
			this.h();
		},
		l(nodes) {
			h2 = claim_element(nodes, "H2", { id: true, class: true });
			var h2_nodes = children(h2);
			t = claim_text(h2_nodes, /*heading*/ ctx[2]);
			h2_nodes.forEach(detach);
			this.h();
		},
		h() {
			attr(h2, "id", "cg-references-heading");
			attr(h2, "class", "svelte-nsgk4n");
		},
		m(target, anchor) {
			insert_hydration(target, h2, anchor);
			append_hydration(h2, t);
		},
		p(ctx, dirty) {
			if (dirty & /*heading*/ 4) set_data(t, /*heading*/ ctx[2]);
		},
		d(detaching) {
			if (detaching) detach(h2);
		}
	};
}

// (411:6) {#if intro}
function create_if_block_4(ctx) {
	let p;
	let t;

	return {
		c() {
			p = element("p");
			t = text(/*intro*/ ctx[0]);
			this.h();
		},
		l(nodes) {
			p = claim_element(nodes, "P", { class: true });
			var p_nodes = children(p);
			t = claim_text(p_nodes, /*intro*/ ctx[0]);
			p_nodes.forEach(detach);
			this.h();
		},
		h() {
			attr(p, "class", "cg-references__intro svelte-nsgk4n");
		},
		m(target, anchor) {
			insert_hydration(target, p, anchor);
			append_hydration(p, t);
		},
		p(ctx, dirty) {
			if (dirty & /*intro*/ 1) set_data(t, /*intro*/ ctx[0]);
		},
		d(detaching) {
			if (detaching) detach(p);
		}
	};
}

// (418:4) {#if references && references.length > 0}
function create_if_block(ctx) {
	let div1;
	let t0;
	let div0;
	let t1;
	let mounted;
	let dispose;
	let if_block0 = /*references*/ ctx[3].length > 1 && create_if_block_3(ctx);
	let each_value = /*references*/ ctx[3];
	let each_blocks = [];

	for (let i = 0; i < each_value.length; i += 1) {
		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
	}

	let if_block1 = /*references*/ ctx[3].length > 1 && create_if_block_1(ctx);

	return {
		c() {
			div1 = element("div");
			if (if_block0) if_block0.c();
			t0 = space();
			div0 = element("div");

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].c();
			}

			t1 = space();
			if (if_block1) if_block1.c();
			this.h();
		},
		l(nodes) {
			div1 = claim_element(nodes, "DIV", { class: true });
			var div1_nodes = children(div1);
			if (if_block0) if_block0.l(div1_nodes);
			t0 = claim_space(div1_nodes);
			div0 = claim_element(div1_nodes, "DIV", { class: true });
			var div0_nodes = children(div0);

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].l(div0_nodes);
			}

			div0_nodes.forEach(detach);
			t1 = claim_space(div1_nodes);
			if (if_block1) if_block1.l(div1_nodes);
			div1_nodes.forEach(detach);
			this.h();
		},
		h() {
			attr(div0, "class", "cg-references__viewport svelte-nsgk4n");
			attr(div1, "class", "cg-references__slider svelte-nsgk4n");
		},
		m(target, anchor) {
			insert_hydration(target, div1, anchor);
			if (if_block0) if_block0.m(div1, null);
			append_hydration(div1, t0);
			append_hydration(div1, div0);

			for (let i = 0; i < each_blocks.length; i += 1) {
				if (each_blocks[i]) {
					each_blocks[i].m(div0, null);
				}
			}

			/*div0_binding*/ ctx[11](div0);
			append_hydration(div1, t1);
			if (if_block1) if_block1.m(div1, null);

			if (!mounted) {
				dispose = listen(div0, "scroll", /*updateScrollState*/ ctx[7]);
				mounted = true;
			}
		},
		p(ctx, dirty) {
			if (/*references*/ ctx[3].length > 1) {
				if (if_block0) {
					if_block0.p(ctx, dirty);
				} else {
					if_block0 = create_if_block_3(ctx);
					if_block0.c();
					if_block0.m(div1, t0);
				}
			} else if (if_block0) {
				if_block0.d(1);
				if_block0 = null;
			}

			if (dirty & /*references*/ 8) {
				each_value = /*references*/ ctx[3];
				let i;

				for (i = 0; i < each_value.length; i += 1) {
					const child_ctx = get_each_context(ctx, each_value, i);

					if (each_blocks[i]) {
						each_blocks[i].p(child_ctx, dirty);
					} else {
						each_blocks[i] = create_each_block(child_ctx);
						each_blocks[i].c();
						each_blocks[i].m(div0, null);
					}
				}

				for (; i < each_blocks.length; i += 1) {
					each_blocks[i].d(1);
				}

				each_blocks.length = each_value.length;
			}

			if (/*references*/ ctx[3].length > 1) {
				if (if_block1) {
					if_block1.p(ctx, dirty);
				} else {
					if_block1 = create_if_block_1(ctx);
					if_block1.c();
					if_block1.m(div1, null);
				}
			} else if (if_block1) {
				if_block1.d(1);
				if_block1 = null;
			}
		},
		d(detaching) {
			if (detaching) detach(div1);
			if (if_block0) if_block0.d();
			destroy_each(each_blocks, detaching);
			/*div0_binding*/ ctx[11](null);
			if (if_block1) if_block1.d();
			mounted = false;
			dispose();
		}
	};
}

// (420:8) {#if references.length > 1}
function create_if_block_3(ctx) {
	let button;
	let svg;
	let path;
	let button_disabled_value;
	let mounted;
	let dispose;

	return {
		c() {
			button = element("button");
			svg = svg_element("svg");
			path = svg_element("path");
			this.h();
		},
		l(nodes) {
			button = claim_element(nodes, "BUTTON", {
				type: true,
				class: true,
				"aria-label": true
			});

			var button_nodes = children(button);

			svg = claim_svg_element(button_nodes, "svg", {
				viewBox: true,
				"aria-hidden": true,
				class: true
			});

			var svg_nodes = children(svg);
			path = claim_svg_element(svg_nodes, "path", { d: true, class: true });
			children(path).forEach(detach);
			svg_nodes.forEach(detach);
			button_nodes.forEach(detach);
			this.h();
		},
		h() {
			attr(path, "d", "m15 18-6-6 6-6");
			attr(path, "class", "svelte-nsgk4n");
			attr(svg, "viewBox", "0 0 24 24");
			attr(svg, "aria-hidden", "true");
			attr(svg, "class", "svelte-nsgk4n");
			attr(button, "type", "button");
			attr(button, "class", "cg-references__arrow cg-references__arrow--previous svelte-nsgk4n");
			attr(button, "aria-label", "Vorherige Kundenstimme");
			button.disabled = button_disabled_value = !/*canScrollPrevious*/ ctx[5];
		},
		m(target, anchor) {
			insert_hydration(target, button, anchor);
			append_hydration(button, svg);
			append_hydration(svg, path);

			if (!mounted) {
				dispose = listen(button, "click", /*click_handler*/ ctx[10]);
				mounted = true;
			}
		},
		p(ctx, dirty) {
			if (dirty & /*canScrollPrevious*/ 32 && button_disabled_value !== (button_disabled_value = !/*canScrollPrevious*/ ctx[5])) {
				button.disabled = button_disabled_value;
			}
		},
		d(detaching) {
			if (detaching) detach(button);
			mounted = false;
			dispose();
		}
	};
}

// (462:16) {#if reference.context}
function create_if_block_2(ctx) {
	let span;
	let t_value = /*reference*/ ctx[13].context + "";
	let t;

	return {
		c() {
			span = element("span");
			t = text(t_value);
			this.h();
		},
		l(nodes) {
			span = claim_element(nodes, "SPAN", { class: true });
			var span_nodes = children(span);
			t = claim_text(span_nodes, t_value);
			span_nodes.forEach(detach);
			this.h();
		},
		h() {
			attr(span, "class", "svelte-nsgk4n");
		},
		m(target, anchor) {
			insert_hydration(target, span, anchor);
			append_hydration(span, t);
		},
		p(ctx, dirty) {
			if (dirty & /*references*/ 8 && t_value !== (t_value = /*reference*/ ctx[13].context + "")) set_data(t, t_value);
		},
		d(detaching) {
			if (detaching) detach(span);
		}
	};
}

// (439:10) {#each references as reference}
function create_each_block(ctx) {
	let article;
	let div0;
	let t0;
	let t1;
	let blockquote;
	let p;
	let t2_value = /*reference*/ ctx[13].quote + "";
	let t2;
	let t3;
	let div1;
	let span;
	let t4;
	let t5;
	let footer;
	let strong;
	let t6_value = /*reference*/ ctx[13].name + "";
	let t6;
	let t7;
	let t8;
	let if_block = /*reference*/ ctx[13].context && create_if_block_2(ctx);

	return {
		c() {
			article = element("article");
			div0 = element("div");
			t0 = text("“");
			t1 = space();
			blockquote = element("blockquote");
			p = element("p");
			t2 = text(t2_value);
			t3 = space();
			div1 = element("div");
			span = element("span");
			t4 = text("★★★★★");
			t5 = space();
			footer = element("footer");
			strong = element("strong");
			t6 = text(t6_value);
			t7 = space();
			if (if_block) if_block.c();
			t8 = space();
			this.h();
		},
		l(nodes) {
			article = claim_element(nodes, "ARTICLE", { class: true });
			var article_nodes = children(article);
			div0 = claim_element(article_nodes, "DIV", { class: true, "aria-hidden": true });
			var div0_nodes = children(div0);
			t0 = claim_text(div0_nodes, "“");
			div0_nodes.forEach(detach);
			t1 = claim_space(article_nodes);
			blockquote = claim_element(article_nodes, "BLOCKQUOTE", { class: true });
			var blockquote_nodes = children(blockquote);
			p = claim_element(blockquote_nodes, "P", { class: true });
			var p_nodes = children(p);
			t2 = claim_text(p_nodes, t2_value);
			p_nodes.forEach(detach);
			blockquote_nodes.forEach(detach);
			t3 = claim_space(article_nodes);
			div1 = claim_element(article_nodes, "DIV", { class: true, "aria-label": true });
			var div1_nodes = children(div1);
			span = claim_element(div1_nodes, "SPAN", { "aria-hidden": true, class: true });
			var span_nodes = children(span);
			t4 = claim_text(span_nodes, "★★★★★");
			span_nodes.forEach(detach);
			div1_nodes.forEach(detach);
			t5 = claim_space(article_nodes);
			footer = claim_element(article_nodes, "FOOTER", { class: true });
			var footer_nodes = children(footer);
			strong = claim_element(footer_nodes, "STRONG", { class: true });
			var strong_nodes = children(strong);
			t6 = claim_text(strong_nodes, t6_value);
			strong_nodes.forEach(detach);
			t7 = claim_space(footer_nodes);
			if (if_block) if_block.l(footer_nodes);
			footer_nodes.forEach(detach);
			t8 = claim_space(article_nodes);
			article_nodes.forEach(detach);
			this.h();
		},
		h() {
			attr(div0, "class", "cg-references__quote-mark svelte-nsgk4n");
			attr(div0, "aria-hidden", "true");
			attr(p, "class", "svelte-nsgk4n");
			attr(blockquote, "class", "svelte-nsgk4n");
			attr(span, "aria-hidden", "true");
			attr(span, "class", "svelte-nsgk4n");
			attr(div1, "class", "cg-references__stars svelte-nsgk4n");
			attr(div1, "aria-label", "5 von 5 Sternen");
			attr(strong, "class", "svelte-nsgk4n");
			attr(footer, "class", "cg-references__person svelte-nsgk4n");
			attr(article, "class", "cg-references__card svelte-nsgk4n");
		},
		m(target, anchor) {
			insert_hydration(target, article, anchor);
			append_hydration(article, div0);
			append_hydration(div0, t0);
			append_hydration(article, t1);
			append_hydration(article, blockquote);
			append_hydration(blockquote, p);
			append_hydration(p, t2);
			append_hydration(article, t3);
			append_hydration(article, div1);
			append_hydration(div1, span);
			append_hydration(span, t4);
			append_hydration(article, t5);
			append_hydration(article, footer);
			append_hydration(footer, strong);
			append_hydration(strong, t6);
			append_hydration(footer, t7);
			if (if_block) if_block.m(footer, null);
			append_hydration(article, t8);
		},
		p(ctx, dirty) {
			if (dirty & /*references*/ 8 && t2_value !== (t2_value = /*reference*/ ctx[13].quote + "")) set_data(t2, t2_value);
			if (dirty & /*references*/ 8 && t6_value !== (t6_value = /*reference*/ ctx[13].name + "")) set_data(t6, t6_value);

			if (/*reference*/ ctx[13].context) {
				if (if_block) {
					if_block.p(ctx, dirty);
				} else {
					if_block = create_if_block_2(ctx);
					if_block.c();
					if_block.m(footer, null);
				}
			} else if (if_block) {
				if_block.d(1);
				if_block = null;
			}
		},
		d(detaching) {
			if (detaching) detach(article);
			if (if_block) if_block.d();
		}
	};
}

// (470:8) {#if references.length > 1}
function create_if_block_1(ctx) {
	let button;
	let svg;
	let path;
	let button_disabled_value;
	let mounted;
	let dispose;

	return {
		c() {
			button = element("button");
			svg = svg_element("svg");
			path = svg_element("path");
			this.h();
		},
		l(nodes) {
			button = claim_element(nodes, "BUTTON", {
				type: true,
				class: true,
				"aria-label": true
			});

			var button_nodes = children(button);

			svg = claim_svg_element(button_nodes, "svg", {
				viewBox: true,
				"aria-hidden": true,
				class: true
			});

			var svg_nodes = children(svg);
			path = claim_svg_element(svg_nodes, "path", { d: true, class: true });
			children(path).forEach(detach);
			svg_nodes.forEach(detach);
			button_nodes.forEach(detach);
			this.h();
		},
		h() {
			attr(path, "d", "m9 18 6-6-6-6");
			attr(path, "class", "svelte-nsgk4n");
			attr(svg, "viewBox", "0 0 24 24");
			attr(svg, "aria-hidden", "true");
			attr(svg, "class", "svelte-nsgk4n");
			attr(button, "type", "button");
			attr(button, "class", "cg-references__arrow cg-references__arrow--next svelte-nsgk4n");
			attr(button, "aria-label", "Nächste Kundenstimme");
			button.disabled = button_disabled_value = !/*canScrollNext*/ ctx[6];
		},
		m(target, anchor) {
			insert_hydration(target, button, anchor);
			append_hydration(button, svg);
			append_hydration(svg, path);

			if (!mounted) {
				dispose = listen(button, "click", /*click_handler_1*/ ctx[12]);
				mounted = true;
			}
		},
		p(ctx, dirty) {
			if (dirty & /*canScrollNext*/ 64 && button_disabled_value !== (button_disabled_value = !/*canScrollNext*/ ctx[6])) {
				button.disabled = button_disabled_value;
			}
		},
		d(detaching) {
			if (detaching) detach(button);
			mounted = false;
			dispose();
		}
	};
}

function create_fragment(ctx) {
	let section;
	let div;
	let header;
	let t0;
	let t1;
	let t2;
	let if_block0 = /*eyebrow*/ ctx[1] && create_if_block_6(ctx);
	let if_block1 = /*heading*/ ctx[2] && create_if_block_5(ctx);
	let if_block2 = /*intro*/ ctx[0] && create_if_block_4(ctx);
	let if_block3 = /*references*/ ctx[3] && /*references*/ ctx[3].length > 0 && create_if_block(ctx);

	return {
		c() {
			section = element("section");
			div = element("div");
			header = element("header");
			if (if_block0) if_block0.c();
			t0 = space();
			if (if_block1) if_block1.c();
			t1 = space();
			if (if_block2) if_block2.c();
			t2 = space();
			if (if_block3) if_block3.c();
			this.h();
		},
		l(nodes) {
			section = claim_element(nodes, "SECTION", { class: true, "aria-labelledby": true });
			var section_nodes = children(section);
			div = claim_element(section_nodes, "DIV", { class: true });
			var div_nodes = children(div);
			header = claim_element(div_nodes, "HEADER", { class: true });
			var header_nodes = children(header);
			if (if_block0) if_block0.l(header_nodes);
			t0 = claim_space(header_nodes);
			if (if_block1) if_block1.l(header_nodes);
			t1 = claim_space(header_nodes);
			if (if_block2) if_block2.l(header_nodes);
			header_nodes.forEach(detach);
			t2 = claim_space(div_nodes);
			if (if_block3) if_block3.l(div_nodes);
			div_nodes.forEach(detach);
			section_nodes.forEach(detach);
			this.h();
		},
		h() {
			attr(header, "class", "cg-references__header svelte-nsgk4n");
			attr(div, "class", "cg-references__container svelte-nsgk4n");
			attr(section, "class", "cg-references svelte-nsgk4n");
			attr(section, "aria-labelledby", "cg-references-heading");
		},
		m(target, anchor) {
			insert_hydration(target, section, anchor);
			append_hydration(section, div);
			append_hydration(div, header);
			if (if_block0) if_block0.m(header, null);
			append_hydration(header, t0);
			if (if_block1) if_block1.m(header, null);
			append_hydration(header, t1);
			if (if_block2) if_block2.m(header, null);
			append_hydration(div, t2);
			if (if_block3) if_block3.m(div, null);
		},
		p(ctx, [dirty]) {
			if (/*eyebrow*/ ctx[1]) {
				if (if_block0) {
					if_block0.p(ctx, dirty);
				} else {
					if_block0 = create_if_block_6(ctx);
					if_block0.c();
					if_block0.m(header, t0);
				}
			} else if (if_block0) {
				if_block0.d(1);
				if_block0 = null;
			}

			if (/*heading*/ ctx[2]) {
				if (if_block1) {
					if_block1.p(ctx, dirty);
				} else {
					if_block1 = create_if_block_5(ctx);
					if_block1.c();
					if_block1.m(header, t1);
				}
			} else if (if_block1) {
				if_block1.d(1);
				if_block1 = null;
			}

			if (/*intro*/ ctx[0]) {
				if (if_block2) {
					if_block2.p(ctx, dirty);
				} else {
					if_block2 = create_if_block_4(ctx);
					if_block2.c();
					if_block2.m(header, null);
				}
			} else if (if_block2) {
				if_block2.d(1);
				if_block2 = null;
			}

			if (/*references*/ ctx[3] && /*references*/ ctx[3].length > 0) {
				if (if_block3) {
					if_block3.p(ctx, dirty);
				} else {
					if_block3 = create_if_block(ctx);
					if_block3.c();
					if_block3.m(div, null);
				}
			} else if (if_block3) {
				if_block3.d(1);
				if_block3 = null;
			}
		},
		i: noop,
		o: noop,
		d(detaching) {
			if (detaching) detach(section);
			if (if_block0) if_block0.d();
			if (if_block1) if_block1.d();
			if (if_block2) if_block2.d();
			if (if_block3) if_block3.d();
		}
	};
}

function instance($$self, $$props, $$invalidate) {
	let { props } = $$props;
	let { intro } = $$props;
	let { eyebrow } = $$props;
	let { heading } = $$props;
	let { references } = $$props;
	let referenceViewport;
	let canScrollPrevious = false;
	let canScrollNext = false;

	function updateScrollState() {
		if (!referenceViewport) return;
		const maximumScroll = referenceViewport.scrollWidth - referenceViewport.clientWidth;
		$$invalidate(5, canScrollPrevious = referenceViewport.scrollLeft > 4);
		$$invalidate(6, canScrollNext = referenceViewport.scrollLeft < maximumScroll - 4);
	}

	function moveReferences(direction) {
		if (!referenceViewport) return;
		const firstCard = referenceViewport.querySelector(".cg-references__card");
		const cardWidth = firstCard?.getBoundingClientRect().width || referenceViewport.clientWidth;
		const styles = getComputedStyle(referenceViewport);
		const gap = parseFloat(styles.gap) || 0;

		referenceViewport.scrollBy({
			left: direction * (cardWidth + gap),
			behavior: "smooth"
		});
	}

	onMount(() => {
		updateScrollState();
		window.addEventListener("resize", updateScrollState);
		requestAnimationFrame(updateScrollState);

		return () => {
			window.removeEventListener("resize", updateScrollState);
		};
	});

	const click_handler = () => moveReferences(-1);

	function div0_binding($$value) {
		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
			referenceViewport = $$value;
			$$invalidate(4, referenceViewport);
		});
	}

	const click_handler_1 = () => moveReferences(1);

	$$self.$$set = $$props => {
		if ('props' in $$props) $$invalidate(9, props = $$props.props);
		if ('intro' in $$props) $$invalidate(0, intro = $$props.intro);
		if ('eyebrow' in $$props) $$invalidate(1, eyebrow = $$props.eyebrow);
		if ('heading' in $$props) $$invalidate(2, heading = $$props.heading);
		if ('references' in $$props) $$invalidate(3, references = $$props.references);
	};

	return [
		intro,
		eyebrow,
		heading,
		references,
		referenceViewport,
		canScrollPrevious,
		canScrollNext,
		updateScrollState,
		moveReferences,
		props,
		click_handler,
		div0_binding,
		click_handler_1
	];
}

class Component extends SvelteComponent {
	constructor(options) {
		super();

		init(this, options, instance, create_fragment, safe_not_equal, {
			props: 9,
			intro: 0,
			eyebrow: 1,
			heading: 2,
			references: 3
		});
	}
}

export { Component as default };

// Site Navigation Homepage - Updated June 9, 2026
function noop() { }
function assign(tar, src) {
    // @ts-ignore
    for (const k in src)
        tar[k] = src[k];
    return tar;
}
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
let src_url_equal_anchor;
function src_url_equal(element_src, url) {
    if (!src_url_equal_anchor) {
        src_url_equal_anchor = document.createElement('a');
    }
    src_url_equal_anchor.href = url;
    return element_src === src_url_equal_anchor.href;
}
function is_empty(obj) {
    return Object.keys(obj).length === 0;
}
function create_slot(definition, ctx, $$scope, fn) {
    if (definition) {
        const slot_ctx = get_slot_context(definition, ctx, $$scope, fn);
        return definition[0](slot_ctx);
    }
}
function get_slot_context(definition, ctx, $$scope, fn) {
    return definition[1] && fn
        ? assign($$scope.ctx.slice(), definition[1](fn(ctx)))
        : $$scope.ctx;
}
function get_slot_changes(definition, $$scope, dirty, fn) {
    if (definition[2] && fn) {
        const lets = definition[2](fn(dirty));
        if ($$scope.dirty === undefined) {
            return lets;
        }
        if (typeof lets === 'object') {
            const merged = [];
            const len = Math.max($$scope.dirty.length, lets.length);
            for (let i = 0; i < len; i += 1) {
                merged[i] = $$scope.dirty[i] | lets[i];
            }
            return merged;
        }
        return $$scope.dirty | lets;
    }
    return $$scope.dirty;
}
function update_slot_base(slot, slot_definition, ctx, $$scope, slot_changes, get_slot_context_fn) {
    if (slot_changes) {
        const slot_context = get_slot_context(slot_definition, ctx, $$scope, get_slot_context_fn);
        slot.p(slot_context, slot_changes);
    }
}
function get_all_dirty_from_scope($$scope) {
    if ($$scope.ctx.length > 32) {
        const dirty = [];
        const length = $$scope.ctx.length / 32;
        for (let i = 0; i < length; i++) {
            dirty[i] = -1;
        }
        return dirty;
    }
    return -1;
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
function element(name) {
    return document.createElement(name);
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
function toggle_class(element, name, toggle) {
    element.classList[toggle ? 'add' : 'remove'](name);
}

let current_component;
function set_current_component(component) {
    current_component = component;
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
let outros;
function transition_in(block, local) {
    if (block && block.i) {
        outroing.delete(block);
        block.i(local);
    }
}
function transition_out(block, local, detach, callback) {
    if (block && block.o) {
        if (outroing.has(block))
            return;
        outroing.add(block);
        outros.c.push(() => {
            outroing.delete(block);
            if (callback) {
                if (detach)
                    block.d(1);
                callback();
            }
        });
        block.o(local);
    }
    else if (callback) {
        callback();
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

function create_if_block_4(ctx) {
	let img;
	let img_src_value;

	return {
		c() {
			img = element("img");
			this.h();
		},
		l(nodes) {
			img = claim_element(nodes, "IMG", { src: true, class: true, alt: true });
			this.h();
		},
		h() {
			if (!src_url_equal(img.src, img_src_value = /*logo*/ ctx[0].image.url)) attr(img, "src", img_src_value);
			attr(img, "class", "intro-icon svelte-10nr4zk");
			attr(img, "alt", "Logo");
		},
		m(target, anchor) {
			insert_hydration(target, img, anchor);
		},
		p(ctx, dirty) {
			if (dirty & /*logo*/ 1 && !src_url_equal(img.src, img_src_value = /*logo*/ ctx[0].image.url)) {
				attr(img, "src", img_src_value);
			}
		},
		d(detaching) {
			if (detaching) detach(img);
		}
	};
}

// (453:10) {#if unternehmensOpen}
function create_if_block_3(ctx) {
	let div1;
	let a0;
	let t0;
	let t1;
	let div0;
	let t2;
	let a1;
	let t3;
	let t4;
	let a2;
	let t5;
	let t6;
	let a3;
	let t7;
	let t8;
	let a4;
	let t9;
	let t10;
	let a5;
	let t11;

	return {
		c() {
			div1 = element("div");
			a0 = element("a");
			t0 = text("Alle Leistungen →");
			t1 = space();
			div0 = element("div");
			t2 = space();
			a1 = element("a");
			t3 = text("Marketing-Analysen");
			t4 = space();
			a2 = element("a");
			t5 = text("Prozessoptimierung");
			t6 = space();
			a3 = element("a");
			t7 = text("Erkenntnisse aus Umfragen");
			t8 = space();
			a4 = element("a");
			t9 = text("Reporting");
			t10 = space();
			a5 = element("a");
			t11 = text("Forecasts & Prognosen");
			this.h();
		},
		l(nodes) {
			div1 = claim_element(nodes, "DIV", { class: true });
			var div1_nodes = children(div1);
			a0 = claim_element(div1_nodes, "A", { href: true, class: true });
			var a0_nodes = children(a0);
			t0 = claim_text(a0_nodes, "Alle Leistungen →");
			a0_nodes.forEach(detach);
			t1 = claim_space(div1_nodes);
			div0 = claim_element(div1_nodes, "DIV", { class: true });
			children(div0).forEach(detach);
			t2 = claim_space(div1_nodes);
			a1 = claim_element(div1_nodes, "A", { href: true, class: true });
			var a1_nodes = children(a1);
			t3 = claim_text(a1_nodes, "Marketing-Analysen");
			a1_nodes.forEach(detach);
			t4 = claim_space(div1_nodes);
			a2 = claim_element(div1_nodes, "A", { href: true, class: true });
			var a2_nodes = children(a2);
			t5 = claim_text(a2_nodes, "Prozessoptimierung");
			a2_nodes.forEach(detach);
			t6 = claim_space(div1_nodes);
			a3 = claim_element(div1_nodes, "A", { href: true, class: true });
			var a3_nodes = children(a3);
			t7 = claim_text(a3_nodes, "Erkenntnisse aus Umfragen");
			a3_nodes.forEach(detach);
			t8 = claim_space(div1_nodes);
			a4 = claim_element(div1_nodes, "A", { href: true, class: true });
			var a4_nodes = children(a4);
			t9 = claim_text(a4_nodes, "Reporting");
			a4_nodes.forEach(detach);
			t10 = claim_space(div1_nodes);
			a5 = claim_element(div1_nodes, "A", { href: true, class: true });
			var a5_nodes = children(a5);
			t11 = claim_text(a5_nodes, "Forecasts & Prognosen");
			a5_nodes.forEach(detach);
			div1_nodes.forEach(detach);
			this.h();
		},
		h() {
			attr(a0, "href", "/statistische-beratung-fuer-unternehmen");
			attr(a0, "class", "dropdown-item dropdown-overview svelte-10nr4zk");
			attr(div0, "class", "dropdown-divider svelte-10nr4zk");
			attr(a1, "href", "/statistische-beratung-fuer-unternehmen/marketing-optimieren");
			attr(a1, "class", "dropdown-item svelte-10nr4zk");
			attr(a2, "href", "/statistische-beratung-fuer-unternehmen/prozesse-optimieren");
			attr(a2, "class", "dropdown-item svelte-10nr4zk");
			attr(a3, "href", "/statistische-beratung-fuer-unternehmen/erkenntnisse-aus-umfragen");
			attr(a3, "class", "dropdown-item svelte-10nr4zk");
			attr(a4, "href", "/statistische-beratung-fuer-unternehmen/reporting");
			attr(a4, "class", "dropdown-item svelte-10nr4zk");
			attr(a5, "href", "/statistische-beratung-fuer-unternehmen/forecasts-und-prognosen");
			attr(a5, "class", "dropdown-item svelte-10nr4zk");
			attr(div1, "class", "dropdown-panel svelte-10nr4zk");
		},
		m(target, anchor) {
			insert_hydration(target, div1, anchor);
			append_hydration(div1, a0);
			append_hydration(a0, t0);
			append_hydration(div1, t1);
			append_hydration(div1, div0);
			append_hydration(div1, t2);
			append_hydration(div1, a1);
			append_hydration(a1, t3);
			append_hydration(div1, t4);
			append_hydration(div1, a2);
			append_hydration(a2, t5);
			append_hydration(div1, t6);
			append_hydration(div1, a3);
			append_hydration(a3, t7);
			append_hydration(div1, t8);
			append_hydration(div1, a4);
			append_hydration(a4, t9);
			append_hydration(div1, t10);
			append_hydration(div1, a5);
			append_hydration(a5, t11);
		},
		d(detaching) {
			if (detaching) detach(div1);
		}
	};
}

// (471:6) {#if logo.image && logo.image.url}
function create_if_block_2(ctx) {
	let a;
	let img;
	let img_src_value;

	return {
		c() {
			a = element("a");
			img = element("img");
			this.h();
		},
		l(nodes) {
			a = claim_element(nodes, "A", { href: true, class: true });
			var a_nodes = children(a);
			img = claim_element(a_nodes, "IMG", { src: true, class: true, alt: true });
			a_nodes.forEach(detach);
			this.h();
		},
		h() {
			if (!src_url_equal(img.src, img_src_value = /*logo*/ ctx[0].image.url)) attr(img, "src", img_src_value);
			attr(img, "class", "nav-icon svelte-10nr4zk");
			attr(img, "alt", "Logo");
			toggle_class(img, "active", /*introDone*/ ctx[2]);
			attr(a, "href", "/");
			attr(a, "class", "svelte-10nr4zk");
		},
		m(target, anchor) {
			insert_hydration(target, a, anchor);
			append_hydration(a, img);
		},
		p(ctx, dirty) {
			if (dirty & /*logo*/ 1 && !src_url_equal(img.src, img_src_value = /*logo*/ ctx[0].image.url)) {
				attr(img, "src", img_src_value);
			}

			if (dirty & /*introDone*/ 4) {
				toggle_class(img, "active", /*introDone*/ ctx[2]);
			}
		},
		d(detaching) {
			if (detaching) detach(a);
		}
	};
}

// (490:8) {#if studierendeOpen}
function create_if_block_1(ctx) {
	let div1;
	let a0;
	let t0;
	let t1;
	let div0;
	let t2;
	let a1;
	let t3;
	let t4;
	let a2;
	let t5;
	let t6;
	let a3;
	let t7;

	return {
		c() {
			div1 = element("div");
			a0 = element("a");
			t0 = text("Alle Leistungen →");
			t1 = space();
			div0 = element("div");
			t2 = space();
			a1 = element("a");
			t3 = text("Statistik / Mathematik");
			t4 = space();
			a2 = element("a");
			t5 = text("Statistische Auswertung");
			t6 = space();
			a3 = element("a");
			t7 = text("Datenanalyse");
			this.h();
		},
		l(nodes) {
			div1 = claim_element(nodes, "DIV", { class: true });
			var div1_nodes = children(div1);
			a0 = claim_element(div1_nodes, "A", { href: true, class: true });
			var a0_nodes = children(a0);
			t0 = claim_text(a0_nodes, "Alle Leistungen →");
			a0_nodes.forEach(detach);
			t1 = claim_space(div1_nodes);
			div0 = claim_element(div1_nodes, "DIV", { class: true });
			children(div0).forEach(detach);
			t2 = claim_space(div1_nodes);
			a1 = claim_element(div1_nodes, "A", { href: true, class: true });
			var a1_nodes = children(a1);
			t3 = claim_text(a1_nodes, "Statistik / Mathematik");
			a1_nodes.forEach(detach);
			t4 = claim_space(div1_nodes);
			a2 = claim_element(div1_nodes, "A", { href: true, class: true });
			var a2_nodes = children(a2);
			t5 = claim_text(a2_nodes, "Statistische Auswertung");
			a2_nodes.forEach(detach);
			t6 = claim_space(div1_nodes);
			a3 = claim_element(div1_nodes, "A", { href: true, class: true });
			var a3_nodes = children(a3);
			t7 = claim_text(a3_nodes, "Datenanalyse");
			a3_nodes.forEach(detach);
			div1_nodes.forEach(detach);
			this.h();
		},
		h() {
			attr(a0, "href", "/statistik-beratung-fuer-studierende");
			attr(a0, "class", "dropdown-item dropdown-overview svelte-10nr4zk");
			attr(div0, "class", "dropdown-divider svelte-10nr4zk");
			attr(a1, "href", "/statistik_mathematik");
			attr(a1, "class", "dropdown-item svelte-10nr4zk");
			attr(a2, "href", "/statistische-auswertung");
			attr(a2, "class", "dropdown-item svelte-10nr4zk");
			attr(a3, "href", "/datenanalyse");
			attr(a3, "class", "dropdown-item svelte-10nr4zk");
			attr(div1, "class", "dropdown-panel svelte-10nr4zk");
		},
		m(target, anchor) {
			insert_hydration(target, div1, anchor);
			append_hydration(div1, a0);
			append_hydration(a0, t0);
			append_hydration(div1, t1);
			append_hydration(div1, div0);
			append_hydration(div1, t2);
			append_hydration(div1, a1);
			append_hydration(a1, t3);
			append_hydration(div1, t4);
			append_hydration(div1, a2);
			append_hydration(a2, t5);
			append_hydration(div1, t6);
			append_hydration(div1, a3);
			append_hydration(a3, t7);
		},
		d(detaching) {
			if (detaching) detach(div1);
		}
	};
}

// (512:2) {#if menuOpen}
function create_if_block(ctx) {
	let div;
	let a0;
	let t0;
	let t1;
	let a1;
	let t2;
	let t3;
	let a2;
	let t4;
	let t5;
	let a3;
	let t6;
	let t7;
	let a4;
	let t8_value = /*primary_cta*/ ctx[1].label + "";
	let t8;
	let a4_href_value;
	let mounted;
	let dispose;

	return {
		c() {
			div = element("div");
			a0 = element("a");
			t0 = text("Für Unternehmen");
			t1 = space();
			a1 = element("a");
			t2 = text("Team");
			t3 = space();
			a2 = element("a");
			t4 = text("Kontakt");
			t5 = space();
			a3 = element("a");
			t6 = text("Für Studierende");
			t7 = space();
			a4 = element("a");
			t8 = text(t8_value);
			this.h();
		},
		l(nodes) {
			div = claim_element(nodes, "DIV", { class: true });
			var div_nodes = children(div);
			a0 = claim_element(div_nodes, "A", { class: true, href: true });
			var a0_nodes = children(a0);
			t0 = claim_text(a0_nodes, "Für Unternehmen");
			a0_nodes.forEach(detach);
			t1 = claim_space(div_nodes);
			a1 = claim_element(div_nodes, "A", { class: true, href: true });
			var a1_nodes = children(a1);
			t2 = claim_text(a1_nodes, "Team");
			a1_nodes.forEach(detach);
			t3 = claim_space(div_nodes);
			a2 = claim_element(div_nodes, "A", { class: true, href: true });
			var a2_nodes = children(a2);
			t4 = claim_text(a2_nodes, "Kontakt");
			a2_nodes.forEach(detach);
			t5 = claim_space(div_nodes);
			a3 = claim_element(div_nodes, "A", { class: true, href: true });
			var a3_nodes = children(a3);
			t6 = claim_text(a3_nodes, "Für Studierende");
			a3_nodes.forEach(detach);
			t7 = claim_space(div_nodes);
			a4 = claim_element(div_nodes, "A", { href: true, class: true });
			var a4_nodes = children(a4);
			t8 = claim_text(a4_nodes, t8_value);
			a4_nodes.forEach(detach);
			div_nodes.forEach(detach);
			this.h();
		},
		h() {
			attr(a0, "class", "mobile-link svelte-10nr4zk");
			attr(a0, "href", "/statistische-beratung-fuer-unternehmen");
			attr(a1, "class", "mobile-link svelte-10nr4zk");
			attr(a1, "href", "/team");
			attr(a2, "class", "mobile-link svelte-10nr4zk");
			attr(a2, "href", "/kontakt");
			attr(a3, "class", "mobile-link svelte-10nr4zk");
			attr(a3, "href", "/statistik-beratung-fuer-studierende");
			attr(a4, "href", a4_href_value = /*primary_cta*/ ctx[1].url);
			attr(a4, "class", "mobile-button svelte-10nr4zk");
			attr(div, "class", "mobile-menu svelte-10nr4zk");
		},
		m(target, anchor) {
			insert_hydration(target, div, anchor);
			append_hydration(div, a0);
			append_hydration(a0, t0);
			append_hydration(div, t1);
			append_hydration(div, a1);
			append_hydration(a1, t2);
			append_hydration(div, t3);
			append_hydration(div, a2);
			append_hydration(a2, t4);
			append_hydration(div, t5);
			append_hydration(div, a3);
			append_hydration(a3, t6);
			append_hydration(div, t7);
			append_hydration(div, a4);
			append_hydration(a4, t8);

			if (!mounted) {
				dispose = [
					listen(a0, "click", /*click_handler_1*/ ctx[18]),
					listen(a1, "click", /*click_handler_2*/ ctx[19]),
					listen(a2, "click", /*click_handler_3*/ ctx[20]),
					listen(a3, "click", /*click_handler_4*/ ctx[21]),
					listen(a4, "click", /*click_handler_5*/ ctx[22])
				];

				mounted = true;
			}
		},
		p(ctx, dirty) {
			if (dirty & /*primary_cta*/ 2 && t8_value !== (t8_value = /*primary_cta*/ ctx[1].label + "")) set_data(t8, t8_value);

			if (dirty & /*primary_cta*/ 2 && a4_href_value !== (a4_href_value = /*primary_cta*/ ctx[1].url)) {
				attr(a4, "href", a4_href_value);
			}
		},
		d(detaching) {
			if (detaching) detach(div);
			mounted = false;
			run_all(dispose);
		}
	};
}

function create_fragment(ctx) {
	let div1;
	let div0;
	let t0;
	let header;
	let div8;
	let div4;
	let a0;
	let img;
	let img_src_value;
	let t1;
	let div3;
	let div2;
	let a1;
	let t2;
	let span0;
	let t3;
	let t4;
	let t5;
	let a2;
	let t6;
	let t7;
	let div5;
	let t8;
	let div7;
	let a3;
	let t9;
	let t10;
	let div6;
	let a4;
	let t11;
	let span1;
	let t12;
	let t13;
	let t14;
	let a5;
	let t15_value = /*primary_cta*/ ctx[1].label + "";
	let t15;
	let a5_href_value;
	let t16;
	let button;
	let span2;
	let t17;
	let span3;
	let t18;
	let span4;
	let t19;
	let t20;
	let div9;
	let current;
	let mounted;
	let dispose;
	let if_block0 = /*logo*/ ctx[0].image && /*logo*/ ctx[0].image.url && create_if_block_4(ctx);
	let if_block1 = /*unternehmensOpen*/ ctx[4] && create_if_block_3();
	let if_block2 = /*logo*/ ctx[0].image && /*logo*/ ctx[0].image.url && create_if_block_2(ctx);
	let if_block3 = /*studierendeOpen*/ ctx[5] && create_if_block_1();
	let if_block4 = /*menuOpen*/ ctx[3] && create_if_block(ctx);
	const default_slot_template = /*#slots*/ ctx[11].default;
	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[10], null);

	return {
		c() {
			div1 = element("div");
			div0 = element("div");
			if (if_block0) if_block0.c();
			t0 = space();
			header = element("header");
			div8 = element("div");
			div4 = element("div");
			a0 = element("a");
			img = element("img");
			t1 = space();
			div3 = element("div");
			div2 = element("div");
			a1 = element("a");
			t2 = text("Für Unternehmen\n            ");
			span0 = element("span");
			t3 = text("▾");
			t4 = space();
			if (if_block1) if_block1.c();
			t5 = space();
			a2 = element("a");
			t6 = text("Team");
			t7 = space();
			div5 = element("div");
			if (if_block2) if_block2.c();
			t8 = space();
			div7 = element("div");
			a3 = element("a");
			t9 = text("Kontakt");
			t10 = space();
			div6 = element("div");
			a4 = element("a");
			t11 = text("Für Studierende\n          ");
			span1 = element("span");
			t12 = text("▾");
			t13 = space();
			if (if_block3) if_block3.c();
			t14 = space();
			a5 = element("a");
			t15 = text(t15_value);
			t16 = space();
			button = element("button");
			span2 = element("span");
			t17 = space();
			span3 = element("span");
			t18 = space();
			span4 = element("span");
			t19 = space();
			if (if_block4) if_block4.c();
			t20 = space();
			div9 = element("div");
			if (default_slot) default_slot.c();
			this.h();
		},
		l(nodes) {
			div1 = claim_element(nodes, "DIV", { class: true, role: true, tabindex: true });
			var div1_nodes = children(div1);
			div0 = claim_element(div1_nodes, "DIV", { class: true });
			var div0_nodes = children(div0);
			if (if_block0) if_block0.l(div0_nodes);
			div0_nodes.forEach(detach);
			div1_nodes.forEach(detach);
			t0 = claim_space(nodes);
			header = claim_element(nodes, "HEADER", { class: true });
			var header_nodes = children(header);
			div8 = claim_element(header_nodes, "DIV", { class: true });
			var div8_nodes = children(div8);
			div4 = claim_element(div8_nodes, "DIV", { class: true });
			var div4_nodes = children(div4);
			a0 = claim_element(div4_nodes, "A", { href: true, class: true });
			var a0_nodes = children(a0);
			img = claim_element(a0_nodes, "IMG", { src: true, class: true, alt: true });
			a0_nodes.forEach(detach);
			t1 = claim_space(div4_nodes);
			div3 = claim_element(div4_nodes, "DIV", { class: true });
			var div3_nodes = children(div3);
			div2 = claim_element(div3_nodes, "DIV", { class: true });
			var div2_nodes = children(div2);
			a1 = claim_element(div2_nodes, "A", { class: true, href: true });
			var a1_nodes = children(a1);
			t2 = claim_text(a1_nodes, "Für Unternehmen\n            ");
			span0 = claim_element(a1_nodes, "SPAN", { class: true });
			var span0_nodes = children(span0);
			t3 = claim_text(span0_nodes, "▾");
			span0_nodes.forEach(detach);
			a1_nodes.forEach(detach);
			t4 = claim_space(div2_nodes);
			if (if_block1) if_block1.l(div2_nodes);
			div2_nodes.forEach(detach);
			t5 = claim_space(div3_nodes);
			a2 = claim_element(div3_nodes, "A", { class: true, href: true });
			var a2_nodes = children(a2);
			t6 = claim_text(a2_nodes, "Team");
			a2_nodes.forEach(detach);
			div3_nodes.forEach(detach);
			div4_nodes.forEach(detach);
			t7 = claim_space(div8_nodes);
			div5 = claim_element(div8_nodes, "DIV", { class: true });
			var div5_nodes = children(div5);
			if (if_block2) if_block2.l(div5_nodes);
			div5_nodes.forEach(detach);
			t8 = claim_space(div8_nodes);
			div7 = claim_element(div8_nodes, "DIV", { class: true });
			var div7_nodes = children(div7);
			a3 = claim_element(div7_nodes, "A", { class: true, href: true });
			var a3_nodes = children(a3);
			t9 = claim_text(a3_nodes, "Kontakt");
			a3_nodes.forEach(detach);
			t10 = claim_space(div7_nodes);
			div6 = claim_element(div7_nodes, "DIV", { class: true });
			var div6_nodes = children(div6);
			a4 = claim_element(div6_nodes, "A", { class: true, href: true });
			var a4_nodes = children(a4);
			t11 = claim_text(a4_nodes, "Für Studierende\n          ");
			span1 = claim_element(a4_nodes, "SPAN", { class: true });
			var span1_nodes = children(span1);
			t12 = claim_text(span1_nodes, "▾");
			span1_nodes.forEach(detach);
			a4_nodes.forEach(detach);
			t13 = claim_space(div6_nodes);
			if (if_block3) if_block3.l(div6_nodes);
			div6_nodes.forEach(detach);
			t14 = claim_space(div7_nodes);
			a5 = claim_element(div7_nodes, "A", { href: true, class: true });
			var a5_nodes = children(a5);
			t15 = claim_text(a5_nodes, t15_value);
			a5_nodes.forEach(detach);
			div7_nodes.forEach(detach);
			t16 = claim_space(div8_nodes);
			button = claim_element(div8_nodes, "BUTTON", { class: true });
			var button_nodes = children(button);
			span2 = claim_element(button_nodes, "SPAN", { class: true });
			children(span2).forEach(detach);
			t17 = claim_space(button_nodes);
			span3 = claim_element(button_nodes, "SPAN", { class: true });
			children(span3).forEach(detach);
			t18 = claim_space(button_nodes);
			span4 = claim_element(button_nodes, "SPAN", { class: true });
			children(span4).forEach(detach);
			button_nodes.forEach(detach);
			div8_nodes.forEach(detach);
			t19 = claim_space(header_nodes);
			if (if_block4) if_block4.l(header_nodes);
			header_nodes.forEach(detach);
			t20 = claim_space(nodes);
			div9 = claim_element(nodes, "DIV", { class: true });
			var div9_nodes = children(div9);
			if (default_slot) default_slot.l(div9_nodes);
			div9_nodes.forEach(detach);
			this.h();
		},
		h() {
			attr(div0, "class", "intro-content svelte-10nr4zk");
			attr(div1, "class", "intro svelte-10nr4zk");
			attr(div1, "role", "button");
			attr(div1, "tabindex", "0");
			toggle_class(div1, "hide", /*introDone*/ ctx[2]);
			if (!src_url_equal(img.src, img_src_value = "https://nxdvajxwcfktiptiprwh.supabase.co/storage/v1/object/public/images/962f92e4-4c84-49f1-b9bf-603b11bceef4/1767266774000Logos%20Christoph_NEW2026_white.svg")) attr(img, "src", img_src_value);
			attr(img, "class", "nav-left-logo svelte-10nr4zk");
			attr(img, "alt", "Christoph Gross Logo");
			attr(a0, "href", "/");
			attr(a0, "class", "nav-left-logo-link svelte-10nr4zk");
			attr(span0, "class", "arrow svelte-10nr4zk");
			toggle_class(span0, "open", /*unternehmensOpen*/ ctx[4]);
			attr(a1, "class", "link dropdown-trigger svelte-10nr4zk");
			attr(a1, "href", "/statistische-beratung-fuer-unternehmen");
			attr(div2, "class", "dropdown-wrapper svelte-10nr4zk");
			attr(a2, "class", "link svelte-10nr4zk");
			attr(a2, "href", "/team");
			attr(div3, "class", "nav-left svelte-10nr4zk");
			attr(div4, "class", "nav-left-group svelte-10nr4zk");
			attr(div5, "class", "nav-center svelte-10nr4zk");
			attr(a3, "class", "link svelte-10nr4zk");
			attr(a3, "href", "/kontakt");
			attr(span1, "class", "arrow svelte-10nr4zk");
			toggle_class(span1, "open", /*studierendeOpen*/ ctx[5]);
			attr(a4, "class", "link dropdown-trigger svelte-10nr4zk");
			attr(a4, "href", "/statistik-beratung-fuer-studierende");
			attr(div6, "class", "dropdown-wrapper svelte-10nr4zk");
			attr(a5, "href", a5_href_value = /*primary_cta*/ ctx[1].url);
			attr(a5, "class", "button svelte-10nr4zk");
			attr(div7, "class", "nav-right svelte-10nr4zk");
			attr(span2, "class", "svelte-10nr4zk");
			toggle_class(span2, "open", /*menuOpen*/ ctx[3]);
			attr(span3, "class", "svelte-10nr4zk");
			toggle_class(span3, "open", /*menuOpen*/ ctx[3]);
			attr(span4, "class", "svelte-10nr4zk");
			toggle_class(span4, "open", /*menuOpen*/ ctx[3]);
			attr(button, "class", "hamburger svelte-10nr4zk");
			attr(div8, "class", "nav-wrapper svelte-10nr4zk");
			attr(header, "class", "header svelte-10nr4zk");
			toggle_class(header, "active", /*introDone*/ ctx[2]);
			attr(div9, "class", "main-content svelte-10nr4zk");
			toggle_class(div9, "visible", /*introDone*/ ctx[2]);
		},
		m(target, anchor) {
			insert_hydration(target, div1, anchor);
			append_hydration(div1, div0);
			if (if_block0) if_block0.m(div0, null);
			insert_hydration(target, t0, anchor);
			insert_hydration(target, header, anchor);
			append_hydration(header, div8);
			append_hydration(div8, div4);
			append_hydration(div4, a0);
			append_hydration(a0, img);
			append_hydration(div4, t1);
			append_hydration(div4, div3);
			append_hydration(div3, div2);
			append_hydration(div2, a1);
			append_hydration(a1, t2);
			append_hydration(a1, span0);
			append_hydration(span0, t3);
			append_hydration(div2, t4);
			if (if_block1) if_block1.m(div2, null);
			append_hydration(div3, t5);
			append_hydration(div3, a2);
			append_hydration(a2, t6);
			append_hydration(div8, t7);
			append_hydration(div8, div5);
			if (if_block2) if_block2.m(div5, null);
			append_hydration(div8, t8);
			append_hydration(div8, div7);
			append_hydration(div7, a3);
			append_hydration(a3, t9);
			append_hydration(div7, t10);
			append_hydration(div7, div6);
			append_hydration(div6, a4);
			append_hydration(a4, t11);
			append_hydration(a4, span1);
			append_hydration(span1, t12);
			append_hydration(div6, t13);
			if (if_block3) if_block3.m(div6, null);
			append_hydration(div7, t14);
			append_hydration(div7, a5);
			append_hydration(a5, t15);
			append_hydration(div8, t16);
			append_hydration(div8, button);
			append_hydration(button, span2);
			append_hydration(button, t17);
			append_hydration(button, span3);
			append_hydration(button, t18);
			append_hydration(button, span4);
			append_hydration(header, t19);
			if (if_block4) if_block4.m(header, null);
			insert_hydration(target, t20, anchor);
			insert_hydration(target, div9, anchor);

			if (default_slot) {
				default_slot.m(div9, null);
			}

			current = true;

			if (!mounted) {
				dispose = [
					listen(div1, "click", /*handleIntro*/ ctx[6]),
					listen(div1, "keydown", /*keydown_handler*/ ctx[12]),
					listen(div2, "mouseenter", /*mouseenter_handler*/ ctx[13]),
					listen(div2, "mouseleave", /*mouseleave_handler*/ ctx[14]),
					listen(div6, "mouseenter", /*mouseenter_handler_1*/ ctx[15]),
					listen(div6, "mouseleave", /*mouseleave_handler_1*/ ctx[16]),
					listen(button, "click", /*click_handler*/ ctx[17])
				];

				mounted = true;
			}
		},
		p(ctx, [dirty]) {
			if (/*logo*/ ctx[0].image && /*logo*/ ctx[0].image.url) {
				if (if_block0) {
					if_block0.p(ctx, dirty);
				} else {
					if_block0 = create_if_block_4(ctx);
					if_block0.c();
					if_block0.m(div0, null);
				}
			} else if (if_block0) {
				if_block0.d(1);
				if_block0 = null;
			}

			if (!current || dirty & /*introDone*/ 4) {
				toggle_class(div1, "hide", /*introDone*/ ctx[2]);
			}

			if (!current || dirty & /*unternehmensOpen*/ 16) {
				toggle_class(span0, "open", /*unternehmensOpen*/ ctx[4]);
			}

			if (/*unternehmensOpen*/ ctx[4]) {
				if (if_block1) ; else {
					if_block1 = create_if_block_3();
					if_block1.c();
					if_block1.m(div2, null);
				}
			} else if (if_block1) {
				if_block1.d(1);
				if_block1 = null;
			}

			if (/*logo*/ ctx[0].image && /*logo*/ ctx[0].image.url) {
				if (if_block2) {
					if_block2.p(ctx, dirty);
				} else {
					if_block2 = create_if_block_2(ctx);
					if_block2.c();
					if_block2.m(div5, null);
				}
			} else if (if_block2) {
				if_block2.d(1);
				if_block2 = null;
			}

			if (!current || dirty & /*studierendeOpen*/ 32) {
				toggle_class(span1, "open", /*studierendeOpen*/ ctx[5]);
			}

			if (/*studierendeOpen*/ ctx[5]) {
				if (if_block3) ; else {
					if_block3 = create_if_block_1();
					if_block3.c();
					if_block3.m(div6, null);
				}
			} else if (if_block3) {
				if_block3.d(1);
				if_block3 = null;
			}

			if ((!current || dirty & /*primary_cta*/ 2) && t15_value !== (t15_value = /*primary_cta*/ ctx[1].label + "")) set_data(t15, t15_value);

			if (!current || dirty & /*primary_cta*/ 2 && a5_href_value !== (a5_href_value = /*primary_cta*/ ctx[1].url)) {
				attr(a5, "href", a5_href_value);
			}

			if (!current || dirty & /*menuOpen*/ 8) {
				toggle_class(span2, "open", /*menuOpen*/ ctx[3]);
			}

			if (!current || dirty & /*menuOpen*/ 8) {
				toggle_class(span3, "open", /*menuOpen*/ ctx[3]);
			}

			if (!current || dirty & /*menuOpen*/ 8) {
				toggle_class(span4, "open", /*menuOpen*/ ctx[3]);
			}

			if (/*menuOpen*/ ctx[3]) {
				if (if_block4) {
					if_block4.p(ctx, dirty);
				} else {
					if_block4 = create_if_block(ctx);
					if_block4.c();
					if_block4.m(header, null);
				}
			} else if (if_block4) {
				if_block4.d(1);
				if_block4 = null;
			}

			if (!current || dirty & /*introDone*/ 4) {
				toggle_class(header, "active", /*introDone*/ ctx[2]);
			}

			if (default_slot) {
				if (default_slot.p && (!current || dirty & /*$$scope*/ 1024)) {
					update_slot_base(
						default_slot,
						default_slot_template,
						ctx,
						/*$$scope*/ ctx[10],
						!current
						? get_all_dirty_from_scope(/*$$scope*/ ctx[10])
						: get_slot_changes(default_slot_template, /*$$scope*/ ctx[10], dirty, null),
						null
					);
				}
			}

			if (!current || dirty & /*introDone*/ 4) {
				toggle_class(div9, "visible", /*introDone*/ ctx[2]);
			}
		},
		i(local) {
			if (current) return;
			transition_in(default_slot, local);
			current = true;
		},
		o(local) {
			transition_out(default_slot, local);
			current = false;
		},
		d(detaching) {
			if (detaching) detach(div1);
			if (if_block0) if_block0.d();
			if (detaching) detach(t0);
			if (detaching) detach(header);
			if (if_block1) if_block1.d();
			if (if_block2) if_block2.d();
			if (if_block3) if_block3.d();
			if (if_block4) if_block4.d();
			if (detaching) detach(t20);
			if (detaching) detach(div9);
			if (default_slot) default_slot.d(detaching);
			mounted = false;
			run_all(dispose);
		}
	};
}

function instance($$self, $$props, $$invalidate) {
	let { $$slots: slots = {}, $$scope } = $$props;
	let { props } = $$props;
	let { logo } = $$props;
	let { site_nav } = $$props;
	let { primary_cta } = $$props;
	let { leftlogo } = $$props;
	let introDone = false;
	let menuOpen = false;
	let unternehmensOpen = false;
	let studierendeOpen = false;

	function handleIntro() {
		if (!introDone) {
			$$invalidate(2, introDone = true);
		}
	}

	function closeDropdowns(e) {
		if (!e.target.closest('.dropdown-wrapper')) {
			$$invalidate(4, unternehmensOpen = false);
			$$invalidate(5, studierendeOpen = false);
		}
	}

	window.addEventListener("click", handleIntro);
	window.addEventListener("click", closeDropdowns);
	window.addEventListener("mousemove", handleIntro, { once: true });

	setTimeout(
		() => {
			handleIntro();
		},
		800
	);

	const keydown_handler = e => e.key === 'Enter' && handleIntro();

	const mouseenter_handler = () => {
		$$invalidate(4, unternehmensOpen = true);
		$$invalidate(5, studierendeOpen = false);
	};

	const mouseleave_handler = () => $$invalidate(4, unternehmensOpen = false);

	const mouseenter_handler_1 = () => {
		$$invalidate(5, studierendeOpen = true);
		$$invalidate(4, unternehmensOpen = false);
	};

	const mouseleave_handler_1 = () => $$invalidate(5, studierendeOpen = false);
	const click_handler = () => $$invalidate(3, menuOpen = !menuOpen);
	const click_handler_1 = () => $$invalidate(3, menuOpen = false);
	const click_handler_2 = () => $$invalidate(3, menuOpen = false);
	const click_handler_3 = () => $$invalidate(3, menuOpen = false);
	const click_handler_4 = () => $$invalidate(3, menuOpen = false);
	const click_handler_5 = () => $$invalidate(3, menuOpen = false);

	$$self.$$set = $$props => {
		if ('props' in $$props) $$invalidate(7, props = $$props.props);
		if ('logo' in $$props) $$invalidate(0, logo = $$props.logo);
		if ('site_nav' in $$props) $$invalidate(8, site_nav = $$props.site_nav);
		if ('primary_cta' in $$props) $$invalidate(1, primary_cta = $$props.primary_cta);
		if ('leftlogo' in $$props) $$invalidate(9, leftlogo = $$props.leftlogo);
		if ('$$scope' in $$props) $$invalidate(10, $$scope = $$props.$$scope);
	};

	return [
		logo,
		primary_cta,
		introDone,
		menuOpen,
		unternehmensOpen,
		studierendeOpen,
		handleIntro,
		props,
		site_nav,
		leftlogo,
		$$scope,
		slots,
		keydown_handler,
		mouseenter_handler,
		mouseleave_handler,
		mouseenter_handler_1,
		mouseleave_handler_1,
		click_handler,
		click_handler_1,
		click_handler_2,
		click_handler_3,
		click_handler_4,
		click_handler_5
	];
}

class Component extends SvelteComponent {
	constructor(options) {
		super();

		init(this, options, instance, create_fragment, safe_not_equal, {
			props: 7,
			logo: 0,
			site_nav: 8,
			primary_cta: 1,
			leftlogo: 9
		});
	}
}

export { Component as default };

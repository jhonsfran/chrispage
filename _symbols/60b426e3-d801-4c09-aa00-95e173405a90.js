// Trainer und Referenzen (copy) - Updated September 22, 2026
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
	child_ctx[12] = list[i];
	return child_ctx;
}

function get_each_context_1(ctx, list, i) {
	const child_ctx = ctx.slice();
	child_ctx[15] = list[i];
	return child_ctx;
}

// (338:6) {#if references_heading}
function create_if_block_9(ctx) {
	let p;
	let t;

	return {
		c() {
			p = element("p");
			t = text(/*references_heading*/ ctx[8]);
			this.h();
		},
		l(nodes) {
			p = claim_element(nodes, "P", { class: true });
			var p_nodes = children(p);
			t = claim_text(p_nodes, /*references_heading*/ ctx[8]);
			p_nodes.forEach(detach);
			this.h();
		},
		h() {
			attr(p, "class", "cg-dl-trainer__references-heading svelte-1a20zcr");
		},
		m(target, anchor) {
			insert_hydration(target, p, anchor);
			append_hydration(p, t);
		},
		p(ctx, dirty) {
			if (dirty & /*references_heading*/ 256) set_data(t, /*references_heading*/ ctx[8]);
		},
		d(detaching) {
			if (detaching) detach(p);
		}
	};
}

// (344:6) {#if references_text}
function create_if_block_8(ctx) {
	let p;
	let t;

	return {
		c() {
			p = element("p");
			t = text(/*references_text*/ ctx[7]);
			this.h();
		},
		l(nodes) {
			p = claim_element(nodes, "P", { class: true });
			var p_nodes = children(p);
			t = claim_text(p_nodes, /*references_text*/ ctx[7]);
			p_nodes.forEach(detach);
			this.h();
		},
		h() {
			attr(p, "class", "cg-dl-trainer__references-text svelte-1a20zcr");
		},
		m(target, anchor) {
			insert_hydration(target, p, anchor);
			append_hydration(p, t);
		},
		p(ctx, dirty) {
			if (dirty & /*references_text*/ 128) set_data(t, /*references_text*/ ctx[7]);
		},
		d(detaching) {
			if (detaching) detach(p);
		}
	};
}

// (350:6) {#if logos && logos.length > 0}
function create_if_block_6(ctx) {
	let div;
	let each_value_1 = /*logos*/ ctx[1];
	let each_blocks = [];

	for (let i = 0; i < each_value_1.length; i += 1) {
		each_blocks[i] = create_each_block_1(get_each_context_1(ctx, each_value_1, i));
	}

	return {
		c() {
			div = element("div");

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].c();
			}

			this.h();
		},
		l(nodes) {
			div = claim_element(nodes, "DIV", { class: true });
			var div_nodes = children(div);

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].l(div_nodes);
			}

			div_nodes.forEach(detach);
			this.h();
		},
		h() {
			attr(div, "class", "cg-dl-trainer__logos svelte-1a20zcr");
		},
		m(target, anchor) {
			insert_hydration(target, div, anchor);

			for (let i = 0; i < each_blocks.length; i += 1) {
				if (each_blocks[i]) {
					each_blocks[i].m(div, null);
				}
			}
		},
		p(ctx, dirty) {
			if (dirty & /*logos*/ 2) {
				each_value_1 = /*logos*/ ctx[1];
				let i;

				for (i = 0; i < each_value_1.length; i += 1) {
					const child_ctx = get_each_context_1(ctx, each_value_1, i);

					if (each_blocks[i]) {
						each_blocks[i].p(child_ctx, dirty);
					} else {
						each_blocks[i] = create_each_block_1(child_ctx);
						each_blocks[i].c();
						each_blocks[i].m(div, null);
					}
				}

				for (; i < each_blocks.length; i += 1) {
					each_blocks[i].d(1);
				}

				each_blocks.length = each_value_1.length;
			}
		},
		d(detaching) {
			if (detaching) detach(div);
			destroy_each(each_blocks, detaching);
		}
	};
}

// (359:14) {:else}
function create_else_block(ctx) {
	let span;
	let t_value = (/*item*/ ctx[15].name || "LOGO") + "";
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
			attr(span, "class", "svelte-1a20zcr");
		},
		m(target, anchor) {
			insert_hydration(target, span, anchor);
			append_hydration(span, t);
		},
		p(ctx, dirty) {
			if (dirty & /*logos*/ 2 && t_value !== (t_value = (/*item*/ ctx[15].name || "LOGO") + "")) set_data(t, t_value);
		},
		d(detaching) {
			if (detaching) detach(span);
		}
	};
}

// (354:14) {#if item.logo && item.logo.url}
function create_if_block_7(ctx) {
	let img;
	let img_src_value;
	let img_alt_value;

	return {
		c() {
			img = element("img");
			this.h();
		},
		l(nodes) {
			img = claim_element(nodes, "IMG", { src: true, alt: true, class: true });
			this.h();
		},
		h() {
			if (!src_url_equal(img.src, img_src_value = /*item*/ ctx[15].logo.url)) attr(img, "src", img_src_value);
			attr(img, "alt", img_alt_value = /*item*/ ctx[15].logo.alt || /*item*/ ctx[15].name || "Referenzlogo");
			attr(img, "class", "svelte-1a20zcr");
		},
		m(target, anchor) {
			insert_hydration(target, img, anchor);
		},
		p(ctx, dirty) {
			if (dirty & /*logos*/ 2 && !src_url_equal(img.src, img_src_value = /*item*/ ctx[15].logo.url)) {
				attr(img, "src", img_src_value);
			}

			if (dirty & /*logos*/ 2 && img_alt_value !== (img_alt_value = /*item*/ ctx[15].logo.alt || /*item*/ ctx[15].name || "Referenzlogo")) {
				attr(img, "alt", img_alt_value);
			}
		},
		d(detaching) {
			if (detaching) detach(img);
		}
	};
}

// (352:10) {#each logos as item}
function create_each_block_1(ctx) {
	let div;
	let t;

	function select_block_type(ctx, dirty) {
		if (/*item*/ ctx[15].logo && /*item*/ ctx[15].logo.url) return create_if_block_7;
		return create_else_block;
	}

	let current_block_type = select_block_type(ctx);
	let if_block = current_block_type(ctx);

	return {
		c() {
			div = element("div");
			if_block.c();
			t = space();
			this.h();
		},
		l(nodes) {
			div = claim_element(nodes, "DIV", { class: true });
			var div_nodes = children(div);
			if_block.l(div_nodes);
			t = claim_space(div_nodes);
			div_nodes.forEach(detach);
			this.h();
		},
		h() {
			attr(div, "class", "cg-dl-trainer__logo svelte-1a20zcr");
		},
		m(target, anchor) {
			insert_hydration(target, div, anchor);
			if_block.m(div, null);
			append_hydration(div, t);
		},
		p(ctx, dirty) {
			if (current_block_type === (current_block_type = select_block_type(ctx)) && if_block) {
				if_block.p(ctx, dirty);
			} else {
				if_block.d(1);
				if_block = current_block_type(ctx);

				if (if_block) {
					if_block.c();
					if_block.m(div, t);
				}
			}
		},
		d(detaching) {
			if (detaching) detach(div);
			if_block.d();
		}
	};
}

// (369:6) {#if eyebrow}
function create_if_block_5(ctx) {
	let p;
	let t;

	return {
		c() {
			p = element("p");
			t = text(/*eyebrow*/ ctx[2]);
			this.h();
		},
		l(nodes) {
			p = claim_element(nodes, "P", { class: true });
			var p_nodes = children(p);
			t = claim_text(p_nodes, /*eyebrow*/ ctx[2]);
			p_nodes.forEach(detach);
			this.h();
		},
		h() {
			attr(p, "class", "cg-dl-trainer__eyebrow svelte-1a20zcr");
		},
		m(target, anchor) {
			insert_hydration(target, p, anchor);
			append_hydration(p, t);
		},
		p(ctx, dirty) {
			if (dirty & /*eyebrow*/ 4) set_data(t, /*eyebrow*/ ctx[2]);
		},
		d(detaching) {
			if (detaching) detach(p);
		}
	};
}

// (379:6) {#if description_1}
function create_if_block_4(ctx) {
	let p;
	let t;

	return {
		c() {
			p = element("p");
			t = text(/*description_1*/ ctx[4]);
			this.h();
		},
		l(nodes) {
			p = claim_element(nodes, "P", { class: true });
			var p_nodes = children(p);
			t = claim_text(p_nodes, /*description_1*/ ctx[4]);
			p_nodes.forEach(detach);
			this.h();
		},
		h() {
			attr(p, "class", "cg-dl-trainer__lead svelte-1a20zcr");
		},
		m(target, anchor) {
			insert_hydration(target, p, anchor);
			append_hydration(p, t);
		},
		p(ctx, dirty) {
			if (dirty & /*description_1*/ 16) set_data(t, /*description_1*/ ctx[4]);
		},
		d(detaching) {
			if (detaching) detach(p);
		}
	};
}

// (385:6) {#if description_2}
function create_if_block_3(ctx) {
	let p;
	let t;

	return {
		c() {
			p = element("p");
			t = text(/*description_2*/ ctx[5]);
			this.h();
		},
		l(nodes) {
			p = claim_element(nodes, "P", { class: true });
			var p_nodes = children(p);
			t = claim_text(p_nodes, /*description_2*/ ctx[5]);
			p_nodes.forEach(detach);
			this.h();
		},
		h() {
			attr(p, "class", "cg-dl-trainer__description svelte-1a20zcr");
		},
		m(target, anchor) {
			insert_hydration(target, p, anchor);
			append_hydration(p, t);
		},
		p(ctx, dirty) {
			if (dirty & /*description_2*/ 32) set_data(t, /*description_2*/ ctx[5]);
		},
		d(detaching) {
			if (detaching) detach(p);
		}
	};
}

// (391:6) {#if facts && facts.length > 0}
function create_if_block_1(ctx) {
	let div;
	let each_value = /*facts*/ ctx[0];
	let each_blocks = [];

	for (let i = 0; i < each_value.length; i += 1) {
		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
	}

	return {
		c() {
			div = element("div");

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].c();
			}

			this.h();
		},
		l(nodes) {
			div = claim_element(nodes, "DIV", { class: true });
			var div_nodes = children(div);

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].l(div_nodes);
			}

			div_nodes.forEach(detach);
			this.h();
		},
		h() {
			attr(div, "class", "cg-dl-trainer__facts svelte-1a20zcr");
		},
		m(target, anchor) {
			insert_hydration(target, div, anchor);

			for (let i = 0; i < each_blocks.length; i += 1) {
				if (each_blocks[i]) {
					each_blocks[i].m(div, null);
				}
			}
		},
		p(ctx, dirty) {
			if (dirty & /*facts*/ 1) {
				each_value = /*facts*/ ctx[0];
				let i;

				for (i = 0; i < each_value.length; i += 1) {
					const child_ctx = get_each_context(ctx, each_value, i);

					if (each_blocks[i]) {
						each_blocks[i].p(child_ctx, dirty);
					} else {
						each_blocks[i] = create_each_block(child_ctx);
						each_blocks[i].c();
						each_blocks[i].m(div, null);
					}
				}

				for (; i < each_blocks.length; i += 1) {
					each_blocks[i].d(1);
				}

				each_blocks.length = each_value.length;
			}
		},
		d(detaching) {
			if (detaching) detach(div);
			destroy_each(each_blocks, detaching);
		}
	};
}

// (397:14) {#if fact.text}
function create_if_block_2(ctx) {
	let span;
	let t_value = /*fact*/ ctx[12].text + "";
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
			attr(span, "class", "svelte-1a20zcr");
		},
		m(target, anchor) {
			insert_hydration(target, span, anchor);
			append_hydration(span, t);
		},
		p(ctx, dirty) {
			if (dirty & /*facts*/ 1 && t_value !== (t_value = /*fact*/ ctx[12].text + "")) set_data(t, t_value);
		},
		d(detaching) {
			if (detaching) detach(span);
		}
	};
}

// (393:10) {#each facts as fact}
function create_each_block(ctx) {
	let div;
	let strong;
	let t0_value = /*fact*/ ctx[12].title + "";
	let t0;
	let t1;
	let t2;
	let if_block = /*fact*/ ctx[12].text && create_if_block_2(ctx);

	return {
		c() {
			div = element("div");
			strong = element("strong");
			t0 = text(t0_value);
			t1 = space();
			if (if_block) if_block.c();
			t2 = space();
			this.h();
		},
		l(nodes) {
			div = claim_element(nodes, "DIV", { class: true });
			var div_nodes = children(div);
			strong = claim_element(div_nodes, "STRONG", { class: true });
			var strong_nodes = children(strong);
			t0 = claim_text(strong_nodes, t0_value);
			strong_nodes.forEach(detach);
			t1 = claim_space(div_nodes);
			if (if_block) if_block.l(div_nodes);
			t2 = claim_space(div_nodes);
			div_nodes.forEach(detach);
			this.h();
		},
		h() {
			attr(strong, "class", "svelte-1a20zcr");
			attr(div, "class", "svelte-1a20zcr");
		},
		m(target, anchor) {
			insert_hydration(target, div, anchor);
			append_hydration(div, strong);
			append_hydration(strong, t0);
			append_hydration(div, t1);
			if (if_block) if_block.m(div, null);
			append_hydration(div, t2);
		},
		p(ctx, dirty) {
			if (dirty & /*facts*/ 1 && t0_value !== (t0_value = /*fact*/ ctx[12].title + "")) set_data(t0, t0_value);

			if (/*fact*/ ctx[12].text) {
				if (if_block) {
					if_block.p(ctx, dirty);
				} else {
					if_block = create_if_block_2(ctx);
					if_block.c();
					if_block.m(div, t2);
				}
			} else if (if_block) {
				if_block.d(1);
				if_block = null;
			}
		},
		d(detaching) {
			if (detaching) detach(div);
			if (if_block) if_block.d();
		}
	};
}

// (407:6) {#if speaker_image && speaker_image.url}
function create_if_block(ctx) {
	let img;
	let img_src_value;
	let img_alt_value;

	return {
		c() {
			img = element("img");
			this.h();
		},
		l(nodes) {
			img = claim_element(nodes, "IMG", { src: true, alt: true, class: true });
			this.h();
		},
		h() {
			if (!src_url_equal(img.src, img_src_value = /*speaker_image*/ ctx[6].url)) attr(img, "src", img_src_value);
			attr(img, "alt", img_alt_value = /*speaker_image*/ ctx[6].alt || /*heading*/ ctx[3]);
			attr(img, "class", "svelte-1a20zcr");
		},
		m(target, anchor) {
			insert_hydration(target, img, anchor);
		},
		p(ctx, dirty) {
			if (dirty & /*speaker_image*/ 64 && !src_url_equal(img.src, img_src_value = /*speaker_image*/ ctx[6].url)) {
				attr(img, "src", img_src_value);
			}

			if (dirty & /*speaker_image, heading*/ 72 && img_alt_value !== (img_alt_value = /*speaker_image*/ ctx[6].alt || /*heading*/ ctx[3])) {
				attr(img, "alt", img_alt_value);
			}
		},
		d(detaching) {
			if (detaching) detach(img);
		}
	};
}

function create_fragment(ctx) {
	let section;
	let div2;
	let aside;
	let t0;
	let t1;
	let t2;
	let div0;
	let t3;
	let h2;
	let t4;
	let t5;
	let t6;
	let t7;
	let t8;
	let div1;
	let if_block0 = /*references_heading*/ ctx[8] && create_if_block_9(ctx);
	let if_block1 = /*references_text*/ ctx[7] && create_if_block_8(ctx);
	let if_block2 = /*logos*/ ctx[1] && /*logos*/ ctx[1].length > 0 && create_if_block_6(ctx);
	let if_block3 = /*eyebrow*/ ctx[2] && create_if_block_5(ctx);
	let if_block4 = /*description_1*/ ctx[4] && create_if_block_4(ctx);
	let if_block5 = /*description_2*/ ctx[5] && create_if_block_3(ctx);
	let if_block6 = /*facts*/ ctx[0] && /*facts*/ ctx[0].length > 0 && create_if_block_1(ctx);
	let if_block7 = /*speaker_image*/ ctx[6] && /*speaker_image*/ ctx[6].url && create_if_block(ctx);

	return {
		c() {
			section = element("section");
			div2 = element("div");
			aside = element("aside");
			if (if_block0) if_block0.c();
			t0 = space();
			if (if_block1) if_block1.c();
			t1 = space();
			if (if_block2) if_block2.c();
			t2 = space();
			div0 = element("div");
			if (if_block3) if_block3.c();
			t3 = space();
			h2 = element("h2");
			t4 = text(/*heading*/ ctx[3]);
			t5 = space();
			if (if_block4) if_block4.c();
			t6 = space();
			if (if_block5) if_block5.c();
			t7 = space();
			if (if_block6) if_block6.c();
			t8 = space();
			div1 = element("div");
			if (if_block7) if_block7.c();
			this.h();
		},
		l(nodes) {
			section = claim_element(nodes, "SECTION", { class: true, "aria-labelledby": true });
			var section_nodes = children(section);
			div2 = claim_element(section_nodes, "DIV", { class: true });
			var div2_nodes = children(div2);
			aside = claim_element(div2_nodes, "ASIDE", { class: true });
			var aside_nodes = children(aside);
			if (if_block0) if_block0.l(aside_nodes);
			t0 = claim_space(aside_nodes);
			if (if_block1) if_block1.l(aside_nodes);
			t1 = claim_space(aside_nodes);
			if (if_block2) if_block2.l(aside_nodes);
			aside_nodes.forEach(detach);
			t2 = claim_space(div2_nodes);
			div0 = claim_element(div2_nodes, "DIV", { class: true });
			var div0_nodes = children(div0);
			if (if_block3) if_block3.l(div0_nodes);
			t3 = claim_space(div0_nodes);
			h2 = claim_element(div0_nodes, "H2", { id: true, class: true });
			var h2_nodes = children(h2);
			t4 = claim_text(h2_nodes, /*heading*/ ctx[3]);
			h2_nodes.forEach(detach);
			t5 = claim_space(div0_nodes);
			if (if_block4) if_block4.l(div0_nodes);
			t6 = claim_space(div0_nodes);
			if (if_block5) if_block5.l(div0_nodes);
			t7 = claim_space(div0_nodes);
			if (if_block6) if_block6.l(div0_nodes);
			div0_nodes.forEach(detach);
			t8 = claim_space(div2_nodes);
			div1 = claim_element(div2_nodes, "DIV", { class: true });
			var div1_nodes = children(div1);
			if (if_block7) if_block7.l(div1_nodes);
			div1_nodes.forEach(detach);
			div2_nodes.forEach(detach);
			section_nodes.forEach(detach);
			this.h();
		},
		h() {
			attr(aside, "class", "cg-dl-trainer__references cg-reveal-item svelte-1a20zcr");
			attr(h2, "id", "cg-dl-trainer-heading");
			attr(h2, "class", "svelte-1a20zcr");
			attr(div0, "class", "cg-dl-trainer__content cg-reveal-item svelte-1a20zcr");
			attr(div1, "class", "cg-dl-trainer__image cg-reveal-item svelte-1a20zcr");
			attr(div2, "class", "cg-dl-trainer__inner svelte-1a20zcr");
			attr(section, "class", "cg-dl-trainer svelte-1a20zcr");
			attr(section, "aria-labelledby", "cg-dl-trainer-heading");
		},
		m(target, anchor) {
			insert_hydration(target, section, anchor);
			append_hydration(section, div2);
			append_hydration(div2, aside);
			if (if_block0) if_block0.m(aside, null);
			append_hydration(aside, t0);
			if (if_block1) if_block1.m(aside, null);
			append_hydration(aside, t1);
			if (if_block2) if_block2.m(aside, null);
			append_hydration(div2, t2);
			append_hydration(div2, div0);
			if (if_block3) if_block3.m(div0, null);
			append_hydration(div0, t3);
			append_hydration(div0, h2);
			append_hydration(h2, t4);
			append_hydration(div0, t5);
			if (if_block4) if_block4.m(div0, null);
			append_hydration(div0, t6);
			if (if_block5) if_block5.m(div0, null);
			append_hydration(div0, t7);
			if (if_block6) if_block6.m(div0, null);
			append_hydration(div2, t8);
			append_hydration(div2, div1);
			if (if_block7) if_block7.m(div1, null);
			/*section_binding*/ ctx[11](section);
		},
		p(ctx, [dirty]) {
			if (/*references_heading*/ ctx[8]) {
				if (if_block0) {
					if_block0.p(ctx, dirty);
				} else {
					if_block0 = create_if_block_9(ctx);
					if_block0.c();
					if_block0.m(aside, t0);
				}
			} else if (if_block0) {
				if_block0.d(1);
				if_block0 = null;
			}

			if (/*references_text*/ ctx[7]) {
				if (if_block1) {
					if_block1.p(ctx, dirty);
				} else {
					if_block1 = create_if_block_8(ctx);
					if_block1.c();
					if_block1.m(aside, t1);
				}
			} else if (if_block1) {
				if_block1.d(1);
				if_block1 = null;
			}

			if (/*logos*/ ctx[1] && /*logos*/ ctx[1].length > 0) {
				if (if_block2) {
					if_block2.p(ctx, dirty);
				} else {
					if_block2 = create_if_block_6(ctx);
					if_block2.c();
					if_block2.m(aside, null);
				}
			} else if (if_block2) {
				if_block2.d(1);
				if_block2 = null;
			}

			if (/*eyebrow*/ ctx[2]) {
				if (if_block3) {
					if_block3.p(ctx, dirty);
				} else {
					if_block3 = create_if_block_5(ctx);
					if_block3.c();
					if_block3.m(div0, t3);
				}
			} else if (if_block3) {
				if_block3.d(1);
				if_block3 = null;
			}

			if (dirty & /*heading*/ 8) set_data(t4, /*heading*/ ctx[3]);

			if (/*description_1*/ ctx[4]) {
				if (if_block4) {
					if_block4.p(ctx, dirty);
				} else {
					if_block4 = create_if_block_4(ctx);
					if_block4.c();
					if_block4.m(div0, t6);
				}
			} else if (if_block4) {
				if_block4.d(1);
				if_block4 = null;
			}

			if (/*description_2*/ ctx[5]) {
				if (if_block5) {
					if_block5.p(ctx, dirty);
				} else {
					if_block5 = create_if_block_3(ctx);
					if_block5.c();
					if_block5.m(div0, t7);
				}
			} else if (if_block5) {
				if_block5.d(1);
				if_block5 = null;
			}

			if (/*facts*/ ctx[0] && /*facts*/ ctx[0].length > 0) {
				if (if_block6) {
					if_block6.p(ctx, dirty);
				} else {
					if_block6 = create_if_block_1(ctx);
					if_block6.c();
					if_block6.m(div0, null);
				}
			} else if (if_block6) {
				if_block6.d(1);
				if_block6 = null;
			}

			if (/*speaker_image*/ ctx[6] && /*speaker_image*/ ctx[6].url) {
				if (if_block7) {
					if_block7.p(ctx, dirty);
				} else {
					if_block7 = create_if_block(ctx);
					if_block7.c();
					if_block7.m(div1, null);
				}
			} else if (if_block7) {
				if_block7.d(1);
				if_block7 = null;
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
			if (if_block4) if_block4.d();
			if (if_block5) if_block5.d();
			if (if_block6) if_block6.d();
			if (if_block7) if_block7.d();
			/*section_binding*/ ctx[11](null);
		}
	};
}

function instance($$self, $$props, $$invalidate) {
	let { props } = $$props;
	let { facts } = $$props;
	let { logos } = $$props;
	let { eyebrow } = $$props;
	let { heading } = $$props;
	let { description_1 } = $$props;
	let { description_2 } = $$props;
	let { speaker_image } = $$props;
	let { references_text } = $$props;
	let { references_heading } = $$props;
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
			$$invalidate(9, sectionElement);
		});
	}

	$$self.$$set = $$props => {
		if ('props' in $$props) $$invalidate(10, props = $$props.props);
		if ('facts' in $$props) $$invalidate(0, facts = $$props.facts);
		if ('logos' in $$props) $$invalidate(1, logos = $$props.logos);
		if ('eyebrow' in $$props) $$invalidate(2, eyebrow = $$props.eyebrow);
		if ('heading' in $$props) $$invalidate(3, heading = $$props.heading);
		if ('description_1' in $$props) $$invalidate(4, description_1 = $$props.description_1);
		if ('description_2' in $$props) $$invalidate(5, description_2 = $$props.description_2);
		if ('speaker_image' in $$props) $$invalidate(6, speaker_image = $$props.speaker_image);
		if ('references_text' in $$props) $$invalidate(7, references_text = $$props.references_text);
		if ('references_heading' in $$props) $$invalidate(8, references_heading = $$props.references_heading);
	};

	return [
		facts,
		logos,
		eyebrow,
		heading,
		description_1,
		description_2,
		speaker_image,
		references_text,
		references_heading,
		sectionElement,
		props,
		section_binding
	];
}

class Component extends SvelteComponent {
	constructor(options) {
		super();

		init(this, options, instance, create_fragment, safe_not_equal, {
			props: 10,
			facts: 0,
			logos: 1,
			eyebrow: 2,
			heading: 3,
			description_1: 4,
			description_2: 5,
			speaker_image: 6,
			references_text: 7,
			references_heading: 8
		});
	}
}

export { Component as default };

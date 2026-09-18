// Blog Intro - Updated September 18, 2026
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
	child_ctx[9] = list[i];
	return child_ctx;
}

// (550:6) {#if eyebrow}
function create_if_block_5(ctx) {
	let p;
	let t;

	return {
		c() {
			p = element("p");
			t = text(/*eyebrow*/ ctx[0]);
			this.h();
		},
		l(nodes) {
			p = claim_element(nodes, "P", { class: true });
			var p_nodes = children(p);
			t = claim_text(p_nodes, /*eyebrow*/ ctx[0]);
			p_nodes.forEach(detach);
			this.h();
		},
		h() {
			attr(p, "class", "cg-blog-featured-hero__eyebrow svelte-fdqjr9");
		},
		m(target, anchor) {
			insert_hydration(target, p, anchor);
			append_hydration(p, t);
		},
		p(ctx, dirty) {
			if (dirty & /*eyebrow*/ 1) set_data(t, /*eyebrow*/ ctx[0]);
		},
		d(detaching) {
			if (detaching) detach(p);
		}
	};
}

// (568:6) {#if benefits && benefits.length > 0}
function create_if_block_4(ctx) {
	let div;
	let each_value = /*benefits*/ ctx[2];
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
			div = claim_element(nodes, "DIV", { class: true, "aria-label": true });
			var div_nodes = children(div);

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].l(div_nodes);
			}

			div_nodes.forEach(detach);
			this.h();
		},
		h() {
			attr(div, "class", "cg-blog-featured-hero__topics svelte-fdqjr9");
			attr(div, "aria-label", "Themen des Blogs");
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
			if (dirty & /*benefits*/ 4) {
				each_value = /*benefits*/ ctx[2];
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

// (573:10) {#each benefits as benefit}
function create_each_block(ctx) {
	let span;
	let t_value = /*benefit*/ ctx[9].title + "";
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
			attr(span, "class", "svelte-fdqjr9");
		},
		m(target, anchor) {
			insert_hydration(target, span, anchor);
			append_hydration(span, t);
		},
		p(ctx, dirty) {
			if (dirty & /*benefits*/ 4 && t_value !== (t_value = /*benefit*/ ctx[9].title + "")) set_data(t, t_value);
		},
		d(detaching) {
			if (detaching) detach(span);
		}
	};
}

// (667:4) {:else}
function create_else_block_1(ctx) {
	let div2;
	let div0;
	let t0;
	let div1;
	let span0;
	let t1;
	let span1;
	let t2;
	let span2;

	return {
		c() {
			div2 = element("div");
			div0 = element("div");
			t0 = space();
			div1 = element("div");
			span0 = element("span");
			t1 = space();
			span1 = element("span");
			t2 = space();
			span2 = element("span");
			this.h();
		},
		l(nodes) {
			div2 = claim_element(nodes, "DIV", { class: true, "aria-hidden": true });
			var div2_nodes = children(div2);
			div0 = claim_element(div2_nodes, "DIV", { class: true });
			children(div0).forEach(detach);
			t0 = claim_space(div2_nodes);
			div1 = claim_element(div2_nodes, "DIV", { class: true });
			var div1_nodes = children(div1);
			span0 = claim_element(div1_nodes, "SPAN", { class: true });
			children(span0).forEach(detach);
			t1 = claim_space(div1_nodes);
			span1 = claim_element(div1_nodes, "SPAN", { class: true });
			children(span1).forEach(detach);
			t2 = claim_space(div1_nodes);
			span2 = claim_element(div1_nodes, "SPAN", { class: true });
			children(span2).forEach(detach);
			div1_nodes.forEach(detach);
			div2_nodes.forEach(detach);
			this.h();
		},
		h() {
			attr(div0, "class", "cg-blog-featured-hero__loading-image svelte-fdqjr9");
			attr(span0, "class", "svelte-fdqjr9");
			attr(span1, "class", "svelte-fdqjr9");
			attr(span2, "class", "svelte-fdqjr9");
			attr(div1, "class", "cg-blog-featured-hero__loading-content svelte-fdqjr9");
			attr(div2, "class", "cg-blog-featured-hero__loading svelte-fdqjr9");
			attr(div2, "aria-hidden", "true");
		},
		m(target, anchor) {
			insert_hydration(target, div2, anchor);
			append_hydration(div2, div0);
			append_hydration(div2, t0);
			append_hydration(div2, div1);
			append_hydration(div1, span0);
			append_hydration(div1, t1);
			append_hydration(div1, span1);
			append_hydration(div1, t2);
			append_hydration(div1, span2);
		},
		p: noop,
		d(detaching) {
			if (detaching) detach(div2);
		}
	};
}

// (585:4) {#if latestPost}
function create_if_block(ctx) {
	let div3;
	let div0;
	let span0;
	let t0;
	let t1;
	let svg0;
	let path0;
	let path1;
	let t2;
	let article;
	let span1;
	let t3;
	let t4;
	let button0;
	let button0_aria_label_value;
	let t5;
	let div2;
	let div1;
	let t6;
	let t7;
	let button1;
	let t8_value = /*latestPost*/ ctx[4].title + "";
	let t8;
	let t9;
	let button2;
	let t10;
	let svg1;
	let path2;
	let path3;
	let mounted;
	let dispose;

	function select_block_type_1(ctx, dirty) {
		if (/*latestPost*/ ctx[4].image && /*latestPost*/ ctx[4].image.url) return create_if_block_3;
		return create_else_block;
	}

	let current_block_type = select_block_type_1(ctx);
	let if_block0 = current_block_type(ctx);
	let if_block1 = /*latestPost*/ ctx[4].category && create_if_block_2(ctx);
	let if_block2 = /*latestPost*/ ctx[4].date && create_if_block_1(ctx);

	return {
		c() {
			div3 = element("div");
			div0 = element("div");
			span0 = element("span");
			t0 = text("Neuester Beitrag");
			t1 = space();
			svg0 = svg_element("svg");
			path0 = svg_element("path");
			path1 = svg_element("path");
			t2 = space();
			article = element("article");
			span1 = element("span");
			t3 = text("Neuester Beitrag");
			t4 = space();
			button0 = element("button");
			if_block0.c();
			t5 = space();
			div2 = element("div");
			div1 = element("div");
			if (if_block1) if_block1.c();
			t6 = space();
			if (if_block2) if_block2.c();
			t7 = space();
			button1 = element("button");
			t8 = text(t8_value);
			t9 = space();
			button2 = element("button");
			t10 = text("Beitrag lesen\n\n              ");
			svg1 = svg_element("svg");
			path2 = svg_element("path");
			path3 = svg_element("path");
			this.h();
		},
		l(nodes) {
			div3 = claim_element(nodes, "DIV", { class: true });
			var div3_nodes = children(div3);
			div0 = claim_element(div3_nodes, "DIV", { class: true, "aria-hidden": true });
			var div0_nodes = children(div0);
			span0 = claim_element(div0_nodes, "SPAN", { class: true });
			var span0_nodes = children(span0);
			t0 = claim_text(span0_nodes, "Neuester Beitrag");
			span0_nodes.forEach(detach);
			t1 = claim_space(div0_nodes);
			svg0 = claim_svg_element(div0_nodes, "svg", { viewBox: true, class: true });
			var svg0_nodes = children(svg0);
			path0 = claim_svg_element(svg0_nodes, "path", { class: true, d: true });
			children(path0).forEach(detach);
			path1 = claim_svg_element(svg0_nodes, "path", { class: true, d: true });
			children(path1).forEach(detach);
			svg0_nodes.forEach(detach);
			div0_nodes.forEach(detach);
			t2 = claim_space(div3_nodes);
			article = claim_element(div3_nodes, "ARTICLE", { class: true });
			var article_nodes = children(article);
			span1 = claim_element(article_nodes, "SPAN", { class: true });
			var span1_nodes = children(span1);
			t3 = claim_text(span1_nodes, "Neuester Beitrag");
			span1_nodes.forEach(detach);
			t4 = claim_space(article_nodes);

			button0 = claim_element(article_nodes, "BUTTON", {
				type: true,
				class: true,
				"aria-label": true
			});

			var button0_nodes = children(button0);
			if_block0.l(button0_nodes);
			button0_nodes.forEach(detach);
			t5 = claim_space(article_nodes);
			div2 = claim_element(article_nodes, "DIV", { class: true });
			var div2_nodes = children(div2);
			div1 = claim_element(div2_nodes, "DIV", { class: true });
			var div1_nodes = children(div1);
			if (if_block1) if_block1.l(div1_nodes);
			t6 = claim_space(div1_nodes);
			if (if_block2) if_block2.l(div1_nodes);
			div1_nodes.forEach(detach);
			t7 = claim_space(div2_nodes);
			button1 = claim_element(div2_nodes, "BUTTON", { type: true, class: true });
			var button1_nodes = children(button1);
			t8 = claim_text(button1_nodes, t8_value);
			button1_nodes.forEach(detach);
			t9 = claim_space(div2_nodes);
			button2 = claim_element(div2_nodes, "BUTTON", { type: true, class: true });
			var button2_nodes = children(button2);
			t10 = claim_text(button2_nodes, "Beitrag lesen\n\n              ");

			svg1 = claim_svg_element(button2_nodes, "svg", {
				viewBox: true,
				"aria-hidden": true,
				class: true
			});

			var svg1_nodes = children(svg1);
			path2 = claim_svg_element(svg1_nodes, "path", { d: true, class: true });
			children(path2).forEach(detach);
			path3 = claim_svg_element(svg1_nodes, "path", { d: true, class: true });
			children(path3).forEach(detach);
			svg1_nodes.forEach(detach);
			button2_nodes.forEach(detach);
			div2_nodes.forEach(detach);
			article_nodes.forEach(detach);
			div3_nodes.forEach(detach);
			this.h();
		},
		h() {
			attr(span0, "class", "svelte-fdqjr9");
			attr(path0, "class", "cg-blog-featured-hero__annotation-line svelte-fdqjr9");
			attr(path0, "d", "M120 10 C91 10 76 21 65 36 C54 51 37 57 12 56");
			attr(path1, "class", "cg-blog-featured-hero__annotation-arrow svelte-fdqjr9");
			attr(path1, "d", "M23 47 L12 56 L25 62");
			attr(svg0, "viewBox", "0 0 130 70");
			attr(svg0, "class", "svelte-fdqjr9");
			attr(div0, "class", "cg-blog-featured-hero__annotation svelte-fdqjr9");
			attr(div0, "aria-hidden", "true");
			attr(span1, "class", "cg-blog-featured-hero__mobile-badge svelte-fdqjr9");
			attr(button0, "type", "button");
			attr(button0, "class", "cg-blog-featured-hero__image-button svelte-fdqjr9");
			attr(button0, "aria-label", button0_aria_label_value = "Beitrag öffnen: " + /*latestPost*/ ctx[4].title);
			attr(div1, "class", "cg-blog-featured-hero__meta svelte-fdqjr9");
			attr(button1, "type", "button");
			attr(button1, "class", "cg-blog-featured-hero__title svelte-fdqjr9");
			attr(path2, "d", "M5 12h14");
			attr(path2, "class", "svelte-fdqjr9");
			attr(path3, "d", "m14 7 5 5-5 5");
			attr(path3, "class", "svelte-fdqjr9");
			attr(svg1, "viewBox", "0 0 24 24");
			attr(svg1, "aria-hidden", "true");
			attr(svg1, "class", "svelte-fdqjr9");
			attr(button2, "type", "button");
			attr(button2, "class", "cg-blog-featured-hero__read svelte-fdqjr9");
			attr(div2, "class", "cg-blog-featured-hero__article-content svelte-fdqjr9");
			attr(article, "class", "cg-blog-featured-hero__article svelte-fdqjr9");
			attr(div3, "class", "cg-blog-featured-hero__featured svelte-fdqjr9");
		},
		m(target, anchor) {
			insert_hydration(target, div3, anchor);
			append_hydration(div3, div0);
			append_hydration(div0, span0);
			append_hydration(span0, t0);
			append_hydration(div0, t1);
			append_hydration(div0, svg0);
			append_hydration(svg0, path0);
			append_hydration(svg0, path1);
			append_hydration(div3, t2);
			append_hydration(div3, article);
			append_hydration(article, span1);
			append_hydration(span1, t3);
			append_hydration(article, t4);
			append_hydration(article, button0);
			if_block0.m(button0, null);
			append_hydration(article, t5);
			append_hydration(article, div2);
			append_hydration(div2, div1);
			if (if_block1) if_block1.m(div1, null);
			append_hydration(div1, t6);
			if (if_block2) if_block2.m(div1, null);
			append_hydration(div2, t7);
			append_hydration(div2, button1);
			append_hydration(button1, t8);
			append_hydration(div2, t9);
			append_hydration(div2, button2);
			append_hydration(button2, t10);
			append_hydration(button2, svg1);
			append_hydration(svg1, path2);
			append_hydration(svg1, path3);

			if (!mounted) {
				dispose = [
					listen(button0, "click", /*openLatestPost*/ ctx[5]),
					listen(button1, "click", /*openLatestPost*/ ctx[5]),
					listen(button2, "click", /*openLatestPost*/ ctx[5])
				];

				mounted = true;
			}
		},
		p(ctx, dirty) {
			if (current_block_type === (current_block_type = select_block_type_1(ctx)) && if_block0) {
				if_block0.p(ctx, dirty);
			} else {
				if_block0.d(1);
				if_block0 = current_block_type(ctx);

				if (if_block0) {
					if_block0.c();
					if_block0.m(button0, null);
				}
			}

			if (dirty & /*latestPost*/ 16 && button0_aria_label_value !== (button0_aria_label_value = "Beitrag öffnen: " + /*latestPost*/ ctx[4].title)) {
				attr(button0, "aria-label", button0_aria_label_value);
			}

			if (/*latestPost*/ ctx[4].category) {
				if (if_block1) {
					if_block1.p(ctx, dirty);
				} else {
					if_block1 = create_if_block_2(ctx);
					if_block1.c();
					if_block1.m(div1, t6);
				}
			} else if (if_block1) {
				if_block1.d(1);
				if_block1 = null;
			}

			if (/*latestPost*/ ctx[4].date) {
				if (if_block2) {
					if_block2.p(ctx, dirty);
				} else {
					if_block2 = create_if_block_1(ctx);
					if_block2.c();
					if_block2.m(div1, null);
				}
			} else if (if_block2) {
				if_block2.d(1);
				if_block2 = null;
			}

			if (dirty & /*latestPost*/ 16 && t8_value !== (t8_value = /*latestPost*/ ctx[4].title + "")) set_data(t8, t8_value);
		},
		d(detaching) {
			if (detaching) detach(div3);
			if_block0.d();
			if (if_block1) if_block1.d();
			if (if_block2) if_block2.d();
			mounted = false;
			run_all(dispose);
		}
	};
}

// (622:12) {:else}
function create_else_block(ctx) {
	let span;
	let t;

	return {
		c() {
			span = element("span");
			t = text("Titelbild");
			this.h();
		},
		l(nodes) {
			span = claim_element(nodes, "SPAN", { class: true });
			var span_nodes = children(span);
			t = claim_text(span_nodes, "Titelbild");
			span_nodes.forEach(detach);
			this.h();
		},
		h() {
			attr(span, "class", "cg-blog-featured-hero__placeholder svelte-fdqjr9");
		},
		m(target, anchor) {
			insert_hydration(target, span, anchor);
			append_hydration(span, t);
		},
		p: noop,
		d(detaching) {
			if (detaching) detach(span);
		}
	};
}

// (617:12) {#if latestPost.image && latestPost.image.url}
function create_if_block_3(ctx) {
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
			if (!src_url_equal(img.src, img_src_value = /*latestPost*/ ctx[4].image.url)) attr(img, "src", img_src_value);
			attr(img, "alt", img_alt_value = /*latestPost*/ ctx[4].image.alt || /*latestPost*/ ctx[4].title);
			attr(img, "class", "svelte-fdqjr9");
		},
		m(target, anchor) {
			insert_hydration(target, img, anchor);
		},
		p(ctx, dirty) {
			if (dirty & /*latestPost*/ 16 && !src_url_equal(img.src, img_src_value = /*latestPost*/ ctx[4].image.url)) {
				attr(img, "src", img_src_value);
			}

			if (dirty & /*latestPost*/ 16 && img_alt_value !== (img_alt_value = /*latestPost*/ ctx[4].image.alt || /*latestPost*/ ctx[4].title)) {
				attr(img, "alt", img_alt_value);
			}
		},
		d(detaching) {
			if (detaching) detach(img);
		}
	};
}

// (631:14) {#if latestPost.category}
function create_if_block_2(ctx) {
	let span;
	let t_value = /*latestPost*/ ctx[4].category + "";
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
			attr(span, "class", "cg-blog-featured-hero__category svelte-fdqjr9");
		},
		m(target, anchor) {
			insert_hydration(target, span, anchor);
			append_hydration(span, t);
		},
		p(ctx, dirty) {
			if (dirty & /*latestPost*/ 16 && t_value !== (t_value = /*latestPost*/ ctx[4].category + "")) set_data(t, t_value);
		},
		d(detaching) {
			if (detaching) detach(span);
		}
	};
}

// (637:14) {#if latestPost.date}
function create_if_block_1(ctx) {
	let span;
	let t_value = /*latestPost*/ ctx[4].date + "";
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
			attr(span, "class", "cg-blog-featured-hero__date svelte-fdqjr9");
		},
		m(target, anchor) {
			insert_hydration(target, span, anchor);
			append_hydration(span, t);
		},
		p(ctx, dirty) {
			if (dirty & /*latestPost*/ 16 && t_value !== (t_value = /*latestPost*/ ctx[4].date + "")) set_data(t, t_value);
		},
		d(detaching) {
			if (detaching) detach(span);
		}
	};
}

function create_fragment(ctx) {
	let section;
	let div1;
	let div0;
	let t0;
	let h1;
	let t1;
	let t2;
	let span0;
	let t3;
	let t4;
	let p;
	let t5;
	let t6;
	let t7;
	let span1;
	let t8;
	let if_block0 = /*eyebrow*/ ctx[0] && create_if_block_5(ctx);
	let if_block1 = /*benefits*/ ctx[2] && /*benefits*/ ctx[2].length > 0 && create_if_block_4(ctx);

	function select_block_type(ctx, dirty) {
		if (/*latestPost*/ ctx[4]) return create_if_block;
		return create_else_block_1;
	}

	let current_block_type = select_block_type(ctx);
	let if_block2 = current_block_type(ctx);

	return {
		c() {
			section = element("section");
			div1 = element("div");
			div0 = element("div");
			if (if_block0) if_block0.c();
			t0 = space();
			h1 = element("h1");
			t1 = text(/*heading*/ ctx[1]);
			t2 = space();
			span0 = element("span");
			t3 = text("Leben");
			t4 = space();
			p = element("p");
			t5 = text(/*description*/ ctx[3]);
			t6 = space();
			if (if_block1) if_block1.c();
			t7 = space();
			span1 = element("span");
			t8 = space();
			if_block2.c();
			this.h();
		},
		l(nodes) {
			section = claim_element(nodes, "SECTION", { class: true, "aria-labelledby": true });
			var section_nodes = children(section);
			div1 = claim_element(section_nodes, "DIV", { class: true });
			var div1_nodes = children(div1);
			div0 = claim_element(div1_nodes, "DIV", { class: true });
			var div0_nodes = children(div0);
			if (if_block0) if_block0.l(div0_nodes);
			t0 = claim_space(div0_nodes);
			h1 = claim_element(div0_nodes, "H1", { id: true, class: true });
			var h1_nodes = children(h1);
			t1 = claim_text(h1_nodes, /*heading*/ ctx[1]);
			t2 = claim_space(h1_nodes);
			span0 = claim_element(h1_nodes, "SPAN", { class: true });
			var span0_nodes = children(span0);
			t3 = claim_text(span0_nodes, "Leben");
			span0_nodes.forEach(detach);
			h1_nodes.forEach(detach);
			t4 = claim_space(div0_nodes);
			p = claim_element(div0_nodes, "P", { class: true });
			var p_nodes = children(p);
			t5 = claim_text(p_nodes, /*description*/ ctx[3]);
			p_nodes.forEach(detach);
			t6 = claim_space(div0_nodes);
			if (if_block1) if_block1.l(div0_nodes);
			t7 = claim_space(div0_nodes);
			span1 = claim_element(div0_nodes, "SPAN", { class: true, "aria-hidden": true });
			children(span1).forEach(detach);
			div0_nodes.forEach(detach);
			t8 = claim_space(div1_nodes);
			if_block2.l(div1_nodes);
			div1_nodes.forEach(detach);
			section_nodes.forEach(detach);
			this.h();
		},
		h() {
			attr(span0, "class", "cg-blog-featured-hero__heading-accent svelte-fdqjr9");
			attr(h1, "id", "cg-blog-featured-heading");
			attr(h1, "class", "svelte-fdqjr9");
			attr(p, "class", "cg-blog-featured-hero__description svelte-fdqjr9");
			attr(span1, "class", "cg-blog-featured-hero__line svelte-fdqjr9");
			attr(span1, "aria-hidden", "true");
			attr(div0, "class", "cg-blog-featured-hero__intro svelte-fdqjr9");
			attr(div1, "class", "cg-blog-featured-hero__inner svelte-fdqjr9");
			attr(section, "class", "cg-blog-featured-hero svelte-fdqjr9");
			attr(section, "aria-labelledby", "cg-blog-featured-heading");
		},
		m(target, anchor) {
			insert_hydration(target, section, anchor);
			append_hydration(section, div1);
			append_hydration(div1, div0);
			if (if_block0) if_block0.m(div0, null);
			append_hydration(div0, t0);
			append_hydration(div0, h1);
			append_hydration(h1, t1);
			append_hydration(h1, t2);
			append_hydration(h1, span0);
			append_hydration(span0, t3);
			append_hydration(div0, t4);
			append_hydration(div0, p);
			append_hydration(p, t5);
			append_hydration(div0, t6);
			if (if_block1) if_block1.m(div0, null);
			append_hydration(div0, t7);
			append_hydration(div0, span1);
			append_hydration(div1, t8);
			if_block2.m(div1, null);
		},
		p(ctx, [dirty]) {
			if (/*eyebrow*/ ctx[0]) {
				if (if_block0) {
					if_block0.p(ctx, dirty);
				} else {
					if_block0 = create_if_block_5(ctx);
					if_block0.c();
					if_block0.m(div0, t0);
				}
			} else if (if_block0) {
				if_block0.d(1);
				if_block0 = null;
			}

			if (dirty & /*heading*/ 2) set_data(t1, /*heading*/ ctx[1]);
			if (dirty & /*description*/ 8) set_data(t5, /*description*/ ctx[3]);

			if (/*benefits*/ ctx[2] && /*benefits*/ ctx[2].length > 0) {
				if (if_block1) {
					if_block1.p(ctx, dirty);
				} else {
					if_block1 = create_if_block_4(ctx);
					if_block1.c();
					if_block1.m(div0, t7);
				}
			} else if (if_block1) {
				if_block1.d(1);
				if_block1 = null;
			}

			if (current_block_type === (current_block_type = select_block_type(ctx)) && if_block2) {
				if_block2.p(ctx, dirty);
			} else {
				if_block2.d(1);
				if_block2 = current_block_type(ctx);

				if (if_block2) {
					if_block2.c();
					if_block2.m(div1, null);
				}
			}
		},
		i: noop,
		o: noop,
		d(detaching) {
			if (detaching) detach(section);
			if (if_block0) if_block0.d();
			if (if_block1) if_block1.d();
			if_block2.d();
		}
	};
}

function instance($$self, $$props, $$invalidate) {
	let { props } = $$props;
	let { eyebrow } = $$props;
	let { heading } = $$props;
	let { benefits } = $$props;
	let { statement } = $$props;
	let { description } = $$props;
	let latestPost = null;

	function receiveLatestPost(event) {
		if (event.detail) {
			$$invalidate(4, latestPost = event.detail);
		}
	}

	function openLatestPost() {
		if (!latestPost || typeof window === "undefined") return;
		window.dispatchEvent(new CustomEvent("cg-blog-open-post", { detail: latestPost }));
	}

	onMount(() => {
		window.addEventListener("cg-blog-latest-post", receiveLatestPost);

		/*
  Falls der Blog-Block bereits geladen wurde,
  liegt der Beitrag hier schon bereit.
*/
		if (window.__cgLatestBlogPost) {
			$$invalidate(4, latestPost = window.__cgLatestBlogPost);
		}

		/*
  Fordert den neuesten Beitrag noch einmal an.
  Das macht die Verbindung unabhängig davon,
  welcher Block zuerst geladen wird.
*/
		window.dispatchEvent(new CustomEvent("cg-blog-request-latest-post"));

		return () => {
			window.removeEventListener("cg-blog-latest-post", receiveLatestPost);
		};
	});

	$$self.$$set = $$props => {
		if ('props' in $$props) $$invalidate(6, props = $$props.props);
		if ('eyebrow' in $$props) $$invalidate(0, eyebrow = $$props.eyebrow);
		if ('heading' in $$props) $$invalidate(1, heading = $$props.heading);
		if ('benefits' in $$props) $$invalidate(2, benefits = $$props.benefits);
		if ('statement' in $$props) $$invalidate(7, statement = $$props.statement);
		if ('description' in $$props) $$invalidate(3, description = $$props.description);
	};

	return [
		eyebrow,
		heading,
		benefits,
		description,
		latestPost,
		openLatestPost,
		props,
		statement
	];
}

class Component extends SvelteComponent {
	constructor(options) {
		super();

		init(this, options, instance, create_fragment, safe_not_equal, {
			props: 6,
			eyebrow: 0,
			heading: 1,
			benefits: 2,
			statement: 7,
			description: 3
		});
	}
}

export { Component as default };

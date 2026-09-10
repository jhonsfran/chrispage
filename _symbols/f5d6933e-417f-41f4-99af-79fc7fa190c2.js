// Filter und Blogbeiträge - Updated September 10, 2026
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
function set_input_value(input, value) {
    input.value = value == null ? '' : value;
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
	child_ctx[16] = list[i];
	return child_ctx;
}

function get_each_context_1(ctx, list, i) {
	const child_ctx = ctx.slice();
	child_ctx[19] = list[i];
	return child_ctx;
}

// (603:8) {#each categories as category}
function create_each_block_1(ctx) {
	let button;
	let t0_value = /*category*/ ctx[19].label + "";
	let t0;
	let t1;
	let button_aria_pressed_value;
	let mounted;
	let dispose;

	function click_handler() {
		return /*click_handler*/ ctx[12](/*category*/ ctx[19]);
	}

	return {
		c() {
			button = element("button");
			t0 = text(t0_value);
			t1 = space();
			this.h();
		},
		l(nodes) {
			button = claim_element(nodes, "BUTTON", {
				type: true,
				"aria-pressed": true,
				class: true
			});

			var button_nodes = children(button);
			t0 = claim_text(button_nodes, t0_value);
			t1 = claim_space(button_nodes);
			button_nodes.forEach(detach);
			this.h();
		},
		h() {
			attr(button, "type", "button");
			attr(button, "aria-pressed", button_aria_pressed_value = /*activeCategory*/ ctx[4] === /*category*/ ctx[19].label);
			attr(button, "class", "svelte-oe1ka9");
			toggle_class(button, "active", /*activeCategory*/ ctx[4] === /*category*/ ctx[19].label);
		},
		m(target, anchor) {
			insert_hydration(target, button, anchor);
			append_hydration(button, t0);
			append_hydration(button, t1);

			if (!mounted) {
				dispose = listen(button, "click", click_handler);
				mounted = true;
			}
		},
		p(new_ctx, dirty) {
			ctx = new_ctx;
			if (dirty & /*categories*/ 8 && t0_value !== (t0_value = /*category*/ ctx[19].label + "")) set_data(t0, t0_value);

			if (dirty & /*activeCategory, categories*/ 24 && button_aria_pressed_value !== (button_aria_pressed_value = /*activeCategory*/ ctx[4] === /*category*/ ctx[19].label)) {
				attr(button, "aria-pressed", button_aria_pressed_value);
			}

			if (dirty & /*activeCategory, categories*/ 24) {
				toggle_class(button, "active", /*activeCategory*/ ctx[4] === /*category*/ ctx[19].label);
			}
		},
		d(detaching) {
			if (detaching) detach(button);
			mounted = false;
			dispose();
		}
	};
}

// (705:4) {:else}
function create_else_block(ctx) {
	let div;
	let p;
	let t;

	return {
		c() {
			div = element("div");
			p = element("p");
			t = text(/*empty_message*/ ctx[2]);
			this.h();
		},
		l(nodes) {
			div = claim_element(nodes, "DIV", { class: true });
			var div_nodes = children(div);
			p = claim_element(div_nodes, "P", { class: true });
			var p_nodes = children(p);
			t = claim_text(p_nodes, /*empty_message*/ ctx[2]);
			p_nodes.forEach(detach);
			div_nodes.forEach(detach);
			this.h();
		},
		h() {
			attr(p, "class", "svelte-oe1ka9");
			attr(div, "class", "cg-blog-empty svelte-oe1ka9");
		},
		m(target, anchor) {
			insert_hydration(target, div, anchor);
			append_hydration(div, p);
			append_hydration(p, t);
		},
		p(ctx, dirty) {
			if (dirty & /*empty_message*/ 4) set_data(t, /*empty_message*/ ctx[2]);
		},
		d(detaching) {
			if (detaching) detach(div);
		}
	};
}

// (637:4) {#if filteredPosts.length > 0}
function create_if_block(ctx) {
	let div;
	let each_value = /*filteredPosts*/ ctx[7];
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
			attr(div, "class", "cg-blog-grid svelte-oe1ka9");
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
			if (dirty & /*openPost, filteredPosts, togglePost, renderPostContent*/ 704) {
				each_value = /*filteredPosts*/ ctx[7];
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

// (639:8) {#each filteredPosts as post}
function create_each_block(ctx) {
	let article;
	let div0;
	let img;
	let img_src_value;
	let img_alt_value;
	let t0;
	let div5;
	let div1;
	let span;
	let t1_value = /*post*/ ctx[16].category + "";
	let t1;
	let t2;
	let time;
	let t3_value = /*post*/ ctx[16].date_label + "";
	let t3;
	let time_datetime_value;
	let t4;
	let h3;
	let t5_value = /*post*/ ctx[16].title + "";
	let t5;
	let t6;
	let p;
	let t7_value = /*post*/ ctx[16].teaser + "";
	let t7;
	let t8;
	let div4;
	let div3;
	let div2;
	let raw_value = renderPostContent(/*post*/ ctx[16].content) + "";
	let div2_id_value;
	let div4_aria_hidden_value;
	let t9;
	let button;

	let t10_value = (/*openPost*/ ctx[6] === /*post*/ ctx[16].id
	? "Weniger anzeigen"
	: "Mehr anzeigen") + "";

	let t10;
	let t11;
	let svg;
	let path;
	let button_aria_expanded_value;
	let button_aria_controls_value;
	let t12;
	let mounted;
	let dispose;

	function click_handler_1() {
		return /*click_handler_1*/ ctx[15](/*post*/ ctx[16]);
	}

	return {
		c() {
			article = element("article");
			div0 = element("div");
			img = element("img");
			t0 = space();
			div5 = element("div");
			div1 = element("div");
			span = element("span");
			t1 = text(t1_value);
			t2 = space();
			time = element("time");
			t3 = text(t3_value);
			t4 = space();
			h3 = element("h3");
			t5 = text(t5_value);
			t6 = space();
			p = element("p");
			t7 = text(t7_value);
			t8 = space();
			div4 = element("div");
			div3 = element("div");
			div2 = element("div");
			t9 = space();
			button = element("button");
			t10 = text(t10_value);
			t11 = space();
			svg = svg_element("svg");
			path = svg_element("path");
			t12 = space();
			this.h();
		},
		l(nodes) {
			article = claim_element(nodes, "ARTICLE", { class: true });
			var article_nodes = children(article);
			div0 = claim_element(article_nodes, "DIV", { class: true });
			var div0_nodes = children(div0);

			img = claim_element(div0_nodes, "IMG", {
				src: true,
				alt: true,
				loading: true,
				class: true
			});

			div0_nodes.forEach(detach);
			t0 = claim_space(article_nodes);
			div5 = claim_element(article_nodes, "DIV", { class: true });
			var div5_nodes = children(div5);
			div1 = claim_element(div5_nodes, "DIV", { class: true });
			var div1_nodes = children(div1);
			span = claim_element(div1_nodes, "SPAN", { class: true });
			var span_nodes = children(span);
			t1 = claim_text(span_nodes, t1_value);
			span_nodes.forEach(detach);
			t2 = claim_space(div1_nodes);
			time = claim_element(div1_nodes, "TIME", { datetime: true, class: true });
			var time_nodes = children(time);
			t3 = claim_text(time_nodes, t3_value);
			time_nodes.forEach(detach);
			div1_nodes.forEach(detach);
			t4 = claim_space(div5_nodes);
			h3 = claim_element(div5_nodes, "H3", { class: true });
			var h3_nodes = children(h3);
			t5 = claim_text(h3_nodes, t5_value);
			h3_nodes.forEach(detach);
			t6 = claim_space(div5_nodes);
			p = claim_element(div5_nodes, "P", { class: true });
			var p_nodes = children(p);
			t7 = claim_text(p_nodes, t7_value);
			p_nodes.forEach(detach);
			t8 = claim_space(div5_nodes);
			div4 = claim_element(div5_nodes, "DIV", { class: true, "aria-hidden": true });
			var div4_nodes = children(div4);
			div3 = claim_element(div4_nodes, "DIV", { class: true });
			var div3_nodes = children(div3);
			div2 = claim_element(div3_nodes, "DIV", { id: true, class: true });
			var div2_nodes = children(div2);
			div2_nodes.forEach(detach);
			div3_nodes.forEach(detach);
			div4_nodes.forEach(detach);
			t9 = claim_space(div5_nodes);

			button = claim_element(div5_nodes, "BUTTON", {
				type: true,
				class: true,
				"aria-expanded": true,
				"aria-controls": true
			});

			var button_nodes = children(button);
			t10 = claim_text(button_nodes, t10_value);
			t11 = claim_space(button_nodes);

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
			div5_nodes.forEach(detach);
			t12 = claim_space(article_nodes);
			article_nodes.forEach(detach);
			this.h();
		},
		h() {
			if (!src_url_equal(img.src, img_src_value = /*post*/ ctx[16].image.url)) attr(img, "src", img_src_value);
			attr(img, "alt", img_alt_value = /*post*/ ctx[16].image.alt);
			attr(img, "loading", "lazy");
			attr(img, "class", "svelte-oe1ka9");
			attr(div0, "class", "cg-blog-card__image svelte-oe1ka9");
			attr(span, "class", "svelte-oe1ka9");
			attr(time, "datetime", time_datetime_value = /*post*/ ctx[16].date_iso);
			attr(time, "class", "svelte-oe1ka9");
			attr(div1, "class", "cg-blog-card__meta svelte-oe1ka9");
			attr(h3, "class", "svelte-oe1ka9");
			attr(p, "class", "cg-blog-card__teaser svelte-oe1ka9");
			attr(div2, "id", div2_id_value = "cg-post-" + /*post*/ ctx[16].id);
			attr(div2, "class", "cg-blog-card__content svelte-oe1ka9");
			attr(div3, "class", "cg-blog-card__expander-inner svelte-oe1ka9");
			attr(div4, "class", "cg-blog-card__expander svelte-oe1ka9");
			attr(div4, "aria-hidden", div4_aria_hidden_value = /*openPost*/ ctx[6] !== /*post*/ ctx[16].id);
			toggle_class(div4, "is-open", /*openPost*/ ctx[6] === /*post*/ ctx[16].id);
			attr(path, "d", "m8 10 4 4 4-4");
			attr(path, "class", "svelte-oe1ka9");
			attr(svg, "viewBox", "0 0 24 24");
			attr(svg, "aria-hidden", "true");
			attr(svg, "class", "svelte-oe1ka9");
			toggle_class(svg, "rotated", /*openPost*/ ctx[6] === /*post*/ ctx[16].id);
			attr(button, "type", "button");
			attr(button, "class", "cg-blog-card__button svelte-oe1ka9");
			attr(button, "aria-expanded", button_aria_expanded_value = /*openPost*/ ctx[6] === /*post*/ ctx[16].id);
			attr(button, "aria-controls", button_aria_controls_value = "cg-post-" + /*post*/ ctx[16].id);
			attr(div5, "class", "cg-blog-card__body svelte-oe1ka9");
			attr(article, "class", "cg-blog-card svelte-oe1ka9");
			toggle_class(article, "expanded", /*openPost*/ ctx[6] === /*post*/ ctx[16].id);
		},
		m(target, anchor) {
			insert_hydration(target, article, anchor);
			append_hydration(article, div0);
			append_hydration(div0, img);
			append_hydration(article, t0);
			append_hydration(article, div5);
			append_hydration(div5, div1);
			append_hydration(div1, span);
			append_hydration(span, t1);
			append_hydration(div1, t2);
			append_hydration(div1, time);
			append_hydration(time, t3);
			append_hydration(div5, t4);
			append_hydration(div5, h3);
			append_hydration(h3, t5);
			append_hydration(div5, t6);
			append_hydration(div5, p);
			append_hydration(p, t7);
			append_hydration(div5, t8);
			append_hydration(div5, div4);
			append_hydration(div4, div3);
			append_hydration(div3, div2);
			div2.innerHTML = raw_value;
			append_hydration(div5, t9);
			append_hydration(div5, button);
			append_hydration(button, t10);
			append_hydration(button, t11);
			append_hydration(button, svg);
			append_hydration(svg, path);
			append_hydration(article, t12);

			if (!mounted) {
				dispose = listen(button, "click", click_handler_1);
				mounted = true;
			}
		},
		p(new_ctx, dirty) {
			ctx = new_ctx;

			if (dirty & /*filteredPosts*/ 128 && !src_url_equal(img.src, img_src_value = /*post*/ ctx[16].image.url)) {
				attr(img, "src", img_src_value);
			}

			if (dirty & /*filteredPosts*/ 128 && img_alt_value !== (img_alt_value = /*post*/ ctx[16].image.alt)) {
				attr(img, "alt", img_alt_value);
			}

			if (dirty & /*filteredPosts*/ 128 && t1_value !== (t1_value = /*post*/ ctx[16].category + "")) set_data(t1, t1_value);
			if (dirty & /*filteredPosts*/ 128 && t3_value !== (t3_value = /*post*/ ctx[16].date_label + "")) set_data(t3, t3_value);

			if (dirty & /*filteredPosts*/ 128 && time_datetime_value !== (time_datetime_value = /*post*/ ctx[16].date_iso)) {
				attr(time, "datetime", time_datetime_value);
			}

			if (dirty & /*filteredPosts*/ 128 && t5_value !== (t5_value = /*post*/ ctx[16].title + "")) set_data(t5, t5_value);
			if (dirty & /*filteredPosts*/ 128 && t7_value !== (t7_value = /*post*/ ctx[16].teaser + "")) set_data(t7, t7_value);
			if (dirty & /*filteredPosts*/ 128 && raw_value !== (raw_value = renderPostContent(/*post*/ ctx[16].content) + "")) div2.innerHTML = raw_value;
			if (dirty & /*filteredPosts*/ 128 && div2_id_value !== (div2_id_value = "cg-post-" + /*post*/ ctx[16].id)) {
				attr(div2, "id", div2_id_value);
			}

			if (dirty & /*openPost, filteredPosts*/ 192 && div4_aria_hidden_value !== (div4_aria_hidden_value = /*openPost*/ ctx[6] !== /*post*/ ctx[16].id)) {
				attr(div4, "aria-hidden", div4_aria_hidden_value);
			}

			if (dirty & /*openPost, filteredPosts*/ 192) {
				toggle_class(div4, "is-open", /*openPost*/ ctx[6] === /*post*/ ctx[16].id);
			}

			if (dirty & /*openPost, filteredPosts*/ 192 && t10_value !== (t10_value = (/*openPost*/ ctx[6] === /*post*/ ctx[16].id
			? "Weniger anzeigen"
			: "Mehr anzeigen") + "")) set_data(t10, t10_value);

			if (dirty & /*openPost, filteredPosts*/ 192) {
				toggle_class(svg, "rotated", /*openPost*/ ctx[6] === /*post*/ ctx[16].id);
			}

			if (dirty & /*openPost, filteredPosts*/ 192 && button_aria_expanded_value !== (button_aria_expanded_value = /*openPost*/ ctx[6] === /*post*/ ctx[16].id)) {
				attr(button, "aria-expanded", button_aria_expanded_value);
			}

			if (dirty & /*filteredPosts*/ 128 && button_aria_controls_value !== (button_aria_controls_value = "cg-post-" + /*post*/ ctx[16].id)) {
				attr(button, "aria-controls", button_aria_controls_value);
			}

			if (dirty & /*openPost, filteredPosts*/ 192) {
				toggle_class(article, "expanded", /*openPost*/ ctx[6] === /*post*/ ctx[16].id);
			}
		},
		d(detaching) {
			if (detaching) detach(article);
			mounted = false;
			dispose();
		}
	};
}

function create_fragment(ctx) {
	let section;
	let div2;
	let h2;
	let t0;
	let t1;
	let div1;
	let div0;
	let t2;
	let label;
	let svg;
	let circle;
	let path;
	let t3;
	let span;
	let t4;
	let t5;
	let input;
	let t6;
	let mounted;
	let dispose;
	let each_value_1 = /*categories*/ ctx[3];
	let each_blocks = [];

	for (let i = 0; i < each_value_1.length; i += 1) {
		each_blocks[i] = create_each_block_1(get_each_context_1(ctx, each_value_1, i));
	}

	function select_block_type(ctx, dirty) {
		if (/*filteredPosts*/ ctx[7].length > 0) return create_if_block;
		return create_else_block;
	}

	let current_block_type = select_block_type(ctx);
	let if_block = current_block_type(ctx);

	return {
		c() {
			section = element("section");
			div2 = element("div");
			h2 = element("h2");
			t0 = text(/*heading*/ ctx[0]);
			t1 = space();
			div1 = element("div");
			div0 = element("div");

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].c();
			}

			t2 = space();
			label = element("label");
			svg = svg_element("svg");
			circle = svg_element("circle");
			path = svg_element("path");
			t3 = space();
			span = element("span");
			t4 = text("Beiträge durchsuchen");
			t5 = space();
			input = element("input");
			t6 = space();
			if_block.c();
			this.h();
		},
		l(nodes) {
			section = claim_element(nodes, "SECTION", { class: true, "aria-labelledby": true });
			var section_nodes = children(section);
			div2 = claim_element(section_nodes, "DIV", { class: true });
			var div2_nodes = children(div2);
			h2 = claim_element(div2_nodes, "H2", { id: true, class: true });
			var h2_nodes = children(h2);
			t0 = claim_text(h2_nodes, /*heading*/ ctx[0]);
			h2_nodes.forEach(detach);
			t1 = claim_space(div2_nodes);
			div1 = claim_element(div2_nodes, "DIV", { class: true });
			var div1_nodes = children(div1);
			div0 = claim_element(div1_nodes, "DIV", { class: true, "aria-label": true });
			var div0_nodes = children(div0);

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].l(div0_nodes);
			}

			div0_nodes.forEach(detach);
			t2 = claim_space(div1_nodes);
			label = claim_element(div1_nodes, "LABEL", { class: true });
			var label_nodes = children(label);

			svg = claim_svg_element(label_nodes, "svg", {
				viewBox: true,
				"aria-hidden": true,
				class: true
			});

			var svg_nodes = children(svg);
			circle = claim_svg_element(svg_nodes, "circle", { cx: true, cy: true, r: true, class: true });
			children(circle).forEach(detach);
			path = claim_svg_element(svg_nodes, "path", { d: true, class: true });
			children(path).forEach(detach);
			svg_nodes.forEach(detach);
			t3 = claim_space(label_nodes);
			span = claim_element(label_nodes, "SPAN", { class: true });
			var span_nodes = children(span);
			t4 = claim_text(span_nodes, "Beiträge durchsuchen");
			span_nodes.forEach(detach);
			t5 = claim_space(label_nodes);

			input = claim_element(label_nodes, "INPUT", {
				type: true,
				placeholder: true,
				class: true
			});

			label_nodes.forEach(detach);
			div1_nodes.forEach(detach);
			t6 = claim_space(div2_nodes);
			if_block.l(div2_nodes);
			div2_nodes.forEach(detach);
			section_nodes.forEach(detach);
			this.h();
		},
		h() {
			attr(h2, "id", "cg-posts-heading");
			attr(h2, "class", "cg-visually-hidden svelte-oe1ka9");
			attr(div0, "class", "cg-blog-filters svelte-oe1ka9");
			attr(div0, "aria-label", "Beiträge nach Kategorie filtern");
			attr(circle, "cx", "11");
			attr(circle, "cy", "11");
			attr(circle, "r", "7");
			attr(circle, "class", "svelte-oe1ka9");
			attr(path, "d", "m16 16 4 4");
			attr(path, "class", "svelte-oe1ka9");
			attr(svg, "viewBox", "0 0 24 24");
			attr(svg, "aria-hidden", "true");
			attr(svg, "class", "svelte-oe1ka9");
			attr(span, "class", "cg-visually-hidden svelte-oe1ka9");
			attr(input, "type", "search");
			attr(input, "placeholder", /*search_placeholder*/ ctx[1]);
			attr(input, "class", "svelte-oe1ka9");
			attr(label, "class", "cg-blog-search svelte-oe1ka9");
			attr(div1, "class", "cg-blog-toolbar svelte-oe1ka9");
			attr(div2, "class", "cg-blog-posts__inner svelte-oe1ka9");
			attr(section, "class", "cg-blog-posts svelte-oe1ka9");
			attr(section, "aria-labelledby", "cg-posts-heading");
		},
		m(target, anchor) {
			insert_hydration(target, section, anchor);
			append_hydration(section, div2);
			append_hydration(div2, h2);
			append_hydration(h2, t0);
			append_hydration(div2, t1);
			append_hydration(div2, div1);
			append_hydration(div1, div0);

			for (let i = 0; i < each_blocks.length; i += 1) {
				if (each_blocks[i]) {
					each_blocks[i].m(div0, null);
				}
			}

			append_hydration(div1, t2);
			append_hydration(div1, label);
			append_hydration(label, svg);
			append_hydration(svg, circle);
			append_hydration(svg, path);
			append_hydration(label, t3);
			append_hydration(label, span);
			append_hydration(span, t4);
			append_hydration(label, t5);
			append_hydration(label, input);
			set_input_value(input, /*searchTerm*/ ctx[5]);
			append_hydration(div2, t6);
			if_block.m(div2, null);

			if (!mounted) {
				dispose = [
					listen(input, "input", /*input_input_handler*/ ctx[13]),
					listen(input, "input", /*input_handler*/ ctx[14])
				];

				mounted = true;
			}
		},
		p(ctx, [dirty]) {
			if (dirty & /*heading*/ 1) set_data(t0, /*heading*/ ctx[0]);

			if (dirty & /*activeCategory, categories, selectCategory*/ 280) {
				each_value_1 = /*categories*/ ctx[3];
				let i;

				for (i = 0; i < each_value_1.length; i += 1) {
					const child_ctx = get_each_context_1(ctx, each_value_1, i);

					if (each_blocks[i]) {
						each_blocks[i].p(child_ctx, dirty);
					} else {
						each_blocks[i] = create_each_block_1(child_ctx);
						each_blocks[i].c();
						each_blocks[i].m(div0, null);
					}
				}

				for (; i < each_blocks.length; i += 1) {
					each_blocks[i].d(1);
				}

				each_blocks.length = each_value_1.length;
			}

			if (dirty & /*search_placeholder*/ 2) {
				attr(input, "placeholder", /*search_placeholder*/ ctx[1]);
			}

			if (dirty & /*searchTerm*/ 32 && input.value !== /*searchTerm*/ ctx[5]) {
				set_input_value(input, /*searchTerm*/ ctx[5]);
			}

			if (current_block_type === (current_block_type = select_block_type(ctx)) && if_block) {
				if_block.p(ctx, dirty);
			} else {
				if_block.d(1);
				if_block = current_block_type(ctx);

				if (if_block) {
					if_block.c();
					if_block.m(div2, null);
				}
			}
		},
		i: noop,
		o: noop,
		d(detaching) {
			if (detaching) detach(section);
			destroy_each(each_blocks, detaching);
			if_block.d();
			mounted = false;
			run_all(dispose);
		}
	};
}

function escapeHTML(value = "") {
	return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function renderMarks(text, marks = []) {
	return marks.reduce(
		(output, mark) => {
			if (mark.type === "bold") {
				return `<strong>${output}</strong>`;
			}

			if (mark.type === "italic") {
				return `<em>${output}</em>`;
			}

			if (mark.type === "underline") {
				return `<u>${output}</u>`;
			}

			if (mark.type === "code") {
				return `<code>${output}</code>`;
			}

			if (mark.type === "link") {
				const href = escapeHTML(mark.attrs?.href || "#");
				return `<a href="${href}" target="_blank" rel="noopener">${output}</a>`;
			}

			return output;
		},
		text
	);
}

function renderRichTextNode(node) {
	if (!node) return "";

	if (Array.isArray(node)) {
		return node.map(renderRichTextNode).join("");
	}

	const children = renderRichTextNode(node.content || []);

	switch (node.type) {
		case "doc":
			return children;
		case "paragraph":
			return `<p>${children || "<br>"}</p>`;
		case "heading":
			{
				const level = Math.min(Math.max(node.attrs?.level || 2, 2), 4);
				return `<h${level}>${children}</h${level}>`;
			}
		case "bulletList":
			return `<ul>${children}</ul>`;
		case "orderedList":
			return `<ol>${children}</ol>`;
		case "listItem":
			return `<li>${children}</li>`;
		case "blockquote":
			return `<blockquote>${children}</blockquote>`;
		case "hardBreak":
			return "<br>";
		case "horizontalRule":
			return "<hr>";
		case "text":
			return renderMarks(escapeHTML(node.text || ""), node.marks || []);
		default:
			return children;
	}
}

function renderPostContent(content) {
	if (!content) return "";

	if (typeof content === "string") {
		return content;
	}

	if (typeof content.html === "string") {
		return content.html;
	}

	if (typeof content.value === "string") {
		return content.value;
	}

	return renderRichTextNode(content);
}

function instance($$self, $$props, $$invalidate) {
	let filteredPosts;
	let { props } = $$props;
	let { heading } = $$props;
	let { search_placeholder } = $$props;
	let { empty_message } = $$props;
	let { categories } = $$props;
	let { posts } = $$props;
	let activeCategory = "Alle Beiträge";
	let searchTerm = "";
	let openPost = null;

	function selectCategory(category) {
		$$invalidate(4, activeCategory = category);
		$$invalidate(6, openPost = null);
	}

	function togglePost(id) {
		$$invalidate(6, openPost = openPost === id ? null : id);
	}

	const click_handler = category => selectCategory(category.label);

	function input_input_handler() {
		searchTerm = this.value;
		$$invalidate(5, searchTerm);
	}

	const input_handler = () => $$invalidate(6, openPost = null);
	const click_handler_1 = post => togglePost(post.id);

	$$self.$$set = $$props => {
		if ('props' in $$props) $$invalidate(10, props = $$props.props);
		if ('heading' in $$props) $$invalidate(0, heading = $$props.heading);
		if ('search_placeholder' in $$props) $$invalidate(1, search_placeholder = $$props.search_placeholder);
		if ('empty_message' in $$props) $$invalidate(2, empty_message = $$props.empty_message);
		if ('categories' in $$props) $$invalidate(3, categories = $$props.categories);
		if ('posts' in $$props) $$invalidate(11, posts = $$props.posts);
	};

	$$self.$$.update = () => {
		if ($$self.$$.dirty & /*posts, activeCategory, searchTerm*/ 2096) {
			$$invalidate(7, filteredPosts = (posts || []).filter(post => {
				const matchesCategory = activeCategory === "Alle Beiträge" || post.category === activeCategory;
				const term = searchTerm.trim().toLocaleLowerCase("de");
				const searchableText = [post.title, post.teaser, post.category].filter(Boolean).join(" ").toLocaleLowerCase("de");
				return matchesCategory && (term === "" || searchableText.includes(term));
			}));
		}
	};

	return [
		heading,
		search_placeholder,
		empty_message,
		categories,
		activeCategory,
		searchTerm,
		openPost,
		filteredPosts,
		selectCategory,
		togglePost,
		props,
		posts,
		click_handler,
		input_input_handler,
		input_handler,
		click_handler_1
	];
}

class Component extends SvelteComponent {
	constructor(options) {
		super();

		init(this, options, instance, create_fragment, safe_not_equal, {
			props: 10,
			heading: 0,
			search_placeholder: 1,
			empty_message: 2,
			categories: 3,
			posts: 11
		});
	}
}

export { Component as default };

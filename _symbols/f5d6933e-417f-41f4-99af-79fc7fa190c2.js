// Filter und Blogbeiträge - Updated September 15, 2026
function noop() { }
const identity = x => x;
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
function split_css_unit(value) {
    const split = typeof value === 'string' && value.match(/^\s*(-?[\d.]+)([^\s]*)\s*$/);
    return split ? [parseFloat(split[1]), split[2] || 'px'] : [value, 'px'];
}

const is_client = typeof window !== 'undefined';
let now = is_client
    ? () => window.performance.now()
    : () => Date.now();
let raf = is_client ? cb => requestAnimationFrame(cb) : noop;

const tasks = new Set();
function run_tasks(now) {
    tasks.forEach(task => {
        if (!task.c(now)) {
            tasks.delete(task);
            task.f();
        }
    });
    if (tasks.size !== 0)
        raf(run_tasks);
}
/**
 * Creates a new task that runs on each raf frame
 * until it returns a falsy value or is aborted
 */
function loop(callback) {
    let task;
    if (tasks.size === 0)
        raf(run_tasks);
    return {
        promise: new Promise(fulfill => {
            tasks.add(task = { c: callback, f: fulfill });
        }),
        abort() {
            tasks.delete(task);
        }
    };
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
function append(target, node) {
    target.appendChild(node);
}
function get_root_for_style(node) {
    if (!node)
        return document;
    const root = node.getRootNode ? node.getRootNode() : node.ownerDocument;
    if (root && root.host) {
        return root;
    }
    return node.ownerDocument;
}
function append_empty_stylesheet(node) {
    const style_element = element('style');
    append_stylesheet(get_root_for_style(node), style_element);
    return style_element.sheet;
}
function append_stylesheet(node, style) {
    append(node.head || node, style);
    return style.sheet;
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
function empty() {
    return text('');
}
function listen(node, event, handler, options) {
    node.addEventListener(event, handler, options);
    return () => node.removeEventListener(event, handler, options);
}
function self(fn) {
    return function (event) {
        // @ts-ignore
        if (event.target === this)
            fn.call(this, event);
    };
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
function custom_event(type, detail, { bubbles = false, cancelable = false } = {}) {
    const e = document.createEvent('CustomEvent');
    e.initCustomEvent(type, bubbles, cancelable, detail);
    return e;
}

// we need to store the information for multiple documents because a Svelte application could also contain iframes
// https://github.com/sveltejs/svelte/issues/3624
const managed_styles = new Map();
let active = 0;
// https://github.com/darkskyapp/string-hash/blob/master/index.js
function hash(str) {
    let hash = 5381;
    let i = str.length;
    while (i--)
        hash = ((hash << 5) - hash) ^ str.charCodeAt(i);
    return hash >>> 0;
}
function create_style_information(doc, node) {
    const info = { stylesheet: append_empty_stylesheet(node), rules: {} };
    managed_styles.set(doc, info);
    return info;
}
function create_rule(node, a, b, duration, delay, ease, fn, uid = 0) {
    const step = 16.666 / duration;
    let keyframes = '{\n';
    for (let p = 0; p <= 1; p += step) {
        const t = a + (b - a) * ease(p);
        keyframes += p * 100 + `%{${fn(t, 1 - t)}}\n`;
    }
    const rule = keyframes + `100% {${fn(b, 1 - b)}}\n}`;
    const name = `__svelte_${hash(rule)}_${uid}`;
    const doc = get_root_for_style(node);
    const { stylesheet, rules } = managed_styles.get(doc) || create_style_information(doc, node);
    if (!rules[name]) {
        rules[name] = true;
        stylesheet.insertRule(`@keyframes ${name} ${rule}`, stylesheet.cssRules.length);
    }
    const animation = node.style.animation || '';
    node.style.animation = `${animation ? `${animation}, ` : ''}${name} ${duration}ms linear ${delay}ms 1 both`;
    active += 1;
    return name;
}
function delete_rule(node, name) {
    const previous = (node.style.animation || '').split(', ');
    const next = previous.filter(name
        ? anim => anim.indexOf(name) < 0 // remove specific animation
        : anim => anim.indexOf('__svelte') === -1 // remove all Svelte animations
    );
    const deleted = previous.length - next.length;
    if (deleted) {
        node.style.animation = next.join(', ');
        active -= deleted;
        if (!active)
            clear_rules();
    }
}
function clear_rules() {
    raf(() => {
        if (active)
            return;
        managed_styles.forEach(info => {
            const { ownerNode } = info.stylesheet;
            // there is no ownerNode if it runs on jsdom.
            if (ownerNode)
                detach(ownerNode);
        });
        managed_styles.clear();
    });
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

let promise;
function wait() {
    if (!promise) {
        promise = Promise.resolve();
        promise.then(() => {
            promise = null;
        });
    }
    return promise;
}
function dispatch(node, direction, kind) {
    node.dispatchEvent(custom_event(`${direction ? 'intro' : 'outro'}${kind}`));
}
const outroing = new Set();
let outros;
function group_outros() {
    outros = {
        r: 0,
        c: [],
        p: outros // parent group
    };
}
function check_outros() {
    if (!outros.r) {
        run_all(outros.c);
    }
    outros = outros.p;
}
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
const null_transition = { duration: 0 };
function create_bidirectional_transition(node, fn, params, intro) {
    const options = { direction: 'both' };
    let config = fn(node, params, options);
    let t = intro ? 0 : 1;
    let running_program = null;
    let pending_program = null;
    let animation_name = null;
    function clear_animation() {
        if (animation_name)
            delete_rule(node, animation_name);
    }
    function init(program, duration) {
        const d = (program.b - t);
        duration *= Math.abs(d);
        return {
            a: t,
            b: program.b,
            d,
            duration,
            start: program.start,
            end: program.start + duration,
            group: program.group
        };
    }
    function go(b) {
        const { delay = 0, duration = 300, easing = identity, tick = noop, css } = config || null_transition;
        const program = {
            start: now() + delay,
            b
        };
        if (!b) {
            // @ts-ignore todo: improve typings
            program.group = outros;
            outros.r += 1;
        }
        if (running_program || pending_program) {
            pending_program = program;
        }
        else {
            // if this is an intro, and there's a delay, we need to do
            // an initial tick and/or apply CSS animation immediately
            if (css) {
                clear_animation();
                animation_name = create_rule(node, t, b, duration, delay, easing, css);
            }
            if (b)
                tick(0, 1);
            running_program = init(program, duration);
            add_render_callback(() => dispatch(node, b, 'start'));
            loop(now => {
                if (pending_program && now > pending_program.start) {
                    running_program = init(pending_program, duration);
                    pending_program = null;
                    dispatch(node, running_program.b, 'start');
                    if (css) {
                        clear_animation();
                        animation_name = create_rule(node, t, running_program.b, running_program.duration, 0, easing, config.css);
                    }
                }
                if (running_program) {
                    if (now >= running_program.end) {
                        tick(t = running_program.b, 1 - t);
                        dispatch(node, running_program.b, 'end');
                        if (!pending_program) {
                            // we're done
                            if (running_program.b) {
                                // intro — we can tidy up immediately
                                clear_animation();
                            }
                            else {
                                // outro — needs to be coordinated
                                if (!--running_program.group.r)
                                    run_all(running_program.group.c);
                            }
                        }
                        running_program = null;
                    }
                    else if (now >= running_program.start) {
                        const p = now - running_program.start;
                        t = running_program.a + running_program.d * easing(p / running_program.duration);
                        tick(t, 1 - t);
                    }
                }
                return !!(running_program || pending_program);
            });
        }
    }
    return {
        run(b) {
            if (is_function(config)) {
                wait().then(() => {
                    // @ts-ignore
                    config = config(options);
                    go(b);
                });
            }
            else {
                go(b);
            }
        },
        end() {
            clear_animation();
            running_program = pending_program = null;
        }
    };
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

function cubicOut(t) {
    const f = t - 1.0;
    return f * f * f + 1.0;
}

function fade(node, { delay = 0, duration = 400, easing = identity } = {}) {
    const o = +getComputedStyle(node).opacity;
    return {
        delay,
        duration,
        easing,
        css: t => `opacity: ${t * o}`
    };
}
function fly(node, { delay = 0, duration = 400, easing = cubicOut, x = 0, y = 0, opacity = 0 } = {}) {
    const style = getComputedStyle(node);
    const target_opacity = +style.opacity;
    const transform = style.transform === 'none' ? '' : style.transform;
    const od = target_opacity * (1 - opacity);
    const [xValue, xUnit] = split_css_unit(x);
    const [yValue, yUnit] = split_css_unit(y);
    return {
        delay,
        duration,
        easing,
        css: (t, u) => `
			transform: ${transform} translate(${(1 - t) * xValue}${xUnit}, ${(1 - t) * yValue}${yUnit});
			opacity: ${target_opacity - (od * u)}`
    };
}

/* generated by Svelte v3.59.1 */

function get_each_context(ctx, list, i) {
	const child_ctx = ctx.slice();
	child_ctx[41] = list[i];
	child_ctx[43] = i;
	return child_ctx;
}

function get_each_context_1(ctx, list, i) {
	const child_ctx = ctx.slice();
	child_ctx[44] = list[i];
	child_ctx[43] = i;
	return child_ctx;
}

function get_each_context_2(ctx, list, i) {
	const child_ctx = ctx.slice();
	child_ctx[46] = list[i];
	return child_ctx;
}

function get_each_context_3(ctx, list, i) {
	const child_ctx = ctx.slice();
	child_ctx[49] = list[i];
	return child_ctx;
}

// (1474:8) {#each availableCategories as category}
function create_each_block_3(ctx) {
	let button;
	let t0_value = /*category*/ ctx[49] + "";
	let t0;
	let t1;
	let button_aria_pressed_value;
	let mounted;
	let dispose;

	function click_handler() {
		return /*click_handler*/ ctx[31](/*category*/ ctx[49]);
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
				class: true,
				"aria-pressed": true
			});

			var button_nodes = children(button);
			t0 = claim_text(button_nodes, t0_value);
			t1 = claim_space(button_nodes);
			button_nodes.forEach(detach);
			this.h();
		},
		h() {
			attr(button, "type", "button");
			attr(button, "class", "cg-blog__category svelte-ktcz30");
			attr(button, "aria-pressed", button_aria_pressed_value = /*activeCategory*/ ctx[0] === /*category*/ ctx[49]);
			toggle_class(button, "active", /*activeCategory*/ ctx[0] === /*category*/ ctx[49]);
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
			if (dirty[0] & /*availableCategories*/ 1024 && t0_value !== (t0_value = /*category*/ ctx[49] + "")) set_data(t0, t0_value);

			if (dirty[0] & /*activeCategory, availableCategories*/ 1025 && button_aria_pressed_value !== (button_aria_pressed_value = /*activeCategory*/ ctx[0] === /*category*/ ctx[49])) {
				attr(button, "aria-pressed", button_aria_pressed_value);
			}

			if (dirty[0] & /*activeCategory, availableCategories*/ 1025) {
				toggle_class(button, "active", /*activeCategory*/ ctx[0] === /*category*/ ctx[49]);
			}
		},
		d(detaching) {
			if (detaching) detach(button);
			mounted = false;
			dispose();
		}
	};
}

// (1649:4) {:else}
function create_else_block_1(ctx) {
	let div;
	let svg;
	let circle;
	let path;
	let t0;
	let h3;
	let t1;
	let t2;
	let p;
	let t3;
	let t4;
	let button;
	let t5;
	let mounted;
	let dispose;

	return {
		c() {
			div = element("div");
			svg = svg_element("svg");
			circle = svg_element("circle");
			path = svg_element("path");
			t0 = space();
			h3 = element("h3");
			t1 = text("Keine Beiträge gefunden");
			t2 = space();
			p = element("p");
			t3 = text("Probiere einen anderen Suchbegriff oder wähle eine andere Kategorie.");
			t4 = space();
			button = element("button");
			t5 = text("Alle Beiträge anzeigen");
			this.h();
		},
		l(nodes) {
			div = claim_element(nodes, "DIV", { class: true });
			var div_nodes = children(div);

			svg = claim_svg_element(div_nodes, "svg", {
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
			t0 = claim_space(div_nodes);
			h3 = claim_element(div_nodes, "H3", { class: true });
			var h3_nodes = children(h3);
			t1 = claim_text(h3_nodes, "Keine Beiträge gefunden");
			h3_nodes.forEach(detach);
			t2 = claim_space(div_nodes);
			p = claim_element(div_nodes, "P", { class: true });
			var p_nodes = children(p);
			t3 = claim_text(p_nodes, "Probiere einen anderen Suchbegriff oder wähle eine andere Kategorie.");
			p_nodes.forEach(detach);
			t4 = claim_space(div_nodes);
			button = claim_element(div_nodes, "BUTTON", { type: true, class: true });
			var button_nodes = children(button);
			t5 = claim_text(button_nodes, "Alle Beiträge anzeigen");
			button_nodes.forEach(detach);
			div_nodes.forEach(detach);
			this.h();
		},
		h() {
			attr(circle, "cx", "10.5");
			attr(circle, "cy", "10.5");
			attr(circle, "r", "6.5");
			attr(circle, "class", "svelte-ktcz30");
			attr(path, "d", "m15.5 15.5 5 5");
			attr(path, "class", "svelte-ktcz30");
			attr(svg, "viewBox", "0 0 24 24");
			attr(svg, "aria-hidden", "true");
			attr(svg, "class", "svelte-ktcz30");
			attr(h3, "class", "svelte-ktcz30");
			attr(p, "class", "svelte-ktcz30");
			attr(button, "type", "button");
			attr(button, "class", "svelte-ktcz30");
			attr(div, "class", "cg-blog__empty svelte-ktcz30");
		},
		m(target, anchor) {
			insert_hydration(target, div, anchor);
			append_hydration(div, svg);
			append_hydration(svg, circle);
			append_hydration(svg, path);
			append_hydration(div, t0);
			append_hydration(div, h3);
			append_hydration(h3, t1);
			append_hydration(div, t2);
			append_hydration(div, p);
			append_hydration(p, t3);
			append_hydration(div, t4);
			append_hydration(div, button);
			append_hydration(button, t5);

			if (!mounted) {
				dispose = listen(button, "click", /*resetFilters*/ ctx[13]);
				mounted = true;
			}
		},
		p: noop,
		d(detaching) {
			if (detaching) detach(div);
			mounted = false;
			dispose();
		}
	};
}

// (1519:4) {#if paginatedPosts.length > 0}
function create_if_block_10(ctx) {
	let div;
	let t;
	let if_block_anchor;
	let each_value_2 = /*paginatedPosts*/ ctx[8];
	let each_blocks = [];

	for (let i = 0; i < each_value_2.length; i += 1) {
		each_blocks[i] = create_each_block_2(get_each_context_2(ctx, each_value_2, i));
	}

	let if_block = /*totalPages*/ ctx[6] > 1 && create_if_block_11(ctx);

	return {
		c() {
			div = element("div");

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].c();
			}

			t = space();
			if (if_block) if_block.c();
			if_block_anchor = empty();
			this.h();
		},
		l(nodes) {
			div = claim_element(nodes, "DIV", { id: true, class: true });
			var div_nodes = children(div);

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].l(div_nodes);
			}

			div_nodes.forEach(detach);
			t = claim_space(nodes);
			if (if_block) if_block.l(nodes);
			if_block_anchor = empty();
			this.h();
		},
		h() {
			attr(div, "id", "cg-blog-results");
			attr(div, "class", "cg-blog__grid svelte-ktcz30");
		},
		m(target, anchor) {
			insert_hydration(target, div, anchor);

			for (let i = 0; i < each_blocks.length; i += 1) {
				if (each_blocks[i]) {
					each_blocks[i].m(div, null);
				}
			}

			insert_hydration(target, t, anchor);
			if (if_block) if_block.m(target, anchor);
			insert_hydration(target, if_block_anchor, anchor);
		},
		p(ctx, dirty) {
			if (dirty[0] & /*openArticle, paginatedPosts*/ 33024) {
				each_value_2 = /*paginatedPosts*/ ctx[8];
				let i;

				for (i = 0; i < each_value_2.length; i += 1) {
					const child_ctx = get_each_context_2(ctx, each_value_2, i);

					if (each_blocks[i]) {
						each_blocks[i].p(child_ctx, dirty);
					} else {
						each_blocks[i] = create_each_block_2(child_ctx);
						each_blocks[i].c();
						each_blocks[i].m(div, null);
					}
				}

				for (; i < each_blocks.length; i += 1) {
					each_blocks[i].d(1);
				}

				each_blocks.length = each_value_2.length;
			}

			if (/*totalPages*/ ctx[6] > 1) {
				if (if_block) {
					if_block.p(ctx, dirty);
				} else {
					if_block = create_if_block_11(ctx);
					if_block.c();
					if_block.m(if_block_anchor.parentNode, if_block_anchor);
				}
			} else if (if_block) {
				if_block.d(1);
				if_block = null;
			}
		},
		d(detaching) {
			if (detaching) detach(div);
			destroy_each(each_blocks, detaching);
			if (detaching) detach(t);
			if (if_block) if_block.d(detaching);
			if (detaching) detach(if_block_anchor);
		}
	};
}

// (1538:14) {:else}
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
			attr(span, "class", "cg-blog-card__image-placeholder svelte-ktcz30");
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

// (1532:14) {#if post.image && post.image.url}
function create_if_block_15(ctx) {
	let img;
	let img_src_value;
	let img_alt_value;

	return {
		c() {
			img = element("img");
			this.h();
		},
		l(nodes) {
			img = claim_element(nodes, "IMG", {
				src: true,
				alt: true,
				loading: true,
				class: true
			});

			this.h();
		},
		h() {
			if (!src_url_equal(img.src, img_src_value = /*post*/ ctx[46].image.url)) attr(img, "src", img_src_value);
			attr(img, "alt", img_alt_value = /*post*/ ctx[46].image.alt || /*post*/ ctx[46].title);
			attr(img, "loading", "lazy");
			attr(img, "class", "svelte-ktcz30");
		},
		m(target, anchor) {
			insert_hydration(target, img, anchor);
		},
		p(ctx, dirty) {
			if (dirty[0] & /*paginatedPosts*/ 256 && !src_url_equal(img.src, img_src_value = /*post*/ ctx[46].image.url)) {
				attr(img, "src", img_src_value);
			}

			if (dirty[0] & /*paginatedPosts*/ 256 && img_alt_value !== (img_alt_value = /*post*/ ctx[46].image.alt || /*post*/ ctx[46].title)) {
				attr(img, "alt", img_alt_value);
			}
		},
		d(detaching) {
			if (detaching) detach(img);
		}
	};
}

// (1547:16) {#if post.category}
function create_if_block_14(ctx) {
	let span;
	let t_value = /*post*/ ctx[46].category + "";
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
			attr(span, "class", "cg-blog-card__category svelte-ktcz30");
		},
		m(target, anchor) {
			insert_hydration(target, span, anchor);
			append_hydration(span, t);
		},
		p(ctx, dirty) {
			if (dirty[0] & /*paginatedPosts*/ 256 && t_value !== (t_value = /*post*/ ctx[46].category + "")) set_data(t, t_value);
		},
		d(detaching) {
			if (detaching) detach(span);
		}
	};
}

// (1553:16) {#if post.date}
function create_if_block_13(ctx) {
	let time;
	let t_value = /*post*/ ctx[46].date + "";
	let t;
	let time_datetime_value;

	return {
		c() {
			time = element("time");
			t = text(t_value);
			this.h();
		},
		l(nodes) {
			time = claim_element(nodes, "TIME", { class: true, datetime: true });
			var time_nodes = children(time);
			t = claim_text(time_nodes, t_value);
			time_nodes.forEach(detach);
			this.h();
		},
		h() {
			attr(time, "class", "cg-blog-card__date svelte-ktcz30");
			attr(time, "datetime", time_datetime_value = /*post*/ ctx[46].date_iso || /*post*/ ctx[46].sort_date);
		},
		m(target, anchor) {
			insert_hydration(target, time, anchor);
			append_hydration(time, t);
		},
		p(ctx, dirty) {
			if (dirty[0] & /*paginatedPosts*/ 256 && t_value !== (t_value = /*post*/ ctx[46].date + "")) set_data(t, t_value);

			if (dirty[0] & /*paginatedPosts*/ 256 && time_datetime_value !== (time_datetime_value = /*post*/ ctx[46].date_iso || /*post*/ ctx[46].sort_date)) {
				attr(time, "datetime", time_datetime_value);
			}
		},
		d(detaching) {
			if (detaching) detach(time);
		}
	};
}

// (1571:14) {#if post.teaser}
function create_if_block_12(ctx) {
	let p;
	let t_value = /*post*/ ctx[46].teaser + "";
	let t;

	return {
		c() {
			p = element("p");
			t = text(t_value);
			this.h();
		},
		l(nodes) {
			p = claim_element(nodes, "P", { class: true });
			var p_nodes = children(p);
			t = claim_text(p_nodes, t_value);
			p_nodes.forEach(detach);
			this.h();
		},
		h() {
			attr(p, "class", "cg-blog-card__teaser svelte-ktcz30");
		},
		m(target, anchor) {
			insert_hydration(target, p, anchor);
			append_hydration(p, t);
		},
		p(ctx, dirty) {
			if (dirty[0] & /*paginatedPosts*/ 256 && t_value !== (t_value = /*post*/ ctx[46].teaser + "")) set_data(t, t_value);
		},
		d(detaching) {
			if (detaching) detach(p);
		}
	};
}

// (1524:8) {#each paginatedPosts as post}
function create_each_block_2(ctx) {
	let article;
	let button0;
	let button0_aria_label_value;
	let t0;
	let div1;
	let div0;
	let t1;
	let t2;
	let button1;
	let t3_value = /*post*/ ctx[46].title + "";
	let t3;
	let t4;
	let t5;
	let button2;
	let t6;
	let svg;
	let path;
	let t7;
	let mounted;
	let dispose;

	function select_block_type_1(ctx, dirty) {
		if (/*post*/ ctx[46].image && /*post*/ ctx[46].image.url) return create_if_block_15;
		return create_else_block;
	}

	let current_block_type = select_block_type_1(ctx);
	let if_block0 = current_block_type(ctx);

	function click_handler_1() {
		return /*click_handler_1*/ ctx[33](/*post*/ ctx[46]);
	}

	let if_block1 = /*post*/ ctx[46].category && create_if_block_14(ctx);
	let if_block2 = /*post*/ ctx[46].date && create_if_block_13(ctx);

	function click_handler_2() {
		return /*click_handler_2*/ ctx[34](/*post*/ ctx[46]);
	}

	let if_block3 = /*post*/ ctx[46].teaser && create_if_block_12(ctx);

	function click_handler_3() {
		return /*click_handler_3*/ ctx[35](/*post*/ ctx[46]);
	}

	return {
		c() {
			article = element("article");
			button0 = element("button");
			if_block0.c();
			t0 = space();
			div1 = element("div");
			div0 = element("div");
			if (if_block1) if_block1.c();
			t1 = space();
			if (if_block2) if_block2.c();
			t2 = space();
			button1 = element("button");
			t3 = text(t3_value);
			t4 = space();
			if (if_block3) if_block3.c();
			t5 = space();
			button2 = element("button");
			t6 = text("Mehr anzeigen\n\n                ");
			svg = svg_element("svg");
			path = svg_element("path");
			t7 = space();
			this.h();
		},
		l(nodes) {
			article = claim_element(nodes, "ARTICLE", { class: true });
			var article_nodes = children(article);

			button0 = claim_element(article_nodes, "BUTTON", {
				type: true,
				class: true,
				"aria-label": true
			});

			var button0_nodes = children(button0);
			if_block0.l(button0_nodes);
			button0_nodes.forEach(detach);
			t0 = claim_space(article_nodes);
			div1 = claim_element(article_nodes, "DIV", { class: true });
			var div1_nodes = children(div1);
			div0 = claim_element(div1_nodes, "DIV", { class: true });
			var div0_nodes = children(div0);
			if (if_block1) if_block1.l(div0_nodes);
			t1 = claim_space(div0_nodes);
			if (if_block2) if_block2.l(div0_nodes);
			div0_nodes.forEach(detach);
			t2 = claim_space(div1_nodes);
			button1 = claim_element(div1_nodes, "BUTTON", { type: true, class: true });
			var button1_nodes = children(button1);
			t3 = claim_text(button1_nodes, t3_value);
			button1_nodes.forEach(detach);
			t4 = claim_space(div1_nodes);
			if (if_block3) if_block3.l(div1_nodes);
			t5 = claim_space(div1_nodes);
			button2 = claim_element(div1_nodes, "BUTTON", { type: true, class: true });
			var button2_nodes = children(button2);
			t6 = claim_text(button2_nodes, "Mehr anzeigen\n\n                ");

			svg = claim_svg_element(button2_nodes, "svg", {
				viewBox: true,
				"aria-hidden": true,
				class: true
			});

			var svg_nodes = children(svg);
			path = claim_svg_element(svg_nodes, "path", { d: true, class: true });
			children(path).forEach(detach);
			svg_nodes.forEach(detach);
			button2_nodes.forEach(detach);
			div1_nodes.forEach(detach);
			t7 = claim_space(article_nodes);
			article_nodes.forEach(detach);
			this.h();
		},
		h() {
			attr(button0, "type", "button");
			attr(button0, "class", "cg-blog-card__image-button svelte-ktcz30");
			attr(button0, "aria-label", button0_aria_label_value = "Beitrag öffnen: " + /*post*/ ctx[46].title);
			attr(div0, "class", "cg-blog-card__meta svelte-ktcz30");
			attr(button1, "type", "button");
			attr(button1, "class", "cg-blog-card__title svelte-ktcz30");
			attr(path, "d", "m6 9 6 6 6-6");
			attr(path, "class", "svelte-ktcz30");
			attr(svg, "viewBox", "0 0 24 24");
			attr(svg, "aria-hidden", "true");
			attr(svg, "class", "svelte-ktcz30");
			attr(button2, "type", "button");
			attr(button2, "class", "cg-blog-card__more svelte-ktcz30");
			attr(div1, "class", "cg-blog-card__body svelte-ktcz30");
			attr(article, "class", "cg-blog-card svelte-ktcz30");
		},
		m(target, anchor) {
			insert_hydration(target, article, anchor);
			append_hydration(article, button0);
			if_block0.m(button0, null);
			append_hydration(article, t0);
			append_hydration(article, div1);
			append_hydration(div1, div0);
			if (if_block1) if_block1.m(div0, null);
			append_hydration(div0, t1);
			if (if_block2) if_block2.m(div0, null);
			append_hydration(div1, t2);
			append_hydration(div1, button1);
			append_hydration(button1, t3);
			append_hydration(div1, t4);
			if (if_block3) if_block3.m(div1, null);
			append_hydration(div1, t5);
			append_hydration(div1, button2);
			append_hydration(button2, t6);
			append_hydration(button2, svg);
			append_hydration(svg, path);
			append_hydration(article, t7);

			if (!mounted) {
				dispose = [
					listen(button0, "click", click_handler_1),
					listen(button1, "click", click_handler_2),
					listen(button2, "click", click_handler_3)
				];

				mounted = true;
			}
		},
		p(new_ctx, dirty) {
			ctx = new_ctx;

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

			if (dirty[0] & /*paginatedPosts*/ 256 && button0_aria_label_value !== (button0_aria_label_value = "Beitrag öffnen: " + /*post*/ ctx[46].title)) {
				attr(button0, "aria-label", button0_aria_label_value);
			}

			if (/*post*/ ctx[46].category) {
				if (if_block1) {
					if_block1.p(ctx, dirty);
				} else {
					if_block1 = create_if_block_14(ctx);
					if_block1.c();
					if_block1.m(div0, t1);
				}
			} else if (if_block1) {
				if_block1.d(1);
				if_block1 = null;
			}

			if (/*post*/ ctx[46].date) {
				if (if_block2) {
					if_block2.p(ctx, dirty);
				} else {
					if_block2 = create_if_block_13(ctx);
					if_block2.c();
					if_block2.m(div0, null);
				}
			} else if (if_block2) {
				if_block2.d(1);
				if_block2 = null;
			}

			if (dirty[0] & /*paginatedPosts*/ 256 && t3_value !== (t3_value = /*post*/ ctx[46].title + "")) set_data(t3, t3_value);

			if (/*post*/ ctx[46].teaser) {
				if (if_block3) {
					if_block3.p(ctx, dirty);
				} else {
					if_block3 = create_if_block_12(ctx);
					if_block3.c();
					if_block3.m(div1, t5);
				}
			} else if (if_block3) {
				if_block3.d(1);
				if_block3 = null;
			}
		},
		d(detaching) {
			if (detaching) detach(article);
			if_block0.d();
			if (if_block1) if_block1.d();
			if (if_block2) if_block2.d();
			if (if_block3) if_block3.d();
			mounted = false;
			run_all(dispose);
		}
	};
}

// (1593:6) {#if totalPages > 1}
function create_if_block_11(ctx) {
	let nav;
	let button0;
	let svg0;
	let path0;
	let t0;
	let span0;
	let t1;
	let button0_disabled_value;
	let t2;
	let div;
	let t3;
	let button1;
	let span1;
	let t4;
	let t5;
	let svg1;
	let path1;
	let button1_disabled_value;
	let t6;
	let p;
	let t7;
	let t8;
	let t9;
	let t10;
	let mounted;
	let dispose;
	let each_value_1 = Array(/*totalPages*/ ctx[6]);
	let each_blocks = [];

	for (let i = 0; i < each_value_1.length; i += 1) {
		each_blocks[i] = create_each_block_1(get_each_context_1(ctx, each_value_1, i));
	}

	return {
		c() {
			nav = element("nav");
			button0 = element("button");
			svg0 = svg_element("svg");
			path0 = svg_element("path");
			t0 = space();
			span0 = element("span");
			t1 = text("Zurück");
			t2 = space();
			div = element("div");

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].c();
			}

			t3 = space();
			button1 = element("button");
			span1 = element("span");
			t4 = text("Weiter");
			t5 = space();
			svg1 = svg_element("svg");
			path1 = svg_element("path");
			t6 = space();
			p = element("p");
			t7 = text("Seite ");
			t8 = text(/*currentPage*/ ctx[4]);
			t9 = text(" von ");
			t10 = text(/*totalPages*/ ctx[6]);
			this.h();
		},
		l(nodes) {
			nav = claim_element(nodes, "NAV", { class: true, "aria-label": true });
			var nav_nodes = children(nav);

			button0 = claim_element(nav_nodes, "BUTTON", {
				type: true,
				class: true,
				"aria-label": true
			});

			var button0_nodes = children(button0);

			svg0 = claim_svg_element(button0_nodes, "svg", {
				viewBox: true,
				"aria-hidden": true,
				class: true
			});

			var svg0_nodes = children(svg0);
			path0 = claim_svg_element(svg0_nodes, "path", { d: true, class: true });
			children(path0).forEach(detach);
			svg0_nodes.forEach(detach);
			t0 = claim_space(button0_nodes);
			span0 = claim_element(button0_nodes, "SPAN", { class: true });
			var span0_nodes = children(span0);
			t1 = claim_text(span0_nodes, "Zurück");
			span0_nodes.forEach(detach);
			button0_nodes.forEach(detach);
			t2 = claim_space(nav_nodes);
			div = claim_element(nav_nodes, "DIV", { class: true });
			var div_nodes = children(div);

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].l(div_nodes);
			}

			div_nodes.forEach(detach);
			t3 = claim_space(nav_nodes);

			button1 = claim_element(nav_nodes, "BUTTON", {
				type: true,
				class: true,
				"aria-label": true
			});

			var button1_nodes = children(button1);
			span1 = claim_element(button1_nodes, "SPAN", { class: true });
			var span1_nodes = children(span1);
			t4 = claim_text(span1_nodes, "Weiter");
			span1_nodes.forEach(detach);
			t5 = claim_space(button1_nodes);

			svg1 = claim_svg_element(button1_nodes, "svg", {
				viewBox: true,
				"aria-hidden": true,
				class: true
			});

			var svg1_nodes = children(svg1);
			path1 = claim_svg_element(svg1_nodes, "path", { d: true, class: true });
			children(path1).forEach(detach);
			svg1_nodes.forEach(detach);
			button1_nodes.forEach(detach);
			nav_nodes.forEach(detach);
			t6 = claim_space(nodes);
			p = claim_element(nodes, "P", { class: true });
			var p_nodes = children(p);
			t7 = claim_text(p_nodes, "Seite ");
			t8 = claim_text(p_nodes, /*currentPage*/ ctx[4]);
			t9 = claim_text(p_nodes, " von ");
			t10 = claim_text(p_nodes, /*totalPages*/ ctx[6]);
			p_nodes.forEach(detach);
			this.h();
		},
		h() {
			attr(path0, "d", "m15 18-6-6 6-6");
			attr(path0, "class", "svelte-ktcz30");
			attr(svg0, "viewBox", "0 0 24 24");
			attr(svg0, "aria-hidden", "true");
			attr(svg0, "class", "svelte-ktcz30");
			attr(span0, "class", "svelte-ktcz30");
			attr(button0, "type", "button");
			attr(button0, "class", "cg-blog-pagination__arrow svelte-ktcz30");
			button0.disabled = button0_disabled_value = /*currentPage*/ ctx[4] === 1;
			attr(button0, "aria-label", "Vorherige Seite");
			attr(div, "class", "cg-blog-pagination__pages svelte-ktcz30");
			attr(span1, "class", "svelte-ktcz30");
			attr(path1, "d", "m9 6 6 6-6 6");
			attr(path1, "class", "svelte-ktcz30");
			attr(svg1, "viewBox", "0 0 24 24");
			attr(svg1, "aria-hidden", "true");
			attr(svg1, "class", "svelte-ktcz30");
			attr(button1, "type", "button");
			attr(button1, "class", "cg-blog-pagination__arrow svelte-ktcz30");
			button1.disabled = button1_disabled_value = /*currentPage*/ ctx[4] === /*totalPages*/ ctx[6];
			attr(button1, "aria-label", "Nächste Seite");
			attr(nav, "class", "cg-blog-pagination svelte-ktcz30");
			attr(nav, "aria-label", "Seitennavigation der Blogbeiträge");
			attr(p, "class", "cg-blog-pagination__status svelte-ktcz30");
		},
		m(target, anchor) {
			insert_hydration(target, nav, anchor);
			append_hydration(nav, button0);
			append_hydration(button0, svg0);
			append_hydration(svg0, path0);
			append_hydration(button0, t0);
			append_hydration(button0, span0);
			append_hydration(span0, t1);
			append_hydration(nav, t2);
			append_hydration(nav, div);

			for (let i = 0; i < each_blocks.length; i += 1) {
				if (each_blocks[i]) {
					each_blocks[i].m(div, null);
				}
			}

			append_hydration(nav, t3);
			append_hydration(nav, button1);
			append_hydration(button1, span1);
			append_hydration(span1, t4);
			append_hydration(button1, t5);
			append_hydration(button1, svg1);
			append_hydration(svg1, path1);
			insert_hydration(target, t6, anchor);
			insert_hydration(target, p, anchor);
			append_hydration(p, t7);
			append_hydration(p, t8);
			append_hydration(p, t9);
			append_hydration(p, t10);

			if (!mounted) {
				dispose = [
					listen(button0, "click", /*click_handler_4*/ ctx[36]),
					listen(button1, "click", /*click_handler_6*/ ctx[38])
				];

				mounted = true;
			}
		},
		p(ctx, dirty) {
			if (dirty[0] & /*currentPage*/ 16 && button0_disabled_value !== (button0_disabled_value = /*currentPage*/ ctx[4] === 1)) {
				button0.disabled = button0_disabled_value;
			}

			if (dirty[0] & /*currentPage, goToPage, totalPages*/ 16464) {
				each_value_1 = Array(/*totalPages*/ ctx[6]);
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

			if (dirty[0] & /*currentPage, totalPages*/ 80 && button1_disabled_value !== (button1_disabled_value = /*currentPage*/ ctx[4] === /*totalPages*/ ctx[6])) {
				button1.disabled = button1_disabled_value;
			}

			if (dirty[0] & /*currentPage*/ 16) set_data(t8, /*currentPage*/ ctx[4]);
			if (dirty[0] & /*totalPages*/ 64) set_data(t10, /*totalPages*/ ctx[6]);
		},
		d(detaching) {
			if (detaching) detach(nav);
			destroy_each(each_blocks, detaching);
			if (detaching) detach(t6);
			if (detaching) detach(p);
			mounted = false;
			run_all(dispose);
		}
	};
}

// (1613:12) {#each Array(totalPages) as _, index}
function create_each_block_1(ctx) {
	let button;
	let t0_value = /*index*/ ctx[43] + 1 + "";
	let t0;
	let t1;
	let button_aria_current_value;
	let mounted;
	let dispose;

	function click_handler_5() {
		return /*click_handler_5*/ ctx[37](/*index*/ ctx[43]);
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
				class: true,
				"aria-label": true,
				"aria-current": true
			});

			var button_nodes = children(button);
			t0 = claim_text(button_nodes, t0_value);
			t1 = claim_space(button_nodes);
			button_nodes.forEach(detach);
			this.h();
		},
		h() {
			attr(button, "type", "button");
			attr(button, "class", "cg-blog-pagination__page svelte-ktcz30");
			attr(button, "aria-label", "Seite " + (/*index*/ ctx[43] + 1) + " anzeigen");

			attr(button, "aria-current", button_aria_current_value = /*currentPage*/ ctx[4] === /*index*/ ctx[43] + 1
			? "page"
			: undefined);

			toggle_class(button, "active", /*currentPage*/ ctx[4] === /*index*/ ctx[43] + 1);
		},
		m(target, anchor) {
			insert_hydration(target, button, anchor);
			append_hydration(button, t0);
			append_hydration(button, t1);

			if (!mounted) {
				dispose = listen(button, "click", click_handler_5);
				mounted = true;
			}
		},
		p(new_ctx, dirty) {
			ctx = new_ctx;

			if (dirty[0] & /*currentPage*/ 16 && button_aria_current_value !== (button_aria_current_value = /*currentPage*/ ctx[4] === /*index*/ ctx[43] + 1
			? "page"
			: undefined)) {
				attr(button, "aria-current", button_aria_current_value);
			}

			if (dirty[0] & /*currentPage*/ 16) {
				toggle_class(button, "active", /*currentPage*/ ctx[4] === /*index*/ ctx[43] + 1);
			}
		},
		d(detaching) {
			if (detaching) detach(button);
			mounted = false;
			dispose();
		}
	};
}

// (1673:0) {#if selectedPost}
function create_if_block(ctx) {
	let div4;
	let article;
	let button0;
	let svg0;
	let path0;
	let t0;
	let div2;
	let t1;
	let div1;
	let div0;
	let t2;
	let t3;
	let h2;
	let t4_value = /*selectedPost*/ ctx[2].title + "";
	let t4;
	let t5;
	let t6;
	let div3;
	let raw_value = renderPostContent(/*selectedPost*/ ctx[2].content) + "";
	let t7;
	let t8;
	let button1;
	let t9;
	let svg1;
	let path1;
	let article_transition;
	let div4_transition;
	let current;
	let mounted;
	let dispose;
	let if_block0 = /*selectedPost*/ ctx[2].image && /*selectedPost*/ ctx[2].image.url && create_if_block_9(ctx);
	let if_block1 = /*selectedPost*/ ctx[2].category && create_if_block_8(ctx);
	let if_block2 = /*selectedPost*/ ctx[2].date && create_if_block_7(ctx);
	let if_block3 = /*selectedPost*/ ctx[2].teaser && create_if_block_6(ctx);
	let if_block4 = /*galleryItems*/ ctx[5].length > 0 && /*currentGalleryImage*/ ctx[9] && create_if_block_1(ctx);

	return {
		c() {
			div4 = element("div");
			article = element("article");
			button0 = element("button");
			svg0 = svg_element("svg");
			path0 = svg_element("path");
			t0 = space();
			div2 = element("div");
			if (if_block0) if_block0.c();
			t1 = space();
			div1 = element("div");
			div0 = element("div");
			if (if_block1) if_block1.c();
			t2 = space();
			if (if_block2) if_block2.c();
			t3 = space();
			h2 = element("h2");
			t4 = text(t4_value);
			t5 = space();
			if (if_block3) if_block3.c();
			t6 = space();
			div3 = element("div");
			t7 = space();
			if (if_block4) if_block4.c();
			t8 = space();
			button1 = element("button");
			t9 = text("Weniger anzeigen\n\n        ");
			svg1 = svg_element("svg");
			path1 = svg_element("path");
			this.h();
		},
		l(nodes) {
			div4 = claim_element(nodes, "DIV", { class: true, role: true });
			var div4_nodes = children(div4);

			article = claim_element(div4_nodes, "ARTICLE", {
				class: true,
				role: true,
				"aria-modal": true,
				"aria-labelledby": true
			});

			var article_nodes = children(article);

			button0 = claim_element(article_nodes, "BUTTON", {
				type: true,
				class: true,
				"aria-label": true
			});

			var button0_nodes = children(button0);

			svg0 = claim_svg_element(button0_nodes, "svg", {
				viewBox: true,
				"aria-hidden": true,
				class: true
			});

			var svg0_nodes = children(svg0);
			path0 = claim_svg_element(svg0_nodes, "path", { d: true, class: true });
			children(path0).forEach(detach);
			svg0_nodes.forEach(detach);
			button0_nodes.forEach(detach);
			t0 = claim_space(article_nodes);
			div2 = claim_element(article_nodes, "DIV", { class: true });
			var div2_nodes = children(div2);
			if (if_block0) if_block0.l(div2_nodes);
			t1 = claim_space(div2_nodes);
			div1 = claim_element(div2_nodes, "DIV", { class: true });
			var div1_nodes = children(div1);
			div0 = claim_element(div1_nodes, "DIV", { class: true });
			var div0_nodes = children(div0);
			if (if_block1) if_block1.l(div0_nodes);
			t2 = claim_space(div0_nodes);
			if (if_block2) if_block2.l(div0_nodes);
			div0_nodes.forEach(detach);
			t3 = claim_space(div1_nodes);
			h2 = claim_element(div1_nodes, "H2", { id: true, class: true });
			var h2_nodes = children(h2);
			t4 = claim_text(h2_nodes, t4_value);
			h2_nodes.forEach(detach);
			t5 = claim_space(div1_nodes);
			if (if_block3) if_block3.l(div1_nodes);
			div1_nodes.forEach(detach);
			div2_nodes.forEach(detach);
			t6 = claim_space(article_nodes);
			div3 = claim_element(article_nodes, "DIV", { class: true });
			var div3_nodes = children(div3);
			div3_nodes.forEach(detach);
			t7 = claim_space(article_nodes);
			if (if_block4) if_block4.l(article_nodes);
			t8 = claim_space(article_nodes);
			button1 = claim_element(article_nodes, "BUTTON", { type: true, class: true });
			var button1_nodes = children(button1);
			t9 = claim_text(button1_nodes, "Weniger anzeigen\n\n        ");

			svg1 = claim_svg_element(button1_nodes, "svg", {
				viewBox: true,
				"aria-hidden": true,
				class: true
			});

			var svg1_nodes = children(svg1);
			path1 = claim_svg_element(svg1_nodes, "path", { d: true, class: true });
			children(path1).forEach(detach);
			svg1_nodes.forEach(detach);
			button1_nodes.forEach(detach);
			article_nodes.forEach(detach);
			div4_nodes.forEach(detach);
			this.h();
		},
		h() {
			attr(path0, "d", "M6 6l12 12M18 6 6 18");
			attr(path0, "class", "svelte-ktcz30");
			attr(svg0, "viewBox", "0 0 24 24");
			attr(svg0, "aria-hidden", "true");
			attr(svg0, "class", "svelte-ktcz30");
			attr(button0, "type", "button");
			attr(button0, "class", "cg-blog-modal__close svelte-ktcz30");
			attr(button0, "aria-label", "Beitrag schließen");
			attr(div0, "class", "cg-blog-modal__meta svelte-ktcz30");
			attr(h2, "id", "cg-blog-modal-title");
			attr(h2, "class", "svelte-ktcz30");
			attr(div1, "class", "cg-blog-modal__intro svelte-ktcz30");
			attr(div2, "class", "cg-blog-modal__header svelte-ktcz30");
			attr(div3, "class", "cg-blog-modal__content svelte-ktcz30");
			attr(path1, "d", "m6 15 6-6 6 6");
			attr(path1, "class", "svelte-ktcz30");
			attr(svg1, "viewBox", "0 0 24 24");
			attr(svg1, "aria-hidden", "true");
			attr(svg1, "class", "svelte-ktcz30");
			attr(button1, "type", "button");
			attr(button1, "class", "cg-blog-modal__bottom-close svelte-ktcz30");
			attr(article, "class", "cg-blog-modal svelte-ktcz30");
			attr(article, "role", "dialog");
			attr(article, "aria-modal", "true");
			attr(article, "aria-labelledby", "cg-blog-modal-title");
			attr(div4, "class", "cg-blog-modal__overlay svelte-ktcz30");
			attr(div4, "role", "presentation");
		},
		m(target, anchor) {
			insert_hydration(target, div4, anchor);
			append_hydration(div4, article);
			append_hydration(article, button0);
			append_hydration(button0, svg0);
			append_hydration(svg0, path0);
			append_hydration(article, t0);
			append_hydration(article, div2);
			if (if_block0) if_block0.m(div2, null);
			append_hydration(div2, t1);
			append_hydration(div2, div1);
			append_hydration(div1, div0);
			if (if_block1) if_block1.m(div0, null);
			append_hydration(div0, t2);
			if (if_block2) if_block2.m(div0, null);
			append_hydration(div1, t3);
			append_hydration(div1, h2);
			append_hydration(h2, t4);
			append_hydration(div1, t5);
			if (if_block3) if_block3.m(div1, null);
			append_hydration(article, t6);
			append_hydration(article, div3);
			div3.innerHTML = raw_value;
			append_hydration(article, t7);
			if (if_block4) if_block4.m(article, null);
			append_hydration(article, t8);
			append_hydration(article, button1);
			append_hydration(button1, t9);
			append_hydration(button1, svg1);
			append_hydration(svg1, path1);
			current = true;

			if (!mounted) {
				dispose = [
					listen(button0, "click", /*closeArticle*/ ctx[16]),
					listen(button1, "click", /*closeArticle*/ ctx[16]),
					listen(div4, "click", self(/*closeArticle*/ ctx[16]))
				];

				mounted = true;
			}
		},
		p(ctx, dirty) {
			if (/*selectedPost*/ ctx[2].image && /*selectedPost*/ ctx[2].image.url) {
				if (if_block0) {
					if_block0.p(ctx, dirty);
				} else {
					if_block0 = create_if_block_9(ctx);
					if_block0.c();
					if_block0.m(div2, t1);
				}
			} else if (if_block0) {
				if_block0.d(1);
				if_block0 = null;
			}

			if (/*selectedPost*/ ctx[2].category) {
				if (if_block1) {
					if_block1.p(ctx, dirty);
				} else {
					if_block1 = create_if_block_8(ctx);
					if_block1.c();
					if_block1.m(div0, t2);
				}
			} else if (if_block1) {
				if_block1.d(1);
				if_block1 = null;
			}

			if (/*selectedPost*/ ctx[2].date) {
				if (if_block2) {
					if_block2.p(ctx, dirty);
				} else {
					if_block2 = create_if_block_7(ctx);
					if_block2.c();
					if_block2.m(div0, null);
				}
			} else if (if_block2) {
				if_block2.d(1);
				if_block2 = null;
			}

			if ((!current || dirty[0] & /*selectedPost*/ 4) && t4_value !== (t4_value = /*selectedPost*/ ctx[2].title + "")) set_data(t4, t4_value);

			if (/*selectedPost*/ ctx[2].teaser) {
				if (if_block3) {
					if_block3.p(ctx, dirty);
				} else {
					if_block3 = create_if_block_6(ctx);
					if_block3.c();
					if_block3.m(div1, null);
				}
			} else if (if_block3) {
				if_block3.d(1);
				if_block3 = null;
			}

			if ((!current || dirty[0] & /*selectedPost*/ 4) && raw_value !== (raw_value = renderPostContent(/*selectedPost*/ ctx[2].content) + "")) div3.innerHTML = raw_value;
			if (/*galleryItems*/ ctx[5].length > 0 && /*currentGalleryImage*/ ctx[9]) {
				if (if_block4) {
					if_block4.p(ctx, dirty);

					if (dirty[0] & /*galleryItems, currentGalleryImage*/ 544) {
						transition_in(if_block4, 1);
					}
				} else {
					if_block4 = create_if_block_1(ctx);
					if_block4.c();
					transition_in(if_block4, 1);
					if_block4.m(article, t8);
				}
			} else if (if_block4) {
				group_outros();

				transition_out(if_block4, 1, 1, () => {
					if_block4 = null;
				});

				check_outros();
			}
		},
		i(local) {
			if (current) return;
			transition_in(if_block4);

			add_render_callback(() => {
				if (!current) return;
				if (!article_transition) article_transition = create_bidirectional_transition(article, fly, { y: 25, duration: 240 }, true);
				article_transition.run(1);
			});

			add_render_callback(() => {
				if (!current) return;
				if (!div4_transition) div4_transition = create_bidirectional_transition(div4, fade, { duration: 180 }, true);
				div4_transition.run(1);
			});

			current = true;
		},
		o(local) {
			transition_out(if_block4);
			if (!article_transition) article_transition = create_bidirectional_transition(article, fly, { y: 25, duration: 240 }, false);
			article_transition.run(0);
			if (!div4_transition) div4_transition = create_bidirectional_transition(div4, fade, { duration: 180 }, false);
			div4_transition.run(0);
			current = false;
		},
		d(detaching) {
			if (detaching) detach(div4);
			if (if_block0) if_block0.d();
			if (if_block1) if_block1.d();
			if (if_block2) if_block2.d();
			if (if_block3) if_block3.d();
			if (if_block4) if_block4.d();
			if (detaching && article_transition) article_transition.end();
			if (detaching && div4_transition) div4_transition.end();
			mounted = false;
			run_all(dispose);
		}
	};
}

// (1699:8) {#if selectedPost.image && selectedPost.image.url}
function create_if_block_9(ctx) {
	let div;
	let img;
	let img_src_value;
	let img_alt_value;

	return {
		c() {
			div = element("div");
			img = element("img");
			this.h();
		},
		l(nodes) {
			div = claim_element(nodes, "DIV", { class: true });
			var div_nodes = children(div);
			img = claim_element(div_nodes, "IMG", { src: true, alt: true, class: true });
			div_nodes.forEach(detach);
			this.h();
		},
		h() {
			if (!src_url_equal(img.src, img_src_value = /*selectedPost*/ ctx[2].image.url)) attr(img, "src", img_src_value);
			attr(img, "alt", img_alt_value = /*selectedPost*/ ctx[2].image.alt || /*selectedPost*/ ctx[2].title);
			attr(img, "class", "svelte-ktcz30");
			attr(div, "class", "cg-blog-modal__image svelte-ktcz30");
		},
		m(target, anchor) {
			insert_hydration(target, div, anchor);
			append_hydration(div, img);
		},
		p(ctx, dirty) {
			if (dirty[0] & /*selectedPost*/ 4 && !src_url_equal(img.src, img_src_value = /*selectedPost*/ ctx[2].image.url)) {
				attr(img, "src", img_src_value);
			}

			if (dirty[0] & /*selectedPost*/ 4 && img_alt_value !== (img_alt_value = /*selectedPost*/ ctx[2].image.alt || /*selectedPost*/ ctx[2].title)) {
				attr(img, "alt", img_alt_value);
			}
		},
		d(detaching) {
			if (detaching) detach(div);
		}
	};
}

// (1710:12) {#if selectedPost.category}
function create_if_block_8(ctx) {
	let span;
	let t_value = /*selectedPost*/ ctx[2].category + "";
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
			attr(span, "class", "cg-blog-modal__category svelte-ktcz30");
		},
		m(target, anchor) {
			insert_hydration(target, span, anchor);
			append_hydration(span, t);
		},
		p(ctx, dirty) {
			if (dirty[0] & /*selectedPost*/ 4 && t_value !== (t_value = /*selectedPost*/ ctx[2].category + "")) set_data(t, t_value);
		},
		d(detaching) {
			if (detaching) detach(span);
		}
	};
}

// (1716:12) {#if selectedPost.date}
function create_if_block_7(ctx) {
	let time;
	let t_value = /*selectedPost*/ ctx[2].date + "";
	let t;
	let time_datetime_value;

	return {
		c() {
			time = element("time");
			t = text(t_value);
			this.h();
		},
		l(nodes) {
			time = claim_element(nodes, "TIME", { class: true, datetime: true });
			var time_nodes = children(time);
			t = claim_text(time_nodes, t_value);
			time_nodes.forEach(detach);
			this.h();
		},
		h() {
			attr(time, "class", "cg-blog-modal__date svelte-ktcz30");
			attr(time, "datetime", time_datetime_value = /*selectedPost*/ ctx[2].date_iso || /*selectedPost*/ ctx[2].sort_date);
		},
		m(target, anchor) {
			insert_hydration(target, time, anchor);
			append_hydration(time, t);
		},
		p(ctx, dirty) {
			if (dirty[0] & /*selectedPost*/ 4 && t_value !== (t_value = /*selectedPost*/ ctx[2].date + "")) set_data(t, t_value);

			if (dirty[0] & /*selectedPost*/ 4 && time_datetime_value !== (time_datetime_value = /*selectedPost*/ ctx[2].date_iso || /*selectedPost*/ ctx[2].sort_date)) {
				attr(time, "datetime", time_datetime_value);
			}
		},
		d(detaching) {
			if (detaching) detach(time);
		}
	};
}

// (1730:10) {#if selectedPost.teaser}
function create_if_block_6(ctx) {
	let p;
	let t_value = /*selectedPost*/ ctx[2].teaser + "";
	let t;

	return {
		c() {
			p = element("p");
			t = text(t_value);
			this.h();
		},
		l(nodes) {
			p = claim_element(nodes, "P", { class: true });
			var p_nodes = children(p);
			t = claim_text(p_nodes, t_value);
			p_nodes.forEach(detach);
			this.h();
		},
		h() {
			attr(p, "class", "cg-blog-modal__teaser svelte-ktcz30");
		},
		m(target, anchor) {
			insert_hydration(target, p, anchor);
			append_hydration(p, t);
		},
		p(ctx, dirty) {
			if (dirty[0] & /*selectedPost*/ 4 && t_value !== (t_value = /*selectedPost*/ ctx[2].teaser + "")) set_data(t, t_value);
		},
		d(detaching) {
			if (detaching) detach(p);
		}
	};
}

// (1742:6) {#if galleryItems.length > 0 && currentGalleryImage}
function create_if_block_1(ctx) {
	let section;
	let div0;
	let h3;
	let t0;
	let t1;
	let t2;
	let div1;
	let previous_key = /*currentGalleryImage*/ ctx[9].image.url;
	let t3;
	let t4;
	let t5;
	let section_aria_label_value;
	let current;
	let if_block0 = /*galleryItems*/ ctx[5].length > 1 && create_if_block_5(ctx);
	let key_block = create_key_block(ctx);
	let if_block1 = /*galleryItems*/ ctx[5].length > 1 && create_if_block_4(ctx);
	let if_block2 = /*currentGalleryImage*/ ctx[9].caption && create_if_block_3(ctx);
	let if_block3 = /*galleryItems*/ ctx[5].length > 1 && create_if_block_2(ctx);

	return {
		c() {
			section = element("section");
			div0 = element("div");
			h3 = element("h3");
			t0 = text("Bildergalerie");
			t1 = space();
			if (if_block0) if_block0.c();
			t2 = space();
			div1 = element("div");
			key_block.c();
			t3 = space();
			if (if_block1) if_block1.c();
			t4 = space();
			if (if_block2) if_block2.c();
			t5 = space();
			if (if_block3) if_block3.c();
			this.h();
		},
		l(nodes) {
			section = claim_element(nodes, "SECTION", { class: true, "aria-label": true });
			var section_nodes = children(section);
			div0 = claim_element(section_nodes, "DIV", { class: true });
			var div0_nodes = children(div0);
			h3 = claim_element(div0_nodes, "H3", { class: true });
			var h3_nodes = children(h3);
			t0 = claim_text(h3_nodes, "Bildergalerie");
			h3_nodes.forEach(detach);
			t1 = claim_space(div0_nodes);
			if (if_block0) if_block0.l(div0_nodes);
			div0_nodes.forEach(detach);
			t2 = claim_space(section_nodes);
			div1 = claim_element(section_nodes, "DIV", { class: true });
			var div1_nodes = children(div1);
			key_block.l(div1_nodes);
			t3 = claim_space(div1_nodes);
			if (if_block1) if_block1.l(div1_nodes);
			div1_nodes.forEach(detach);
			t4 = claim_space(section_nodes);
			if (if_block2) if_block2.l(section_nodes);
			t5 = claim_space(section_nodes);
			if (if_block3) if_block3.l(section_nodes);
			section_nodes.forEach(detach);
			this.h();
		},
		h() {
			attr(h3, "class", "svelte-ktcz30");
			attr(div0, "class", "cg-blog-gallery__heading svelte-ktcz30");
			attr(div1, "class", "cg-blog-gallery__stage svelte-ktcz30");
			attr(section, "class", "cg-blog-gallery svelte-ktcz30");
			attr(section, "aria-label", section_aria_label_value = "Bildergalerie: " + /*selectedPost*/ ctx[2].title);
		},
		m(target, anchor) {
			insert_hydration(target, section, anchor);
			append_hydration(section, div0);
			append_hydration(div0, h3);
			append_hydration(h3, t0);
			append_hydration(div0, t1);
			if (if_block0) if_block0.m(div0, null);
			append_hydration(section, t2);
			append_hydration(section, div1);
			key_block.m(div1, null);
			append_hydration(div1, t3);
			if (if_block1) if_block1.m(div1, null);
			append_hydration(section, t4);
			if (if_block2) if_block2.m(section, null);
			append_hydration(section, t5);
			if (if_block3) if_block3.m(section, null);
			current = true;
		},
		p(ctx, dirty) {
			if (/*galleryItems*/ ctx[5].length > 1) {
				if (if_block0) {
					if_block0.p(ctx, dirty);
				} else {
					if_block0 = create_if_block_5(ctx);
					if_block0.c();
					if_block0.m(div0, null);
				}
			} else if (if_block0) {
				if_block0.d(1);
				if_block0 = null;
			}

			if (dirty[0] & /*currentGalleryImage*/ 512 && safe_not_equal(previous_key, previous_key = /*currentGalleryImage*/ ctx[9].image.url)) {
				group_outros();
				transition_out(key_block, 1, 1, noop);
				check_outros();
				key_block = create_key_block(ctx);
				key_block.c();
				transition_in(key_block, 1);
				key_block.m(div1, t3);
			} else {
				key_block.p(ctx, dirty);
			}

			if (/*galleryItems*/ ctx[5].length > 1) {
				if (if_block1) {
					if_block1.p(ctx, dirty);
				} else {
					if_block1 = create_if_block_4(ctx);
					if_block1.c();
					if_block1.m(div1, null);
				}
			} else if (if_block1) {
				if_block1.d(1);
				if_block1 = null;
			}

			if (/*currentGalleryImage*/ ctx[9].caption) {
				if (if_block2) {
					if_block2.p(ctx, dirty);
				} else {
					if_block2 = create_if_block_3(ctx);
					if_block2.c();
					if_block2.m(section, t5);
				}
			} else if (if_block2) {
				if_block2.d(1);
				if_block2 = null;
			}

			if (/*galleryItems*/ ctx[5].length > 1) {
				if (if_block3) {
					if_block3.p(ctx, dirty);
				} else {
					if_block3 = create_if_block_2(ctx);
					if_block3.c();
					if_block3.m(section, null);
				}
			} else if (if_block3) {
				if_block3.d(1);
				if_block3 = null;
			}

			if (!current || dirty[0] & /*selectedPost*/ 4 && section_aria_label_value !== (section_aria_label_value = "Bildergalerie: " + /*selectedPost*/ ctx[2].title)) {
				attr(section, "aria-label", section_aria_label_value);
			}
		},
		i(local) {
			if (current) return;
			transition_in(key_block);
			current = true;
		},
		o(local) {
			transition_out(key_block);
			current = false;
		},
		d(detaching) {
			if (detaching) detach(section);
			if (if_block0) if_block0.d();
			key_block.d(detaching);
			if (if_block1) if_block1.d();
			if (if_block2) if_block2.d();
			if (if_block3) if_block3.d();
		}
	};
}

// (1750:12) {#if galleryItems.length > 1}
function create_if_block_5(ctx) {
	let span;
	let t0_value = /*galleryIndex*/ ctx[3] + 1 + "";
	let t0;
	let t1;
	let t2_value = /*galleryItems*/ ctx[5].length + "";
	let t2;

	return {
		c() {
			span = element("span");
			t0 = text(t0_value);
			t1 = text(" / ");
			t2 = text(t2_value);
			this.h();
		},
		l(nodes) {
			span = claim_element(nodes, "SPAN", { class: true });
			var span_nodes = children(span);
			t0 = claim_text(span_nodes, t0_value);
			t1 = claim_text(span_nodes, " / ");
			t2 = claim_text(span_nodes, t2_value);
			span_nodes.forEach(detach);
			this.h();
		},
		h() {
			attr(span, "class", "svelte-ktcz30");
		},
		m(target, anchor) {
			insert_hydration(target, span, anchor);
			append_hydration(span, t0);
			append_hydration(span, t1);
			append_hydration(span, t2);
		},
		p(ctx, dirty) {
			if (dirty[0] & /*galleryIndex*/ 8 && t0_value !== (t0_value = /*galleryIndex*/ ctx[3] + 1 + "")) set_data(t0, t0_value);
			if (dirty[0] & /*galleryItems*/ 32 && t2_value !== (t2_value = /*galleryItems*/ ctx[5].length + "")) set_data(t2, t2_value);
		},
		d(detaching) {
			if (detaching) detach(span);
		}
	};
}

// (1758:12) {#key currentGalleryImage.image.url}
function create_key_block(ctx) {
	let img;
	let img_src_value;
	let img_alt_value;
	let img_transition;
	let current;

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
			if (!src_url_equal(img.src, img_src_value = /*currentGalleryImage*/ ctx[9].image.url)) attr(img, "src", img_src_value);
			attr(img, "alt", img_alt_value = /*currentGalleryImage*/ ctx[9].image.alt || /*currentGalleryImage*/ ctx[9].caption || /*selectedPost*/ ctx[2].title);
			attr(img, "class", "svelte-ktcz30");
		},
		m(target, anchor) {
			insert_hydration(target, img, anchor);
			current = true;
		},
		p(ctx, dirty) {
			if (!current || dirty[0] & /*currentGalleryImage*/ 512 && !src_url_equal(img.src, img_src_value = /*currentGalleryImage*/ ctx[9].image.url)) {
				attr(img, "src", img_src_value);
			}

			if (!current || dirty[0] & /*currentGalleryImage, selectedPost*/ 516 && img_alt_value !== (img_alt_value = /*currentGalleryImage*/ ctx[9].image.alt || /*currentGalleryImage*/ ctx[9].caption || /*selectedPost*/ ctx[2].title)) {
				attr(img, "alt", img_alt_value);
			}
		},
		i(local) {
			if (current) return;

			add_render_callback(() => {
				if (!current) return;
				if (!img_transition) img_transition = create_bidirectional_transition(img, fade, { duration: 180 }, true);
				img_transition.run(1);
			});

			current = true;
		},
		o(local) {
			if (!img_transition) img_transition = create_bidirectional_transition(img, fade, { duration: 180 }, false);
			img_transition.run(0);
			current = false;
		},
		d(detaching) {
			if (detaching) detach(img);
			if (detaching && img_transition) img_transition.end();
		}
	};
}

// (1768:12) {#if galleryItems.length > 1}
function create_if_block_4(ctx) {
	let button0;
	let svg0;
	let path0;
	let t;
	let button1;
	let svg1;
	let path1;
	let mounted;
	let dispose;

	return {
		c() {
			button0 = element("button");
			svg0 = svg_element("svg");
			path0 = svg_element("path");
			t = space();
			button1 = element("button");
			svg1 = svg_element("svg");
			path1 = svg_element("path");
			this.h();
		},
		l(nodes) {
			button0 = claim_element(nodes, "BUTTON", {
				type: true,
				class: true,
				"aria-label": true
			});

			var button0_nodes = children(button0);

			svg0 = claim_svg_element(button0_nodes, "svg", {
				viewBox: true,
				"aria-hidden": true,
				class: true
			});

			var svg0_nodes = children(svg0);
			path0 = claim_svg_element(svg0_nodes, "path", { d: true, class: true });
			children(path0).forEach(detach);
			svg0_nodes.forEach(detach);
			button0_nodes.forEach(detach);
			t = claim_space(nodes);

			button1 = claim_element(nodes, "BUTTON", {
				type: true,
				class: true,
				"aria-label": true
			});

			var button1_nodes = children(button1);

			svg1 = claim_svg_element(button1_nodes, "svg", {
				viewBox: true,
				"aria-hidden": true,
				class: true
			});

			var svg1_nodes = children(svg1);
			path1 = claim_svg_element(svg1_nodes, "path", { d: true, class: true });
			children(path1).forEach(detach);
			svg1_nodes.forEach(detach);
			button1_nodes.forEach(detach);
			this.h();
		},
		h() {
			attr(path0, "d", "m15 18-6-6 6-6");
			attr(path0, "class", "svelte-ktcz30");
			attr(svg0, "viewBox", "0 0 24 24");
			attr(svg0, "aria-hidden", "true");
			attr(svg0, "class", "svelte-ktcz30");
			attr(button0, "type", "button");
			attr(button0, "class", "cg-blog-gallery__arrow cg-blog-gallery__arrow--previous svelte-ktcz30");
			attr(button0, "aria-label", "Vorheriges Bild");
			attr(path1, "d", "m9 6 6 6-6 6");
			attr(path1, "class", "svelte-ktcz30");
			attr(svg1, "viewBox", "0 0 24 24");
			attr(svg1, "aria-hidden", "true");
			attr(svg1, "class", "svelte-ktcz30");
			attr(button1, "type", "button");
			attr(button1, "class", "cg-blog-gallery__arrow cg-blog-gallery__arrow--next svelte-ktcz30");
			attr(button1, "aria-label", "Nächstes Bild");
		},
		m(target, anchor) {
			insert_hydration(target, button0, anchor);
			append_hydration(button0, svg0);
			append_hydration(svg0, path0);
			insert_hydration(target, t, anchor);
			insert_hydration(target, button1, anchor);
			append_hydration(button1, svg1);
			append_hydration(svg1, path1);

			if (!mounted) {
				dispose = [
					listen(button0, "click", /*previousGalleryImage*/ ctx[17]),
					listen(button1, "click", /*nextGalleryImage*/ ctx[18])
				];

				mounted = true;
			}
		},
		p: noop,
		d(detaching) {
			if (detaching) detach(button0);
			if (detaching) detach(t);
			if (detaching) detach(button1);
			mounted = false;
			run_all(dispose);
		}
	};
}

// (1793:10) {#if currentGalleryImage.caption}
function create_if_block_3(ctx) {
	let p;
	let t_value = /*currentGalleryImage*/ ctx[9].caption + "";
	let t;

	return {
		c() {
			p = element("p");
			t = text(t_value);
			this.h();
		},
		l(nodes) {
			p = claim_element(nodes, "P", { class: true });
			var p_nodes = children(p);
			t = claim_text(p_nodes, t_value);
			p_nodes.forEach(detach);
			this.h();
		},
		h() {
			attr(p, "class", "cg-blog-gallery__caption svelte-ktcz30");
		},
		m(target, anchor) {
			insert_hydration(target, p, anchor);
			append_hydration(p, t);
		},
		p(ctx, dirty) {
			if (dirty[0] & /*currentGalleryImage*/ 512 && t_value !== (t_value = /*currentGalleryImage*/ ctx[9].caption + "")) set_data(t, t_value);
		},
		d(detaching) {
			if (detaching) detach(p);
		}
	};
}

// (1799:10) {#if galleryItems.length > 1}
function create_if_block_2(ctx) {
	let div;
	let each_value = /*galleryItems*/ ctx[5];
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
			attr(div, "class", "cg-blog-gallery__thumbnails svelte-ktcz30");
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
			if (dirty[0] & /*galleryIndex, selectGalleryImage, galleryItems*/ 524328) {
				each_value = /*galleryItems*/ ctx[5];
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

// (1801:14) {#each galleryItems as galleryImage, index}
function create_each_block(ctx) {
	let button;
	let img;
	let img_src_value;
	let t;
	let button_aria_current_value;
	let mounted;
	let dispose;

	function click_handler_7() {
		return /*click_handler_7*/ ctx[39](/*index*/ ctx[43]);
	}

	return {
		c() {
			button = element("button");
			img = element("img");
			t = space();
			this.h();
		},
		l(nodes) {
			button = claim_element(nodes, "BUTTON", {
				type: true,
				"aria-label": true,
				"aria-current": true,
				class: true
			});

			var button_nodes = children(button);

			img = claim_element(button_nodes, "IMG", {
				src: true,
				alt: true,
				loading: true,
				class: true
			});

			t = claim_space(button_nodes);
			button_nodes.forEach(detach);
			this.h();
		},
		h() {
			if (!src_url_equal(img.src, img_src_value = /*galleryImage*/ ctx[41].image.url)) attr(img, "src", img_src_value);
			attr(img, "alt", "");
			attr(img, "loading", "lazy");
			attr(img, "class", "svelte-ktcz30");
			attr(button, "type", "button");
			attr(button, "aria-label", "Bild " + (/*index*/ ctx[43] + 1) + " anzeigen");

			attr(button, "aria-current", button_aria_current_value = /*galleryIndex*/ ctx[3] === /*index*/ ctx[43]
			? "true"
			: undefined);

			attr(button, "class", "svelte-ktcz30");
			toggle_class(button, "active", /*galleryIndex*/ ctx[3] === /*index*/ ctx[43]);
		},
		m(target, anchor) {
			insert_hydration(target, button, anchor);
			append_hydration(button, img);
			append_hydration(button, t);

			if (!mounted) {
				dispose = listen(button, "click", click_handler_7);
				mounted = true;
			}
		},
		p(new_ctx, dirty) {
			ctx = new_ctx;

			if (dirty[0] & /*galleryItems*/ 32 && !src_url_equal(img.src, img_src_value = /*galleryImage*/ ctx[41].image.url)) {
				attr(img, "src", img_src_value);
			}

			if (dirty[0] & /*galleryIndex*/ 8 && button_aria_current_value !== (button_aria_current_value = /*galleryIndex*/ ctx[3] === /*index*/ ctx[43]
			? "true"
			: undefined)) {
				attr(button, "aria-current", button_aria_current_value);
			}

			if (dirty[0] & /*galleryIndex*/ 8) {
				toggle_class(button, "active", /*galleryIndex*/ ctx[3] === /*index*/ ctx[43]);
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
	let div3;
	let div1;
	let div0;
	let t0;
	let label;
	let span0;
	let svg;
	let circle;
	let path;
	let t1;
	let span1;
	let t2;
	let t3;
	let input;
	let t4;
	let div2;
	let h2;
	let t5;
	let t6;
	let span2;
	let t7_value = /*filteredPosts*/ ctx[7].length + "";
	let t7;
	let t8;

	let t9_value = (/*filteredPosts*/ ctx[7].length === 1
	? " Beitrag"
	: " Beiträge") + "";

	let t9;
	let t10;
	let t11;
	let if_block1_anchor;
	let current;
	let mounted;
	let dispose;
	let each_value_3 = /*availableCategories*/ ctx[10];
	let each_blocks = [];

	for (let i = 0; i < each_value_3.length; i += 1) {
		each_blocks[i] = create_each_block_3(get_each_context_3(ctx, each_value_3, i));
	}

	function select_block_type(ctx, dirty) {
		if (/*paginatedPosts*/ ctx[8].length > 0) return create_if_block_10;
		return create_else_block_1;
	}

	let current_block_type = select_block_type(ctx);
	let if_block0 = current_block_type(ctx);
	let if_block1 = /*selectedPost*/ ctx[2] && create_if_block(ctx);

	return {
		c() {
			section = element("section");
			div3 = element("div");
			div1 = element("div");
			div0 = element("div");

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].c();
			}

			t0 = space();
			label = element("label");
			span0 = element("span");
			svg = svg_element("svg");
			circle = svg_element("circle");
			path = svg_element("path");
			t1 = space();
			span1 = element("span");
			t2 = text("Beiträge durchsuchen");
			t3 = space();
			input = element("input");
			t4 = space();
			div2 = element("div");
			h2 = element("h2");
			t5 = text(/*activeCategory*/ ctx[0]);
			t6 = space();
			span2 = element("span");
			t7 = text(t7_value);
			t8 = space();
			t9 = text(t9_value);
			t10 = space();
			if_block0.c();
			t11 = space();
			if (if_block1) if_block1.c();
			if_block1_anchor = empty();
			this.h();
		},
		l(nodes) {
			section = claim_element(nodes, "SECTION", { class: true, "aria-labelledby": true });
			var section_nodes = children(section);
			div3 = claim_element(section_nodes, "DIV", { class: true });
			var div3_nodes = children(div3);
			div1 = claim_element(div3_nodes, "DIV", { class: true });
			var div1_nodes = children(div1);
			div0 = claim_element(div1_nodes, "DIV", { class: true, "aria-label": true });
			var div0_nodes = children(div0);

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].l(div0_nodes);
			}

			div0_nodes.forEach(detach);
			t0 = claim_space(div1_nodes);
			label = claim_element(div1_nodes, "LABEL", { class: true });
			var label_nodes = children(label);
			span0 = claim_element(label_nodes, "SPAN", { class: true, "aria-hidden": true });
			var span0_nodes = children(span0);
			svg = claim_svg_element(span0_nodes, "svg", { viewBox: true, class: true });
			var svg_nodes = children(svg);
			circle = claim_svg_element(svg_nodes, "circle", { cx: true, cy: true, r: true, class: true });
			children(circle).forEach(detach);
			path = claim_svg_element(svg_nodes, "path", { d: true, class: true });
			children(path).forEach(detach);
			svg_nodes.forEach(detach);
			span0_nodes.forEach(detach);
			t1 = claim_space(label_nodes);
			span1 = claim_element(label_nodes, "SPAN", { class: true });
			var span1_nodes = children(span1);
			t2 = claim_text(span1_nodes, "Beiträge durchsuchen");
			span1_nodes.forEach(detach);
			t3 = claim_space(label_nodes);

			input = claim_element(label_nodes, "INPUT", {
				type: true,
				placeholder: true,
				class: true
			});

			label_nodes.forEach(detach);
			div1_nodes.forEach(detach);
			t4 = claim_space(div3_nodes);
			div2 = claim_element(div3_nodes, "DIV", { class: true });
			var div2_nodes = children(div2);
			h2 = claim_element(div2_nodes, "H2", { id: true, class: true });
			var h2_nodes = children(h2);
			t5 = claim_text(h2_nodes, /*activeCategory*/ ctx[0]);
			h2_nodes.forEach(detach);
			t6 = claim_space(div2_nodes);
			span2 = claim_element(div2_nodes, "SPAN", { class: true });
			var span2_nodes = children(span2);
			t7 = claim_text(span2_nodes, t7_value);
			t8 = claim_space(span2_nodes);
			t9 = claim_text(span2_nodes, t9_value);
			span2_nodes.forEach(detach);
			div2_nodes.forEach(detach);
			t10 = claim_space(div3_nodes);
			if_block0.l(div3_nodes);
			div3_nodes.forEach(detach);
			section_nodes.forEach(detach);
			t11 = claim_space(nodes);
			if (if_block1) if_block1.l(nodes);
			if_block1_anchor = empty();
			this.h();
		},
		h() {
			attr(div0, "class", "cg-blog__categories svelte-ktcz30");
			attr(div0, "aria-label", "Blogkategorien");
			attr(circle, "cx", "10.5");
			attr(circle, "cy", "10.5");
			attr(circle, "r", "6.5");
			attr(circle, "class", "svelte-ktcz30");
			attr(path, "d", "m15.5 15.5 5 5");
			attr(path, "class", "svelte-ktcz30");
			attr(svg, "viewBox", "0 0 24 24");
			attr(svg, "class", "svelte-ktcz30");
			attr(span0, "class", "cg-blog__search-icon svelte-ktcz30");
			attr(span0, "aria-hidden", "true");
			attr(span1, "class", "cg-blog__search-label svelte-ktcz30");
			attr(input, "type", "search");
			attr(input, "placeholder", "Beiträge suchen …");
			attr(input, "class", "svelte-ktcz30");
			attr(label, "class", "cg-blog__search svelte-ktcz30");
			attr(div1, "class", "cg-blog__toolbar svelte-ktcz30");
			attr(h2, "id", "cg-blog-results-heading");
			attr(h2, "class", "svelte-ktcz30");
			attr(span2, "class", "svelte-ktcz30");
			attr(div2, "class", "cg-blog__results-header svelte-ktcz30");
			attr(div3, "class", "cg-blog__inner svelte-ktcz30");
			attr(section, "class", "cg-blog svelte-ktcz30");
			attr(section, "aria-labelledby", "cg-blog-results-heading");
		},
		m(target, anchor) {
			insert_hydration(target, section, anchor);
			append_hydration(section, div3);
			append_hydration(div3, div1);
			append_hydration(div1, div0);

			for (let i = 0; i < each_blocks.length; i += 1) {
				if (each_blocks[i]) {
					each_blocks[i].m(div0, null);
				}
			}

			append_hydration(div1, t0);
			append_hydration(div1, label);
			append_hydration(label, span0);
			append_hydration(span0, svg);
			append_hydration(svg, circle);
			append_hydration(svg, path);
			append_hydration(label, t1);
			append_hydration(label, span1);
			append_hydration(span1, t2);
			append_hydration(label, t3);
			append_hydration(label, input);
			set_input_value(input, /*searchTerm*/ ctx[1]);
			append_hydration(div3, t4);
			append_hydration(div3, div2);
			append_hydration(div2, h2);
			append_hydration(h2, t5);
			append_hydration(div2, t6);
			append_hydration(div2, span2);
			append_hydration(span2, t7);
			append_hydration(span2, t8);
			append_hydration(span2, t9);
			append_hydration(div3, t10);
			if_block0.m(div3, null);
			insert_hydration(target, t11, anchor);
			if (if_block1) if_block1.m(target, anchor);
			insert_hydration(target, if_block1_anchor, anchor);
			current = true;

			if (!mounted) {
				dispose = [
					listen(input, "input", /*input_input_handler*/ ctx[32]),
					listen(input, "input", /*handleSearch*/ ctx[12])
				];

				mounted = true;
			}
		},
		p(ctx, dirty) {
			if (dirty[0] & /*activeCategory, availableCategories, selectCategory*/ 3073) {
				each_value_3 = /*availableCategories*/ ctx[10];
				let i;

				for (i = 0; i < each_value_3.length; i += 1) {
					const child_ctx = get_each_context_3(ctx, each_value_3, i);

					if (each_blocks[i]) {
						each_blocks[i].p(child_ctx, dirty);
					} else {
						each_blocks[i] = create_each_block_3(child_ctx);
						each_blocks[i].c();
						each_blocks[i].m(div0, null);
					}
				}

				for (; i < each_blocks.length; i += 1) {
					each_blocks[i].d(1);
				}

				each_blocks.length = each_value_3.length;
			}

			if (dirty[0] & /*searchTerm*/ 2 && input.value !== /*searchTerm*/ ctx[1]) {
				set_input_value(input, /*searchTerm*/ ctx[1]);
			}

			if (!current || dirty[0] & /*activeCategory*/ 1) set_data(t5, /*activeCategory*/ ctx[0]);
			if ((!current || dirty[0] & /*filteredPosts*/ 128) && t7_value !== (t7_value = /*filteredPosts*/ ctx[7].length + "")) set_data(t7, t7_value);

			if ((!current || dirty[0] & /*filteredPosts*/ 128) && t9_value !== (t9_value = (/*filteredPosts*/ ctx[7].length === 1
			? " Beitrag"
			: " Beiträge") + "")) set_data(t9, t9_value);

			if (current_block_type === (current_block_type = select_block_type(ctx)) && if_block0) {
				if_block0.p(ctx, dirty);
			} else {
				if_block0.d(1);
				if_block0 = current_block_type(ctx);

				if (if_block0) {
					if_block0.c();
					if_block0.m(div3, null);
				}
			}

			if (/*selectedPost*/ ctx[2]) {
				if (if_block1) {
					if_block1.p(ctx, dirty);

					if (dirty[0] & /*selectedPost*/ 4) {
						transition_in(if_block1, 1);
					}
				} else {
					if_block1 = create_if_block(ctx);
					if_block1.c();
					transition_in(if_block1, 1);
					if_block1.m(if_block1_anchor.parentNode, if_block1_anchor);
				}
			} else if (if_block1) {
				group_outros();

				transition_out(if_block1, 1, 1, () => {
					if_block1 = null;
				});

				check_outros();
			}
		},
		i(local) {
			if (current) return;
			transition_in(if_block1);
			current = true;
		},
		o(local) {
			transition_out(if_block1);
			current = false;
		},
		d(detaching) {
			if (detaching) detach(section);
			destroy_each(each_blocks, detaching);
			if_block0.d();
			if (detaching) detach(t11);
			if (if_block1) if_block1.d(detaching);
			if (detaching) detach(if_block1_anchor);
			mounted = false;
			run_all(dispose);
		}
	};
}

const postsPerPage = 9;

/*
  Neuesten Beitrag an den separaten Hero senden.
*/
function publishLatestPost(post) {
	if (typeof window === "undefined" || !post) {
		return;
	}

	window.__cgLatestBlogPost = post;
	window.dispatchEvent(new CustomEvent("cg-blog-latest-post", { detail: post }));
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

				return `
        <a
          href="${href}"
          target="_blank"
          rel="noopener"
        >
          ${output}
        </a>
      `;
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
	let preparedPosts;
	let sortedPosts;
	let latestPost;
	let availableCategories;
	let galleryItems;
	let currentGalleryImage;
	let filteredPosts;
	let totalPages;
	let firstVisiblePost;
	let lastVisiblePost;
	let paginatedPosts;
	let { props } = $$props;
	let { posts } = $$props;
	let { heading } = $$props;
	let { categories } = $$props;
	let { empty_message } = $$props;
	let { search_placeholder } = $$props;
	let activeCategory = "Alle Beiträge";
	let searchTerm = "";
	let selectedPost = null;
	let galleryIndex = 0;
	let previousBodyOverflow = "";
	let currentPage = 1;

	function selectCategory(category) {
		$$invalidate(0, activeCategory = category);
		$$invalidate(4, currentPage = 1);
		closeArticle();
	}

	function handleSearch() {
		$$invalidate(4, currentPage = 1);
		closeArticle();
	}

	function resetFilters() {
		$$invalidate(0, activeCategory = "Alle Beiträge");
		$$invalidate(1, searchTerm = "");
		$$invalidate(4, currentPage = 1);
		closeArticle();
	}

	function goToPage(page) {
		const targetPage = Math.min(Math.max(page, 1), totalPages);
		if (targetPage === currentPage) return;
		$$invalidate(4, currentPage = targetPage);
		closeArticle();

		if (typeof document !== "undefined") {
			requestAnimationFrame(() => {
				const blogResults = document.getElementById("cg-blog-results");

				if (blogResults) {
					blogResults.scrollIntoView({ behavior: "smooth", block: "start" });
				}
			});
		}
	}

	function openArticle(post) {
		if (!post) return;
		$$invalidate(2, selectedPost = post);
		$$invalidate(3, galleryIndex = 0);

		if (typeof document !== "undefined") {
			previousBodyOverflow = document.body.style.overflow;
			document.body.style.overflow = "hidden";
		}
	}

	function closeArticle() {
		$$invalidate(2, selectedPost = null);
		$$invalidate(3, galleryIndex = 0);

		if (typeof document !== "undefined") {
			document.body.style.overflow = previousBodyOverflow;
		}
	}

	function previousGalleryImage() {
		if (galleryItems.length < 2) return;

		$$invalidate(3, galleryIndex = galleryIndex === 0
		? galleryItems.length - 1
		: galleryIndex - 1);
	}

	function nextGalleryImage() {
		if (galleryItems.length < 2) return;

		$$invalidate(3, galleryIndex = galleryIndex === galleryItems.length - 1
		? 0
		: galleryIndex + 1);
	}

	function selectGalleryImage(index) {
		$$invalidate(3, galleryIndex = index);
	}

	onMount(() => {
		function handleKeydown(event) {
			if (!selectedPost) return;

			if (event.key === "Escape") {
				closeArticle();
			}

			if (event.key === "ArrowLeft") {
				previousGalleryImage();
			}

			if (event.key === "ArrowRight") {
				nextGalleryImage();
			}
		}

		function handleHeroPostOpen(event) {
			if (event.detail) {
				openArticle(event.detail);
			}
		}

		function handleLatestPostRequest() {
			if (latestPost) {
				publishLatestPost(latestPost);
			}
		}

		document.addEventListener("keydown", handleKeydown);
		window.addEventListener("cg-blog-open-post", handleHeroPostOpen);
		window.addEventListener("cg-blog-request-latest-post", handleLatestPostRequest);

		if (latestPost) {
			publishLatestPost(latestPost);
		}

		return () => {
			document.removeEventListener("keydown", handleKeydown);
			window.removeEventListener("cg-blog-open-post", handleHeroPostOpen);
			window.removeEventListener("cg-blog-request-latest-post", handleLatestPostRequest);

			if (window.__cgLatestBlogPost === latestPost) {
				delete window.__cgLatestBlogPost;
			}

			document.body.style.overflow = previousBodyOverflow;
		};
	});

	const click_handler = category => selectCategory(category);

	function input_input_handler() {
		searchTerm = this.value;
		$$invalidate(1, searchTerm);
	}

	const click_handler_1 = post => openArticle(post);
	const click_handler_2 = post => openArticle(post);
	const click_handler_3 = post => openArticle(post);
	const click_handler_4 = () => goToPage(currentPage - 1);
	const click_handler_5 = index => goToPage(index + 1);
	const click_handler_6 = () => goToPage(currentPage + 1);
	const click_handler_7 = index => selectGalleryImage(index);

	$$self.$$set = $$props => {
		if ('props' in $$props) $$invalidate(20, props = $$props.props);
		if ('posts' in $$props) $$invalidate(21, posts = $$props.posts);
		if ('heading' in $$props) $$invalidate(22, heading = $$props.heading);
		if ('categories' in $$props) $$invalidate(23, categories = $$props.categories);
		if ('empty_message' in $$props) $$invalidate(24, empty_message = $$props.empty_message);
		if ('search_placeholder' in $$props) $$invalidate(25, search_placeholder = $$props.search_placeholder);
	};

	$$self.$$.update = () => {
		if ($$self.$$.dirty[0] & /*posts*/ 2097152) {
			/*
  date_label wird automatisch zusätzlich als date
  bereitgestellt. Dadurch funktionieren der Blog
  und der separate Hero mit demselben Datum.
*/
			$$invalidate(30, preparedPosts = (posts || []).map(post => ({ ...post, date: post.date_label || "" })));
		}

		if ($$self.$$.dirty[0] & /*preparedPosts*/ 1073741824) {
			/*
  sort_date bestimmt die Reihenfolge.
  Der neueste Beitrag steht an erster Stelle.
*/
			$$invalidate(29, sortedPosts = [...preparedPosts].sort((postA, postB) => {
				const dateA = String(postA.sort_date || "");
				const dateB = String(postB.sort_date || "");
				return dateB.localeCompare(dateA);
			}));
		}

		if ($$self.$$.dirty[0] & /*sortedPosts*/ 536870912) {
			$$invalidate(26, latestPost = sortedPosts[0] || null);
		}

		if ($$self.$$.dirty[0] & /*preparedPosts*/ 1073741824) {
			/*
  Kategorien aus den Beiträgen erzeugen.
*/
			$$invalidate(10, availableCategories = [
				"Alle Beiträge",
				...Array.from(new Set(preparedPosts.map(post => post.category).filter(Boolean)))
			]);
		}

		if ($$self.$$.dirty[0] & /*selectedPost*/ 4) {
			/*
  Galerie des aktuell geöffneten Beitrags.
  Unvollständige Galerieeinträge werden entfernt.
*/
			$$invalidate(5, galleryItems = (selectedPost?.gallery || []).filter(item => item?.image?.url));
		}

		if ($$self.$$.dirty[0] & /*galleryItems, galleryIndex*/ 40) {
			$$invalidate(9, currentGalleryImage = galleryItems[galleryIndex] || null);
		}

		if ($$self.$$.dirty[0] & /*sortedPosts, activeCategory, searchTerm*/ 536870915) {
			/*
  Kategorie und Suchbegriff anwenden.
*/
			$$invalidate(7, filteredPosts = sortedPosts.filter(post => {
				const matchesCategory = activeCategory === "Alle Beiträge" || post.category === activeCategory;
				const term = searchTerm.trim().toLocaleLowerCase("de");
				const searchableText = [post.title, post.teaser, post.category].filter(Boolean).join(" ").toLocaleLowerCase("de");
				return matchesCategory && (term === "" || searchableText.includes(term));
			}));
		}

		if ($$self.$$.dirty[0] & /*filteredPosts*/ 128) {
			/*
  Pagination mit neun Beiträgen pro Seite.
*/
			$$invalidate(6, totalPages = Math.max(1, Math.ceil(filteredPosts.length / postsPerPage)));
		}

		if ($$self.$$.dirty[0] & /*currentPage, totalPages*/ 80) {
			if (currentPage > totalPages) {
				$$invalidate(4, currentPage = totalPages);
			}
		}

		if ($$self.$$.dirty[0] & /*currentPage*/ 16) {
			$$invalidate(28, firstVisiblePost = (currentPage - 1) * postsPerPage);
		}

		if ($$self.$$.dirty[0] & /*firstVisiblePost*/ 268435456) {
			$$invalidate(27, lastVisiblePost = firstVisiblePost + postsPerPage);
		}

		if ($$self.$$.dirty[0] & /*filteredPosts, firstVisiblePost, lastVisiblePost*/ 402653312) {
			$$invalidate(8, paginatedPosts = filteredPosts.slice(firstVisiblePost, lastVisiblePost));
		}

		if ($$self.$$.dirty[0] & /*latestPost*/ 67108864) {
			if (latestPost && typeof window !== "undefined") {
				publishLatestPost(latestPost);
			}
		}
	};

	return [
		activeCategory,
		searchTerm,
		selectedPost,
		galleryIndex,
		currentPage,
		galleryItems,
		totalPages,
		filteredPosts,
		paginatedPosts,
		currentGalleryImage,
		availableCategories,
		selectCategory,
		handleSearch,
		resetFilters,
		goToPage,
		openArticle,
		closeArticle,
		previousGalleryImage,
		nextGalleryImage,
		selectGalleryImage,
		props,
		posts,
		heading,
		categories,
		empty_message,
		search_placeholder,
		latestPost,
		lastVisiblePost,
		firstVisiblePost,
		sortedPosts,
		preparedPosts,
		click_handler,
		input_input_handler,
		click_handler_1,
		click_handler_2,
		click_handler_3,
		click_handler_4,
		click_handler_5,
		click_handler_6,
		click_handler_7
	];
}

class Component extends SvelteComponent {
	constructor(options) {
		super();

		init(
			this,
			options,
			instance,
			create_fragment,
			safe_not_equal,
			{
				props: 20,
				posts: 21,
				heading: 22,
				categories: 23,
				empty_message: 24,
				search_placeholder: 25
			},
			null,
			[-1, -1]
		);
	}
}

export { Component as default };

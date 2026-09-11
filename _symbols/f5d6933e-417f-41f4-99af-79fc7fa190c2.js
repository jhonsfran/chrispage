// Filter und Blogbeiträge - Updated September 11, 2026
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
	child_ctx[18] = list[i];
	return child_ctx;
}

function get_each_context_1(ctx, list, i) {
	const child_ctx = ctx.slice();
	child_ctx[21] = list[i];
	return child_ctx;
}

// (879:8) {#each categories as category}
function create_each_block_1(ctx) {
	let button;
	let t0_value = /*category*/ ctx[21].label + "";
	let t0;
	let t1;
	let button_aria_pressed_value;
	let mounted;
	let dispose;

	function click_handler() {
		return /*click_handler*/ ctx[14](/*category*/ ctx[21]);
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
			attr(button, "aria-pressed", button_aria_pressed_value = /*activeCategory*/ ctx[4] === /*category*/ ctx[21].label);
			attr(button, "class", "svelte-1cb6l9x");
			toggle_class(button, "active", /*activeCategory*/ ctx[4] === /*category*/ ctx[21].label);
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
			if (dirty & /*categories*/ 2 && t0_value !== (t0_value = /*category*/ ctx[21].label + "")) set_data(t0, t0_value);

			if (dirty & /*activeCategory, categories*/ 18 && button_aria_pressed_value !== (button_aria_pressed_value = /*activeCategory*/ ctx[4] === /*category*/ ctx[21].label)) {
				attr(button, "aria-pressed", button_aria_pressed_value);
			}

			if (dirty & /*activeCategory, categories*/ 18) {
				toggle_class(button, "active", /*activeCategory*/ ctx[4] === /*category*/ ctx[21].label);
			}
		},
		d(detaching) {
			if (detaching) detach(button);
			mounted = false;
			dispose();
		}
	};
}

// (953:4) {:else}
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
			attr(p, "class", "svelte-1cb6l9x");
			attr(div, "class", "cg-blog-empty svelte-1cb6l9x");
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

// (910:4) {#if filteredPosts.length > 0}
function create_if_block_1(ctx) {
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
			attr(div, "class", "cg-blog-grid svelte-1cb6l9x");
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
			if (dirty & /*openArticle, filteredPosts*/ 1152) {
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

// (912:8) {#each filteredPosts as post}
function create_each_block(ctx) {
	let article;
	let div0;
	let img;
	let img_src_value;
	let img_alt_value;
	let t0;
	let div2;
	let div1;
	let span;
	let t1_value = /*post*/ ctx[18].category + "";
	let t1;
	let t2;
	let time;
	let t3_value = /*post*/ ctx[18].date_label + "";
	let t3;
	let time_datetime_value;
	let t4;
	let h3;
	let t5_value = /*post*/ ctx[18].title + "";
	let t5;
	let t6;
	let p;
	let t7_value = /*post*/ ctx[18].teaser + "";
	let t7;
	let t8;
	let button;
	let t9;
	let svg;
	let path;
	let t10;
	let mounted;
	let dispose;

	function click_handler_1() {
		return /*click_handler_1*/ ctx[16](/*post*/ ctx[18]);
	}

	return {
		c() {
			article = element("article");
			div0 = element("div");
			img = element("img");
			t0 = space();
			div2 = element("div");
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
			button = element("button");
			t9 = text("Mehr anzeigen\n\n                ");
			svg = svg_element("svg");
			path = svg_element("path");
			t10 = space();
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
			div2 = claim_element(article_nodes, "DIV", { class: true });
			var div2_nodes = children(div2);
			div1 = claim_element(div2_nodes, "DIV", { class: true });
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
			t4 = claim_space(div2_nodes);
			h3 = claim_element(div2_nodes, "H3", { class: true });
			var h3_nodes = children(h3);
			t5 = claim_text(h3_nodes, t5_value);
			h3_nodes.forEach(detach);
			t6 = claim_space(div2_nodes);
			p = claim_element(div2_nodes, "P", { class: true });
			var p_nodes = children(p);
			t7 = claim_text(p_nodes, t7_value);
			p_nodes.forEach(detach);
			t8 = claim_space(div2_nodes);

			button = claim_element(div2_nodes, "BUTTON", {
				type: true,
				class: true,
				"aria-haspopup": true
			});

			var button_nodes = children(button);
			t9 = claim_text(button_nodes, "Mehr anzeigen\n\n                ");

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
			div2_nodes.forEach(detach);
			t10 = claim_space(article_nodes);
			article_nodes.forEach(detach);
			this.h();
		},
		h() {
			if (!src_url_equal(img.src, img_src_value = /*post*/ ctx[18].image.url)) attr(img, "src", img_src_value);
			attr(img, "alt", img_alt_value = /*post*/ ctx[18].image.alt);
			attr(img, "loading", "lazy");
			attr(img, "class", "svelte-1cb6l9x");
			attr(div0, "class", "cg-blog-card__image svelte-1cb6l9x");
			attr(span, "class", "svelte-1cb6l9x");
			attr(time, "datetime", time_datetime_value = /*post*/ ctx[18].date_iso);
			attr(time, "class", "svelte-1cb6l9x");
			attr(div1, "class", "cg-blog-card__meta svelte-1cb6l9x");
			attr(h3, "class", "svelte-1cb6l9x");
			attr(p, "class", "cg-blog-card__teaser svelte-1cb6l9x");
			attr(path, "d", "m8 10 4 4 4-4");
			attr(path, "class", "svelte-1cb6l9x");
			attr(svg, "viewBox", "0 0 24 24");
			attr(svg, "aria-hidden", "true");
			attr(svg, "class", "svelte-1cb6l9x");
			attr(button, "type", "button");
			attr(button, "class", "cg-blog-card__button svelte-1cb6l9x");
			attr(button, "aria-haspopup", "dialog");
			attr(div2, "class", "cg-blog-card__body svelte-1cb6l9x");
			attr(article, "class", "cg-blog-card svelte-1cb6l9x");
		},
		m(target, anchor) {
			insert_hydration(target, article, anchor);
			append_hydration(article, div0);
			append_hydration(div0, img);
			append_hydration(article, t0);
			append_hydration(article, div2);
			append_hydration(div2, div1);
			append_hydration(div1, span);
			append_hydration(span, t1);
			append_hydration(div1, t2);
			append_hydration(div1, time);
			append_hydration(time, t3);
			append_hydration(div2, t4);
			append_hydration(div2, h3);
			append_hydration(h3, t5);
			append_hydration(div2, t6);
			append_hydration(div2, p);
			append_hydration(p, t7);
			append_hydration(div2, t8);
			append_hydration(div2, button);
			append_hydration(button, t9);
			append_hydration(button, svg);
			append_hydration(svg, path);
			append_hydration(article, t10);

			if (!mounted) {
				dispose = listen(button, "click", click_handler_1);
				mounted = true;
			}
		},
		p(new_ctx, dirty) {
			ctx = new_ctx;

			if (dirty & /*filteredPosts*/ 128 && !src_url_equal(img.src, img_src_value = /*post*/ ctx[18].image.url)) {
				attr(img, "src", img_src_value);
			}

			if (dirty & /*filteredPosts*/ 128 && img_alt_value !== (img_alt_value = /*post*/ ctx[18].image.alt)) {
				attr(img, "alt", img_alt_value);
			}

			if (dirty & /*filteredPosts*/ 128 && t1_value !== (t1_value = /*post*/ ctx[18].category + "")) set_data(t1, t1_value);
			if (dirty & /*filteredPosts*/ 128 && t3_value !== (t3_value = /*post*/ ctx[18].date_label + "")) set_data(t3, t3_value);

			if (dirty & /*filteredPosts*/ 128 && time_datetime_value !== (time_datetime_value = /*post*/ ctx[18].date_iso)) {
				attr(time, "datetime", time_datetime_value);
			}

			if (dirty & /*filteredPosts*/ 128 && t5_value !== (t5_value = /*post*/ ctx[18].title + "")) set_data(t5, t5_value);
			if (dirty & /*filteredPosts*/ 128 && t7_value !== (t7_value = /*post*/ ctx[18].teaser + "")) set_data(t7, t7_value);
		},
		d(detaching) {
			if (detaching) detach(article);
			mounted = false;
			dispose();
		}
	};
}

// (960:2) {#if selectedPost}
function create_if_block(ctx) {
	let div4;
	let article;
	let button0;
	let svg;
	let path;
	let t0;
	let div0;
	let img;
	let img_src_value;
	let img_alt_value;
	let t1;
	let div3;
	let div1;
	let span0;
	let t2_value = /*selectedPost*/ ctx[6].category + "";
	let t2;
	let t3;
	let time;
	let t4_value = /*selectedPost*/ ctx[6].date_label + "";
	let t4;
	let time_datetime_value;
	let t5;
	let h2;
	let t6_value = /*selectedPost*/ ctx[6].title + "";
	let t6;
	let h2_id_value;
	let t7;
	let p;
	let t8_value = /*selectedPost*/ ctx[6].teaser + "";
	let t8;
	let t9;
	let div2;
	let raw_value = renderPostContent(/*selectedPost*/ ctx[6].content) + "";
	let t10;
	let button1;
	let t11;
	let span1;
	let t12;
	let article_aria_labelledby_value;
	let article_transition;
	let div4_transition;
	let current;
	let mounted;
	let dispose;

	return {
		c() {
			div4 = element("div");
			article = element("article");
			button0 = element("button");
			svg = svg_element("svg");
			path = svg_element("path");
			t0 = space();
			div0 = element("div");
			img = element("img");
			t1 = space();
			div3 = element("div");
			div1 = element("div");
			span0 = element("span");
			t2 = text(t2_value);
			t3 = space();
			time = element("time");
			t4 = text(t4_value);
			t5 = space();
			h2 = element("h2");
			t6 = text(t6_value);
			t7 = space();
			p = element("p");
			t8 = text(t8_value);
			t9 = space();
			div2 = element("div");
			t10 = space();
			button1 = element("button");
			t11 = text("Weniger anzeigen\n            ");
			span1 = element("span");
			t12 = text("↑");
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

			svg = claim_svg_element(button0_nodes, "svg", {
				viewBox: true,
				"aria-hidden": true,
				class: true
			});

			var svg_nodes = children(svg);
			path = claim_svg_element(svg_nodes, "path", { d: true, class: true });
			children(path).forEach(detach);
			svg_nodes.forEach(detach);
			button0_nodes.forEach(detach);
			t0 = claim_space(article_nodes);
			div0 = claim_element(article_nodes, "DIV", { class: true });
			var div0_nodes = children(div0);
			img = claim_element(div0_nodes, "IMG", { src: true, alt: true, class: true });
			div0_nodes.forEach(detach);
			t1 = claim_space(article_nodes);
			div3 = claim_element(article_nodes, "DIV", { class: true });
			var div3_nodes = children(div3);
			div1 = claim_element(div3_nodes, "DIV", { class: true });
			var div1_nodes = children(div1);
			span0 = claim_element(div1_nodes, "SPAN", { class: true });
			var span0_nodes = children(span0);
			t2 = claim_text(span0_nodes, t2_value);
			span0_nodes.forEach(detach);
			t3 = claim_space(div1_nodes);
			time = claim_element(div1_nodes, "TIME", { datetime: true, class: true });
			var time_nodes = children(time);
			t4 = claim_text(time_nodes, t4_value);
			time_nodes.forEach(detach);
			div1_nodes.forEach(detach);
			t5 = claim_space(div3_nodes);
			h2 = claim_element(div3_nodes, "H2", { id: true, class: true });
			var h2_nodes = children(h2);
			t6 = claim_text(h2_nodes, t6_value);
			h2_nodes.forEach(detach);
			t7 = claim_space(div3_nodes);
			p = claim_element(div3_nodes, "P", { class: true });
			var p_nodes = children(p);
			t8 = claim_text(p_nodes, t8_value);
			p_nodes.forEach(detach);
			t9 = claim_space(div3_nodes);
			div2 = claim_element(div3_nodes, "DIV", { class: true });
			var div2_nodes = children(div2);
			div2_nodes.forEach(detach);
			t10 = claim_space(div3_nodes);
			button1 = claim_element(div3_nodes, "BUTTON", { type: true, class: true });
			var button1_nodes = children(button1);
			t11 = claim_text(button1_nodes, "Weniger anzeigen\n            ");
			span1 = claim_element(button1_nodes, "SPAN", { "aria-hidden": true, class: true });
			var span1_nodes = children(span1);
			t12 = claim_text(span1_nodes, "↑");
			span1_nodes.forEach(detach);
			button1_nodes.forEach(detach);
			div3_nodes.forEach(detach);
			article_nodes.forEach(detach);
			div4_nodes.forEach(detach);
			this.h();
		},
		h() {
			attr(path, "d", "M6 6l12 12M18 6 6 18");
			attr(path, "class", "svelte-1cb6l9x");
			attr(svg, "viewBox", "0 0 24 24");
			attr(svg, "aria-hidden", "true");
			attr(svg, "class", "svelte-1cb6l9x");
			attr(button0, "type", "button");
			attr(button0, "class", "cg-blog-modal__close svelte-1cb6l9x");
			attr(button0, "aria-label", "Beitrag schließen");
			if (!src_url_equal(img.src, img_src_value = /*selectedPost*/ ctx[6].image.url)) attr(img, "src", img_src_value);
			attr(img, "alt", img_alt_value = /*selectedPost*/ ctx[6].image.alt);
			attr(img, "class", "svelte-1cb6l9x");
			attr(div0, "class", "cg-blog-modal__image svelte-1cb6l9x");
			attr(span0, "class", "svelte-1cb6l9x");
			attr(time, "datetime", time_datetime_value = /*selectedPost*/ ctx[6].date_iso);
			attr(time, "class", "svelte-1cb6l9x");
			attr(div1, "class", "cg-blog-modal__meta svelte-1cb6l9x");
			attr(h2, "id", h2_id_value = "cg-modal-title-" + /*selectedPost*/ ctx[6].id);
			attr(h2, "class", "svelte-1cb6l9x");
			attr(p, "class", "cg-blog-modal__teaser svelte-1cb6l9x");
			attr(div2, "class", "cg-blog-modal__content svelte-1cb6l9x");
			attr(span1, "aria-hidden", "true");
			attr(span1, "class", "svelte-1cb6l9x");
			attr(button1, "type", "button");
			attr(button1, "class", "cg-blog-modal__bottom-close svelte-1cb6l9x");
			attr(div3, "class", "cg-blog-modal__body svelte-1cb6l9x");
			attr(article, "class", "cg-blog-modal svelte-1cb6l9x");
			attr(article, "role", "dialog");
			attr(article, "aria-modal", "true");
			attr(article, "aria-labelledby", article_aria_labelledby_value = "cg-modal-title-" + /*selectedPost*/ ctx[6].id);
			attr(div4, "class", "cg-blog-overlay svelte-1cb6l9x");
			attr(div4, "role", "presentation");
		},
		m(target, anchor) {
			insert_hydration(target, div4, anchor);
			append_hydration(div4, article);
			append_hydration(article, button0);
			append_hydration(button0, svg);
			append_hydration(svg, path);
			append_hydration(article, t0);
			append_hydration(article, div0);
			append_hydration(div0, img);
			append_hydration(article, t1);
			append_hydration(article, div3);
			append_hydration(div3, div1);
			append_hydration(div1, span0);
			append_hydration(span0, t2);
			append_hydration(div1, t3);
			append_hydration(div1, time);
			append_hydration(time, t4);
			append_hydration(div3, t5);
			append_hydration(div3, h2);
			append_hydration(h2, t6);
			append_hydration(div3, t7);
			append_hydration(div3, p);
			append_hydration(p, t8);
			append_hydration(div3, t9);
			append_hydration(div3, div2);
			div2.innerHTML = raw_value;
			append_hydration(div3, t10);
			append_hydration(div3, button1);
			append_hydration(button1, t11);
			append_hydration(button1, span1);
			append_hydration(span1, t12);
			current = true;

			if (!mounted) {
				dispose = [
					listen(button0, "click", /*closeArticle*/ ctx[11]),
					listen(button1, "click", /*closeArticle*/ ctx[11]),
					listen(div4, "click", self(/*closeArticle*/ ctx[11]))
				];

				mounted = true;
			}
		},
		p(ctx, dirty) {
			if (!current || dirty & /*selectedPost*/ 64 && !src_url_equal(img.src, img_src_value = /*selectedPost*/ ctx[6].image.url)) {
				attr(img, "src", img_src_value);
			}

			if (!current || dirty & /*selectedPost*/ 64 && img_alt_value !== (img_alt_value = /*selectedPost*/ ctx[6].image.alt)) {
				attr(img, "alt", img_alt_value);
			}

			if ((!current || dirty & /*selectedPost*/ 64) && t2_value !== (t2_value = /*selectedPost*/ ctx[6].category + "")) set_data(t2, t2_value);
			if ((!current || dirty & /*selectedPost*/ 64) && t4_value !== (t4_value = /*selectedPost*/ ctx[6].date_label + "")) set_data(t4, t4_value);

			if (!current || dirty & /*selectedPost*/ 64 && time_datetime_value !== (time_datetime_value = /*selectedPost*/ ctx[6].date_iso)) {
				attr(time, "datetime", time_datetime_value);
			}

			if ((!current || dirty & /*selectedPost*/ 64) && t6_value !== (t6_value = /*selectedPost*/ ctx[6].title + "")) set_data(t6, t6_value);

			if (!current || dirty & /*selectedPost*/ 64 && h2_id_value !== (h2_id_value = "cg-modal-title-" + /*selectedPost*/ ctx[6].id)) {
				attr(h2, "id", h2_id_value);
			}

			if ((!current || dirty & /*selectedPost*/ 64) && t8_value !== (t8_value = /*selectedPost*/ ctx[6].teaser + "")) set_data(t8, t8_value);
			if ((!current || dirty & /*selectedPost*/ 64) && raw_value !== (raw_value = renderPostContent(/*selectedPost*/ ctx[6].content) + "")) div2.innerHTML = raw_value;
			if (!current || dirty & /*selectedPost*/ 64 && article_aria_labelledby_value !== (article_aria_labelledby_value = "cg-modal-title-" + /*selectedPost*/ ctx[6].id)) {
				attr(article, "aria-labelledby", article_aria_labelledby_value);
			}
		},
		i(local) {
			if (current) return;

			add_render_callback(() => {
				if (!current) return;
				if (!article_transition) article_transition = create_bidirectional_transition(article, fly, { y: 28, duration: 340 }, true);
				article_transition.run(1);
			});

			add_render_callback(() => {
				if (!current) return;
				if (!div4_transition) div4_transition = create_bidirectional_transition(div4, fade, { duration: 220 }, true);
				div4_transition.run(1);
			});

			current = true;
		},
		o(local) {
			if (!article_transition) article_transition = create_bidirectional_transition(article, fly, { y: 28, duration: 340 }, false);
			article_transition.run(0);
			if (!div4_transition) div4_transition = create_bidirectional_transition(div4, fade, { duration: 220 }, false);
			div4_transition.run(0);
			current = false;
		},
		d(detaching) {
			if (detaching) detach(div4);
			if (detaching && article_transition) article_transition.end();
			if (detaching && div4_transition) div4_transition.end();
			mounted = false;
			run_all(dispose);
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
	let t7;
	let current;
	let mounted;
	let dispose;
	let each_value_1 = /*categories*/ ctx[1];
	let each_blocks = [];

	for (let i = 0; i < each_value_1.length; i += 1) {
		each_blocks[i] = create_each_block_1(get_each_context_1(ctx, each_value_1, i));
	}

	function select_block_type(ctx, dirty) {
		if (/*filteredPosts*/ ctx[7].length > 0) return create_if_block_1;
		return create_else_block;
	}

	let current_block_type = select_block_type(ctx);
	let if_block0 = current_block_type(ctx);
	let if_block1 = /*selectedPost*/ ctx[6] && create_if_block(ctx);

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
			if_block0.c();
			t7 = space();
			if (if_block1) if_block1.c();
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
			if_block0.l(div2_nodes);
			div2_nodes.forEach(detach);
			t7 = claim_space(section_nodes);
			if (if_block1) if_block1.l(section_nodes);
			section_nodes.forEach(detach);
			this.h();
		},
		h() {
			attr(h2, "id", "cg-posts-heading");
			attr(h2, "class", "cg-visually-hidden svelte-1cb6l9x");
			attr(div0, "class", "cg-blog-filters svelte-1cb6l9x");
			attr(div0, "aria-label", "Beiträge nach Kategorie filtern");
			attr(circle, "cx", "11");
			attr(circle, "cy", "11");
			attr(circle, "r", "7");
			attr(circle, "class", "svelte-1cb6l9x");
			attr(path, "d", "m16 16 4 4");
			attr(path, "class", "svelte-1cb6l9x");
			attr(svg, "viewBox", "0 0 24 24");
			attr(svg, "aria-hidden", "true");
			attr(svg, "class", "svelte-1cb6l9x");
			attr(span, "class", "cg-visually-hidden svelte-1cb6l9x");
			attr(input, "type", "search");
			attr(input, "placeholder", /*search_placeholder*/ ctx[3]);
			attr(input, "class", "svelte-1cb6l9x");
			attr(label, "class", "cg-blog-search svelte-1cb6l9x");
			attr(div1, "class", "cg-blog-toolbar svelte-1cb6l9x");
			attr(div2, "class", "cg-blog-posts__inner svelte-1cb6l9x");
			attr(section, "class", "cg-blog-posts svelte-1cb6l9x");
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
			if_block0.m(div2, null);
			append_hydration(section, t7);
			if (if_block1) if_block1.m(section, null);
			current = true;

			if (!mounted) {
				dispose = [
					listen(input, "input", /*input_input_handler*/ ctx[15]),
					listen(input, "input", /*handleSearch*/ ctx[9])
				];

				mounted = true;
			}
		},
		p(ctx, [dirty]) {
			if (!current || dirty & /*heading*/ 1) set_data(t0, /*heading*/ ctx[0]);

			if (dirty & /*activeCategory, categories, selectCategory*/ 274) {
				each_value_1 = /*categories*/ ctx[1];
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

			if (!current || dirty & /*search_placeholder*/ 8) {
				attr(input, "placeholder", /*search_placeholder*/ ctx[3]);
			}

			if (dirty & /*searchTerm*/ 32 && input.value !== /*searchTerm*/ ctx[5]) {
				set_input_value(input, /*searchTerm*/ ctx[5]);
			}

			if (current_block_type === (current_block_type = select_block_type(ctx)) && if_block0) {
				if_block0.p(ctx, dirty);
			} else {
				if_block0.d(1);
				if_block0 = current_block_type(ctx);

				if (if_block0) {
					if_block0.c();
					if_block0.m(div2, null);
				}
			}

			if (/*selectedPost*/ ctx[6]) {
				if (if_block1) {
					if_block1.p(ctx, dirty);

					if (dirty & /*selectedPost*/ 64) {
						transition_in(if_block1, 1);
					}
				} else {
					if_block1 = create_if_block(ctx);
					if_block1.c();
					transition_in(if_block1, 1);
					if_block1.m(section, null);
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
			if (if_block1) if_block1.d();
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

				return `
        <a href="${href}" target="_blank" rel="noopener">
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
	let filteredPosts;
	let { props } = $$props;
	let { posts } = $$props;
	let { heading } = $$props;
	let { categories } = $$props;
	let { empty_message } = $$props;
	let { search_placeholder } = $$props;
	let activeCategory = "Alle Beiträge";
	let searchTerm = "";
	let selectedPost = null;
	let previousBodyOverflow = "";

	function selectCategory(category) {
		$$invalidate(4, activeCategory = category);
		closeArticle();
	}

	function handleSearch() {
		closeArticle();
	}

	function openArticle(post) {
		$$invalidate(6, selectedPost = post);

		if (typeof document !== "undefined") {
			previousBodyOverflow = document.body.style.overflow;
			document.body.style.overflow = "hidden";
		}
	}

	function closeArticle() {
		$$invalidate(6, selectedPost = null);

		if (typeof document !== "undefined") {
			document.body.style.overflow = previousBodyOverflow;
		}
	}

	onMount(() => {
		function handleKeydown(event) {
			if (event.key === "Escape" && selectedPost) {
				closeArticle();
			}
		}

		document.addEventListener("keydown", handleKeydown);

		return () => {
			document.removeEventListener("keydown", handleKeydown);
			document.body.style.overflow = previousBodyOverflow;
		};
	});

	const click_handler = category => selectCategory(category.label);

	function input_input_handler() {
		searchTerm = this.value;
		$$invalidate(5, searchTerm);
	}

	const click_handler_1 = post => openArticle(post);

	$$self.$$set = $$props => {
		if ('props' in $$props) $$invalidate(12, props = $$props.props);
		if ('posts' in $$props) $$invalidate(13, posts = $$props.posts);
		if ('heading' in $$props) $$invalidate(0, heading = $$props.heading);
		if ('categories' in $$props) $$invalidate(1, categories = $$props.categories);
		if ('empty_message' in $$props) $$invalidate(2, empty_message = $$props.empty_message);
		if ('search_placeholder' in $$props) $$invalidate(3, search_placeholder = $$props.search_placeholder);
	};

	$$self.$$.update = () => {
		if ($$self.$$.dirty & /*posts, activeCategory, searchTerm*/ 8240) {
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
		categories,
		empty_message,
		search_placeholder,
		activeCategory,
		searchTerm,
		selectedPost,
		filteredPosts,
		selectCategory,
		handleSearch,
		openArticle,
		closeArticle,
		props,
		posts,
		click_handler,
		input_input_handler,
		click_handler_1
	];
}

class Component extends SvelteComponent {
	constructor(options) {
		super();

		init(this, options, instance, create_fragment, safe_not_equal, {
			props: 12,
			posts: 13,
			heading: 0,
			categories: 1,
			empty_message: 2,
			search_placeholder: 3
		});
	}
}

export { Component as default };

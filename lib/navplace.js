// Temporary, just for prototype
document.write(`<script src="${document.currentScript.src.replace(/[^/]+$/, '')}filter1_from_spec.js"></script>`);
document.write(`<script src="${document.currentScript.src.replace(/[^/]+$/, '')}parse.js"></script>`);
document.write(`<script src="${document.currentScript.src.replace(/[^/]+$/, '')}items_search.js"></script>`);

window.__NAVPLACE_INST__ = null;
window.__NAVPLACE_EXTERNAL_TEXT__ = null;

parent_messages_listen();

function navplace(params)
{
    params = params || {};
    const update = params.update || function () {};
    const selector_by_meta_key = params.meta || {};
    const input_spec = params.input || 'input[type=search]';
    const input = (typeof input_spec === 'string') ? document.querySelector(input_spec) : input_spec;
    if (!input) {
        return;
    }

    window.__NAVPLACE_INST__ = {
        replace: function (text) {
            const collection = parse(text);
            for (const [meta_key, selector] of Object.entries(selector_by_meta_key)) {
                if (collection.meta[meta_key]) {
                    const elem = document.querySelector(selector);
                    if (!elem) {
                        continue;
                    }
                    elem.innerText = collection.meta[meta_key];
                    // A mail address is a link that writes to it; anything else stays text, with no link
                    if ((meta_key === 'email') && (elem.tagName === 'A')) {
                        if (is_email_address(collection.meta[meta_key])) {
                            elem.href = `mailto:${collection.meta[meta_key]}`;
                        }
                        else {
                            elem.removeAttribute('href');
                        }
                    }
                }
            }
            all_items.splice(0, all_items.length, ...collection.items);
            setTimeout(refresh_matches, 0);
        },
    };

    const all_items = [];
    const filtered_items = [];
    const selected_items = [];
    navplace.selected_items = selected_items;
    // The links ↑ and ↓ walk, in the order the page shows them: filtered_items, unless the page set
    // its own with navplace.order_set(); null after every new search
    let order = null;
    // The link ↑ and ↓ move to and Enter opens: an index into the order. update() gets it as
    // {current}, its index in the items it was given, and {item}; the design marks that link's
    // element with the class np-current
    let current = 0;
    current_style_add();
    // The page sets the current link itself, a row under the mouse for one: its index in the order
    navplace.current_set = function (index) {
        if ((index >= 0) && (index < walk().length) && (index !== current)) {
            current = index;
            update_send();
        }
    };
    // The page shows other links, or in another order, than the items it was given (a section picked,
    // links grouped): those it shows, in its order. The current link stays when it is still among them
    navplace.order_set = function (items) {
        const before = walk()[current];
        order = Array.from(items ?? []);
        const at = order.indexOf(before);
        current = (at === -1) ? 0 : at;
        if (walk()[current] !== before) {
            update_send();
        }
    };

    input.addEventListener('input', function () {
        refresh_matches();
    });

    document.addEventListener('keydown', function (event) {
        if (event.isComposing) {
            return;
        }
        if (event.ctrlKey || event.metaKey || event.altKey) {
            return;
        }
        // Enter and Space on a focused button or link are its own: the button does its work, the link
        // opens as a click on it does. Letters typed there still go to the search box
        if (((event.key === 'Enter') || (event.key === ' ')) && is_button_or_link(document.activeElement)) {
            return;
        }
        if (((event.key === 'ArrowDown') || (event.key === 'ArrowUp')) && walk().length && !is_other_field(document.activeElement)) {
            event.preventDefault();
            current = Math.max(0, Math.min(walk().length - 1, current + ((event.key === 'ArrowDown') ? 1 : -1)));
            update_send();
            current_reveal();
            return;
        }
        if ((event.key === 'Enter') && walk()[current]?.href && !is_other_field(document.activeElement)) {
            event.preventDefault();
            if (params.navigate) {
                for (const target of targets_from_item(walk()[current])) {
                    params.navigate(target);
                }
            }
            else {
                // One call opens every selected item once, the current one in place of the last
                navplace.navigate(walk()[current]);
            }
        }
        // Ignore non-printable keys
        if (event.key.length !== 1) {
            return;
        }
        if ((document.activeElement !== input) && !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName) && !document.activeElement?.isContentEditable) {
            input.focus();
        }
    });
    input.focus();

    if (window.ElectronApp?.api_items_all) {
        function items_replace(collection) {
            all_items.splice(0, all_items.length, ...collection.items);
            refresh_matches();
        }
        window.ElectronApp.api_items_all().then(items_replace);
        window.ElectronApp.api_items_changed?.(items_replace);
    }
    else if (window.__NAVPLACE_EXTERNAL_TEXT__ !== null) {
        window.__NAVPLACE_INST__.replace(window.__NAVPLACE_EXTERNAL_TEXT__);
    }
    else {
        const sample = parse(`
ChatGPT https://chatgpt.com/
GitHub  https://github.com/
Gmail   https://mail.google.com/
`);
        all_items.push(...sample.items);
        setTimeout(refresh_matches, 0);
    }

    function refresh_matches() {
        const found = items_search(all_items, input.value);
        selected_items.splice(0, selected_items.length, ...found.selected_items);
        filtered_items.splice(0, filtered_items.length, ...found.filtered_items);
        order = null;
        current = 0;
        update_send();
    }

    function walk() {
        return order ?? filtered_items;
    }

    // The design's update() with the current link: its index in filtered_items, and the item itself
    function update_send() {
        const item = walk()[current] ?? null;
        update(filtered_items, {current: item ? filtered_items.indexOf(item) : -1, item});
    }

    // Another input, a textarea or a select keeps its own arrows and Enter; the search box does not
    function is_other_field(element) {
        return !!element && (element !== input) && (/^(INPUT|TEXTAREA|SELECT)$/.test(element.tagName) || element.isContentEditable);
    }

    // What Enter and Space press by themselves: a button, or a thing that acts like one, and a link
    function is_button_or_link(element) {
        return !!element?.matches?.('button, summary, [role=button], a[href]');
    }

    // A plain mail address: one @, no spaces, no quotes, no < > or :, so no other kind of address
    function is_email_address(text) {
        return /^[^\s@"'<>:]+@[^\s@"'<>:]+$/.test(text);
    }

    // The current link scrolled into view, after the design has drawn it
    function current_reveal() {
        requestAnimationFrame(function () {
            document.querySelector('.np-current')?.scrollIntoView({block: 'nearest', inline: 'nearest'});
        });
    }

    // A ring around the current link unless the design draws its own: first in <head>, so the design's
    // styles win
    function current_style_add() {
        if (document.querySelector('style[data-np-current]')) {
            return;
        }
        document.head.insertAdjacentHTML('afterbegin', '<style data-np-current>.np-current { outline: 3px solid var(--np-current, #1299DA); outline-offset: 2px; }</style>');
    }
}

navplace.navigate = function (item, event) {
    // Ctrl, Cmd, Shift or the middle button on a link: the browser opens it its own way, in a new tab or window
    if (event && (event.ctrlKey || event.metaKey || event.shiftKey || (event.button === 1)) && event.target?.closest?.('a[href]')) {
        return;
    }
    event?.preventDefault();
    // The desktop app hands every link to the browser. On the web `item` takes the page's place and
    // the others open in new tabs, asked for before it: asked for after, a browser that blocks
    // pop-ups opens none of them. Asked for first, it opens one, and `item` loads either way
    for (const target of targets_from_item(item)) {
        if (window.ElectronApp || (target !== item)) {
            window.open(target.href, '_blank', 'noopener,noreferrer');
        }
        else {
            window.open(target.href, '_top', 'noopener,noreferrer');
        }
    }
};

// The links one Enter or one click opens: the top link of each word before the last, then `item`
// in place of the last word's. An address picked twice, `aa aa`, opens once
function targets_from_item(item)
{
    const others = navplace.selected_items.slice(0, -1).filter(v => v.href !== item.href);
    return [...new Map(others.map(v => [v.href, v])).values(), item];
}

// Inside the embed's iframe: the page around it sends the links, and a character typed there for the search box;
// text that comes before navplace() is called waits in __NAVPLACE_EXTERNAL_TEXT__.
// Only that page is heard: another frame on it, an ad beside the embed, cannot send links of its own
function parent_messages_listen()
{
    if (window.parent === window) {
        return;
    }
    window.addEventListener('message', function (event) {
        if (event.source !== window.parent) {
            return;
        }
        if (!event.data) {
            return;
        }
        if (event.data.type === 'navplace:items-text') {
            if (window.__NAVPLACE_INST__) {
                window.__NAVPLACE_INST__.replace(event.data.text || '');
            }
            else {
                window.__NAVPLACE_EXTERNAL_TEXT__ = event.data.text || '';
            }
        }
        if (event.data.type === 'navplace:focus') {
            const input = document.querySelector('input[type=search]') || document.querySelector('input');
            if (input) {
                input.focus();
                // The character that asked for the focus was typed on the page around: it is typed here
                if ((typeof event.data.key === 'string') && (event.data.key.length === 1)) {
                    input.value = `${input.value}${event.data.key}`;
                    input.dispatchEvent(new Event('input', {bubbles: true}));
                }
            }
        }
    });
    window.parent.postMessage({type: 'navplace:ready'}, '*');
}

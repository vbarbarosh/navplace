// Temporary, just for prototype
document.write(`<script src="${document.currentScript.src.replace(/[^/]+$/, '')}filter1_from_spec.js"></script>`);
document.write(`<script src="${document.currentScript.src.replace(/[^/]+$/, '')}parse.js"></script>`);

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
                    if ((meta_key === 'email') && (elem.tagName === 'A')) {
                        elem.href = collection.meta[meta_key];
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
        if ((event.key === 'Enter') && filtered_items[0]?.href) {
            if (params.navigate) {
                for (const item of selected_items) {
                    params.navigate(item);
                }
            }
            else {
                event.preventDefault();
                // One call opens every selected item once
                navplace.navigate(selected_items[selected_items.length - 1]);
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
        selected_items.splice(0, selected_items.length);
        // A space at either end is no expression of its own
        for (const expr of String(input.value).trim().split(/\s+/)) {
            const filter1 = filter1_from_spec(expr);
            const search1_matches = all_items.filter(v => filter1(v.search1));
            const search2_matches = all_items.filter(v => filter1(v.search2));
            const search1_set = new Set(search1_matches);
            const matches = [...search1_matches, ...search2_matches.filter(v => !search1_set.has(v))];
            if (matches.length) {
                selected_items.push(matches[0]);
            }
            filtered_items.splice(0, filtered_items.length, ...matches);
        }
        update(filtered_items);
    }
}

navplace.navigate = function (item, event) {
    event?.preventDefault();
    const targets = navplace.selected_items.slice();
    targets.splice(-1, 1, item);
    for (const target of targets) {
        if (window.ElectronApp) {
            window.open(target.href, '_blank', 'noopener,noreferrer');
        }
        else {
            window.open(target.href, '_top', 'noopener,noreferrer');
        }
    }
};

// Inside the embed's iframe: the page around it sends the links and asks for the focus;
// text that comes before navplace() is called waits in __NAVPLACE_EXTERNAL_TEXT__
function parent_messages_listen()
{
    if (window.parent === window) {
        return;
    }
    window.addEventListener('message', function (event) {
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
            }
        }
    });
    window.parent.postMessage({type: 'navplace:ready'}, '*');
}

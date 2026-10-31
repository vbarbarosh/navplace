// Temporary, just for prototype
document.write(`<script src="${document.currentScript.src.replace(/[^/]+$/, '')}filter1_from_spec.js"></script>`);
document.write(`<script src="${document.currentScript.src.replace(/[^/]+$/, '')}parse.js"></script>`);

window.__NAVPLACE_INST__ = null;
window.__NAVPLACE_EXTERNAL_TEXT__ = null;

if (window.parent !== window) {
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
    window.parent.postMessage({type: 'navplace:ready' }, '*');
}

function navplace(params)
{
    params = params || {};
    params.input = params.input || 'input[type=search]';
    params.update = params.update || function () {};
    params.meta = params.meta || {};

    window.__NAVPLACE_INST__ = {
        replace: function (text) {
            const tmp = parse(text);
            Object.entries(params.meta).forEach(function ([meta_key, selector]) {
                if (tmp.meta[meta_key]) {
                    const elem = document.querySelector(selector);
                    if (elem) {
                        elem.innerText = tmp.meta[meta_key];
                    }
                    if (meta_key === 'email' && elem.tagName === 'A') {
                        elem.href = tmp.meta[meta_key];
                    }
                }
            });
            all_items.splice(0, all_items.length, ...tmp.items);
            setTimeout(update, 0);
        },
    };

    const all_items = [];
    const filtered_items = [];
    const selected_items = [];
    navplace.selected_items = selected_items;

    if (typeof params.input === 'string') {
        params.input = document.querySelector(params.input);
    }
    if (params.input) {
        params.input.addEventListener('input', function () {
            update();
        });
    }

    document.addEventListener('keydown', function (event) {
        // 1. Ignore IME composition
        if (event.isComposing) {
            return;
        }
        // 2. Ignore modifier combos
        if (event.ctrlKey || event.metaKey || event.altKey) {
            return;
        }
        if (event.key === 'Enter' && filtered_items[0]?.href) {
            if (params.navigate) {
                selected_items.forEach(v => params.navigate(v));
                // params.navigate(filtered_items[0]);
            }
            else {
                event.preventDefault();
                // One call opens every selected item once
                navplace.navigate(selected_items[selected_items.length - 1]);
            }
        }
        // 3. Ignore non-printable keys
        if (event.key.length !== 1) {
            return;
        }
        if (document.activeElement !== params.input && !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName) && !document.activeElement?.isContentEditable) {
            params.input.focus();
        }
    });
    params.input.focus();

    if (window.ElectronApp?.api_items_all) {
        const replace_items = function (v) {
            all_items.splice(0, all_items.length, ...v.items);
            update();
        };
        window.ElectronApp.api_items_all().then(replace_items);
        window.ElectronApp.api_items_changed?.(replace_items);
    }
    else if (window.__NAVPLACE_EXTERNAL_TEXT__ !== null) {
        window.__NAVPLACE_INST__.replace(window.__NAVPLACE_EXTERNAL_TEXT__);
    }
    else {
        all_items.push(...parse(`
ChatGPT https://chatgpt.com/
GitHub  https://github.com/
Gmail   https://mail.google.com/
`).items);
        setTimeout(update, 0);
    }

    function update() {
        selected_items.splice(0, selected_items.length);
        // A space at either end is no expression of its own
        for (const expr of String(params.input.value).trim().split(/\s+/)) {
            const filter = filter1_from_spec(expr);
            const search1 = all_items.filter(v => filter(v.search1));
            const search2 = all_items.filter(v => filter(v.search2));
            const search1_set = new Set(search1);
            const matches = [...search1, ...search2.filter(v => !search1_set.has(v))];
            if (matches.length) {
                selected_items.push(matches[0]);
            }
            filtered_items.splice(0, filtered_items.length, ...matches);
        }
        params.update(filtered_items);
    }
}

navplace.navigate = function (item, event) {
    event?.preventDefault();
    const tmp = navplace.selected_items.slice();
    tmp.splice(-1, 1, item);
    for (const it of tmp) {
        if (window.ElectronApp) {
            window.open(it.href, '_blank', 'noopener,noreferrer');
        }
        else {
            window.open(it.href, '_top', 'noopener,noreferrer');
        }
    }
    // if (window.ElectronApp) {
    //     window.open(item.href, '_blank', 'noopener,noreferrer');
    // }
    // else {
    //     window.open(item.href, '_top', 'noopener,noreferrer');
    // }
};

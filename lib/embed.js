(function () {
    const script = document.currentScript;
    if (!script) {
        return;
    }

    const links_text = script.dataset.links || '';
    const meta = {};
    for (const line of links_text.split('\n')) {
        if (line.startsWith('%')) {
            const colon_at = line.indexOf(':');
            if (colon_at !== -1) {
                meta[line.slice(1, colon_at).trim()] = line.slice(colon_at + 1).trim();
            }
        }
    }

    let iframe_ready = false;

    const design = script.dataset.design || meta.design || 'basic';
    const src = script.dataset.src || `${script.src.replace(/[^/]+$/, '')}../designs/${design}/index.html`;
    const iframe = document.createElement('iframe');
    iframe.src = src;
    iframe.style.border = '0';
    iframe.style.width = '100%';
    iframe.style.height = '100%'; // design controls its own height
    iframe.setAttribute('tabindex', '-1');
    // The links go to the origin of the address the iframe was given, and to no other: a page a
    // link loaded in the frame gets none. An address with no origin, a data: one, gets none either
    const iframe_origin = new URL(iframe.src).origin;

    window.addEventListener('message', function (event) {
        if (event.source !== iframe.contentWindow) {
            return;
        }
        if (!event.data || (event.data.type !== 'navplace:ready') || (iframe_origin === 'null')) {
            return;
        }
        iframe_ready = true;
        if (links_text) {
            iframe.contentWindow.postMessage({type: 'navplace:items-text', text: links_text}, iframe_origin);
        }
    });

    // A character typed while nothing on this page has the focus goes to the design's search box:
    // the design takes the focus and types the character itself, so the first one is not lost.
    // A field, a button or a link of this page keeps its keys; so do Ctrl, Alt and Cmd, and Space,
    // which scrolls the page
    document.addEventListener('keydown', function (event) {
        if (!iframe_ready || event.ctrlKey || event.altKey || event.metaKey || event.isComposing) {
            return;
        }
        if (document.activeElement && (document.activeElement !== document.body) && (document.activeElement !== iframe)) {
            return;
        }
        if ((event.key.length !== 1) || (event.key === ' ')) {
            return;
        }
        event.preventDefault();
        iframe.contentWindow.postMessage({type: 'navplace:focus', key: event.key}, iframe_origin);
    });

    script.after(iframe);
})();

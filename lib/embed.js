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

    // Forward *any* keydown to iframe to restore focus
    document.addEventListener('keydown', function (event) {
        if (!iframe_ready) {
            return;
        }
        iframe.contentWindow.postMessage({type: 'navplace:focus'}, iframe_origin);
    });

    script.after(iframe);
})();

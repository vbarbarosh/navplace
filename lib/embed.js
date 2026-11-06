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

    window.addEventListener('message', function (event) {
        if (event.source !== iframe.contentWindow) {
            return;
        }
        if (!event.data || (event.data.type !== 'navplace:ready')) {
            return;
        }
        iframe_ready = true;
        if (links_text) {
            iframe.contentWindow.postMessage({type: 'navplace:items-text', text: links_text}, '*');
        }
    });

    // Forward *any* keydown to iframe to restore focus
    document.addEventListener('keydown', function (event) {
        if (!iframe_ready) {
            return;
        }
        iframe.contentWindow.postMessage({type: 'navplace:focus'}, '*');
    });

    script.after(iframe);
})();

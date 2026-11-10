// Designs drawn live in small frames of a page: the home page's six designs and its widget, the
// docs' thirteen. Loaded by a page with <script src="designs-shown.js"></script>.
//
// designs_show(shown, focus_holder_find)
//
// - `shown` is a list of {place, frame, design, text, fit}: the iframe `frame` in its element
//   `place` shows the design named `design`. It is given the links `text`; with none, the design's
//   own sample, designs/<design>/links.txt, and when that does not load the few links it starts with.
// - `fit()` gives the frame its size, with frame_fit() below; it is called again whenever the
//   place changes its size.
// - A design starts as the visitor comes near its place, so the page opens as fast as without them.
// - A design takes the focus as it starts, and the keys with it. It goes back to where it was;
//   `focus_holder_find()`, when given, names that element for a page that knows better than
//   document.activeElement, a search box inside another frame for one.
function designs_show(shown, focus_holder_find)
{
    const starting = new IntersectionObserver(function (entries) {
        for (const entry of entries.filter(v => v.isIntersecting)) {
            starting.unobserve(entry.target);
            design_start(shown.find(v => v.place === entry.target));
        }
    }, {rootMargin: '600px'});
    for (const item of shown) {
        new ResizeObserver(item.fit).observe(item.place);
        starting.observe(item.place);
    }

    window.addEventListener('message', async function (event) {
        const item = shown.find(v => v.frame.contentWindow === event.source);
        if (!item || (event.data?.type !== 'navplace:ready')) {
            return;
        }
        const text = await item.text;
        if (typeof text === 'string') {
            item.frame.contentWindow.postMessage({type: 'navplace:items-text', text}, location.origin);
        }
    });

    function design_start(item) {
        item.text ??= sample_load(item.design);
        const holder = focus_holder_find?.() ?? document.activeElement;
        item.frame.addEventListener('load', function () {
            if (document.activeElement === item.frame) {
                item.frame.blur();
                holder?.focus({preventScroll: true});
            }
        });
        item.frame.src = `designs/${item.design}/index.html`;
    }

    // A design's own sample; null when it did not load
    async function sample_load(design_name) {
        try {
            const response = await fetch(`designs/${design_name}/links.txt`);
            return response.ok ? await response.text() : null;
        }
        catch {
            return null;
        }
    }
}

// A design is drawn `inner_width` wide and scaled to the width of its place; with no height given
// it is as tall as the place. Returns the scale
function frame_fit(place, frame, inner_width, inner_height)
{
    const scale = place.clientWidth/inner_width;
    frame.style.width = `${inner_width}px`;
    frame.style.height = `${inner_height ?? Math.round(place.clientHeight/scale)}px`;
    frame.style.transform = `scale(${scale})`;
    return scale;
}

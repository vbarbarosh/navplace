// The parsed links as a page of the app is handed them: a picture from the web is shown by the
// address `page_url` gives for it, the app's own (helpers/make_picture_store.js), so a page
// never asks the web. So are the pictures of `meta.picture`, the one named background among
// them, which a design shows behind the links. Every other picture stays as written: a `data:`
// one, a file of ~/.navplace/. The collection itself is not changed.
function collection_route_pictures(collection, page_url)
{
    const items = collection.items.map(v => is_web_href(v.image_url) ? {...v, image_url: page_url(v.image_url)} : v);
    if (!collection.meta.picture) {
        return {...collection, items};
    }
    const picture = {};
    for (const [name, href] of Object.entries(collection.meta.picture)) {
        picture[name] = is_web_href(href) ? page_url(href) : href;
    }
    return {...collection, meta: {...collection.meta, picture}, items};
}

function is_web_href(href)
{
    return /^https?:\/\//.test(href ?? '');
}

module.exports = collection_route_pictures;

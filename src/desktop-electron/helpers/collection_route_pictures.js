// The parsed links as a page of the app is handed them: a picture from the web is shown by the
// address `page_url` gives for it, the app's own (helpers/make_picture_store.js), so a page
// never asks the web. Every other picture stays as written: a `data:` one, a file of
// ~/.navplace/. The collection itself is not changed.
function collection_route_pictures(collection, page_url)
{
    return {...collection, items: collection.items.map(v => /^https?:\/\//.test(v.image_url ?? '') ? {...v, image_url: page_url(v.image_url)} : v)};
}

module.exports = collection_route_pictures;

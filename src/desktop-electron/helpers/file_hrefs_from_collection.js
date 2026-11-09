// The `file:` addresses of a collection's links, each as the links file writes it. Taken from the
// user's own file before its includes are added, these are the only ones the app opens: a link of
// an included file is someone else's text
function file_hrefs_from_collection(collection)
{
    return new Set(collection.items.map(v => v.href).filter(v => v.startsWith('file:')));
}

module.exports = file_hrefs_from_collection;

// The parsed links as a page is handed them: without the `% include:` addresses. An address may
// carry a token or a password, pulling it is the app's own work (collection_resolve_includes),
// and no design reads it. The collection itself is not changed.
function collection_drop_includes(collection)
{
    const {include: _, ...meta} = collection.meta;
    return {...collection, meta};
}

module.exports = collection_drop_includes;

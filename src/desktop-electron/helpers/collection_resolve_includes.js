const http_get_utf8 = require('@vbarbarosh/node-helpers/src/http_get_utf8');
const include_spec_from_text = require('./include_spec_from_text');
const parse = require('../../../lib/parse');

// `% include:` pulls another document into this one. The directive belongs to
// the desktop app; the web app and the embed widget ignore it.
//
// A pulled document contributes links and sections only — its own directives
// are dropped before parsing, so it cannot switch the design, apply `% ns:`,
// or pull further documents. The pull happens first and `% ns:` runs after it:
// the filter of the pulling document gates local and pulled links alike. The
// request carries no access token: an include url is a stranger.
async function collection_resolve_includes(collection, group_uid)
{
    const specs = (collection.meta.include || []).map(include_spec_from_text);
    const items = [...collection.items];
    for (const spec of specs) {
        // A query may carry a token: the logs keep the url without it
        const url_without_query = spec.url.split('?')[0];
        if (!spec.url.startsWith('http://') && !spec.url.startsWith('https://')) {
            console.error(`[${group_uid}][include_skipped] url=${url_without_query}`);
            continue;
        }
        try {
            // Startup waits for this — a silent url must not hold the window back.
            const text = await http_get_utf8(spec.url, {timeout: 5000});
            const included = parse(text_drop_directives(text), {prefix: spec.prefix, suffix: spec.suffix, tags: spec.tags, ns: collection.meta.ns});
            console.log(`[${group_uid}][include_ok] url=${url_without_query} items=${included.items.length}`);
            items.push(...included.items);
        }
        catch (error) {
            // One dead url keeps the rest of the collection alive.
            console.error(`[${group_uid}][include_failed] url=${url_without_query} reason=${JSON.stringify(error.message)}`);
        }
    }

    return {meta: collection.meta, items};
}

function text_drop_directives(text)
{
    return text.split('\n').filter(v => !v.trim().startsWith('%')).join('\n');
}

module.exports = collection_resolve_includes;

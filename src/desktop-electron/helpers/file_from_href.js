const url = require('url');

// The path of a `file:` address a page asked the app to open, or null when it is not to be
// opened. Only an address the set lists, written exactly as there, gives a path: the page is not
// trusted to say where a link came from, so the set (helpers/file_hrefs_from_collection.js, of
// the user's own file) decides. An address of another machine, `file://host/…`, gives none
function file_from_href(href, file_hrefs)
{
    if ((typeof href !== 'string') || !file_hrefs.has(href)) {
        return null;
    }
    try {
        const parsed = new URL(href);
        return (parsed.protocol === 'file:') ? url.fileURLToPath(parsed) : null;
    }
    catch {
        return null;
    }
}

module.exports = file_from_href;

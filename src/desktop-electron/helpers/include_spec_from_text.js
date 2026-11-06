// The value of a `% include:` line: the url first, then optional decorations
// for every pulled item. `#tag` adds a common tag, `#prefix=` and `#suffix=`
// wrap the label. Values hold no spaces — the rule item lines already follow.
//
//     https://example.com/links.md #work #prefix=ACME/
function include_spec_from_text(text)
{
    const [url, ...rest] = text.trim().split(/\s+/);
    const out = {url, tags: [], prefix: '', suffix: ''};
    for (const [, key, value] of rest.join(' ').matchAll(/#([a-zA-Z0-9_-]+)(?:=([^\s#]+))?/g)) {
        if (value === undefined) {
            out.tags.push(key);
        }
        else if (key === 'prefix') {
            out.prefix = value;
        }
        else if (key === 'suffix') {
            out.suffix = value;
        }
    }

    return out;
}

module.exports = include_spec_from_text;

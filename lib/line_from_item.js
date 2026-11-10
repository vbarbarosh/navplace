// A link line with `edited` written into it part by part: what did not change keeps
// its place and its spacing. `item` is the line's item from parse(text, {spans: true});
// `edited` has the parts a person may change: {label, href, tags, image_url, meta}.
// The line it returns, parsed again, gives the edited parts; an edit a link line cannot hold
// throws an Error that says which part, the line untouched.
// An empty label is no name: the link shows its address, as the parser names it. With a tag
// or a #key=value it has to take that name in writing: nothing else would stand before the
// tag, and a line that opens with # is a section
function line_from_item(line, item, edited)
{
    const spans = item.spans;
    const lead = line.length - line.trimStart().length;
    const label_text = String(edited.label).trim();
    const tags_text = edited.tags.map(v => `#${v}`).join(' ');
    const meta_text = Object.entries(edited.meta).map(v => `#${v[0]}=${v[1]}`).join(' ');
    // A picture is a name: `private://m.png`, `@m.png` and `m.png` are all written `@m.png`
    const image_name = String(edited.image_url ?? '').replace(/^private:\/\//, '').replace(/^@/, '');
    const image_text = image_name ? `@${image_name}` : '';
    const places = [
        ...spans.label.map(v => ({kind: 'label', at: v})),
        ...spans.tags.map(v => ({kind: 'tags', at: v.at})),
        ...spans.meta.map(v => ({kind: 'meta', at: v.at})),
        ...(spans.image ? [{kind: 'image', at: spans.image}] : []),
        {kind: 'href', at: spans.href},
    ].sort((a, b) => a.at[0] - b.at[0]);
    // The parts in the order they stand, the link last: {kind, text, gap}. `gap` is the space before
    // a part, null for the one that opens the line and for a new one; a part with no text is taken out
    const parts = places.map((v, i) => ({kind: v.kind, text: line.slice(v.at[0], v.at[1]), gap: i ? line.slice(places[i - 1].at[1], v.at[0]) : null}));

    // A label a tag splits is its pieces with one space between in parse's label: compare the words
    if (words_of(edited.label) !== words_of(item.label)) {
        parts_write('label', label_text, 0);
    }
    // New tags and meta go after the last label, tag or meta part, before the picture and the link
    if (JSON.stringify(edited.tags) !== JSON.stringify(item.tags)) {
        parts_write('tags', tags_text, parts.findIndex(v => (v.kind === 'image') || (v.kind === 'href')));
    }
    if (JSON.stringify(edited.meta) !== JSON.stringify(item.meta)) {
        parts_write('meta', meta_text, parts.findIndex(v => (v.kind === 'image') || (v.kind === 'href')));
    }
    if (image_text !== (spans.image ? line.slice(spans.image[0], spans.image[1]) : '')) {
        parts_write('image', image_text, parts.length - 1);
    }
    parts[parts.length - 1].text = edited.href;

    const is_named = parts.some(v => (v.kind === 'label') && v.text);
    const name_shown = is_named ? null : (item_from_line(edited.href)?.label ?? '');
    if (!is_named && (tags_text || meta_text)) {
        if (!name_shown) {
            throw new Error('A link with no name cannot take tags or meta: give it a "label" first.');
        }
        parts.unshift({kind: 'label', text: name_shown, gap: null});
    }

    let out = line.slice(0, lead);
    // The space a part taken out leaves to the next one that has none of its own
    let gap_left = '';
    for (const part of parts) {
        const gap = (part.gap === null) ? ' ' : (part.gap || gap_left);
        if (!part.text) {
            gap_left = gap;
            continue;
        }
        out = `${out}${(out.length > lead) ? gap : ''}${part.text}`;
        gap_left = '';
    }
    out = `${out}${line.slice(spans.href[1])}`;

    const read = item_from_line(out);
    if (!read) {
        throw new Error(`This cannot be written as a link: the line "${out.trim()}" would not read as one.`);
    }
    // An address given as the picture is wanted back as it is: a line holds a name only, so it is refused
    const image_wanted = /^data:|:\/\//.test(edited.image_url) ? edited.image_url : `private://${image_name}`;
    const wanted = {label: words_of(is_named ? edited.label : name_shown), href: edited.href, tags: edited.tags, image_url: edited.image_url ? image_wanted : null, meta: edited.meta};
    const written = {label: words_of(read.label), href: read.href, tags: read.tags, image_url: read.image_url, meta: read.meta};
    for (const key of Object.keys(wanted)) {
        if (JSON.stringify(written[key]) !== JSON.stringify(wanted[key])) {
            throw new Error(`"${key}" cannot be written into the line as it is: it would read back as ${JSON.stringify(written[key])}.`);
        }
    }
    return out;

    // The first part of a kind takes the new text and the others go; with none of the kind, the
    // text is a new part at `index`
    function parts_write(kind, text, index) {
        const first = parts.find(v => v.kind === kind);
        for (const part of parts.filter(v => v.kind === kind)) {
            part.text = '';
        }
        if (first) {
            first.text = text;
        }
        else if (text) {
            parts.splice(index, 0, {kind, text, gap: null});
        }
    }
}

function words_of(text)
{
    return String(text).trim().replace(/\s+/g, ' ');
}

// The link the parser reads from one line, or null when it reads none. A page loads lib/parse.js
// before this file; node takes the one beside it
function item_from_line(line)
{
    const parse_fn = (typeof module === 'undefined') ? parse : require('./parse');
    return parse_fn(line).items[0] ?? null;
}

if (typeof module !== 'undefined') {
    module.exports = line_from_item;
}

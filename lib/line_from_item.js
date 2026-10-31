// A link line with `edited` written into it part by part: what did not change keeps
// its place and its spacing. `item` is the line's item from parse(text, {spans: true});
// `edited` has the parts a person may change: {label, href, tags, image_url, meta}.
function line_from_item(line, item, edited)
{
    const spans = item.spans;
    const lead = line.length - line.trimStart().length;
    const point = point_of_new_parts(spans);
    const edits = [];
    const inserts = [];

    // A tag inside a label leaves its spaces in parse's label: compare the words
    if (words_of(edited.label) !== words_of(item.label)) {
        parts_replace(spans.label, edited.label, function () {
            if (edited.label) {
                edits.push({at: [lead, lead], text: `${edited.label} `});
            }
        });
    }
    if (edited.href !== item.href) {
        edits.push({at: spans.href, text: edited.href});
    }
    if (JSON.stringify(edited.tags) !== JSON.stringify(item.tags)) {
        const text = edited.tags.map(v => `#${v}`).join(' ');
        parts_replace(spans.tags.map(v => v.at), text, () => text && inserts.push(text));
    }
    if (JSON.stringify(edited.meta) !== JSON.stringify(item.meta)) {
        const text = Object.entries(edited.meta).map(([key, value]) => `#${key}=${value}`).join(' ');
        parts_replace(spans.meta.map(v => v.at), text, () => text && inserts.push(text));
    }
    if (edited.image_url !== item.image_url) {
        const text = edited.image_url ? `@${String(edited.image_url).replace(/^private:\/\//, '').replace(/^@/, '')}` : '';
        parts_replace(spans.image ? [spans.image] : [], text, function () {
            if (text) {
                edits.push({at: [spans.href[0], spans.href[0]], text: `${text} `});
            }
        });
    }
    if (inserts.length) {
        // With nothing before the link, the new parts open the line
        const text = (point === spans.href[0]) ? `${inserts.join(' ')} ` : ` ${inserts.join(' ')}`;
        edits.push({at: [point, point], text});
    }

    let out = line;
    for (const edit of edits.sort((a, b) => b.at[0] - a.at[0])) {
        out = out.slice(0, edit.at[0]) + edit.text + out.slice(edit.at[1]);
    }
    return out;

    // The first part takes the new text, the others go with the space before them
    function parts_replace(parts, text, insert)
    {
        if (!parts.length) {
            insert();
            return;
        }
        edits.push(text ? {at: parts[0], text} : {at: at_with_space(parts[0]), text: ''});
        for (const at of parts.slice(1)) {
            edits.push({at: at_with_space(at), text: ''});
        }
    }

    function at_with_space(at)
    {
        const before = line.slice(0, at[0]);
        const space = before.length - before.trimEnd().length;
        if (at[0] - space > lead) {
            return [at[0] - space, at[1]];
        }
        const after = line.slice(at[1]);
        return [at[0], at[1] + (after.length - after.trimStart().length)];
    }
}

function words_of(text)
{
    return String(text).trim().replace(/\s+/g, ' ');
}

// New tags and meta go after the last label, tag or meta part, before the picture and the link
function point_of_new_parts(spans)
{
    const ends = [...spans.label, ...spans.tags.map(v => v.at), ...spans.meta.map(v => v.at)].map(v => v[1]);
    return ends.length ? Math.max(...ends) : spans.href[0];
}

if (typeof module !== 'undefined') {
    module.exports = line_from_item;
}

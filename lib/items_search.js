// What the search box's text finds among the links. Each word is an expression of its own:
// `filtered_items` are the links the last word matches, `selected_items` the top link of every
// word that matches any.
//
// An expression is its /-separated parts, and a link matches when every part holds:
// - a part holds when it is found in the link's name, in one of its tags or in its address;
// - with ^ or $ it is tried against the name alone, each tag alone and the address alone,
//   so hub$ finds `GitHub #dev`;
// - with ! it holds only when it is found in none of them.
// Links whose parts all hold without the address come first, the rest after, in the file's order.
//
// What is typed is lowered and transliterated as the names are, so Git finds GitHub and почта
// finds Почта. Each part is read by lib/filter1_from_spec.js; lib/navplace.js loads that file and
// lib/parse.js before this one, and a test gives node the two as globals.
function items_search(items, text)
{
    const selected_items = [];
    // What each link is searched by: its name and tags, and the same with its address
    const rows = items.map(row_from_item);

    let filtered_items = [];
    // A space at either end is no expression of its own
    for (const expr of parse.text_transliterate(String(text)).trim().split(/\s+/)) {
        filtered_items = items_match(expr);
        if (filtered_items.length) {
            selected_items.push(filtered_items[0]);
        }
    }
    return {filtered_items, selected_items};

    function row_from_item(item) {
        const names = [item.label, ...item.tags].map(v => parse.text_transliterate(v));
        return {item, names, fields: [...names, item.search2]};
    }

    function items_match(expr) {
        const tests = expr.split('/').filter(Boolean).map(test_from_part);
        const by_name = [];
        const by_address = [];
        for (const row of rows) {
            if (!tests.every(v => is_held(v, row.fields))) {
                continue;
            }
            if (tests.every(v => is_held(v, row.names))) {
                by_name.push(row.item);
            }
            else {
                by_address.push(row.item);
            }
        }
        return [...by_name, ...by_address];
    }

    // The part without its !, and whether an odd number of them turns it around
    function test_from_part(part) {
        const positive = part.replaceAll('!', '');
        return {filter1: filter1_from_spec(positive), is_negated: ((part.length - positive.length) % 2 === 1)};
    }

    function is_held(test, fields) {
        return fields.some(v => test.filter1(v)) !== test.is_negated;
    }
}

if (typeof module !== 'undefined') {
    module.exports = items_search;
}

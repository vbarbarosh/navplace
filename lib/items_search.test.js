#!/usr/bin/env mocha

const assert = require('assert');
const items_search = require('./items_search');
const parse = require('./parse');

const ITEMS = parse(`
GitHub #dev https://github.example.com/
Mirror https://git.example.org/
Git https://example.com/api/
Docs #dev #api https://docs.example.com/
Почта https://mail.example.com/
Письма https://letters.example.com/
Hubble https://example.io
Git API https://example.net/
`).items;

describe('items_search', function () {
    // A page gives lib/items_search.js its two helpers as globals, and so does this test.
    // lib/filter1_from_spec.js is a page's file: it leaves its function on `window`
    before(function () {
        global.window = {};
        require('./filter1_from_spec');
        global.filter1_from_spec = global.window.filter1_from_spec;
        global.parse = parse;
        delete global.window;
    });
    after(function () {
        delete global.filter1_from_spec;
        delete global.parse;
    });

    it('shows every link for an empty text, in the file\'s order, the first one selected', function () {
        for (const text of ['', '   ']) {
            const found = items_search(ITEMS, text);
            assert.deepStrictEqual(found.filtered_items, ITEMS);
            assert.deepStrictEqual(found.selected_items, [ITEMS[0]]);
        }
        assert.deepStrictEqual(items_search([], 'git'), {filtered_items: [], selected_items: []});
    });

    it('puts the links found by name or tag first, those found by address after', function () {
        assert.deepStrictEqual(labels_search('git'), ['GitHub', 'Git', 'Git API', 'Mirror']);
        assert.deepStrictEqual(labels_search('api'), ['Docs', 'Git API', 'Git']);
        assert.deepStrictEqual(labels_search('example.io'), ['Hubble']);
        assert.deepStrictEqual(labels_search('zzz'), []);
    });

    it('finds whatever the case of what is typed', function () {
        assert.deepStrictEqual(labels_search('Git'), labels_search('git'));
        assert.deepStrictEqual(labels_search('GITHUB'), ['GitHub']);
        assert.deepStrictEqual(labels_search('^GIT/Api'), labels_search('^git/api'));
    });

    it('finds a Cyrillic name by Cyrillic and by Latin letters', function () {
        for (const text of ['почта', 'Почта', 'ПОЧТА', 'pochta', 'Pochta']) {
            assert.deepStrictEqual(labels_search(text), ['Почта'], text);
        }
        assert.deepStrictEqual(labels_search('pisma'), ['Письма']);
        assert.deepStrictEqual(labels_search('письма'), ['Письма']);
    });

    it('finds a link by a tag', function () {
        assert.deepStrictEqual(labels_search('dev'), ['GitHub', 'Docs']);
        assert.deepStrictEqual(labels_search('DEV'), ['GitHub', 'Docs']);
        assert.deepStrictEqual(labels_search('!dev'), ['Mirror', 'Git', 'Почта', 'Письма', 'Hubble', 'Git API']);
    });

    it('tries ^ and $ against the name alone, each tag alone and the address alone', function () {
        assert.deepStrictEqual(labels_search('hub$'), ['GitHub']);
        assert.deepStrictEqual(labels_search('^git'), ['GitHub', 'Git', 'Git API']);
        assert.deepStrictEqual(labels_search('^dev'), ['GitHub', 'Docs']);
        assert.deepStrictEqual(labels_search('api$'), ['Docs', 'Git API']);
        assert.deepStrictEqual(labels_search('^api$'), ['Docs']);
        assert.deepStrictEqual(labels_search('^git$'), ['Git']);
        assert.deepStrictEqual(labels_search('^https:'), ITEMS.map(v => v.label));
        assert.deepStrictEqual(labels_search('.io$'), ['Hubble']);
    });

    it('holds a part with ! only when it is found in none of them', function () {
        assert.deepStrictEqual(labels_search('!git'), ['Docs', 'Почта', 'Письма', 'Hubble']);
        assert.deepStrictEqual(labels_search('!git/!hub'), ['Docs', 'Почта', 'Письма']);
        assert.deepStrictEqual(labels_search('!^git'), ['Mirror', 'Docs', 'Почта', 'Письма', 'Hubble']);
        assert.deepStrictEqual(labels_search('!!git'), labels_search('git'));
        assert.deepStrictEqual(labels_search('!'), []);
    });

    it('matches a link when every part holds, each part wherever it is found', function () {
        assert.deepStrictEqual(labels_search('git/api'), ['Git API', 'Git']);
        assert.deepStrictEqual(labels_search('api/git'), ['Git API', 'Git']);
        assert.deepStrictEqual(labels_search('hub/dev'), ['GitHub']);
        assert.deepStrictEqual(labels_search('git/!api'), ['GitHub', 'Mirror']);
        assert.deepStrictEqual(labels_search('^git/!hub'), ['Git', 'Git API']);
        assert.deepStrictEqual(labels_search('git/'), labels_search('git'));
        assert.deepStrictEqual(labels_search('/'), ITEMS.map(v => v.label));
    });

    it('takes each word as an expression of its own: the last one is shown, the top of each is selected', function () {
        const found = items_search(ITEMS, ' git  mail ');
        assert.deepStrictEqual(found.filtered_items.map(v => v.label), ['Почта']);
        assert.deepStrictEqual(found.selected_items.map(v => v.label), ['GitHub', 'Почта']);
        assert.deepStrictEqual(items_search(ITEMS, 'Hub$ pisma !git').selected_items.map(v => v.label), ['GitHub', 'Письма', 'Docs']);
        assert.deepStrictEqual(items_search(ITEMS, 'git git').selected_items.map(v => v.label), ['GitHub', 'GitHub']);
    });

    it('selects nothing for a word that finds nothing', function () {
        assert.deepStrictEqual(items_search(ITEMS, 'git zzz'), {filtered_items: [], selected_items: [ITEMS[0]]});
        const found = items_search(ITEMS, 'zzz git');
        assert.deepStrictEqual(found.filtered_items.map(v => v.label), ['GitHub', 'Git', 'Git API', 'Mirror']);
        assert.deepStrictEqual(found.selected_items, [ITEMS[0]]);
    });
});

function labels_search(text)
{
    return items_search(ITEMS, text).filtered_items.map(v => v.label);
}

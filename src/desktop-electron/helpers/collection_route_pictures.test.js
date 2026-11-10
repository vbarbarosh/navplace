const assert = require('node:assert/strict');
const collection_route_pictures = require('./collection_route_pictures');
const parse = require('../../../lib/parse');
const test = require('node:test');

test('collection_route_pictures: a picture from the web gets the address the app gives it, the rest stay', function () {
    const collection = parse(`% title: Jane Roe
% picture web: https://example.com/img/a.png?token=abc
% picture plain: http://example.com/b.png
% picture drawn: data:image/png;base64,iVBORw0KGgo=

Web     @web        https://web.example.com/
Plain   @plain      https://plain.example.com/
Drawn   @drawn      https://drawn.example.com/
File    @img/c.png  https://file.example.com/
None                https://none.example.com/
Twice   @web        https://twice.example.com/
`);
    const asked = [];
    const actual = collection_route_pictures(collection, function (href) {
        asked.push(href);
        return `app://picture/${asked.length}`;
    });
    assert.deepEqual(actual.items.map(v => [v.label, v.image_url]), [
        ['Web', 'app://picture/1'],
        ['Plain', 'app://picture/2'],
        ['Drawn', 'data:image/png;base64,iVBORw0KGgo='],
        ['File', 'private://img/c.png'],
        ['None', null],
        ['Twice', 'app://picture/3'],
    ]);
    assert.deepEqual(asked, ['https://example.com/img/a.png?token=abc', 'http://example.com/b.png', 'https://example.com/img/a.png?token=abc']);
    assert.equal(actual.meta, collection.meta);
    assert.deepEqual(actual.items.map(v => v.href), collection.items.map(v => v.href));
});

test('collection_route_pictures: the collection itself is not changed', function () {
    const collection = parse(`% picture web: https://example.com/a.png

Web @web https://web.example.com/
`);
    const before = JSON.stringify(collection);
    const actual = collection_route_pictures(collection, () => 'app://picture/1');
    assert.equal(JSON.stringify(collection), before);
    assert.notEqual(actual.items[0], collection.items[0]);
});

test('collection_route_pictures: no link, no picture: nothing to do', function () {
    const empty = collection_route_pictures(parse(''), assert.fail);
    assert.deepEqual(empty.items, []);
    const plain = collection_route_pictures(parse('One https://one.example.com/\n'), assert.fail);
    assert.deepEqual(plain.items.map(v => v.image_url), [null]);
});

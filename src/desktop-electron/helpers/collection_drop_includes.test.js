const assert = require('node:assert/strict');
const collection_drop_includes = require('./collection_drop_includes');
const parse = require('../../../lib/parse');
const test = require('node:test');

test('collection_drop_includes: the include addresses are gone, the rest is there', function () {
    const collection = parse('% design: cards\n% include: https://user:secret@example.com/links.md?token=abc\n\nDocs https://example.com/docs\n');
    const dropped = collection_drop_includes(collection);
    assert.equal(JSON.stringify(dropped).includes('secret'), false);
    assert.equal(JSON.stringify(dropped).includes('token=abc'), false);
    assert.equal(dropped.meta.design, 'cards');
    assert.deepEqual(dropped.items, collection.items);
});

test('collection_drop_includes: the collection itself keeps them', function () {
    const collection = parse('% include: https://example.com/links.md\n\nDocs https://example.com/docs\n');
    collection_drop_includes(collection);
    assert.deepEqual(collection.meta.include, ['https://example.com/links.md']);
});

test('collection_drop_includes: a collection with no include stays as it is', function () {
    const collection = parse('% design: cards\n\nDocs https://example.com/docs\n');
    assert.deepEqual(collection_drop_includes(collection), collection);
});

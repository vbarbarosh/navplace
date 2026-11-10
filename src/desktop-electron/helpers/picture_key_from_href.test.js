const assert = require('node:assert/strict');
const picture_key_from_href = require('./picture_key_from_href');
const test = require('node:test');

test('picture_key_from_href: 64 hex digits, the same for the same address', function () {
    const key = picture_key_from_href('https://example.com/img/logo.png?token=abc');
    assert.match(key, /^[0-9a-f]{64}$/);
    assert.equal(picture_key_from_href('https://example.com/img/logo.png?token=abc'), key);
});

test('picture_key_from_href: another address, by a letter or by its query, is another key', function () {
    const keys = ['https://example.com/a.png', 'https://example.com/b.png', 'https://example.com/a.png?2', 'http://example.com/a.png'].map(picture_key_from_href);
    assert.equal(new Set(keys).size, 4);
});

const assert = require('node:assert/strict');
const test = require('node:test');
const url_drop_secrets = require('./url_drop_secrets');

test('url_drop_secrets: the query, the fragment, the user and the password are left out', function () {
    assert.equal(url_drop_secrets('https://example.com/img/logo.png'), 'https://example.com/img/logo.png');
    assert.equal(url_drop_secrets('https://example.com/img/logo.png?token=abc#top'), 'https://example.com/img/logo.png');
    assert.equal(url_drop_secrets('http://user:secret@example.com:8080/links.md?token=abc'), 'http://example.com:8080/links.md');
    assert.equal(url_drop_secrets('ftp://user:secret@files.example.com/links.md?token=abc#top'), 'ftp://files.example.com/links.md');
});

test('url_drop_secrets: an address with no // keeps its scheme only', function () {
    assert.equal(url_drop_secrets('mailto:user:secret@files.example.com?token=abc'), 'mailto:');
    assert.equal(url_drop_secrets('data:image/png;base64,iVBORw0KGgo='), 'data:');
});

test('url_drop_secrets: what is no address is not repeated', function () {
    assert.equal(url_drop_secrets('links.md?token=abc'), 'invalid-url');
    assert.equal(url_drop_secrets('http://user:secret@files.example.com:99999/links.md?token=abc'), 'invalid-url');
    assert.equal(url_drop_secrets(''), 'invalid-url');
});

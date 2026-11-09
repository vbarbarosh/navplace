const assert = require('node:assert/strict');
const is_url_external = require('./is_url_external');
const test = require('node:test');

test('is_url_external: a web address goes to the system', function () {
    for (const url of [
        'https://example.com/',
        'http://example.com/',
        'https://example.com/path?q=1&r=2#part',
        'https://user:secret@example.com:8443/',
        'HTTPS://EXAMPLE.COM/',
        'http://127.0.0.1:9402/links.md',
    ]) {
        assert.equal(is_url_external(url), true, url);
    }
});

test('is_url_external: mailto: with one plain mail address goes to the system', function () {
    for (const url of [
        'mailto:jane@example.com',
        'mailto:jane.roe+links@mail.example.com',
        'mailto:jane_roe-1@example-site.com',
        'MAILTO:Jane@Example.com',
    ]) {
        assert.equal(is_url_external(url), true, url);
    }
});

test('is_url_external: a mailto: with a `?` part does not, whatever the part says', function () {
    for (const url of [
        'mailto:jane@example.com?attach=/etc/hostname',
        'mailto:jane@example.com?cc=other@example.com',
        'mailto:jane@example.com?bcc=other@example.com',
        'mailto:jane@example.com?subject=hello',
        'mailto:jane@example.com?body=hello',
        'mailto:jane@example.com?',
        'mailto:?to=jane@example.com',
        'mailto:?attach=/etc/hostname',
    ]) {
        assert.equal(is_url_external(url), false, url);
    }
});

test('is_url_external: a mailto: that hides a field, a quote or a second address does not', function () {
    for (const url of [
        'mailto:jane@example.com&attach=/etc/hostname',
        'mailto:jane@example.com%3Fattach=/etc/hostname',
        'mailto:jane@example.com%26attach=/etc/hostname',
        'mailto:jane@example.com%27,attachment=%27/etc/hostname',
        'mailto:jane@example.com\\x27,attachment=\\x27/etc/hostname',
        "mailto:jane@example.com',attachment='/etc/hostname",
        'mailto:jane@example.com"',
        'mailto:jane@example.com,other@example.com',
        'mailto:jane@example.com;other@example.com',
        'mailto:jane@example.com other@example.com',
        'mailto:jane@example.com#part',
        'mailto:<jane@example.com>',
        'mailto:jane@example.com:25',
        'mailto:jane@other@example.com',
        'mailto:jane@example.com\n',
        ' mailto:jane@example.com',
        'mailto:jane@example.com/../x',
        'mailto:*@example.com',
    ]) {
        assert.equal(is_url_external(url), false, JSON.stringify(url));
    }
});

test('is_url_external: a mailto: with no whole address does not', function () {
    for (const url of [
        'mailto:',
        'mailto:jane',
        'mailto:@example.com',
        'mailto:jane@',
        'mailto://jane@example.com',
    ]) {
        assert.equal(is_url_external(url), false, url);
    }
});

test('is_url_external: any other kind of address does not', function () {
    for (const url of [
        'file:///etc/hostname',
        'ssh://example.com/',
        'smb://example.com/share',
        'vscode://file/etc/hostname',
        'javascript:alert(1)',
        'data:text/html,hello',
        'about:blank',
        'navplace://app/designs/github/index.html',
        'private://picture.png',
        'tel:+10000000000',
        'ftp://example.com/',
        'mailto.example.com',
    ]) {
        assert.equal(is_url_external(url), false, url);
    }
});

test('is_url_external: what is not an address does not', function () {
    for (const url of [
        '',
        'example.com',
        '/etc/hostname',
        'jane@example.com',
        null,
        undefined,
        42,
        {},
    ]) {
        assert.equal(is_url_external(url), false, JSON.stringify(url));
    }
});

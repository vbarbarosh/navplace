const assert = require('node:assert/strict');
const file_from_href = require('./file_from_href');
const test = require('node:test');

const FILE_HREFS = new Set([
    'file:///home/user/notes.txt',
    'file:///home/user/my%20notes.txt',
    'file:///home/user/folder/',
    'file:///home/user/report.pdf?page=2#top',
    'file://localhost/home/user/local.txt',
    'file://server.example.com/share/notes.txt',
    'file:///home/user/a%2Fb.txt',
    'https://example.com/',
]);

test('file_from_href: an address of the set gives its path', function () {
    assert.equal(file_from_href('file:///home/user/notes.txt', FILE_HREFS), '/home/user/notes.txt');
    assert.equal(file_from_href('file:///home/user/my%20notes.txt', FILE_HREFS), '/home/user/my notes.txt');
    assert.equal(file_from_href('file:///home/user/folder/', FILE_HREFS), '/home/user/folder/');
    assert.equal(file_from_href('file://localhost/home/user/local.txt', FILE_HREFS), '/home/user/local.txt');
});

test('file_from_href: what follows `?` or `#` is not a part of the path', function () {
    assert.equal(file_from_href('file:///home/user/report.pdf?page=2#top', FILE_HREFS), '/home/user/report.pdf');
});

test('file_from_href: an address the set does not list gives none', function () {
    for (const href of [
        'file:///etc/hostname',
        'file:///home/user/other.txt',
        'file:///home/user/notes.txt?x=1',
        'file:///home/user/notes.txt#top',
        'file:///home/user/folder',
    ]) {
        assert.equal(file_from_href(href, FILE_HREFS), null, href);
    }
});

test('file_from_href: the same file written another way is not listed', function () {
    for (const href of [
        'file:///home/user/./notes.txt',
        'file:///home/user/folder/../notes.txt',
        'file:///home/user//notes.txt',
        'file:///home/user/notes%2Etxt',
        'file:/home/user/notes.txt',
        'FILE:///home/user/notes.txt',
        ' file:///home/user/notes.txt',
        'file:///home/user/notes.txt ',
    ]) {
        assert.equal(file_from_href(href, FILE_HREFS), null, JSON.stringify(href));
    }
});

test('file_from_href: a listed address that is no path of this machine gives none', function () {
    // POSIX: a host other than localhost, and an encoded slash, are not paths
    assert.equal(file_from_href('file://server.example.com/share/notes.txt', FILE_HREFS), null);
    assert.equal(file_from_href('file:///home/user/a%2Fb.txt', FILE_HREFS), null);
});

test('file_from_href: a listed address of another kind gives none', function () {
    assert.equal(file_from_href('https://example.com/', FILE_HREFS), null);
});

test('file_from_href: what is not a text gives none', function () {
    for (const href of [null, undefined, 42, {}, ['file:///home/user/notes.txt'], {href: 'file:///home/user/notes.txt'}]) {
        assert.equal(file_from_href(href, FILE_HREFS), null, JSON.stringify(href));
    }
});

test('file_from_href: an empty set opens nothing', function () {
    assert.equal(file_from_href('file:///home/user/notes.txt', new Set()), null);
});

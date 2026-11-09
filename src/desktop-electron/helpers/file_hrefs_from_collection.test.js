const assert = require('node:assert/strict');
const file_hrefs_from_collection = require('./file_hrefs_from_collection');
const parse = require('../../../lib/parse');
const test = require('node:test');

test('file_hrefs_from_collection: the file: addresses of the links, as written', function () {
    const collection = parse(`% title: Jane Roe

Notes       file:///home/user/notes.txt
Web         https://example.com/
# Work
Spaced      #doc    file:///home/user/my%20notes.txt
Folder      file:///home/user/folder/
file:///home/user/bare.txt
Plain       http://example.com/file:///etc/hostname
`);
    assert.deepEqual([...file_hrefs_from_collection(collection)], [
        'file:///home/user/notes.txt',
        'file:///home/user/my%20notes.txt',
        'file:///home/user/folder/',
        'file:///home/user/bare.txt',
    ]);
});

test('file_hrefs_from_collection: an address listed twice is there once', function () {
    const collection = parse(`One file:///home/user/notes.txt
Two file:///home/user/notes.txt
`);
    assert.equal(file_hrefs_from_collection(collection).size, 1);
});

test('file_hrefs_from_collection: a collection with no file: link gives an empty set', function () {
    assert.equal(file_hrefs_from_collection(parse('Web https://example.com/\n')).size, 0);
    assert.equal(file_hrefs_from_collection(parse('')).size, 0);
});

test('file_hrefs_from_collection: a link `% ns:` filters out is not there', function () {
    const collection = parse(`% ns: Work

# Work
Notes   file:///home/user/notes.txt

# Personal
Diary   file:///home/user/diary.txt
`);
    assert.deepEqual([...file_hrefs_from_collection(collection)], ['file:///home/user/notes.txt']);
});

test('file_hrefs_from_collection: the set is of the collection given, not of what is added to its copy later', function () {
    const own = parse('Notes file:///home/user/notes.txt\n');
    const pulled = parse('Evil file:///etc/hostname\n');
    const file_hrefs = file_hrefs_from_collection(own);
    const resolved = {meta: own.meta, items: [own.items, pulled.items].flat()};
    assert.equal(resolved.items.length, 2);
    assert.equal(file_hrefs.has('file:///home/user/notes.txt'), true);
    assert.equal(file_hrefs.has('file:///etc/hostname'), false);
});

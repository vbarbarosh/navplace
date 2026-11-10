const assert = require('node:assert/strict');
const private_paths_from_url = require('./private_paths_from_url');
const test = require('node:test');

test('private_paths_from_url: a plain name is the path', function () {
    assert.deepEqual(private_paths_from_url('private://photo.png'), ['photo.png']);
    assert.deepEqual(private_paths_from_url('private://pictures/2026/photo.png'), ['pictures/2026/photo.png']);
});

test('private_paths_from_url: what the browser escaped is undone, the name as it came second', function () {
    assert.deepEqual(private_paths_from_url('private://my%20photo.png'), ['my photo.png', 'my%20photo.png']);
    assert.deepEqual(private_paths_from_url('private://%D1%84%D0%BE%D1%82%D0%BE.png'), ['фото.png', '%D1%84%D0%BE%D1%82%D0%BE.png']);
});

test('private_paths_from_url: a percent sign of the name itself is no escape', function () {
    assert.deepEqual(private_paths_from_url('private://50%.png'), ['50%.png']);
    assert.deepEqual(private_paths_from_url('private://100%zoom.png'), ['100%zoom.png']);
    assert.deepEqual(private_paths_from_url('private://50%%20off.png'), ['50% off.png', '50%%20off.png']);
});

test('private_paths_from_url: escapes that are no text stay as they are', function () {
    assert.deepEqual(private_paths_from_url('private://a%FFb.png'), ['a%FFb.png']);
});

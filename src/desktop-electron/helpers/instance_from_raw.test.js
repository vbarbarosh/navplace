const assert = require('node:assert/strict');
const instance_from_raw = require('./instance_from_raw');
const test = require('node:test');

test('instance_from_raw: a pid, a file and a version come back as they are', function () {
    assert.deepEqual(instance_from_raw({pid: 48213, appimage_file: '/opt/apps/NavPlace-1.4.3.AppImage', version: '1.4.3'}), {pid: 48213, appimage_file: '/opt/apps/NavPlace-1.4.3.AppImage', version: '1.4.3'});
});

test('instance_from_raw: a start from source has no file', function () {
    assert.deepEqual(instance_from_raw({pid: 48213, appimage_file: null, version: '1.4.3'}), {pid: 48213, appimage_file: null, version: '1.4.3'});
});

test('instance_from_raw: what else it holds is dropped', function () {
    assert.deepEqual(instance_from_raw({pid: 48213, appimage_file: null, version: '1.4.3', more: true}), {pid: 48213, appimage_file: null, version: '1.4.3'});
});

test('instance_from_raw: nothing, as a release before the takeover sends, is nobody', function () {
    for (const raw of [undefined, null, {}, [], '', 'text', 48213]) {
        assert.equal(instance_from_raw(raw), null, JSON.stringify(raw));
    }
});

test('instance_from_raw: a missing or wrong value is nobody', function () {
    const raws = [
        {appimage_file: null, version: '1.4.3'},
        {pid: '48213', appimage_file: null, version: '1.4.3'},
        {pid: 0, appimage_file: null, version: '1.4.3'},
        {pid: 1.5, appimage_file: null, version: '1.4.3'},
        {pid: 48213, version: '1.4.3'},
        {pid: 48213, appimage_file: '', version: '1.4.3'},
        {pid: 48213, appimage_file: 7, version: '1.4.3'},
        {pid: 48213, appimage_file: null},
        {pid: 48213, appimage_file: null, version: ''},
        {pid: 48213, appimage_file: null, version: 143},
    ];
    for (const raw of raws) {
        assert.equal(instance_from_raw(raw), null, JSON.stringify(raw));
    }
});

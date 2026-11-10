const assert = require('node:assert/strict');
const is_instance_takeover = require('./is_instance_takeover');
const test = require('node:test');

const MINE = {appimage_file: '/opt/downloads/NavPlace-1.4.3.AppImage', version: '1.4.3'};

test('is_instance_takeover: the same file and version only summons', function () {
    assert.equal(is_instance_takeover(MINE, {appimage_file: '/opt/downloads/NavPlace-1.4.3.AppImage', version: '1.4.3'}), false);
});

test('is_instance_takeover: another file takes over, of the same version too', function () {
    assert.equal(is_instance_takeover(MINE, {appimage_file: '/opt/apps/NavPlace-1.4.2.AppImage', version: '1.4.2'}), true);
    assert.equal(is_instance_takeover(MINE, {appimage_file: '/opt/apps/NavPlace-1.4.3.AppImage', version: '1.4.3'}), true);
});

test('is_instance_takeover: another version under the same name takes over', function () {
    assert.equal(is_instance_takeover(MINE, {appimage_file: '/opt/downloads/NavPlace-1.4.3.AppImage', version: '1.4.2'}), true);
});

test('is_instance_takeover: a running one that could not tell its version is another version', function () {
    assert.equal(is_instance_takeover(MINE, {appimage_file: '/opt/downloads/NavPlace-1.4.3.AppImage', version: null}), true);
    assert.equal(is_instance_takeover(MINE, {appimage_file: '/opt/apps/NavPlace-1.4.2.AppImage', version: null}), true);
});

test('is_instance_takeover: an AppImage and a start from source take over from each other', function () {
    assert.equal(is_instance_takeover(MINE, {appimage_file: null, version: '1.4.3'}), true);
    assert.equal(is_instance_takeover({appimage_file: null, version: '1.4.3'}, MINE), true);
});

test('is_instance_takeover: two starts from source of one version only summon', function () {
    assert.equal(is_instance_takeover({appimage_file: null, version: '1.4.3'}, {appimage_file: null, version: '1.4.3'}), false);
    assert.equal(is_instance_takeover({appimage_file: null, version: '1.4.3'}, {appimage_file: null, version: '1.4.2'}), true);
});

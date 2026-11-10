const appimage_target_from_entry = require('./appimage_target_from_entry');
const assert = require('node:assert/strict');
const test = require('node:test');

test('appimage_target_from_entry: the folder of the previous version, the name of the running file', function () {
    assert.equal(appimage_target_from_entry('/opt/downloads/NavPlace-1.4.3.AppImage', '/opt/apps/NavPlace-1.4.2.AppImage'), '/opt/apps/NavPlace-1.4.3.AppImage');
});

test('appimage_target_from_entry: a name with spaces and brackets is kept as it is', function () {
    assert.equal(appimage_target_from_entry('/opt/downloads/NavPlace-1.4.3 (1).AppImage', '/opt/My Apps/NavPlace.AppImage'), '/opt/My Apps/NavPlace-1.4.3 (1).AppImage');
});

test('appimage_target_from_entry: two files of one name give the path of the previous one', function () {
    assert.equal(appimage_target_from_entry('/opt/downloads/NavPlace.AppImage', '/opt/apps/NavPlace.AppImage'), '/opt/apps/NavPlace.AppImage');
});

test('appimage_target_from_entry: a previous version at the root of the disk', function () {
    assert.equal(appimage_target_from_entry('/opt/downloads/NavPlace-1.4.3.AppImage', '/NavPlace-1.4.2.AppImage'), '/NavPlace-1.4.3.AppImage');
});

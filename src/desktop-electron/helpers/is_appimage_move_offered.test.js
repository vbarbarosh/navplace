const assert = require('node:assert/strict');
const is_appimage_move_offered = require('./is_appimage_move_offered');
const test = require('node:test');

const FACTS = {
    appimage_file: '/opt/downloads/NavPlace-1.4.3.AppImage',
    entry_file: '/opt/apps/NavPlace-1.4.2.AppImage',
    is_same_dir: false,
    is_dir_writable: true,
    is_background: false,
};

test('is_appimage_move_offered: started from another folder than the version it replaces', function () {
    assert.equal(is_appimage_move_offered(FACTS), true);
});

test('is_appimage_move_offered: never at a start in the background', function () {
    assert.equal(is_appimage_move_offered({...FACTS, is_background: true}), false);
});

test('is_appimage_move_offered: no previous entry, nothing to move beside', function () {
    assert.equal(is_appimage_move_offered({...FACTS, entry_file: null}), false);
});

test('is_appimage_move_offered: an entry that starts the running file asks nothing', function () {
    assert.equal(is_appimage_move_offered({...FACTS, entry_file: FACTS.appimage_file, is_same_dir: true}), false);
    assert.equal(is_appimage_move_offered({...FACTS, entry_file: FACTS.appimage_file}), false);
});

test('is_appimage_move_offered: another file in the same folder stays where it is', function () {
    assert.equal(is_appimage_move_offered({...FACTS, entry_file: '/opt/downloads/NavPlace-1.4.2.AppImage', is_same_dir: true}), false);
});

test('is_appimage_move_offered: a folder that cannot be written to is not offered', function () {
    assert.equal(is_appimage_move_offered({...FACTS, is_dir_writable: false}), false);
});

test('is_appimage_move_offered: an entry that starts a program by its name names no folder', function () {
    assert.equal(is_appimage_move_offered({...FACTS, entry_file: 'navplace'}), false);
});

test('is_appimage_move_offered: a start from no AppImage has nothing to move', function () {
    assert.equal(is_appimage_move_offered({...FACTS, appimage_file: null}), false);
});

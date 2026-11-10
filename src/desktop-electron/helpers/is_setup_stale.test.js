const assert = require('node:assert/strict');
const is_setup_stale = require('./is_setup_stale');
const test = require('node:test');

const FACTS = {
    stamp: {version: '1.4.3', appimage_file: '/opt/apps/NavPlace-1.4.3.AppImage'},
    version: '1.4.3',
    appimage_file: '/opt/apps/NavPlace-1.4.3.AppImage',
    has_launcher: true,
    has_desktop_entry: true,
};

test('is_setup_stale: set up by this version for this file, nothing to carry over', function () {
    assert.equal(is_setup_stale(FACTS), false);
});

test('is_setup_stale: set up by another version', function () {
    assert.equal(is_setup_stale({...FACTS, stamp: {version: '1.4.2', appimage_file: '/opt/apps/NavPlace-1.4.3.AppImage'}}), true);
});

test('is_setup_stale: set up for another file, of the same version too', function () {
    assert.equal(is_setup_stale({...FACTS, stamp: {version: '1.4.3', appimage_file: '/opt/downloads/NavPlace-1.4.3.AppImage'}}), true);
});

test('is_setup_stale: no stamp, a setup by a release from before it, is another version', function () {
    assert.equal(is_setup_stale({...FACTS, stamp: null}), true);
});

test('is_setup_stale: never set up, nothing is set up behind the user back', function () {
    assert.equal(is_setup_stale({...FACTS, stamp: null, has_launcher: false, has_desktop_entry: false}), false);
});

test('is_setup_stale: one of the two files alone is no setup', function () {
    assert.equal(is_setup_stale({...FACTS, stamp: null, has_launcher: false}), false);
    assert.equal(is_setup_stale({...FACTS, stamp: null, has_desktop_entry: false}), false);
    assert.equal(is_setup_stale({...FACTS, stamp: {version: '1.4.2', appimage_file: '/opt/apps/NavPlace-1.4.2.AppImage'}, has_launcher: false}), false);
});

const assert = require('node:assert/strict');
const bar_from_start = require('./bar_from_start');
const test = require('node:test');

const NEW = '/home/u/bin/NavPlace-1.4.3.AppImage';
const OLD = '/home/u/Applications/NavPlace-1.1.3.AppImage';
const GNOME = {is_gnome: true, is_possible: true, is_set_up: true, hotkey: '<Ctrl><Shift><Alt>N', is_autostart: true};
const CARRIED = {launcher: 'written', hotkey: 'written', failures: [], stamp: null};
const FACTS = {gnome: GNOME, appimage_file: NEW, version: '1.4.3', hotkey: '<Ctrl><Shift><Alt>N', entry_before: NEW, entry_now: NEW, carried: null};

test('bar_from_start: set up for this copy, nothing carried over, no bar', function () {
    assert.equal(bar_from_start(FACTS), null);
});

test('bar_from_start: taken over from another AppImage, the bar names it', function () {
    assert.deepEqual(bar_from_start({...FACTS, entry_before: OLD, carried: CARRIED}), {kind: 'taken_over', hotkey: 'Ctrl+Shift+Alt+N', version: '1.4.3', before: 'NavPlace-1.1.3.AppImage'});
});

test('bar_from_start: taken over from another version of the same file, the bar names the version', function () {
    const carried = {...CARRIED, stamp: {version: '1.4.2', appimage_file: NEW}};
    assert.deepEqual(bar_from_start({...FACTS, carried}), {kind: 'taken_over', hotkey: 'Ctrl+Shift+Alt+N', version: '1.4.3', before: '1.4.2'});
});

test('bar_from_start: taken over from a setup with no stamp in the same file, nothing to name', function () {
    assert.equal(bar_from_start({...FACTS, carried: CARRIED}).before, null);
});

test('bar_from_start: the keys GNOME has, not the settings', function () {
    const gnome = {...GNOME, hotkey: '<Super>space'};
    assert.equal(bar_from_start({...FACTS, gnome, entry_before: OLD, carried: CARRIED}).hotkey, 'Super+space');
});

test('bar_from_start: never set up, Set up for the keys of the settings', function () {
    const gnome = {...GNOME, is_set_up: false, hotkey: null, is_autostart: false};
    assert.deepEqual(bar_from_start({...FACTS, gnome, entry_before: null, entry_now: null}), {kind: 'not_set_up', hotkey: 'Ctrl+Shift+Alt+N'});
});

test('bar_from_start: the cold start still runs another file, Set up', function () {
    assert.equal(bar_from_start({...FACTS, entry_before: OLD, entry_now: OLD, carried: CARRIED}).kind, 'not_set_up');
});

test('bar_from_start: a piece of the carrying over failed, Set up', function () {
    const carried = {...CARRIED, hotkey: 'failed', failures: [{piece: 'hotkey', reason: 'node was not found in PATH'}]};
    assert.equal(bar_from_start({...FACTS, entry_before: OLD, carried}).kind, 'not_set_up');
});

test('bar_from_start: not GNOME, or not an AppImage, no bar', function () {
    assert.equal(bar_from_start({...FACTS, gnome: {...GNOME, is_gnome: false, is_set_up: false}}), null);
    assert.equal(bar_from_start({...FACTS, gnome: {...GNOME, is_possible: false, is_set_up: false}}), null);
});

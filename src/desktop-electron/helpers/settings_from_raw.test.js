const assert = require('node:assert/strict');
const settings_from_raw = require('./settings_from_raw');
const test = require('node:test');

test('settings_from_raw: nothing saved gives the defaults', function () {
    assert.deepEqual(settings_from_raw(undefined), {zoom: 1.25, on_top: true, hide_on_blur: true, hotkey: '<Ctrl><Shift><Alt>N'});
});

test('settings_from_raw: good values are kept', function () {
    assert.deepEqual(settings_from_raw({zoom: 1.5, on_top: false, hide_on_blur: false, hotkey: '<Super>Space'}), {zoom: 1.5, on_top: false, hide_on_blur: false, hotkey: '<Super>Space'});
});

test('settings_from_raw: wrong values take their defaults', function () {
    assert.deepEqual(settings_from_raw({zoom: 3, on_top: 'yes', hide_on_blur: 0, hotkey: 'Ctrl+N'}), {zoom: 1.25, on_top: true, hide_on_blur: true, hotkey: '<Ctrl><Shift><Alt>N'});
});

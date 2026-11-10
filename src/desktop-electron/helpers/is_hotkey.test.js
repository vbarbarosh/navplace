const assert = require('node:assert/strict');
const is_hotkey = require('./is_hotkey');
const test = require('node:test');

test('is_hotkey: modifiers and one letter, digit or F key', function () {
    for (const text of ['<Ctrl><Shift><Alt>N', '<Super>k', '<Ctrl>7', '<Alt><Shift>F5', '<Ctrl><Alt><Super>F12']) {
        assert.equal(is_hotkey(text), true, text);
    }
});

test('is_hotkey: Shift alone, or no modifier, is no hotkey', function () {
    for (const text of ['<Shift>A', 'N', 'F5', '']) {
        assert.equal(is_hotkey(text), false, text);
    }
});

test('is_hotkey: a key that does not exist is no hotkey', function () {
    for (const text of ['<Ctrl>NotAKey', '<Ctrl>F13', '<Ctrl>F0', '<Ctrl>AB', '<Ctrl>', '<Ctrl>Enter', '<Ctrl>+']) {
        assert.equal(is_hotkey(text), false, text);
    }
});

test('is_hotkey: a modifier given twice, or one GNOME has not, is no hotkey', function () {
    for (const text of ['<Ctrl><Ctrl>N', '<Alt><Shift><Alt>N', '<Hyper>N', '<ctrl>N', 'Ctrl+N']) {
        assert.equal(is_hotkey(text), false, text);
    }
});

test('is_hotkey: what is no text is no hotkey', function () {
    for (const value of [undefined, null, 5, ['<Ctrl>N'], {}]) {
        assert.equal(is_hotkey(value), false);
    }
});

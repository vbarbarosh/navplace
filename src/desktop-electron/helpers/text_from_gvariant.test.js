const assert = require('node:assert/strict');
const test = require('node:test');
const text_from_gvariant = require('./text_from_gvariant');

test('text_from_gvariant: a string in single quotes, as dconf prints a hotkey', function () {
    assert.equal(text_from_gvariant("'<Ctrl><Shift><Alt>N'"), '<Ctrl><Shift><Alt>N');
    assert.equal(text_from_gvariant("'<Ctrl><Shift><Alt>N'\n"), '<Ctrl><Shift><Alt>N');
});

test('text_from_gvariant: a string in double quotes, as dconf prints one that holds a single quote', function () {
    assert.equal(text_from_gvariant(`"/opt/it's mine/launcher.js"`), "/opt/it's mine/launcher.js");
});

test('text_from_gvariant: a backslash, a quote and a line break come out of their escapes', function () {
    assert.equal(text_from_gvariant("'a\\\\b'"), 'a\\b');
    assert.equal(text_from_gvariant("'it\\'s'"), "it's");
    assert.equal(text_from_gvariant('"say \\"hi\\""'), 'say "hi"');
    assert.equal(text_from_gvariant("'a\\nb\\tc'"), 'a\nb\tc');
});

test('text_from_gvariant: an empty string is a text, an empty answer is not', function () {
    assert.equal(text_from_gvariant("''"), '');
    assert.equal(text_from_gvariant(''), null);
    assert.equal(text_from_gvariant('\n'), null);
});

test('text_from_gvariant: a value that is not one string gives null', function () {
    for (const value of ["['a', 'b']", '@as []', 'true', '42', "'a' 'b'", "'open", 'bare']) {
        assert.equal(text_from_gvariant(value), null, value);
    }
});

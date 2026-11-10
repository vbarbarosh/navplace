const assert = require('node:assert/strict');
const log_value_from_text = require('./log_value_from_text');
const test = require('node:test');

test('log_value_from_text: a plain word is written as it is', function () {
    for (const text of ['/opt/apps/NavPlace-1.4.3.AppImage', '1.4.3', 'a=b', "it's", '(1)', '~/x', '100%']) {
        assert.equal(log_value_from_text(text), text);
    }
});

test('log_value_from_text: a space, a quote, a backslash or a square bracket gets JSON quotes', function () {
    assert.equal(log_value_from_text('/opt/My Apps/NavPlace (1).AppImage'), '"/opt/My Apps/NavPlace (1).AppImage"');
    assert.equal(log_value_from_text('say "hi"'), '"say \\"hi\\""');
    assert.equal(log_value_from_text('a\\b'), '"a\\\\b"');
    assert.equal(log_value_from_text('[tag]'), '"[tag]"');
    assert.equal(log_value_from_text('a]'), '"a]"');
});

test('log_value_from_text: a line break and a letter outside ASCII never leave the line bare', function () {
    assert.equal(log_value_from_text('a\nb'), '"a\\nb"');
    assert.equal(log_value_from_text('/opt/café.AppImage'), '"/opt/café.AppImage"');
});

test('log_value_from_text: an empty text is a pair of quotes', function () {
    assert.equal(log_value_from_text(''), '""');
});

test('log_value_from_text: what is not a text is compact JSON', function () {
    assert.equal(log_value_from_text(null), 'null');
    assert.equal(log_value_from_text(true), 'true');
    assert.equal(log_value_from_text(48213), '48213');
});

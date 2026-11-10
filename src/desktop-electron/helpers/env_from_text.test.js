const assert = require('node:assert/strict');
const env_from_text = require('./env_from_text');
const test = require('node:test');

test('env_from_text: each part is a name and its value', function () {
    assert.deepEqual(env_from_text('HOME=/home/user\0APPIMAGE=/opt/apps/NavPlace-1.4.3.AppImage\0'), {HOME: '/home/user', APPIMAGE: '/opt/apps/NavPlace-1.4.3.AppImage'});
});

test('env_from_text: a value keeps its own equal signs, spaces and line breaks', function () {
    assert.deepEqual(env_from_text('A=b=c\0B=two words\0C=line\nbreak\0D=\0'), {A: 'b=c', B: 'two words', C: 'line\nbreak', D: ''});
});

test('env_from_text: a part with no name is left out', function () {
    assert.deepEqual(env_from_text('plain\0=value\0\0A=1\0'), {A: '1'});
});

test('env_from_text: the first of two parts with one name counts', function () {
    assert.deepEqual(env_from_text('A=1\0A=2\0'), {A: '1'});
});

test('env_from_text: a name of Object.prototype is a name like any other', function () {
    assert.deepEqual(env_from_text('toString=1\0'), {toString: '1'});
    assert.equal(env_from_text('A=1\0').APPIMAGE, undefined);
});

test('env_from_text: an empty text is an empty environment', function () {
    assert.deepEqual(env_from_text(''), {});
});

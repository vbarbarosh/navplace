const assert = require('node:assert/strict');
const file_is_inside = require('./file_is_inside');
const test = require('node:test');

const DIR = '/opt/app/settings';

test('file_is_inside: a file of the folder, however deep, is inside', function () {
    for (const file of [
        'index.html',
        'img/logo.svg',
        './index.html',
        'img/../index.html',
        '/opt/app/settings/index.html',
        '/opt/app/settings/img/../index.html',
    ]) {
        assert.equal(file_is_inside(file, DIR), true, file);
    }
});

test('file_is_inside: `..` does not lead out', function () {
    for (const file of [
        '..',
        '../main.js',
        '../../../../etc/hostname',
        'img/../../main.js',
        '/opt/app/settings/../main.js',
    ]) {
        assert.equal(file_is_inside(file, DIR), false, file);
    }
});

test('file_is_inside: an encoded slash is a name while encoded, a way out once decoded', function () {
    assert.equal(file_is_inside('..%2F..%2Fetc%2Fhostname', DIR), true);
    assert.equal(file_is_inside(decodeURIComponent('..%2F..%2Fetc%2Fhostname'), DIR), false);
    assert.equal(file_is_inside(decodeURIComponent('%2Fetc%2Fhostname'), DIR), false);
});

test('file_is_inside: a folder beside it whose name starts the same is outside', function () {
    for (const file of [
        '../settings-evil/index.html',
        '/opt/app/settings-evil/index.html',
        '/opt/app/settings.html',
    ]) {
        assert.equal(file_is_inside(file, DIR), false, file);
    }
});

test('file_is_inside: an absolute path elsewhere is outside', function () {
    for (const file of [
        '/etc/hostname',
        '/',
        '/opt/app',
    ]) {
        assert.equal(file_is_inside(file, DIR), false, file);
    }
});

test('file_is_inside: an empty path is the folder itself, outside', function () {
    for (const file of [
        '',
        '.',
        'img/..',
        '/opt/app/settings',
        '/opt/app/settings/',
    ]) {
        assert.equal(file_is_inside(file, DIR), false, file);
    }
});

test('file_is_inside: the folder may end with a slash, or be the root', function () {
    assert.equal(file_is_inside('index.html', '/opt/app/settings/'), true);
    assert.equal(file_is_inside('../main.js', '/opt/app/settings/'), false);
    assert.equal(file_is_inside('/etc/hostname', '/'), true);
    assert.equal(file_is_inside('', '/'), false);
});

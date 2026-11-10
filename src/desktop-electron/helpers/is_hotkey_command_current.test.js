const assert = require('node:assert/strict');
const is_hotkey_command_current = require('./is_hotkey_command_current');
const test = require('node:test');

const LAUNCHER = '/opt/home/.config/navplace/launcher.js';

test('is_hotkey_command_current: node by its whole path, then the launcher', function () {
    assert.equal(is_hotkey_command_current(['/usr/bin/node', LAUNCHER], LAUNCHER), true);
    assert.equal(is_hotkey_command_current(['/opt/home/.nvm/versions/node/v22.11.0/bin/node', LAUNCHER], LAUNCHER), true);
});

test('is_hotkey_command_current: the launcher alone, as releases up to 1.4.2 wrote it, is not', function () {
    assert.equal(is_hotkey_command_current([LAUNCHER], LAUNCHER), false);
});

test('is_hotkey_command_current: a node found by the PATH is not', function () {
    assert.equal(is_hotkey_command_current(['node', LAUNCHER], LAUNCHER), false);
});

test('is_hotkey_command_current: another launcher, more arguments or none are not', function () {
    assert.equal(is_hotkey_command_current(['/usr/bin/node', '/opt/src/navplace/launcher.js'], LAUNCHER), false);
    assert.equal(is_hotkey_command_current(['/usr/bin/node', LAUNCHER, '--flag'], LAUNCHER), false);
    assert.equal(is_hotkey_command_current([], LAUNCHER), false);
});

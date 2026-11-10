const assert = require('node:assert/strict');
const gnome_setup_failure_text = require('./gnome_setup_failure_text');
const test = require('node:test');

test('gnome_setup_failure_text: a program that is not there is named', function () {
    const error = Object.assign(new Error('spawn dconf ENOENT'), {code: 'ENOENT', syscall: 'spawn dconf', path: 'dconf'});
    assert.equal(gnome_setup_failure_text(error), 'The setup needs dconf, which was not found.');
});

test('gnome_setup_failure_text: a file that could not be written, with the reason in plain words', function () {
    const error = Object.assign(new Error("EACCES: permission denied, open '/opt/home/.config/navplace/launcher.js'"), {code: 'EACCES', syscall: 'open', path: '/opt/home/.config/navplace/launcher.js'});
    assert.equal(gnome_setup_failure_text(error), 'The setup could not write /opt/home/.config/navplace/launcher.js: permission denied.');
});

test('gnome_setup_failure_text: dconf that refuses has its last words passed on', function () {
    const error = Object.assign(new Error('Process terminated with code 1 and signal null\nerror: Could not connect: Connection refused\n'), {exit_code: 1});
    assert.equal(gnome_setup_failure_text(error), "GNOME's settings did not take the hotkey. dconf said: error: Could not connect: Connection refused");
});

test('gnome_setup_failure_text: a program that ended with an error and said nothing keeps its message', function () {
    const error = Object.assign(new Error('Process terminated with code 1 and signal null'), {exit_code: 1});
    assert.equal(gnome_setup_failure_text(error), 'Process terminated with code 1 and signal null');
});

test('gnome_setup_failure_text: any other error gives its own message, on one line', function () {
    assert.equal(gnome_setup_failure_text(new Error('node was not found in PATH — the hotkey launcher needs Node.js.')), 'node was not found in PATH — the hotkey launcher needs Node.js.');
    assert.equal(gnome_setup_failure_text(new Error('first line\n  second line\n')), 'first line second line');
    assert.equal(gnome_setup_failure_text('plain text'), 'plain text');
});

test('gnome_setup_failure_text: a file that is missing is no write failure', function () {
    const error = Object.assign(new Error("ENOENT: no such file or directory, open '/opt/app/launcher.js'"), {code: 'ENOENT', syscall: 'open', path: '/opt/app/launcher.js'});
    assert.equal(gnome_setup_failure_text(error), "ENOENT: no such file or directory, open '/opt/app/launcher.js'");
});

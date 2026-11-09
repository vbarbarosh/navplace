const assert = require('node:assert/strict');
const start_failure_text = require('./start_failure_text');
const test = require('node:test');

const LINKS_STEP = {sentence: 'The links file could not be read', file: '/home/user/.navplace/README.md'};

test('start_failure_text: a links file that may not be read', function () {
    const error = Object.assign(new Error("EACCES: permission denied, open '/home/user/.navplace/README.md'"), {code: 'EACCES', syscall: 'open', start_step: LINKS_STEP});
    assert.equal(start_failure_text(error), 'The links file could not be read: permission denied.\n\n/home/user/.navplace/README.md');
});

test('start_failure_text: a folder where the links file should be, which the error itself does not name', function () {
    const error = Object.assign(new Error('EISDIR: illegal operation on a directory, read'), {code: 'EISDIR', syscall: 'read', start_step: LINKS_STEP});
    assert.equal(start_failure_text(error), 'The links file could not be read: it is a folder, not a file.\n\n/home/user/.navplace/README.md');
});

test('start_failure_text: a socket path longer than a unix socket takes', function () {
    const file = `/home/user/${'deep/'.repeat(20)}navplace/navplace.sock`;
    const error = Object.assign(new Error(`listen EINVAL: invalid argument ${file}`), {code: 'EINVAL', syscall: 'listen', address: file, start_step: {sentence: 'The socket the hotkey talks to could not be opened', file}});
    assert.equal(start_failure_text(error), `The socket the hotkey talks to could not be opened: its path is 133 bytes long, a socket takes 108 at most.\n\n${file}`);
});

test('start_failure_text: a socket that fails for another reason keeps the error own words', function () {
    const file = '/home/user/.config/navplace/navplace.sock';
    const error = Object.assign(new Error(`listen EINVAL: invalid argument ${file}`), {code: 'EINVAL', syscall: 'listen', address: file, start_step: {sentence: 'The socket the hotkey talks to could not be opened', file}});
    assert.equal(start_failure_text(error), `The socket the hotkey talks to could not be opened: listen EINVAL: invalid argument ${file}.\n\n${file}`);
});

test('start_failure_text: an error of no known step gives its message', function () {
    assert.equal(start_failure_text(new Error("ERR_FILE_NOT_FOUND (-6) loading 'navplace://app/designs/github/index.html'")), "ERR_FILE_NOT_FOUND (-6) loading 'navplace://app/designs/github/index.html'");
    assert.equal(start_failure_text('thrown text'), 'thrown text');
});

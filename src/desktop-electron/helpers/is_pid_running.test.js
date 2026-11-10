const assert = require('node:assert/strict');
const child_process = require('node:child_process');
const is_pid_running = require('./is_pid_running');
const test = require('node:test');

test('is_pid_running: this very process runs', function () {
    assert.equal(is_pid_running(process.pid), true);
});

test('is_pid_running: a process that has ended does not', function () {
    const ended = child_process.spawnSync(process.execPath, ['-e', '']);
    assert.equal(is_pid_running(ended.pid), false);
});

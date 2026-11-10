const assert = require('node:assert/strict');
const pid_from_lock_target = require('./pid_from_lock_target');
const test = require('node:test');

test('pid_from_lock_target: the pid after the machine name', function () {
    assert.equal(pid_from_lock_target('desk-48213', 'desk'), 48213);
});

test('pid_from_lock_target: a machine name with dashes and digits keeps them', function () {
    assert.equal(pid_from_lock_target('build-box-2-48213', 'build-box-2'), 48213);
    assert.equal(pid_from_lock_target('0a1b2c3d4e5f-805770', '0a1b2c3d4e5f'), 805770);
});

test('pid_from_lock_target: a lock of another machine gives no pid', function () {
    assert.equal(pid_from_lock_target('desk-48213', 'laptop'), null);
    assert.equal(pid_from_lock_target('build-box-2-48213', 'build-box'), null);
});

test('pid_from_lock_target: a text that is not a lock target gives no pid', function () {
    for (const target of ['', 'desk', 'desk-', 'desk-0', 'desk-012', 'desk-12a', 'desk-1.5', '-48213', '48213', null, undefined]) {
        assert.equal(pid_from_lock_target(target, 'desk'), null, String(target));
    }
});

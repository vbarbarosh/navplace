const assert = require('node:assert/strict');
const make_newest_gate = require('./make_newest_gate');
const test = require('node:test');

test('make_newest_gate: an older answer that comes after a newer one is dropped', function () {
    const gate = make_newest_gate();
    const older = gate.enter();
    const newer = gate.enter();
    assert.equal(newer.leave(), true);
    assert.equal(older.leave(), false);
});

test('make_newest_gate: answers that come in order all pass', function () {
    const gate = make_newest_gate();
    const older = gate.enter();
    const newer = gate.enter();
    assert.equal(older.leave(), true);
    assert.equal(newer.leave(), true);
});

test('make_newest_gate: only the call that began last is the newest', function () {
    const gate = make_newest_gate();
    const older = gate.enter();
    assert.equal(older.is_newest(), true);
    const newer = gate.enter();
    assert.deepEqual([older.number, newer.number], [1, 2]);
    assert.equal(older.is_newest(), false);
    assert.equal(newer.is_newest(), true);
});

test('make_newest_gate: a newer call that never answers keeps no older answer out', function () {
    const gate = make_newest_gate();
    const older = gate.enter();
    gate.enter();
    assert.equal(older.leave(), true);
});

test('make_newest_gate: two gates count apart', function () {
    const gate = make_newest_gate();
    const other = make_newest_gate();
    const older = gate.enter();
    other.enter().leave();
    assert.equal(other.enter().leave(), true);
    assert.equal(older.leave(), true);
});

const assert = require('node:assert/strict');
const test = require('node:test');
const version_compare = require('./version_compare');

test('version_compare: by numbers, not by letters', function () {
    assert.equal(version_compare('1.10.0', '1.9.0'), 1);
    assert.equal(version_compare('1.9.0', '1.10.0'), -1);
    assert.equal(version_compare('2.0.0', '1.99.99'), 1);
});

test('version_compare: the same version is the same', function () {
    assert.equal(version_compare('1.4.2', '1.4.2'), 0);
    assert.equal(version_compare('1.4', '1.4.0'), 0);
});

test('version_compare: what follows a plus sign takes no part', function () {
    assert.equal(version_compare('1.4.2', '1.4.2+master.20261110.abc1234'), 0);
    assert.equal(version_compare('1.4.3', '1.4.2+master.20261110.abc1234'), 1);
    assert.equal(version_compare('1.4.2+master.20261110.abc1234', '1.4.3'), -1);
});

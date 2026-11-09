const assert = require('node:assert/strict');
const exec_arg_from_text = require('./exec_arg_from_text');
const test = require('node:test');

test('exec_arg_from_text: a plain path is quoted too', function () {
    assert.equal(exec_arg_from_text('/usr/bin/node'), '"/usr/bin/node"');
});

test('exec_arg_from_text: a space and brackets stay inside the quotes', function () {
    assert.equal(exec_arg_from_text('/opt/NavPlace-1.4.2 (1).AppImage'), '"/opt/NavPlace-1.4.2 (1).AppImage"');
});

test('exec_arg_from_text: a double quote, a backtick, a dollar and a backslash get a backslash', function () {
    assert.equal(exec_arg_from_text('/opt/say "hi" `id` $HOME a\\b'), '"/opt/say \\"hi\\" \\`id\\` \\$HOME a\\\\b"');
});

test('exec_arg_from_text: a percent is doubled', function () {
    assert.equal(exec_arg_from_text('/opt/100%/node'), '"/opt/100%%/node"');
});

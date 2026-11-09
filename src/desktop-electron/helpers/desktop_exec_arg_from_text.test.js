const assert = require('node:assert/strict');
const desktop_exec_arg_from_text = require('./desktop_exec_arg_from_text');
const test = require('node:test');

test('desktop_exec_arg_from_text: a plain path is quoted too', function () {
    assert.equal(desktop_exec_arg_from_text('/opt/NavPlace.AppImage'), '"/opt/NavPlace.AppImage"');
});

test('desktop_exec_arg_from_text: a space and brackets stay inside the quotes', function () {
    assert.equal(desktop_exec_arg_from_text('/home/user/Downloads/NavPlace-1.4.2 (1).AppImage'), '"/home/user/Downloads/NavPlace-1.4.2 (1).AppImage"');
});

test('desktop_exec_arg_from_text: a percent is doubled', function () {
    assert.equal(desktop_exec_arg_from_text('/opt/100% NavPlace.AppImage'), '"/opt/100%% NavPlace.AppImage"');
});

test('desktop_exec_arg_from_text: a double quote, a backtick and a dollar get a backslash, itself doubled', function () {
    assert.equal(desktop_exec_arg_from_text('/opt/say "hi".AppImage'), '"/opt/say \\\\"hi\\\\".AppImage"');
    assert.equal(desktop_exec_arg_from_text('/opt/$HOME.AppImage'), '"/opt/\\\\$HOME.AppImage"');
    assert.equal(desktop_exec_arg_from_text('/opt/`id`.AppImage'), '"/opt/\\\\`id\\\\`.AppImage"');
});

test('desktop_exec_arg_from_text: a backslash becomes four', function () {
    assert.equal(desktop_exec_arg_from_text('/opt/a\\b.AppImage'), '"/opt/a\\\\\\\\b.AppImage"');
});

test('desktop_exec_arg_from_text: a line break never ends the line', function () {
    assert.equal(desktop_exec_arg_from_text('/opt/a\nb.AppImage'), '"/opt/a\\nb.AppImage"');
});

test('desktop_exec_arg_from_text: read back by the rules of the specification, every path is itself again', function () {
    const paths = [
        '/opt/NavPlace.AppImage',
        '/home/user/Downloads/NavPlace-1.4.2 (1).AppImage',
        '/opt/100% NavPlace.AppImage',
        '/opt/%f %U %%.AppImage',
        '/opt/say "hi".AppImage',
        '/opt/$HOME/${x}.AppImage',
        '/opt/`id`.AppImage',
        '/opt/a\\b\\\\c.AppImage',
        "/opt/it's <a> & b; ~ | * ? #.AppImage",
        '/opt/a\nb\tc.AppImage',
        '/opt/\\n \\s.AppImage',
    ];
    for (const path of paths) {
        assert.deepEqual(exec_args_parse(`${desktop_exec_arg_from_text(path)} --background`), [path, '--background']);
    }
});

// An Exec value read as the specification says: the escapes of a string value first, then
// arguments split at spaces, a quoted one taken whole with its backslashes undone, %% a percent
function exec_args_parse(value)
{
    const out = [];
    const text = value.replace(/\\([sntr\\])/g, (match, v) => ({s: ' ', n: '\n', t: '\t', r: '\r', '\\': '\\'})[v]);
    for (const [, quoted, bare] of text.matchAll(/"((?:[^"\\]|\\.)*)"|([^ ]+)/gs)) {
        const arg = (quoted === undefined) ? bare : quoted.replace(/\\(["`$\\])/g, '$1');
        assert.doesNotMatch(arg.replaceAll('%%', ''), /%/, 'a lone percent would be a field code');
        out.push(arg.replaceAll('%%', '%'));
    }
    return out;
}

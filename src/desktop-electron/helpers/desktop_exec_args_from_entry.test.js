const assert = require('node:assert/strict');
const desktop_entry_exec_set = require('./desktop_entry_exec_set');
const desktop_exec_arg_from_text = require('./desktop_exec_arg_from_text');
const desktop_exec_args_from_entry = require('./desktop_exec_args_from_entry');
const test = require('node:test');

const ENTRY = `[Desktop Entry]
Type=Application
Name=NavPlace
Exec=/opt/apps/NavPlace-1.4.1.AppImage --background
NoDisplay=true
`;

test('desktop_exec_args_from_entry: the program and its arguments, as written bare', function () {
    assert.deepEqual(desktop_exec_args_from_entry(ENTRY), ['/opt/apps/NavPlace-1.4.1.AppImage', '--background']);
});

test('desktop_exec_args_from_entry: a quoted program keeps its spaces and brackets', function () {
    assert.deepEqual(desktop_exec_args_from_entry('Exec="/opt/My Apps/NavPlace-1.4.2 (1).AppImage" --background\n'), ['/opt/My Apps/NavPlace-1.4.2 (1).AppImage', '--background']);
});

test('desktop_exec_args_from_entry: the escapes of a value, then those of a quoted argument, are undone', function () {
    assert.deepEqual(desktop_exec_args_from_entry('Exec="/opt/say \\\\"hi\\\\" \\\\$1 100%%.AppImage"\n'), ['/opt/say "hi" $1 100%.AppImage']);
    assert.deepEqual(desktop_exec_args_from_entry('Exec="/opt/a\\\\\\\\b.AppImage"\n'), ['/opt/a\\b.AppImage']);
    assert.deepEqual(desktop_exec_args_from_entry('Exec=/opt/a\\sb.AppImage\n'), ['/opt/a', 'b.AppImage']);
});

test('desktop_exec_args_from_entry: a field code is no argument of the entry', function () {
    assert.deepEqual(desktop_exec_args_from_entry('Exec=/usr/bin/editor %U\n'), ['/usr/bin/editor']);
    assert.deepEqual(desktop_exec_args_from_entry('Exec=/usr/bin/editor --new %f --tag=100%%\n'), ['/usr/bin/editor', '--new', '--tag=100%']);
});

test('desktop_exec_args_from_entry: the first Exec line of the file is the entry own one', function () {
    assert.deepEqual(desktop_exec_args_from_entry(`${ENTRY}\n[Desktop Action quit]\nExec=/opt/apps/other --quit\n`), ['/opt/apps/NavPlace-1.4.1.AppImage', '--background']);
});

test('desktop_exec_args_from_entry: a text with no Exec line, or an empty one, has no arguments', function () {
    assert.deepEqual(desktop_exec_args_from_entry('[Desktop Entry]\nName=NavPlace\n'), []);
    assert.deepEqual(desktop_exec_args_from_entry('[Desktop Entry]\nExec=\n'), []);
    assert.deepEqual(desktop_exec_args_from_entry(''), []);
});

test('desktop_exec_args_from_entry: what desktop_exec_arg_from_text and desktop_entry_exec_set wrote is read back', function () {
    const paths = [
        '/opt/NavPlace.AppImage',
        '/opt/Downloads/NavPlace-1.4.2 (1).AppImage',
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
        const text = desktop_entry_exec_set(ENTRY, `${desktop_exec_arg_from_text(path)} --background`);
        assert.deepEqual(desktop_exec_args_from_entry(text), [path, '--background']);
    }
});

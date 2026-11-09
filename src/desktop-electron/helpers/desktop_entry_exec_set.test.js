const assert = require('node:assert/strict');
const desktop_entry_exec_set = require('./desktop_entry_exec_set');
const test = require('node:test');

const ENTRY = `[Desktop Entry]
Type=Application
Name=NavPlace
Exec=/opt/NavPlace-1.4.1.AppImage --background
NoDisplay=true
X-GNOME-Autostart-enabled=false
`;

test('desktop_entry_exec_set: the Exec line changes, every other line stays', function () {
    assert.equal(desktop_entry_exec_set(ENTRY, '"/opt/NavPlace-1.4.2.AppImage" --background'), `[Desktop Entry]
Type=Application
Name=NavPlace
Exec="/opt/NavPlace-1.4.2.AppImage" --background
NoDisplay=true
X-GNOME-Autostart-enabled=false
`);
});

test('desktop_entry_exec_set: the same value gives the same text', function () {
    assert.equal(desktop_entry_exec_set(ENTRY, '/opt/NavPlace-1.4.1.AppImage --background'), ENTRY);
});

test('desktop_entry_exec_set: a dollar and backslashes in the value are taken as they are', function () {
    assert.equal(desktop_entry_exec_set('Exec=old\n', '"/opt/\\\\$& $1 $$.AppImage"'), 'Exec="/opt/\\\\$& $1 $$.AppImage"\n');
});

test('desktop_entry_exec_set: a text with no Exec line is left alone', function () {
    assert.equal(desktop_entry_exec_set('[Desktop Entry]\nName=NavPlace\n', '"/opt/NavPlace.AppImage"'), '[Desktop Entry]\nName=NavPlace\n');
});

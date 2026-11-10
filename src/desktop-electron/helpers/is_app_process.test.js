const assert = require('node:assert/strict');
const is_app_process = require('./is_app_process');
const test = require('node:test');

const ELECTRON = '/opt/src/navplace/node_modules/electron/dist/electron';
const APPIMAGE_ENVIRON = 'HOME=/opt/home\0APPDIR=/tmp/.mount_NavPlaAbCdEf\0APPIMAGE=/opt/apps/NavPlace-1.4.2.AppImage\0ARGV0=/opt/apps/NavPlace-1.4.2.AppImage\0';

test('is_app_process: the app started from its AppImage', function () {
    assert.equal(is_app_process({environ_text: APPIMAGE_ENVIRON, cmdline_text: '/tmp/.mount_NavPlaAbCdEf/navplace.orig\0--no-sandbox\0--background\0'}, ELECTRON), true);
});

test('is_app_process: a build from before the starter script, the program named navplace', function () {
    assert.equal(is_app_process({environ_text: APPIMAGE_ENVIRON, cmdline_text: '/tmp/.mount_NavPlaAbCdEf/navplace\0'}, ELECTRON), true);
});

test('is_app_process: the app started from source, by the same Electron', function () {
    assert.equal(is_app_process({environ_text: 'HOME=/opt/home\0', cmdline_text: `${ELECTRON}\0--no-sandbox\0/opt/src/navplace-old\0`}, ELECTRON), true);
});

test('is_app_process: another program of an AppImage is not the app', function () {
    const environ_text = 'APPDIR=/tmp/.mount_EditorAbCdEf\0APPIMAGE=/opt/apps/Editor.AppImage\0';
    assert.equal(is_app_process({environ_text, cmdline_text: '/tmp/.mount_EditorAbCdEf/editor\0--no-sandbox\0'}, ELECTRON), false);
    assert.equal(is_app_process({environ_text, cmdline_text: '/usr/bin/sleep\x00600\0'}, ELECTRON), false);
});

test('is_app_process: a program named navplace outside the AppImage folder is not the app', function () {
    assert.equal(is_app_process({environ_text: APPIMAGE_ENVIRON, cmdline_text: '/opt/other/navplace.orig\0'}, ELECTRON), false);
    assert.equal(is_app_process({environ_text: APPIMAGE_ENVIRON, cmdline_text: '/tmp/.mount_NavPlaAbCdEf/usr/navplace.orig\0'}, ELECTRON), false);
    assert.equal(is_app_process({environ_text: APPIMAGE_ENVIRON, cmdline_text: '/tmp/.mount_NavPlaAbCdEf-evil/navplace.orig\0'}, ELECTRON), false);
});

test('is_app_process: the AppImage variables alone prove nothing', function () {
    assert.equal(is_app_process({environ_text: APPIMAGE_ENVIRON, cmdline_text: '/usr/bin/sleep\x00600\0'}, ELECTRON), false);
    assert.equal(is_app_process({environ_text: APPIMAGE_ENVIRON, cmdline_text: '/bin/sh\0/tmp/.mount_NavPlaAbCdEf/navplace\0'}, ELECTRON), false);
});

test('is_app_process: the program alone proves nothing without the AppImage variables', function () {
    assert.equal(is_app_process({environ_text: 'HOME=/opt/home\0', cmdline_text: '/tmp/.mount_NavPlaAbCdEf/navplace.orig\0'}, ELECTRON), false);
    assert.equal(is_app_process({environ_text: 'APPIMAGE=/opt/apps/NavPlace-1.4.2.AppImage\0', cmdline_text: '/navplace.orig\0'}, ELECTRON), false);
    assert.equal(is_app_process({environ_text: 'APPDIR=/tmp/.mount_NavPlaAbCdEf\0', cmdline_text: '/tmp/.mount_NavPlaAbCdEf/navplace.orig\0'}, ELECTRON), false);
});

test('is_app_process: a process Electron starts for itself is not the app', function () {
    assert.equal(is_app_process({environ_text: APPIMAGE_ENVIRON, cmdline_text: '/tmp/.mount_NavPlaAbCdEf/navplace.orig\0--type=renderer\0--no-sandbox\0'}, ELECTRON), false);
    assert.equal(is_app_process({environ_text: '', cmdline_text: `${ELECTRON}\0--type=zygote\0`}, ELECTRON), false);
});

test('is_app_process: any other process is not the app', function () {
    assert.equal(is_app_process({environ_text: 'HOME=/opt/home\0', cmdline_text: '/usr/bin/sleep\x00600\0'}, ELECTRON), false);
    assert.equal(is_app_process({environ_text: 'HOME=/opt/home\0', cmdline_text: '/opt/other/node_modules/electron/dist/electron\0.\0'}, ELECTRON), false);
});

test('is_app_process: a process with no command line, a kernel thread or one that is gone, is not the app', function () {
    assert.equal(is_app_process({environ_text: '', cmdline_text: ''}, ELECTRON), false);
    assert.equal(is_app_process({environ_text: APPIMAGE_ENVIRON, cmdline_text: ''}, ''), false);
});

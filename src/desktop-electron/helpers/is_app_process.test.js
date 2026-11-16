const assert = require('node:assert/strict');
const is_app_process = require('./is_app_process');
const test = require('node:test');

const ELECTRON = '/opt/src/navplace/node_modules/electron/dist/electron';
const MOUNT = '/tmp/.mount_NavPlaAbCdEf';

test('is_app_process: the app started from its AppImage', function () {
    assert.equal(is_app_process({exe_file: `${MOUNT}/navplace.orig`, cmdline_text: `${MOUNT}/navplace.orig\0--no-sandbox\0--background\0`}, ELECTRON), true);
});

test('is_app_process: the app whose command line reads as one text, joined by spaces', function () {
    const cmdline_text = `${MOUNT}/navplace.orig --no-sandbox --no-sandbox\0\0\0\0`;
    assert.equal(is_app_process({exe_file: `${MOUNT}/navplace.orig`, cmdline_text}, ELECTRON), true);
});

test('is_app_process: the app from an AppImage unpacked by --appimage-extract-and-run', function () {
    assert.equal(is_app_process({exe_file: '/tmp/appimage_extracted_0123abcd/navplace.orig', cmdline_text: '/tmp/appimage_extracted_0123abcd/navplace.orig\0--no-sandbox\0'}, ELECTRON), true);
});

test('is_app_process: a build from before the starter script, the program named navplace', function () {
    assert.equal(is_app_process({exe_file: `${MOUNT}/navplace`, cmdline_text: `${MOUNT}/navplace\0`}, ELECTRON), true);
});

test('is_app_process: the app whose program file is gone since it started', function () {
    assert.equal(is_app_process({exe_file: '/tmp/appimage_extracted_0123abcd/navplace.orig (deleted)', cmdline_text: '/tmp/appimage_extracted_0123abcd/navplace.orig\0'}, ELECTRON), true);
    assert.equal(is_app_process({exe_file: `${ELECTRON} (deleted)`, cmdline_text: `${ELECTRON}\0.\0`}, ELECTRON), true);
});

test('is_app_process: the app started from source, by the same Electron', function () {
    assert.equal(is_app_process({exe_file: ELECTRON, cmdline_text: `${ELECTRON}\0--no-sandbox\0/opt/src/navplace-old\0`}, ELECTRON), true);
    assert.equal(is_app_process({exe_file: ELECTRON, cmdline_text: `${ELECTRON} --no-sandbox /opt/src/navplace-old\0`}, ELECTRON), true);
});

test('is_app_process: the program decides, not what the command line says it is', function () {
    assert.equal(is_app_process({exe_file: '/usr/bin/sleep', cmdline_text: `${MOUNT}/navplace.orig\0--no-sandbox\0`}, ELECTRON), false);
    assert.equal(is_app_process({exe_file: '/usr/bin/sleep', cmdline_text: `${ELECTRON}\0.\0`}, ELECTRON), false);
});

test('is_app_process: another program of an AppImage is not the app', function () {
    assert.equal(is_app_process({exe_file: '/tmp/.mount_EditorAbCdEf/editor', cmdline_text: '/tmp/.mount_EditorAbCdEf/editor\0--no-sandbox\0'}, ELECTRON), false);
    assert.equal(is_app_process({exe_file: '/tmp/.mount_EditorAbCdEf/navplace.orig.sh', cmdline_text: '/tmp/.mount_EditorAbCdEf/navplace.orig.sh\0'}, ELECTRON), false);
});

test('is_app_process: a process Electron starts for itself is not the app', function () {
    assert.equal(is_app_process({exe_file: `${MOUNT}/navplace.orig`, cmdline_text: `${MOUNT}/navplace.orig\0--type=renderer\0--no-sandbox\0`}, ELECTRON), false);
    assert.equal(is_app_process({exe_file: `${MOUNT}/navplace.orig`, cmdline_text: `${MOUNT}/navplace.orig --type=zygote --no-sandbox\0\0`}, ELECTRON), false);
    assert.equal(is_app_process({exe_file: ELECTRON, cmdline_text: `${ELECTRON}\0--type=zygote\0`}, ELECTRON), false);
});

test('is_app_process: any other process is not the app', function () {
    assert.equal(is_app_process({exe_file: '/usr/bin/sleep', cmdline_text: '/usr/bin/sleep\x00600\0'}, ELECTRON), false);
    assert.equal(is_app_process({exe_file: '/opt/other/node_modules/electron/dist/electron', cmdline_text: '/opt/other/node_modules/electron/dist/electron\0.\0'}, ELECTRON), false);
});

test('is_app_process: a process with no program, a kernel thread or one that is gone, is not the app', function () {
    assert.equal(is_app_process({exe_file: null, cmdline_text: ''}, ELECTRON), false);
    assert.equal(is_app_process({exe_file: '', cmdline_text: `${MOUNT}/navplace.orig\0`}, ''), false);
});

const assert = require('node:assert/strict');
const fs = require('node:fs');
const is_program_file = require('./is_program_file');
const test = require('node:test');

const FILE = fs.constants.S_IFREG;
const FOLDER = fs.constants.S_IFDIR;

test('is_program_file: a plain file with no execute bit is not one', function () {
    for (const file of [
        '/home/user/notes.txt',
        '/home/user/report.pdf',
        '/home/user/picture.png',
        '/home/user/README',
        '/home/user/archive.tar.gz',
        '/home/user/shell.sh.txt',
        '/home/user/desktop',
    ]) {
        assert.equal(is_program_file(file, FILE | 0o644), false, file);
        assert.equal(is_program_file(file, FILE | 0o600), false, file);
    }
});

test('is_program_file: a file with an execute bit is one, whoever may run it', function () {
    for (const mode of [0o755, 0o700, 0o744, 0o654, 0o645, 0o711]) {
        assert.equal(is_program_file('/home/user/notes.txt', FILE | mode), true, mode.toString(8));
        assert.equal(is_program_file('/home/user/tool', FILE | mode), true, mode.toString(8));
    }
});

test('is_program_file: a launcher, a script or an installer is one by its name alone', function () {
    for (const file of [
        '/home/user/evil.desktop',
        '/home/user/run.sh',
        '/home/user/tool.AppImage',
        '/home/user/TOOL.APPIMAGE',
        '/home/user/setup.run',
        '/home/user/script.py',
        '/home/user/script.pl',
        '/home/user/script.rb',
        '/home/user/tool.jar',
        '/home/user/setup.exe',
        '/home/user/setup.msi',
        '/home/user/start.bat',
        '/home/user/start.cmd',
        '/home/user/start.command',
        '/home/user/.desktop',
        '/home/user/my notes.desktop',
    ]) {
        assert.equal(is_program_file(file, FILE | 0o644), true, file);
    }
});

test('is_program_file: a folder is not one for the bits that let it be entered', function () {
    assert.equal(is_program_file('/home/user/folder', FOLDER | 0o755), false);
    assert.equal(is_program_file('/home/user/folder/', FOLDER | 0o755), false);
    assert.equal(is_program_file('/', FOLDER | 0o755), false);
});

test('is_program_file: a folder named as a program is one, with a slash at its end too', function () {
    assert.equal(is_program_file('/home/user/Tool.app', FOLDER | 0o755), true);
    assert.equal(is_program_file('/home/user/Tool.app/', FOLDER | 0o755), true);
});

test('is_program_file: a folder on the way named as a program does not make the file one', function () {
    assert.equal(is_program_file('/home/user/scripts.sh/notes.txt', FILE | 0o644), false);
    assert.equal(is_program_file('/home/user/Tool.app/readme.txt', FILE | 0o644), false);
});

test('is_program_file: the mode of a real file and of a real folder', function () {
    assert.equal(is_program_file(__filename, fs.statSync(__filename).mode), false);
    assert.equal(is_program_file(__dirname, fs.statSync(__dirname).mode), false);
    assert.equal(is_program_file(process.execPath, fs.statSync(process.execPath).mode), true);
});

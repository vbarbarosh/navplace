const appimage_move = require('./appimage_move');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

// A folder on another filesystem than the temporary one, where this machine has one: a memory disk
const OTHER_FS_DIR = '/dev/shm';

test('appimage_move: the file goes to its new name, the same file with its execute bit', async function (t) {
    const dir = await make_dir(t, os.tmpdir());
    const file = await make_appimage(path.join(dir, 'downloads/NavPlace-1.4.3.AppImage'));
    const target_file = path.join(dir, 'apps/NavPlace-1.4.3.AppImage');
    await fs.promises.mkdir(path.dirname(target_file));
    const before = await fs.promises.stat(file);
    await appimage_move(file, target_file);
    const after = await fs.promises.stat(target_file);
    assert.equal(fs.existsSync(file), false);
    assert.equal(after.ino, before.ino);
    assert.equal(after.mode & 0o777, 0o755);
    assert.equal(await fs.promises.readFile(target_file, 'utf8'), 'the image');
});

test('appimage_move: a name that is taken is never written over, and the file stays where it was', async function (t) {
    const dir = await make_dir(t, os.tmpdir());
    const file = await make_appimage(path.join(dir, 'downloads/NavPlace-1.4.3.AppImage'));
    const target_file = path.join(dir, 'apps/NavPlace-1.4.3.AppImage');
    await fs.promises.mkdir(path.dirname(target_file));
    await fs.promises.writeFile(target_file, 'another file');
    await assert.rejects(appimage_move(file, target_file), {code: 'EEXIST'});
    assert.equal(await fs.promises.readFile(target_file, 'utf8'), 'another file');
    assert.equal(await fs.promises.readFile(file, 'utf8'), 'the image');
});

test('appimage_move: a name taken by a link that leads nowhere is taken too', async function (t) {
    const dir = await make_dir(t, os.tmpdir());
    const file = await make_appimage(path.join(dir, 'downloads/NavPlace-1.4.3.AppImage'));
    const target_file = path.join(dir, 'apps/NavPlace-1.4.3.AppImage');
    await fs.promises.mkdir(path.dirname(target_file));
    await fs.promises.symlink(path.join(dir, 'gone'), target_file);
    await assert.rejects(appimage_move(file, target_file), {code: 'EEXIST'});
    assert.equal(await fs.promises.readlink(target_file), path.join(dir, 'gone'));
    assert.equal(fs.existsSync(file), true);
});

test('appimage_move: a folder that is not there fails, and the file stays where it was', async function (t) {
    const dir = await make_dir(t, os.tmpdir());
    const file = await make_appimage(path.join(dir, 'downloads/NavPlace-1.4.3.AppImage'));
    await assert.rejects(appimage_move(file, path.join(dir, 'apps/NavPlace-1.4.3.AppImage')), {code: 'ENOENT'});
    assert.equal(await fs.promises.readFile(file, 'utf8'), 'the image');
});

test('appimage_move: to another filesystem the file is copied, its execute bit kept, and removed', async function (t) {
    if (!await is_other_fs(OTHER_FS_DIR)) {
        t.skip(`${OTHER_FS_DIR} is not another filesystem here`);
        return;
    }
    const dir = await make_dir(t, os.tmpdir());
    const other_dir = await make_dir(t, OTHER_FS_DIR);
    const file = await make_appimage(path.join(dir, 'downloads/NavPlace-1.4.3.AppImage'));
    const target_file = path.join(other_dir, 'NavPlace-1.4.3.AppImage');
    await appimage_move(file, target_file);
    assert.equal(fs.existsSync(file), false);
    assert.equal((await fs.promises.stat(target_file)).mode & 0o777, 0o755);
    assert.equal(await fs.promises.readFile(target_file, 'utf8'), 'the image');
});

test('appimage_move: on another filesystem too a taken name is never written over', async function (t) {
    if (!await is_other_fs(OTHER_FS_DIR)) {
        t.skip(`${OTHER_FS_DIR} is not another filesystem here`);
        return;
    }
    const dir = await make_dir(t, os.tmpdir());
    const other_dir = await make_dir(t, OTHER_FS_DIR);
    const file = await make_appimage(path.join(dir, 'downloads/NavPlace-1.4.3.AppImage'));
    const target_file = path.join(other_dir, 'NavPlace-1.4.3.AppImage');
    await fs.promises.writeFile(target_file, 'another file');
    await assert.rejects(appimage_move(file, target_file), {code: 'EEXIST'});
    assert.equal(await fs.promises.readFile(target_file, 'utf8'), 'another file');
    assert.equal(await fs.promises.readFile(file, 'utf8'), 'the image');
});

// A folder of its own under `parent`, removed when the test ends
async function make_dir(t, parent)
{
    const out = await fs.promises.mkdtemp(path.join(parent, 'navplace-move-'));
    t.after(async function () {
        await fs.promises.rm(out, {recursive: true, force: true});
    });
    return out;
}

// A file that stands for an AppImage: a few bytes and the execute bit
async function make_appimage(file)
{
    await fs.promises.mkdir(path.dirname(file), {recursive: true});
    await fs.promises.writeFile(file, 'the image');
    await fs.promises.chmod(file, 0o755);
    return file;
}

async function is_other_fs(dir)
{
    try {
        return (await fs.promises.stat(dir)).dev !== (await fs.promises.stat(os.tmpdir())).dev;
    }
    catch {
        return false;
    }
}

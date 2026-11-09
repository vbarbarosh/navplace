const appimage_entries_repoint = require('./appimage_entries_repoint');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const DESKTOP = `[Desktop Entry]
Type=Application
Name=NavPlace
Exec=/opt/NavPlace-1.4.1.AppImage
Categories=Utility;
`;

const AUTOSTART = `[Desktop Entry]
Type=Application
Name=NavPlace
Exec=/opt/NavPlace-1.4.1.AppImage --background
NoDisplay=true
`;

test('appimage_entries_repoint: entries that name another file get the running one', async function () {
    await using entries = await make_entries({desktop: DESKTOP, autostart: AUTOSTART});
    const files = await appimage_entries_repoint({appimage_file: '/opt/NavPlace-1.4.2 (1).AppImage', desktop_file: entries.desktop_file, autostart_file: entries.autostart_file});
    assert.deepEqual(files, [entries.desktop_file, entries.autostart_file]);
    assert.equal(await fs.promises.readFile(entries.desktop_file, 'utf8'), DESKTOP.replace('/opt/NavPlace-1.4.1.AppImage', '"/opt/NavPlace-1.4.2 (1).AppImage"'));
    assert.equal(await fs.promises.readFile(entries.autostart_file, 'utf8'), AUTOSTART.replace('/opt/NavPlace-1.4.1.AppImage', '"/opt/NavPlace-1.4.2 (1).AppImage"'));
});

test('appimage_entries_repoint: entries that name the running file are not written', async function () {
    await using entries = await make_entries({desktop: DESKTOP, autostart: AUTOSTART});
    await appimage_entries_repoint({appimage_file: '/opt/NavPlace-1.4.2.AppImage', desktop_file: entries.desktop_file, autostart_file: entries.autostart_file});
    const past = new Date(Date.now() - 60000);
    await fs.promises.utimes(entries.desktop_file, past, past);
    await fs.promises.utimes(entries.autostart_file, past, past);
    const files = await appimage_entries_repoint({appimage_file: '/opt/NavPlace-1.4.2.AppImage', desktop_file: entries.desktop_file, autostart_file: entries.autostart_file});
    assert.deepEqual(files, []);
    assert.equal((await fs.promises.stat(entries.desktop_file)).mtimeMs, past.getTime());
    assert.equal((await fs.promises.stat(entries.autostart_file)).mtimeMs, past.getTime());
});

test('appimage_entries_repoint: a login entry that is not there stays away', async function () {
    await using entries = await make_entries({desktop: DESKTOP, autostart: null});
    const files = await appimage_entries_repoint({appimage_file: '/opt/NavPlace-1.4.2.AppImage', desktop_file: entries.desktop_file, autostart_file: entries.autostart_file});
    assert.deepEqual(files, [entries.desktop_file]);
    assert.deepEqual(await fs.promises.readdir(entries.dir), ['navplace.desktop']);
});

test('appimage_entries_repoint: with no entry at all nothing is made', async function () {
    await using entries = await make_entries({desktop: null, autostart: null});
    const files = await appimage_entries_repoint({appimage_file: '/opt/NavPlace-1.4.2.AppImage', desktop_file: entries.desktop_file, autostart_file: entries.autostart_file});
    assert.deepEqual(files, []);
    assert.deepEqual(await fs.promises.readdir(entries.dir), []);
});

// A folder of its own with the two entries, each written when its text is given
async function make_entries({desktop, autostart})
{
    const dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'navplace-entries-'));
    const out = {
        dir,
        desktop_file: path.join(dir, 'navplace.desktop'),
        autostart_file: path.join(dir, 'autostart.desktop'),
        [Symbol.asyncDispose]: async function () {
            await fs.promises.rm(dir, {recursive: true, force: true});
        },
    };
    if (desktop !== null) {
        await fs.promises.writeFile(out.desktop_file, desktop);
    }
    if (autostart !== null) {
        await fs.promises.writeFile(out.autostart_file, autostart);
    }
    return out;
}

const assert = require('node:assert/strict');
const fs = require('node:fs');
const gnome_hotkey_read = require('./gnome_hotkey_read');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const BASE = '/org/gnome/settings-daemon/plugins/media-keys/custom-keybindings';

// A dconf that answers `read` from three variables of the environment, one a key
const DCONF = `#!/bin/sh
case "$2" in
${BASE}) printf '%s\\n' "$DCONF_TEST_LIST" ;;
${BASE}/navplace/binding) printf '%s\\n' "$DCONF_TEST_BINDING" ;;
${BASE}/navplace/command) printf '%s\\n' "$DCONF_TEST_COMMAND" ;;
*) exit 1 ;;
esac
`;

test('gnome_hotkey_read: the keys and the command of the shortcut', async function (t) {
    await make_dconf(t, {list: `['${BASE}/navplace/']`, binding: "'<Ctrl><Shift><Alt>N'", command: `'"/usr/bin/node" "/opt/home/.config/navplace/launcher.js"'`});
    assert.deepEqual(await gnome_hotkey_read(), {binding: '<Ctrl><Shift><Alt>N', command: `'"/usr/bin/node" "/opt/home/.config/navplace/launcher.js"'`});
});

test('gnome_hotkey_read: a shortcut among others, in a list dconf prints with its type', async function (t) {
    await make_dconf(t, {list: `@as ['${BASE}/custom0/', '${BASE}/navplace/']`, binding: "'<Super>N'", command: "'/opt/home/.config/navplace/launcher.js'"});
    assert.deepEqual(await gnome_hotkey_read(), {binding: '<Super>N', command: "'/opt/home/.config/navplace/launcher.js'"});
});

test('gnome_hotkey_read: keys the user took off are an empty text', async function (t) {
    await make_dconf(t, {list: `['${BASE}/navplace/']`, binding: "''", command: "'/opt/home/.config/navplace/launcher.js'"});
    assert.equal((await gnome_hotkey_read()).binding, '');
    await make_dconf(t, {list: `['${BASE}/navplace/']`, binding: '', command: "'/opt/home/.config/navplace/launcher.js'"});
    assert.equal((await gnome_hotkey_read()).binding, '');
});

test('gnome_hotkey_read: a shortcut GNOME does not list is not there', async function (t) {
    await make_dconf(t, {list: `['${BASE}/custom0/']`, binding: "'<Ctrl><Shift><Alt>N'", command: "'/opt/home/.config/navplace/launcher.js'"});
    assert.equal(await gnome_hotkey_read(), null);
    await make_dconf(t, {list: '', binding: "'<Ctrl><Shift><Alt>N'", command: "'/opt/home/.config/navplace/launcher.js'"});
    assert.equal(await gnome_hotkey_read(), null);
    await make_dconf(t, {list: '@as []', binding: '', command: ''});
    assert.equal(await gnome_hotkey_read(), null);
});

test('gnome_hotkey_read: a listed shortcut with no command is not there', async function (t) {
    await make_dconf(t, {list: `['${BASE}/navplace/']`, binding: "'<Ctrl><Shift><Alt>N'", command: ''});
    assert.equal(await gnome_hotkey_read(), null);
});

test('gnome_hotkey_read: with no dconf it throws', async function (t) {
    const dir = await make_path_dir(t);
    process.env.PATH = dir;
    await assert.rejects(gnome_hotkey_read(), {code: 'ENOENT'});
});

// A dconf put first on PATH for the time of one test, answering with these three values
async function make_dconf(t, {list, binding, command})
{
    const dir = await make_path_dir(t);
    await fs.promises.writeFile(path.join(dir, 'dconf'), DCONF, {mode: 0o755});
    process.env.DCONF_TEST_LIST = list;
    process.env.DCONF_TEST_BINDING = binding;
    process.env.DCONF_TEST_COMMAND = command;
}

// An empty folder put first on PATH for the time of one test
async function make_path_dir(t)
{
    const path_before = process.env.PATH;
    const out = await fs.promises.realpath(await fs.promises.mkdtemp(path.join(os.tmpdir(), 'navplace-path-')));
    process.env.PATH = `${out}${path.delimiter}${path_before}`;
    t.after(async function () {
        process.env.PATH = path_before;
        await fs.promises.rm(out, {recursive: true, force: true});
    });
    return out;
}

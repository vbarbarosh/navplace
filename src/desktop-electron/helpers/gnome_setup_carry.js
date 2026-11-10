const config = require('../config');
const fs = require('fs');
const fs_exists = require('@vbarbarosh/node-helpers/src/fs_exists');
const fs_path_resolve = require('@vbarbarosh/node-helpers/src/fs_path_resolve');
const fs_read = require('@vbarbarosh/node-helpers/src/fs_read');
const fs_read_utf8 = require('@vbarbarosh/node-helpers/src/fs_read_utf8');
const fs_write = require('@vbarbarosh/node-helpers/src/fs_write');
const gnome_args_from_command = require('./gnome_args_from_command');
const gnome_hotkey_read = require('./gnome_hotkey_read');
const gnome_hotkey_set = require('./gnome_hotkey_set');
const is_hotkey_command_current = require('./is_hotkey_command_current');
const is_setup_stale = require('./is_setup_stale');
const node_bin_find = require('./node_bin_find');
const setup_stamp_from_raw = require('./setup_stamp_from_raw');
const setup_stamp_write = require('./setup_stamp_write');

// What --configure-gnome set up for the AppImage of before, set up again for the one that runs,
// at its start and with no question: the user did it by hand after every update. Only when the
// setup was done before, by another version or for another file (helpers/is_setup_stale.js), and
// only the pieces that are there:
//
// - the launcher copy is written again when it is not the app's own launcher.js;
// - the hotkey's command becomes node by its whole path and the launcher, as the setup writes
//   it today, when it is not that already (releases up to 1.4.2 wrote the launcher alone) or its
//   node is gone; the keys stay the ones dconf has, the user's own, and a shortcut the user
//   removed is not made again.
//
// The two entries are not touched here: appimage_entries_repoint points them at the running file,
// and a login entry the user switched off stays away.
//
// Returns null when there was nothing to carry over; else {launcher, hotkey, failures}: each
// piece `written`, `same`, `absent` or `failed`, and why, {piece, reason}. A piece that failed
// leaves the stamp unwritten, so the next start tries again.
async function gnome_setup_carry({version})
{
    const appimage_file = config.appimage_file;
    const has_launcher = await fs_exists(config.launcher_file);
    const has_desktop_entry = await fs_exists(config.desktop_file);
    if (!is_setup_stale({stamp: await stamp_read(), version, appimage_file, has_launcher, has_desktop_entry})) {
        return null;
    }

    const out = {launcher: 'failed', hotkey: 'failed', failures: []};
    try {
        out.launcher = await launcher_copy_refresh();
    }
    catch (error) {
        out.failures.push({piece: 'launcher', reason: error.message});
    }
    try {
        out.hotkey = await hotkey_command_refresh();
    }
    catch (error) {
        out.failures.push({piece: 'hotkey', reason: error.message});
    }
    if (!out.failures.length) {
        await setup_stamp_write({version, appimage_file});
    }
    return out;
}

async function stamp_read()
{
    try {
        return setup_stamp_from_raw(JSON.parse(await fs_read_utf8(config.setup_file)));
    }
    catch {
        return null;
    }
}

// The launcher copy made the app's own launcher.js again (read+write works across the asar boundary)
async function launcher_copy_refresh()
{
    const launcher = await fs_read(fs_path_resolve(__dirname, '../launcher.js'));
    if (launcher.equals(await fs_read(config.launcher_file))) {
        return 'same';
    }
    await fs_write(config.launcher_file, launcher);
    await fs.promises.chmod(config.launcher_file, 0o755);
    return 'written';
}

// The command of the GNOME shortcut made what the setup writes today, its keys kept. A command
// that is that already, with a node that is still there, is left alone: the app's own PATH may
// find another node than the terminal the setup ran in, or none
async function hotkey_command_refresh()
{
    const hotkey = await gnome_hotkey_read();
    if (!hotkey) {
        return 'absent';
    }
    const args = gnome_args_from_command(hotkey.command);
    if (is_hotkey_command_current(args, config.launcher_file) && await fs_exists(args[0])) {
        return 'same';
    }
    const node_bin = await node_bin_find();
    if (!node_bin) {
        throw new Error('node was not found in PATH: the hotkey keeps the command it has');
    }
    await gnome_hotkey_set(config.launcher_file, hotkey.binding, node_bin);
    return 'written';
}

module.exports = gnome_setup_carry;

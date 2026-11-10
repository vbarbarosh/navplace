const autostart_set = require('./autostart_set');
const config = require('../config');
const desktop_exec_arg_from_text = require('./desktop_exec_arg_from_text');
const fs = require('fs');
const fs_exists = require('@vbarbarosh/node-helpers/src/fs_exists');
const fs_mkdirp = require('@vbarbarosh/node-helpers/src/fs_mkdirp');
const fs_path_dirname = require('@vbarbarosh/node-helpers/src/fs_path_dirname');
const fs_path_join = require('@vbarbarosh/node-helpers/src/fs_path_join');
const fs_path_resolve = require('@vbarbarosh/node-helpers/src/fs_path_resolve');
const fs_read = require('@vbarbarosh/node-helpers/src/fs_read');
const fs_write = require('@vbarbarosh/node-helpers/src/fs_write');
const gnome_hotkey_set = require('./gnome_hotkey_set');
const node_bin_find = require('./node_bin_find');
const setup_stamp_write = require('./setup_stamp_write');

// Install the GNOME hotkey for the AppImage build, invoked as
// `NavPlace.AppImage --configure-gnome`; and start the app at login, hidden, so the
// hotkey finds it running instead of booting the AppImage.
//
// The launcher must live on disk OUTSIDE the bundle: the whole point of the
// socket architecture is that summoning the app never mounts/boots the AppImage.
// So we extract the (dependency-free) launcher next to the socket and bind the
// hotkey to it; the .desktop's Exec points back at the AppImage for cold start.
//
// `version`, the app's own, goes into the stamp with the AppImage's path: a later start of
// another version or file reads there that the setup is to be carried over (gnome_setup_carry).
//
// Returns {launcher_file, appimage_file, node_bin, autostart_file}; the caller reports success.
async function gnome_configure({hotkey, version})
{
    const appimage_file = config.appimage_file;
    if (!appimage_file) {
        throw new Error('--configure-gnome must be run from the AppImage (APPIMAGE is not set)');
    }

    // The hotkey runs the extracted launcher with node. It runs in the session, whose PATH is
    // not this terminal's (a node from nvm or fnm is on PATH in a shell only), so node is
    // found here and goes into the hotkey's command by its absolute path — check before
    // writing anything, fail fast if there is none.
    const node_bin = await node_bin_find();
    if (!node_bin) {
        throw new Error('node was not found in PATH — the hotkey launcher needs Node.js. Install it (or add it to PATH) and run --configure-gnome again.');
    }

    const launcher_file = config.launcher_file;
    const desktop_file = config.desktop_file;
    const autostart_file = config.autostart_file;

    await fs_mkdirp(config.user_data_dir);

    // 1. extract the dependency-free launcher (read+write works across the asar boundary)
    await fs_write(launcher_file, await fs_read(fs_path_resolve(__dirname, '../launcher.js')));
    await fs.promises.chmod(launcher_file, 0o755);

    // 2. extract the app icon (best-effort; the AppImage runtime exposes APPDIR)
    const icon = await icon_extract();

    await gnome_hotkey_set(launcher_file, hotkey, node_bin);

    // 3. .desktop -> the AppImage; `gtk-launch navplace` (the launcher's cold path) lands here
    await fs_mkdirp(fs_path_dirname(desktop_file));
    await fs_write(desktop_file, [
        '[Desktop Entry]',
        'Type=Application',
        'Name=NavPlace',
        'Comment=The fastest way to open your links',
        `Icon=${icon}`,
        `Exec=${desktop_exec_arg_from_text(appimage_file)}`,
        'Categories=Utility;',
        'StartupWMClass=NavPlace',
        '',
    ].join('\n'));

    // 4. at login: the AppImage with --background, its window hidden until the hotkey
    await autostart_set(true, {appimage_file, icon});

    // 5. the stamp: which version set this up, and for which file
    await setup_stamp_write({version, appimage_file});

    return {launcher_file, appimage_file, node_bin, autostart_file};
}

async function icon_extract()
{
    const appimage_mount_dir = config.appimage_mount_dir;
    if (!appimage_mount_dir) {
        return 'application-x-executable';
    }
    for (const name of ['navplace.png', '.DirIcon']) {
        const src = fs_path_join(appimage_mount_dir, name);
        if (await fs_exists(src)) {
            const dest = fs_path_join(config.user_data_dir, 'navplace.png');
            await fs_write(dest, await fs_read(src));
            return dest;
        }
    }
    return 'application-x-executable';
}

module.exports = gnome_configure;

const config = require('../config');
const desktop_exec_arg_from_text = require('./desktop_exec_arg_from_text');
const fs = require('fs');
const fs_exists = require('@vbarbarosh/node-helpers/src/fs_exists');
const fs_mkdirp = require('@vbarbarosh/node-helpers/src/fs_mkdirp');
const fs_path_dirname = require('@vbarbarosh/node-helpers/src/fs_path_dirname');
const fs_write = require('@vbarbarosh/node-helpers/src/fs_write');

// Start at login or not: GNOME starts every .desktop of $XDG_CONFIG_HOME/autostart at login, here the
// AppImage with --background, its window hidden until the hotkey
async function autostart_set(on, {appimage_file, icon})
{
    if (!on) {
        if (await fs_exists(config.autostart_file)) {
            await fs.promises.unlink(config.autostart_file);
        }
        return;
    }
    if (!appimage_file) {
        throw new Error('only the AppImage starts at login (APPIMAGE is not set)');
    }
    await fs_mkdirp(fs_path_dirname(config.autostart_file));
    await fs_write(config.autostart_file, [
        '[Desktop Entry]',
        'Type=Application',
        'Name=NavPlace',
        'Comment=Waits in the background for its hotkey',
        `Icon=${icon}`,
        `Exec=${desktop_exec_arg_from_text(appimage_file)} --background`,
        'NoDisplay=true',
        'X-GNOME-Autostart-enabled=true',
        '',
    ].join('\n'));
}

module.exports = autostart_set;

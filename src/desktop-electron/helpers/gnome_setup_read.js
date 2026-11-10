const config = require('../config');
const fs_exists = require('@vbarbarosh/node-helpers/src/fs_exists');
const gnome_hotkey_read = require('./gnome_hotkey_read');
const is_gnome_desktop = require('./is_gnome_desktop');

// The GNOME setup as it is at this moment, for the settings window: read from the desktop's
// name, the disk and dconf each time, kept nowhere.
//
// - is_gnome: the desktop is GNOME and has a dconf to ask; on any other the setup is not offered
// - is_possible: the app runs from an AppImage, which is what the setup starts
// - is_set_up: the launcher copy, the .desktop entry and the shortcut with its keys are all there
// - hotkey: the keys the shortcut has (`<Ctrl><Shift><Alt>N`), null when no keys start NavPlace
// - is_autostart: the login entry is there
async function gnome_setup_read()
{
    let hotkey = null;
    let is_gnome = is_gnome_desktop(process.env.XDG_CURRENT_DESKTOP);

    if (is_gnome) {
        try {
            hotkey = (await gnome_hotkey_read())?.binding || null;
        }
        catch (error) {
            is_gnome = (error.code !== 'ENOENT');
        }
    }
    const has_launcher = await fs_exists(config.launcher_file);
    const has_desktop_entry = await fs_exists(config.desktop_file);
    return {
        is_gnome,
        is_possible: !!config.appimage_file,
        is_set_up: has_launcher && has_desktop_entry && !!hotkey,
        hotkey,
        is_autostart: await fs_exists(config.autostart_file),
    };
}

module.exports = gnome_setup_read;

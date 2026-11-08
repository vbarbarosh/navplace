const command_run = require('./command_run');

// GNOME's custom shortcut `navplace`: `hotkey` (`<Ctrl><Shift><Alt>N`) runs the launcher
async function gnome_hotkey_set(launcher_file, hotkey)
{
    const base = '/org/gnome/settings-daemon/plugins/media-keys/custom-keybindings';
    const slot = `${base}/navplace/`;

    const raw = (await command_run(['dconf', 'read', base])).trim().replace(/^@as\s+/, '');
    const slots = raw ? JSON.parse(raw.replaceAll("'", '"')) : [];
    if (!slots.includes(slot)) {
        slots.push(slot);
        await command_run(['dconf', 'write', base, JSON.stringify(slots).replaceAll('"', "'")]);
    }

    await command_run(['dconf', 'load', '/'], [
        '[org/gnome/settings-daemon/plugins/media-keys/custom-keybindings/navplace]',
        `binding='${hotkey}'`,
        `command='${launcher_file}'`,
        "name='navplace'",
        '',
    ].join('\n'));
}

module.exports = gnome_hotkey_set;

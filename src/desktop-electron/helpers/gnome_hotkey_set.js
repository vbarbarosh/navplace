const command_run = require('./command_run');
const gnome_command_from_args = require('./gnome_command_from_args');

// GNOME's custom shortcut `navplace`: `hotkey` (`<Ctrl><Shift><Alt>N`) runs the launcher.
//
// With `node_bin`, as --configure-gnome finds it, the command is that node and the launcher,
// each by its absolute path: the session that runs it has not the PATH of a terminal. Without
// it, a hotkey changed in the settings window, the command the shortcut has is kept: the app's
// own PATH may find no node where the terminal's did. Only a shortcut with no command gets the
// launcher alone, started by its `env node` line.
async function gnome_hotkey_set(launcher_file, hotkey, node_bin = null)
{
    const base = '/org/gnome/settings-daemon/plugins/media-keys/custom-keybindings';
    const slot = `${base}/navplace/`;

    const raw = (await command_run(['dconf', 'read', base])).trim().replace(/^@as\s+/, '');
    const slots = raw ? JSON.parse(raw.replaceAll("'", '"')) : [];
    if (!slots.includes(slot)) {
        slots.push(slot);
        await command_run(['dconf', 'write', base, JSON.stringify(slots).replaceAll('"', "'")]);
    }

    const command_kept = node_bin ? '' : (await command_run(['dconf', 'read', `${slot}command`])).trim();
    const command = command_kept || gnome_command_from_args(node_bin ? [node_bin, launcher_file] : [launcher_file]);

    await command_run(['dconf', 'load', '/'], [
        '[org/gnome/settings-daemon/plugins/media-keys/custom-keybindings/navplace]',
        `binding='${hotkey}'`,
        `command=${command}`,
        "name='navplace'",
        '',
    ].join('\n'));
}

module.exports = gnome_hotkey_set;

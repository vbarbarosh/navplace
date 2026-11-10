const command_run = require('./command_run');
const text_from_gvariant = require('./text_from_gvariant');

const BASE = '/org/gnome/settings-daemon/plugins/media-keys/custom-keybindings';
const SLOT = `${BASE}/navplace/`;

// GNOME's custom shortcut `navplace` as dconf has it at this moment, the one gnome_hotkey_set
// writes: {binding, command}. `binding` is the keys as GNOME writes them (`<Ctrl><Shift><Alt>N`),
// an empty text when the user took the keys off; `command` is the value as dconf prints it, for
// gnome_args_from_command. null when there is no such shortcut: GNOME runs only the ones its
// list names, and one with no command runs nothing. Throws when dconf cannot be asked.
async function gnome_hotkey_read()
{
    const list = (await command_run(['dconf', 'read', BASE])).trim().replace(/^@as\s+/, '');
    const slots = list ? JSON.parse(list.replaceAll("'", '"')) : [];
    if (!slots.includes(SLOT)) {
        return null;
    }
    const command = (await command_run(['dconf', 'read', `${SLOT}command`])).trim();
    if (!command) {
        return null;
    }
    const binding = text_from_gvariant(await command_run(['dconf', 'read', `${SLOT}binding`])) ?? '';
    return {binding, command};
}

module.exports = gnome_hotkey_read;

const desktop_entry_exec_set = require('./desktop_entry_exec_set');
const desktop_exec_arg_from_text = require('./desktop_exec_arg_from_text');
const fs_read_utf8 = require('@vbarbarosh/node-helpers/src/fs_read_utf8');
const fs_write = require('@vbarbarosh/node-helpers/src/fs_write');

// After an update the AppImage is another file, and the two entries --configure-gnome wrote still
// start the old one, or nothing when it was deleted: the hotkey's cold start and the start at
// login. Each entry that is there gets the running file in its Exec line, as gnome_configure and
// autostart_set write it, and keeps its other lines; one that is not there stays away (login
// start switched off in the settings removes its entry). An entry that names the running file
// already is not written. Returns the files rewritten.
async function appimage_entries_repoint({appimage_file, desktop_file, autostart_file})
{
    const out = [];
    const exec = desktop_exec_arg_from_text(appimage_file);
    const entries = [
        {file: desktop_file, exec},
        {file: autostart_file, exec: `${exec} --background`},
    ];
    for (const entry of entries) {
        let text = null;
        try {
            text = await fs_read_utf8(entry.file);
        }
        catch {
            continue;
        }
        const next = desktop_entry_exec_set(text, entry.exec);
        if (next !== text) {
            await fs_write(entry.file, next);
            out.push(entry.file);
        }
    }
    return out;
}

module.exports = appimage_entries_repoint;

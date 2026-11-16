const path = require('path');

// The app's own program inside its AppImage: `navplace.orig` since afterPack.js put a starter
// script under the name `navplace`, and `navplace` in the builds before that
const PROGRAMS = ['navplace', 'navplace.orig'];

// What Linux adds to the target of /proc/<pid>/exe once the program's file is gone
const DELETED_SUFFIX = ' (deleted)';

// Whether a process is a running NavPlace, by the program Linux runs for it, the target of
// /proc/<pid>/exe, and its command line, /proc/<pid>/cmdline. It is asked before a process is
// told to end, so only a proof counts:
//
// - a start from an AppImage or a build: the program is the app's own, by its name;
// - a start from source: the program is `exec_file`, the very Electron that asks.
//
// Only the program proves: a process cannot change it. Its command line and environment it can,
// and a running NavPlace does: 1.4.2 on GNOME showed its command line as one text joined by
// spaces, with no AppImage variables (2026-11-16), and was never ended for a newer version.
// A process Electron starts for itself (`--type=renderer`, `--type=zygote`) is never the app, its
// command line joined or not.
function is_app_process({exe_file, cmdline_text}, exec_file)
{
    if (!exe_file || cmdline_text.split(/[\0 ]/).some(v => v.startsWith('--type='))) {
        return false;
    }
    const program = exe_file.endsWith(DELETED_SUFFIX) ? exe_file.slice(0, -DELETED_SUFFIX.length) : exe_file;
    return (program === exec_file) || PROGRAMS.includes(path.basename(program));
}

module.exports = is_app_process;

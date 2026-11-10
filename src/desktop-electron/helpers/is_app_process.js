const env_from_text = require('./env_from_text');
const path = require('path');

// The app's own program inside its AppImage: `navplace.orig` since afterPack.js put a starter
// script under the name `navplace`, and `navplace` in the builds before that
const PROGRAMS = ['navplace', 'navplace.orig'];

// Whether a process is a running NavPlace, by the two texts Linux keeps of it: /proc/<pid>/environ
// and /proc/<pid>/cmdline, their parts ended by a NUL. It is asked before a process is told to
// end, so only a proof counts:
//
// - a start from an AppImage: the environment has APPIMAGE and APPDIR, as the AppImage runtime
//   sets them, and the program is the app's own in that APPDIR;
// - a start from source: the program is `exec_file`, the very Electron that asks.
//
// A process Electron starts for itself (`--type=renderer`, `--type=zygote`) is never the app.
function is_app_process({environ_text, cmdline_text}, exec_file)
{
    const args = cmdline_text.split('\0');
    if (!args[0] || args.some(v => v.startsWith('--type='))) {
        return false;
    }
    if (args[0] === exec_file) {
        return true;
    }
    const env = env_from_text(environ_text);
    if (!env.APPIMAGE || !env.APPDIR) {
        return false;
    }
    return PROGRAMS.some(v => args[0] === path.join(env.APPDIR, v));
}

module.exports = is_app_process;

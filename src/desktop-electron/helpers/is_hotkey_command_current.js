const path = require('path');

// Whether the command of the GNOME shortcut, as its arguments, is the one the setup writes
// today: a node by its whole path, then the launcher copy. Releases up to 1.4.2 wrote the
// launcher alone, started by its `env node` line, which finds node only where the session's PATH
// has one. Whether that node is still there is the caller's to check.
function is_hotkey_command_current(args, launcher_file)
{
    return (args.length === 2) && path.isAbsolute(args[0]) && (args[1] === launcher_file);
}

module.exports = is_hotkey_command_current;

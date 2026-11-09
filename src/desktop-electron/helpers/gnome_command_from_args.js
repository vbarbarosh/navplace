const exec_arg_from_text = require('./exec_arg_from_text');

// The command of a GNOME custom shortcut, a program and its arguments, as `dconf load` takes
// it. GNOME reads the command as GLib reads a command line: each argument quoted by
// exec_arg_from_text. dconf wants the whole as a GVariant string: in single quotes, with `\`
// and `'` each behind a backslash.
//
//     ['/usr/bin/node', '/home/user/.config/navplace/launcher.js']
//     →   '"/usr/bin/node" "/home/user/.config/navplace/launcher.js"'
function gnome_command_from_args(args)
{
    const command = args.map(exec_arg_from_text).join(' ');
    return `'${command.replaceAll('\\', '\\\\').replaceAll("'", "\\'").replaceAll('\n', '\\n')}'`;
}

module.exports = gnome_command_from_args;

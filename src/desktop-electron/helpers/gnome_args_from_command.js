const text_from_gvariant = require('./text_from_gvariant');

// The program and the arguments of a GNOME custom shortcut's command, from the value `dconf
// read` prints for it: the other side of gnome_command_from_args. The GVariant string is undone,
// then the command is split as GLib splits a command line: at spaces, with text in double quotes
// taken whole and its `\"`, `` \` ``, `\$` and `\\` undone, text in single quotes taken as it is,
// a backslash outside quotes taking the next character, and `%%` read as a percent. A value that
// is no string, as of a shortcut that is not there, has no arguments.
//
//     '"/usr/bin/node" "/home/user/.config/navplace/launcher.js"'   →   ['/usr/bin/node', '/home/user/.config/navplace/launcher.js']
//     '/home/user/.config/navplace/launcher.js'                     →   ['/home/user/.config/navplace/launcher.js']
function gnome_args_from_command(value)
{
    const out = [];
    const text = text_from_gvariant(value);
    if (text === null) {
        return out;
    }
    for (const [word] of text.matchAll(/(?:[^\s"'\\]|\\.|"(?:[^"\\]|\\.)*"|'[^']*')+/gs)) {
        out.push(word.replace(/"((?:[^"\\]|\\.)*)"|'([^']*)'|\\(.)/gs, piece_unquote).replaceAll('%%', '%'));
    }
    return out;
}

// One piece of an argument without its quoting: "…", '…' or a character behind a backslash
function piece_unquote(piece, double_quoted, single_quoted, escaped)
{
    if (double_quoted !== undefined) {
        return double_quoted.replace(/\\(["`$\\])/g, '$1');
    }
    return single_quoted ?? escaped;
}

module.exports = gnome_args_from_command;

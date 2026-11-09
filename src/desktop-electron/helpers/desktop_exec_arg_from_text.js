const exec_arg_from_text = require('./exec_arg_from_text');

// One argument of the Exec line of a .desktop file, the program's path first of all, written by
// the Desktop Entry Specification ("The Exec key"): quoted by exec_arg_from_text, then the
// escapes of every string value of such a file, read before the quotes are: each backslash
// doubled once more, a line break as `\n`.
//
//     /opt/NavPlace-1.4.2 (1).AppImage   →   "/opt/NavPlace-1.4.2 (1).AppImage"
//     /opt/$1 100%.AppImage              →   "/opt/\\$1 100%%.AppImage"
function desktop_exec_arg_from_text(text)
{
    return exec_arg_from_text(text).replaceAll('\\', '\\\\').replaceAll('\n', '\\n').replaceAll('\r', '\\r').replaceAll('\t', '\\t');
}

module.exports = desktop_exec_arg_from_text;

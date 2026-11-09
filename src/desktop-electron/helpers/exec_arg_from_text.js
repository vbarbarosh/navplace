// One argument by the quoting rules of the Exec key (Desktop Entry Specification), which is also
// how GLib reads a command line, a GNOME shortcut's among them: always in double quotes, so
// a space or a bracket in it does not cut it in two, with `"`, `` ` ``, `$` and `\` inside each
// behind a backslash, and a percent doubled, or it would start a field code.
//
//     /opt/NavPlace-1.4.2 (1).AppImage   →   "/opt/NavPlace-1.4.2 (1).AppImage"
//     /opt/$1 100%.AppImage              →   "/opt/\$1 100%%.AppImage"
function exec_arg_from_text(text)
{
    return `"${text.replace(/["`$\\]/g, '\\$&').replaceAll('%', '%%')}"`;
}

module.exports = exec_arg_from_text;

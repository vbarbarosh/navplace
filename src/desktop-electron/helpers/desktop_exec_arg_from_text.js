// One argument of the Exec line of a .desktop file, the program's path first of all, written by
// the Desktop Entry Specification ("The Exec key"): always in double quotes, so a space or
// a bracket in it does not cut it in two, with `"`, `` ` ``, `$` and `\` inside each behind
// a backslash, and a percent doubled, or it would start a field code. Then the escapes of every
// string value of such a file, read before the quotes are: each backslash doubled once more,
// a line break as `\n`.
//
//     /opt/NavPlace-1.4.2 (1).AppImage   →   "/opt/NavPlace-1.4.2 (1).AppImage"
//     /opt/$1 100%.AppImage              →   "/opt/\\$1 100%%.AppImage"
function desktop_exec_arg_from_text(text)
{
    const quoted = `"${text.replace(/["`$\\]/g, '\\$&').replaceAll('%', '%%')}"`;
    return quoted.replaceAll('\\', '\\\\').replaceAll('\n', '\\n').replaceAll('\r', '\\r').replaceAll('\t', '\\t');
}

module.exports = desktop_exec_arg_from_text;

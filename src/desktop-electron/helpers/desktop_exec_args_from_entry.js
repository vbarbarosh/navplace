const UNESCAPED = {s: ' ', n: '\n', t: '\t', r: '\r', '\\': '\\'};

// The arguments of the Exec line of a .desktop file, the program first, read as the Desktop
// Entry Specification says ("The Exec key"), which is how desktop_exec_arg_from_text writes one:
// the escapes of a string value undone (`\\`, `\s`, `\n`, `\t`, `\r`), then the value split at
// spaces, an argument in double quotes taken whole with its `\"`, `` \` ``, `\$` and `\\`
// undone, and `%%` read as a percent. A field code (`%U`, `%f`), which stands for the files a
// start is given, is no argument of the entry itself and is left out. A text with no Exec line
// has no arguments.
//
//     Exec="/opt/NavPlace-1.4.2 (1).AppImage" --background   →   ['/opt/NavPlace-1.4.2 (1).AppImage', '--background']
function desktop_exec_args_from_entry(text)
{
    const out = [];
    const line = /^Exec=(.*)$/m.exec(text);
    if (!line) {
        return out;
    }
    const value = line[1].replace(/\\([sntr\\])/g, (match, v) => UNESCAPED[v]);
    for (const [, quoted, bare] of value.matchAll(/"((?:[^"\\]|\\.)*)"|([^ ]+)/gs)) {
        if (/^%[A-Za-z]$/.test(bare ?? '')) {
            continue;
        }
        const arg = (quoted === undefined) ? bare : quoted.replace(/\\(["`$\\])/g, '$1');
        out.push(arg.replaceAll('%%', '%'));
    }
    return out;
}

module.exports = desktop_exec_args_from_entry;

const UNESCAPED = {n: '\n', t: '\t', r: '\r'};

// The text of a GVariant string as `dconf read` prints one: in single quotes, or in double
// quotes when the text holds a single one, with `\\`, `\'`, `\"`, `\n` and `\t` behind a
// backslash. The other side of what gnome_command_from_args writes. null when the value is not
// one string: an empty answer, a key that is not set, or a list.
//
//     '<Ctrl><Shift><Alt>N'   →   <Ctrl><Shift><Alt>N
function text_from_gvariant(value)
{
    const match = /^'((?:[^'\\]|\\.)*)'$|^"((?:[^"\\]|\\.)*)"$/s.exec(value.trim());
    if (!match) {
        return null;
    }
    return (match[1] ?? match[2]).replace(/\\(.)/gs, (found, v) => UNESCAPED[v] ?? v);
}

module.exports = text_from_gvariant;

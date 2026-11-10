// Whether a text is a hotkey the settings window can set and GNOME can bind: modifiers in angle
// brackets, each once at most and Ctrl, Alt or Super among them (Shift alone only types a
// capital), then one key: a letter, a digit, or F1 to F12.
//
//     <Ctrl><Shift><Alt>N   →   true
//     <Shift>A              →   false
//     <Ctrl>NotAKey         →   false
function is_hotkey(text)
{
    const match = /^((?:<(?:Ctrl|Shift|Alt|Super)>)+)(?:[A-Za-z0-9]|F[1-9]|F1[0-2])$/.exec((typeof text === 'string') ? text : '');
    if (!match) {
        return false;
    }
    const modifiers = match[1].slice(1, -1).split('><');
    return (new Set(modifiers).size === modifiers.length) && modifiers.some(v => v !== 'Shift');
}

module.exports = is_hotkey;

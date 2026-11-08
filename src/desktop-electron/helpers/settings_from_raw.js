// What the settings window changes and the app keeps between runs (settings.json beside the socket),
// each value checked: a missing or wrong one takes its default
const ZOOMS = [1, 1.1, 1.25, 1.5, 1.75, 2];

function settings_from_raw(raw)
{
    return {
        zoom: ZOOMS.includes(raw?.zoom) ? raw.zoom : 1.25,
        on_top: (typeof raw?.on_top === 'boolean') ? raw.on_top : true,
        hide_on_blur: (typeof raw?.hide_on_blur === 'boolean') ? raw.hide_on_blur : true,
        // GNOME's accelerator: modifiers in angle brackets, then one key
        hotkey: /^(<(Ctrl|Shift|Alt|Super)>)+[A-Za-z0-9]+$/.test(raw?.hotkey ?? '') ? raw.hotkey : '<Ctrl><Shift><Alt>N',
    };
}

settings_from_raw.ZOOMS = ZOOMS;

module.exports = settings_from_raw;

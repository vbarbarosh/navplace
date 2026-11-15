const path = require('path');

// What the bar on top of the links window says once the start's setup steps are done, from what
// they left (main.js, bar_after_start). Only on GNOME and for an AppImage, which is what the
// setup starts (helpers/gnome_setup_read.js):
//
// - the hotkey does not open this copy: not set up, its cold start still runs another file, or
//   a piece of carrying it over failed: {kind: 'not_set_up', hotkey}, with a Set up button;
// - the start took the hotkey over from another version or file (helpers/gnome_setup_carry.js):
//   {kind: 'taken_over', hotkey, version, before}, said once, with OK. `before` is what the hotkey
//   opened: the other AppImage's name, else the other version, else null;
// - else null, no bar.
//
// `gnome` is gnome_setup_read's, `entry_before` and `entry_now` the program of the .desktop entry
// before and after the start pointed it here, `carried` gnome_setup_carry's, `hotkey` the keys of
// the app's settings, which Set up binds.
function bar_from_start({gnome, appimage_file, version, hotkey, entry_before, entry_now, carried})
{
    if (!gnome.is_gnome || !gnome.is_possible) {
        return null;
    }
    if (!gnome.is_set_up || (entry_now !== appimage_file) || carried?.failures.length) {
        return {kind: 'not_set_up', hotkey: hotkey_label(gnome.hotkey ?? hotkey)};
    }
    if (!carried) {
        return null;
    }
    return {kind: 'taken_over', hotkey: hotkey_label(gnome.hotkey), version, before: before_label(entry_before, appimage_file, carried.stamp, version)};
}

// GNOME's <Ctrl><Shift><Alt>N as people write it, Ctrl+Shift+Alt+N
function hotkey_label(hotkey)
{
    return hotkey.replace(/<(\w+)>/g, '$1+');
}

function before_label(entry_before, appimage_file, stamp, version)
{
    if (entry_before && (entry_before !== appimage_file)) {
        return path.basename(entry_before);
    }
    if (stamp && (stamp.version !== version)) {
        return stamp.version;
    }
    return null;
}

module.exports = bar_from_start;

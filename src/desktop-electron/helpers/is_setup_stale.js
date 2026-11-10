// Whether the GNOME setup must be carried over to the AppImage that runs: it was done before,
// and by another version or for another file. Done before means its two own files are there, the
// launcher copy and the .desktop entry: a machine that was never set up is not set up behind the
// user's back. `stamp` is {version, appimage_file} of the setup done last, null when there is
// none: an install set up by a release from before the stamp (1.4.2 and older), which is another
// version by that alone. So the setup is carried over once per new version or file, not at
// every start.
function is_setup_stale({stamp, version, appimage_file, has_launcher, has_desktop_entry})
{
    if (!has_launcher || !has_desktop_entry) {
        return false;
    }
    return !stamp || (stamp.version !== version) || (stamp.appimage_file !== appimage_file);
}

module.exports = is_setup_stale;

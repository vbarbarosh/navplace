// Which version did the GNOME setup last, and for which AppImage file: {version, appimage_file},
// from what stands in setup.json beside the launcher copy. null when it is not that: a file
// that is missing, cut short or written by hand, and an install set up by a release from before
// the stamp (1.4.2 and older), which wrote none.
function setup_stamp_from_raw(raw)
{
    if ((typeof raw?.version !== 'string') || !raw.version) {
        return null;
    }
    if ((typeof raw.appimage_file !== 'string') || !raw.appimage_file) {
        return null;
    }
    return {version: raw.version, appimage_file: raw.appimage_file};
}

module.exports = setup_stamp_from_raw;

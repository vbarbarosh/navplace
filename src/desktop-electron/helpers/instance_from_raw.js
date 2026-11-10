// Who an instance of the app says it is, {pid, appimage_file, version}: what a start hands the
// running instance through the single-instance lock, and what the running one keeps in
// instance.json for the next start to read. `appimage_file` is null when it runs from no
// AppImage. Each value is checked, as it comes from another process or from a file: null when
// one is missing or wrong, as from a release that knows none of this (1.4.2 and older).
function instance_from_raw(raw)
{
    if (!Number.isInteger(raw?.pid) || (raw.pid < 1)) {
        return null;
    }
    if ((typeof raw.version !== 'string') || !raw.version) {
        return null;
    }
    if ((raw.appimage_file !== null) && ((typeof raw.appimage_file !== 'string') || !raw.appimage_file)) {
        return null;
    }
    return {pid: raw.pid, appimage_file: raw.appimage_file, version: raw.version};
}

module.exports = instance_from_raw;

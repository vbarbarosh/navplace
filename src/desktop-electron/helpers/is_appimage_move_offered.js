const path = require('path');

// Whether a start offers to move its AppImage beside the version it replaces. `appimage_file` is
// the file that runs; `entry_file` the program the .desktop entry starts, read before the entry
// is pointed at the running file: the previous version, set up by --configure-gnome. The move is
// offered when that entry is there and starts another file, by a whole path, in another folder,
// one the file can be written to. Never at a start in the background, at login: nobody is there
// to answer. Once the entry starts the running file, moved or left where it is, nothing is asked.
function is_appimage_move_offered({appimage_file, entry_file, is_same_dir, is_dir_writable, is_background})
{
    if (is_background || !appimage_file || !entry_file) {
        return false;
    }
    if (!path.isAbsolute(entry_file) || (entry_file === appimage_file)) {
        return false;
    }
    return !is_same_dir && is_dir_writable;
}

module.exports = is_appimage_move_offered;

const path = require('path');

// Where the AppImage that runs goes when it is moved beside the version it replaces: the folder
// of `entry_file`, the program the .desktop entry starts, under the name `appimage_file` has now.
//
//     /opt/downloads/NavPlace-1.4.3.AppImage, /opt/apps/NavPlace-1.4.2.AppImage   →   /opt/apps/NavPlace-1.4.3.AppImage
function appimage_target_from_entry(appimage_file, entry_file)
{
    return path.join(path.dirname(entry_file), path.basename(appimage_file));
}

module.exports = appimage_target_from_entry;

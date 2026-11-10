// Whether a start takes the place of the instance that runs, or only brings its window up. It
// takes its place when the two are not the same AppImage file or not the same version: the user
// started another NavPlace on purpose. `mine` and `theirs` are {appimage_file, version}; a file
// is null for a start from no AppImage, a version is null when the other one could not tell it,
// a release from before the takeover (1.4.2 and older), which is another version by that alone.
//
//     /opt/apps/NavPlace-1.4.3.AppImage 1.4.3  vs  /opt/apps/NavPlace-1.4.2.AppImage 1.4.2   →   true
//     /opt/apps/NavPlace-1.4.3.AppImage 1.4.3  vs  the same file, the same version           →   false
function is_instance_takeover(mine, theirs)
{
    return (mine.appimage_file !== theirs.appimage_file) || (mine.version !== theirs.version);
}

module.exports = is_instance_takeover;

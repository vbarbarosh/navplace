const config = require('./index');

// The AppImage was moved while it runs (main.js, appimage_move_offer): from here on `file` is its
// place for everything that reads config.appimage_file, the two entries, the start at login and
// the GNOME setup among them. APPIMAGE of the environment, as the AppImage runtime set it at the
// start, names the place it left: it is brought along for the programs the app starts.
function config_appimage_file_set(file)
{
    config.appimage_file = file;
    process.env.APPIMAGE = file;
}

module.exports = config_appimage_file_set;

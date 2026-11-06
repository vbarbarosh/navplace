const fs_path_join = require('@vbarbarosh/node-helpers/src/fs_path_join');
const fs_path_resolve = require('@vbarbarosh/node-helpers/src/fs_path_resolve');
const make_config = require('./make_config');
const os = require('os');

function config_from_env()
{
    const config_dir = fs_path_resolve(os.homedir(), '.navplace');
    const user_data_dir = fs_path_resolve(process.env.XDG_CONFIG_HOME || fs_path_resolve(os.homedir(), '.config'), 'navplace');
    const data_home_dir = process.env.XDG_DATA_HOME || fs_path_join(os.homedir(), '.local', 'share');
    // The AppImage runtime sets both: the AppImage file and where it is mounted
    const appimage_file = process.env.APPIMAGE || null;
    const appimage_mount_dir = process.env.APPDIR || null;
    const is_wayland = process.env.XDG_SESSION_TYPE === 'wayland';
    return make_config({config_dir, user_data_dir, data_home_dir, appimage_file, appimage_mount_dir, is_wayland});
}

const config = config_from_env();

module.exports = config;

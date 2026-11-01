const fs_path_resolve = require('@vbarbarosh/node-helpers/src/fs_path_resolve');
const make_config = require('./make_config');
const os = require('os');

function init()
{
    const config_dir = fs_path_resolve(os.homedir(), '.navplace');
    const user_data_dir = fs_path_resolve(process.env.XDG_CONFIG_HOME || fs_path_resolve(os.homedir(), '.config'), 'navplace');
    return make_config({config_dir, user_data_dir});
}

module.exports = init();

const fs_path_resolve = require('@vbarbarosh/node-helpers/src/fs_path_resolve');
const make = require('@vbarbarosh/type-helpers');

function make_config(settings)
{
    const out = make(settings, {
        config_dir: {type: 'str'},
        user_data_dir: {type: 'str'},
        data_home_dir: {type: 'str'},
        appimage_file: {type: 'str', nullable: true},
        appimage_mount_dir: {type: 'str', nullable: true},
        is_wayland: {type: 'bool'},
        designs_dir: {type: 'null'},
        readme_file: {type: 'null'},
        socket_file: {type: 'null'},
    });

    out.designs_dir = fs_path_resolve(__dirname, '../../../designs');
    out.readme_file = fs_path_resolve(out.config_dir, 'README.md');
    out.socket_file = fs_path_resolve(out.user_data_dir, 'navplace.sock');

    return out;
}

module.exports = make_config;

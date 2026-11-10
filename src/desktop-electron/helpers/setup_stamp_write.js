const config = require('../config');
const fs_mkdirp = require('@vbarbarosh/node-helpers/src/fs_mkdirp');
const fs_write = require('@vbarbarosh/node-helpers/src/fs_write');

// Which version did the GNOME setup last, and for which AppImage file, kept in setup.json beside
// the launcher copy: a start reads it (helpers/setup_stamp_from_raw.js) and carries the setup
// over once per new version or file (helpers/gnome_setup_carry.js)
async function setup_stamp_write({version, appimage_file})
{
    await fs_mkdirp(config.user_data_dir);
    await fs_write(config.setup_file, `${JSON.stringify({version, appimage_file}, null, 4)}\n`);
}

module.exports = setup_stamp_write;

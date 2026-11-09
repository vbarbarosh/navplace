const command_run = require('./command_run');
const fs = require('fs');
const fs_path_resolve = require('@vbarbarosh/node-helpers/src/fs_path_resolve');

// The absolute path of the node this PATH finds, for a command that will run where the PATH is
// another one; null when there is none. `command -v` gives the PATH's own entry. When that is the
// binary or a link to it, the binary's real path is returned: fnm's entry is a link made for one
// shell, gone at logout. When it is a starter of its own, which finds the binary each time (snap,
// volta, asdf), the entry is returned: the binary it picks may move.
async function node_bin_find()
{
    try {
        const found = fs_path_resolve((await command_run(['sh', '-c', 'command -v node'])).trim());
        const real = (await command_run([found, '-p', 'process.execPath'])).trim();
        return ((await fs.promises.realpath(found)) === real) ? real : found;
    }
    catch {
        return null;
    }
}

module.exports = node_bin_find;

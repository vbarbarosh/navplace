const fs = require('fs');

// A hard link cannot be made: between two filesystems, or on one that has none
const NO_LINK_CODES = ['EXDEV', 'EPERM', 'ENOTSUP', 'EOPNOTSUPP', 'EMLINK'];

// Moves the AppImage `appimage_file` to `target_file`, and never over a file that is there. The
// new name is taken by a hard link, which fails on a taken name where a rename would replace the
// file, and the old name is removed after it. Where no link can be made the file is copied, to a
// free name only, with its mode: the execute bit stays. A failure leaves the file where it was,
// and nothing half-made at the target: a name that is taken throws with the code EEXIST.
//
// An AppImage that runs keeps running through it: its runtime holds the file open, and an open
// file stays whole under another name, and under none.
async function appimage_move(appimage_file, target_file)
{
    try {
        await fs.promises.link(appimage_file, target_file);
    }
    catch (error) {
        if (!NO_LINK_CODES.includes(error.code)) {
            throw error;
        }
        await file_copy(appimage_file, target_file);
    }
    try {
        await fs.promises.unlink(appimage_file);
    }
    catch (error) {
        await fs.promises.unlink(target_file);
        throw error;
    }
}

// A copy under a name that is free, with the mode of the file; a copy that fails halfway is removed
async function file_copy(file, target_file)
{
    await fs.promises.copyFile(file, target_file, fs.constants.COPYFILE_EXCL);
    try {
        await fs.promises.chmod(target_file, (await fs.promises.stat(file)).mode);
    }
    catch (error) {
        await fs.promises.unlink(target_file);
        throw error;
    }
}

module.exports = appimage_move;

const REASON_BY_CODE = {
    EACCES: 'permission denied',
    EPERM: 'permission denied',
    EISDIR: 'it is a folder, not a file',
    ENOTDIR: 'a part of its path is a file, not a folder',
    ENOSPC: 'the disk is full',
    EROFS: 'the disk is read-only',
};

// What a GNOME setup that failed tells the user in the settings window, in one plain sentence.
// A program the setup runs that is not there is named; a file that could not be written is
// named with the reason; dconf, when it refuses, has its own last words passed on
// (helpers/command_run.js puts what a program wrote to stderr under the first line of the
// message). Any other error gives its own message, on one line.
function gnome_setup_failure_text(error)
{
    const lines = String(error?.message ?? error).split('\n').map(v => v.trim()).filter(v => v);
    if ((error?.code === 'ENOENT') && String(error.syscall).startsWith('spawn')) {
        return `The setup needs ${error.path}, which was not found.`;
    }
    if (REASON_BY_CODE[error?.code] && error.path) {
        return `The setup could not write ${error.path}: ${REASON_BY_CODE[error.code]}.`;
    }
    if ((error?.exit_code !== undefined) && (lines.length > 1)) {
        return `GNOME's settings did not take the hotkey. dconf said: ${lines.at(-1)}`;
    }
    return lines.join(' ');
}

module.exports = gnome_setup_failure_text;

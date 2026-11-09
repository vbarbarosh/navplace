// A unix socket's path holds this many bytes at most (Linux, sun_path)
const SOCKET_PATH_MAX = 108;

const REASON_BY_CODE = {
    EACCES: 'permission denied',
    EPERM: 'permission denied',
    EISDIR: 'it is a folder, not a file',
    ENOTDIR: 'a part of its path is a file, not a folder',
    ENOENT: 'it does not exist',
    ENOSPC: 'the disk is full',
    EROFS: 'the disk is read-only',
};

// What a failed start tells the user in its box: started by the hotkey or at login, nobody reads
// stderr. An error of a known step carries `start_step`, {sentence, file}: the sentence, the
// reason in plain words, then the path concerned. Any other error gives its own message.
function start_failure_text(error)
{
    const step = error?.start_step ?? null;
    if (!step) {
        return String(error?.message ?? error);
    }
    const size = Buffer.byteLength(step.file);
    if ((error.syscall === 'listen') && (error.code === 'EINVAL') && (size > SOCKET_PATH_MAX)) {
        return `${step.sentence}: its path is ${size} bytes long, a socket takes ${SOCKET_PATH_MAX} at most.\n\n${step.file}`;
    }
    return `${step.sentence}: ${REASON_BY_CODE[error.code] ?? error.message}.\n\n${step.file}`;
}

module.exports = start_failure_text;

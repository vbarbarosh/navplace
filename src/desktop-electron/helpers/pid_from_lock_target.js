// The pid of the instance that holds Electron's single-instance lock, from the target of the
// `SingletonLock` link in the app's userData folder: the machine's name, a dash, the pid. The
// name may hold dashes of its own. null when the text is not that, or when the name is not
// `hostname`, this machine's: in a home folder shared over the network the lock may be another
// machine's, and its pid says nothing here.
//
//     build-box-2-48213   →   48213
function pid_from_lock_target(target, hostname)
{
    const match = /^(.+)-([1-9][0-9]*)$/s.exec(target ?? '');
    if (!match || (match[1] !== hostname)) {
        return null;
    }
    return Number(match[2]);
}

module.exports = pid_from_lock_target;

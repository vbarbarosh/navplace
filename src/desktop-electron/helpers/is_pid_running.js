// Whether a process has this pid. A process of another user cannot be asked (EPERM), and is there
function is_pid_running(pid)
{
    try {
        process.kill(pid, 0);
        return true;
    }
    catch (error) {
        return error.code === 'EPERM';
    }
}

module.exports = is_pid_running;

const fs = require('fs');
const is_pid_running = require('./is_pid_running');

// How old a lock may be before it counts as left behind, whoever has its pid now: a holder keeps
// it for a moment, and after a restart of the machine a pid belongs to another process
const LEFT_MS = 30000;

// A lock that several starts of the app agree on, each holding it for a moment: a file made only
// while its name is free, the holder's pid inside. A start that finds the name taken waits until
// the holder removes the file; a lock left behind, its holder gone or the file old, is put out of
// the way. It is never the failure of the one who asks: when `wait_ms` are over, or the file
// cannot be made at all, the caller goes on without the lock, `is_held` false.
//
//     await using lock = await make_pid_lock({file, wait_ms: 3000});
async function make_pid_lock({file, wait_ms, poll_ms = 10})
{
    const time0 = Date.now();
    let is_held = false;

    while (!is_held) {
        try {
            await fs.promises.writeFile(file, `${process.pid}\n`, {flag: 'wx'});
            is_held = true;
        }
        catch (error) {
            if ((error.code !== 'EEXIST') || ((Date.now() - time0) >= wait_ms)) {
                break;
            }
            if (!await lock_left_remove(file)) {
                await new Promise(v => setTimeout(v, poll_ms));
            }
        }
    }

    return {
        is_held,
        [Symbol.asyncDispose]: async function () {
            if (!is_held) {
                return;
            }
            try {
                await fs.promises.unlink(file);
            }
            catch {
            }
        },
    };
}

// Whether the name is free again: the lock was left behind and is out of the way now, or it went
// by itself. Left behind: the pid inside is of no running process, or the file is older than a
// holder ever keeps it. Two starts may find the same lock left behind, and the second must not
// remove the lock the first has made since: so the file is moved to a name of its own, looked at
// again there, and put back when it is not the one that was found
async function lock_left_remove(file)
{
    let found = null;
    let moved = null;

    const aside_file = `${file}.${process.pid}.left`;
    try {
        found = await fs.promises.stat(file);
        const pid = Number(await fs.promises.readFile(file, 'utf8'));
        const is_old = (Date.now() - found.mtimeMs) >= LEFT_MS;
        // No pid inside yet: its holder has made the file and writes it this moment
        if (!is_old && (!Number.isInteger(pid) || (pid < 1) || is_pid_running(pid))) {
            return false;
        }
        await fs.promises.rename(file, aside_file);
        moved = await fs.promises.stat(aside_file);
    }
    catch {
        // Gone between two looks: its holder removed it, or another start put it out of the way
        return true;
    }
    if (moved.ino !== found.ino) {
        try {
            await fs.promises.link(aside_file, file);
        }
        catch {
        }
    }
    try {
        await fs.promises.unlink(aside_file);
    }
    catch {
    }
    return moved.ino === found.ino;
}

module.exports = make_pid_lock;

const shell_spawn = require('@vbarbarosh/node-helpers/src/shell_spawn');

// Runs `args` with `input` on stdin; its stdout, or an error with its stderr
async function command_run(args, input)
{
    let stdout = '';
    let stderr = '';

    const proc = shell_spawn(args, {stdio: ['pipe', 'pipe', 'pipe']});
    proc.stdout.on('data', v => stdout = `${stdout}${v}`);
    proc.stderr.on('data', v => stderr = `${stderr}${v}`);

    // shell_spawn rejects BOTH init() and promise() on a spawn error — keep a
    // handler on promise() so ENOENT (node/dconf missing) doesn't leak.
    const exited = proc.promise();
    exited.catch(() => {});

    try {
        await proc.init();
        if (input) {
            proc.stdin.end(input);
        }
        else {
            proc.stdin.end();
        }
        await exited;
    }
    catch (error) {
        error.message = stderr ? `${error.message}\n${stderr}` : error.message;
        throw error;
    }

    return stdout;
}

module.exports = command_run;

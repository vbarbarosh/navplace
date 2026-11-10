const assert = require('node:assert/strict');
const child_process = require('node:child_process');
const fs = require('node:fs');
const make_pid_lock = require('./make_pid_lock');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

test('make_pid_lock: a free name is taken, the pid inside, and freed again', async function (t) {
    const file = path.join(await make_dir(t), 'start.lock');
    const lock = await make_pid_lock({file, wait_ms: 1000});
    assert.equal(lock.is_held, true);
    assert.equal(fs.readFileSync(file, 'utf8'), `${process.pid}\n`);
    await lock[Symbol.asyncDispose]();
    assert.equal(fs.existsSync(file), false);
});

test('make_pid_lock: a second one waits until the first lets go', async function (t) {
    const file = path.join(await make_dir(t), 'start.lock');
    const first = await make_pid_lock({file, wait_ms: 1000});
    let is_second_in = false;
    const waiting = make_pid_lock({file, wait_ms: 5000}).then(function (v) {
        is_second_in = true;
        return v;
    });
    await new Promise(v => setTimeout(v, 80));
    assert.equal(is_second_in, false);
    await first[Symbol.asyncDispose]();
    const second = await waiting;
    assert.equal(second.is_held, true);
    await second[Symbol.asyncDispose]();
    assert.equal(fs.existsSync(file), false);
});

test('make_pid_lock: held longer than the wait, the caller goes on without it and leaves it alone', async function (t) {
    const file = path.join(await make_dir(t), 'start.lock');
    const first = await make_pid_lock({file, wait_ms: 1000});
    const second = await make_pid_lock({file, wait_ms: 60});
    assert.equal(second.is_held, false);
    await second[Symbol.asyncDispose]();
    assert.equal(fs.readFileSync(file, 'utf8'), `${process.pid}\n`);
    await first[Symbol.asyncDispose]();
});

test('make_pid_lock: a lock left by a process that is gone is taken at once', async function (t) {
    const file = path.join(await make_dir(t), 'start.lock');
    const ended = child_process.spawnSync(process.execPath, ['-e', '']);
    fs.writeFileSync(file, `${ended.pid}\n`);
    const time0 = Date.now();
    const lock = await make_pid_lock({file, wait_ms: 5000});
    assert.equal(lock.is_held, true);
    assert.ok((Date.now() - time0) < 1000);
    assert.equal(fs.readFileSync(file, 'utf8'), `${process.pid}\n`);
    await lock[Symbol.asyncDispose]();
    assert.deepEqual(fs.readdirSync(path.dirname(file)), []);
});

test('make_pid_lock: an old lock is taken, whoever has its pid now', async function (t) {
    const file = path.join(await make_dir(t), 'start.lock');
    fs.writeFileSync(file, `${process.pid}\n`);
    const before = new Date(Date.now() - 60000);
    fs.utimesSync(file, before, before);
    const lock = await make_pid_lock({file, wait_ms: 5000});
    assert.equal(lock.is_held, true);
    await lock[Symbol.asyncDispose]();
    assert.deepEqual(fs.readdirSync(path.dirname(file)), []);
});

test('make_pid_lock: a lock with no pid inside yet is its holder own, and is waited for', async function (t) {
    const file = path.join(await make_dir(t), 'start.lock');
    fs.writeFileSync(file, '');
    const lock = await make_pid_lock({file, wait_ms: 60});
    assert.equal(lock.is_held, false);
    assert.equal(fs.readFileSync(file, 'utf8'), '');
});

test('make_pid_lock: a folder that is not there gives no lock and no failure', async function (t) {
    const file = path.join(await make_dir(t), 'missing/start.lock');
    const lock = await make_pid_lock({file, wait_ms: 1000});
    assert.equal(lock.is_held, false);
    await lock[Symbol.asyncDispose]();
});

test('make_pid_lock: of many that ask at once each has it in turn, one at a time', async function (t) {
    const file = path.join(await make_dir(t), 'start.lock');
    let inside = 0;
    let inside_max = 0;
    await Promise.all(Array.from({length: 12}, async function () {
        const lock = await make_pid_lock({file, wait_ms: 10000, poll_ms: 1});
        assert.equal(lock.is_held, true);
        inside_max = Math.max(inside_max, ++inside);
        await new Promise(v => setTimeout(v, 5));
        --inside;
        await lock[Symbol.asyncDispose]();
    }));
    assert.equal(inside_max, 1);
    assert.equal(fs.existsSync(file), false);
});

// A folder of its own, removed when the test ends
async function make_dir(t)
{
    const out = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'navplace-lock-'));
    t.after(async function () {
        await fs.promises.rm(out, {recursive: true, force: true});
    });
    return out;
}

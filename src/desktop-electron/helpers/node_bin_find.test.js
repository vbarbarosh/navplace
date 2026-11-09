const assert = require('node:assert/strict');
const child_process = require('node:child_process');
const fs = require('node:fs');
const node_bin_find = require('./node_bin_find');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

test('node_bin_find: the node on PATH, by an absolute path that runs', async function () {
    const node_bin = await node_bin_find();
    assert.ok(path.isAbsolute(node_bin), node_bin);
    assert.match(child_process.execFileSync(node_bin, ['--version'], {encoding: 'utf8', env: {}}), /^v\d+\./);
});

test('node_bin_find: a link on PATH gives the binary it leads to', async function (t) {
    const dir = await make_path_dir(t);
    await fs.promises.symlink(process.execPath, path.join(dir, 'node'));
    assert.equal(await node_bin_find(), await fs.promises.realpath(process.execPath));
});

test('node_bin_find: a starter script on PATH is kept, it finds its node each time', async function (t) {
    const dir = await make_path_dir(t);
    await fs.promises.writeFile(path.join(dir, 'node'), `#!/bin/sh\nexec "${process.execPath}" "$@"\n`, {mode: 0o755});
    assert.equal(await node_bin_find(), path.join(dir, 'node'));
});

test('node_bin_find: a PATH with no node gives null', async function (t) {
    const dir = await make_path_dir(t);
    process.env.PATH = dir;
    await fs.promises.symlink('/bin/sh', path.join(dir, 'sh'));
    assert.equal(await node_bin_find(), null);
});

// An empty folder put first on PATH for the time of one test
async function make_path_dir(t)
{
    const path_before = process.env.PATH;
    const out = await fs.promises.realpath(await fs.promises.mkdtemp(path.join(os.tmpdir(), 'navplace-path-')));
    process.env.PATH = `${out}${path.delimiter}${path_before}`;
    t.after(async function () {
        process.env.PATH = path_before;
        await fs.promises.rm(out, {recursive: true, force: true});
    });
    return out;
}

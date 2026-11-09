const assert = require('node:assert/strict');
const collection_resolve_includes = require('./collection_resolve_includes');
const crypto = require('node:crypto');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const parse = require('../../../lib/parse');
const path = require('node:path');
const test = require('node:test');

const GROUP_UID = 'test';

const REMOTE = `% design: showcase
% ns: nothing
% include: https://deeper.example.com/links.md

# Work
Jira        #tracker    https://jira.example.com/

# Personal
Netflix                 https://netflix.example.com/
`;

test('appends the links and sections of a pulled document', async function () {
    await using server = await make_text_server(REMOTE);
    const collection = parse(`% design: github
% include: ${server.url} #work #prefix=ACME

Local   https://local.example.com/
`);
    const actual = await collection_resolve_includes(collection, GROUP_UID);
    assert.equal(actual.meta.design, 'github');
    assert.deepEqual(actual.items.map(v => [v.label, v.href, v.tags, v.namespaces]), [
        ['Local', 'https://local.example.com/', [], []],
        ['ACME Jira', 'https://jira.example.com/', ['tracker', 'work'], ['Work']],
        ['ACME Netflix', 'https://netflix.example.com/', ['work'], ['Personal']],
    ]);
});

test('the ns of the pulling document gates pulled links too', async function () {
    await using server = await make_text_server(REMOTE);
    const collection = parse(`% ns: Work
% include: ${server.url}

# Work
Local   https://local.example.com/

# Personal
Hidden  https://hidden.example.com/
`);
    const actual = await collection_resolve_includes(collection, GROUP_UID);
    assert.deepEqual(actual.items.map(v => v.label), ['Local', 'Jira']);
});

test('keeps the collection when a url is dead', async function () {
    const collection = parse(`% include: http://127.0.0.1:1/links.md

Local   https://local.example.com/
`);
    const actual = await collection_resolve_includes(collection, GROUP_UID);
    assert.deepEqual(actual.items.map(v => v.label), ['Local']);
});

test('logs an include url without its user, password, query and fragment', async function (t) {
    const logged = t.mock.method(console, 'error', () => {});
    const collection = parse(`% include: http://user:secret@127.0.0.1:1/links.md?token=abc
% include: ftp://user:secret@files.example.com/links.md?token=abc#top
% include: http://user:secret@files.example.com:99999/links.md?token=abc
% include: mailto:user:secret@files.example.com?token=abc
% include: links.md?token=abc

Local   https://local.example.com/
`);
    const actual = await collection_resolve_includes(collection, GROUP_UID);
    const lines = logged.mock.calls.map(v => v.arguments[0]);
    assert.deepEqual(actual.items.map(v => v.label), ['Local']);
    assert.equal(lines.length, 5);
    assert.match(lines[0], /^\[test\]\[include_failed\] url=http:\/\/127\.0\.0\.1:1\/links\.md reason=/);
    assert.equal(lines[1], '[test][include_skipped] url=ftp://files.example.com/links.md');
    assert.match(lines[2], /^\[test\]\[include_failed\] url=invalid-url reason=/);
    assert.equal(lines[3], '[test][include_skipped] url=mailto:');
    assert.equal(lines[4], '[test][include_skipped] url=invalid-url');
    assert.doesNotMatch(lines.join('\n'), /user|secret|token|abc/);
});

test('a kept copy stands in for an include whose url is dead', async function (t) {
    await using kept = await make_kept_dir();
    await using server = await make_text_server(REMOTE);
    const url = server.url.replace('http://', 'http://user:secret@').concat('?token=xyz');
    const collection = parse(`% include: ${url} #work

Local   https://local.example.com/
`);
    const pulled = await collection_resolve_includes(collection, GROUP_UID, {kept_dir: kept.dir});
    assert.deepEqual(pulled.items.map(v => v.label), ['Local', 'Jira', 'Netflix']);

    await server.close();
    const logged = t.mock.method(console, 'log', () => {});
    const failed = t.mock.method(console, 'error', () => {});
    const actual = await collection_resolve_includes(collection, GROUP_UID, {kept_dir: kept.dir});
    assert.deepEqual(actual.items, pulled.items);

    // The copy is named by a hash of the whole address, and the log says which one was used
    const name = `${crypto.createHash('sha256').update(url).digest('hex')}.md`;
    assert.deepEqual(await fs.promises.readdir(kept.dir), [name]);
    assert.equal(await fs.promises.readFile(path.join(kept.dir, name), 'utf8'), REMOTE);
    assert.equal(failed.mock.calls.length, 1);
    assert.match(failed.mock.calls[0].arguments[0], /^\[test\]\[include_failed\] url=http:\/\/127\.0\.0\.1:\d+\/links\.md reason=/);
    assert.equal(logged.mock.calls.length, 1);
    assert.match(logged.mock.calls[0].arguments[0], new RegExp(`^\\[test\\]\\[include_kept\\] url=http://127\\.0\\.0\\.1:\\d+/links\\.md file=${name} kept_at=\\d{4}-\\d\\d-\\d\\dT[0-9:.]+Z items=2$`));
    assert.doesNotMatch(`${logged.mock.calls[0].arguments[0]}\n${failed.mock.calls[0].arguments[0]}`, /user|secret|token|xyz/);
});

test('an include that was never pulled and is dead gives no links', async function () {
    await using kept = await make_kept_dir();
    const collection = parse(`% include: http://127.0.0.1:1/links.md

Local   https://local.example.com/
`);
    const actual = await collection_resolve_includes(collection, GROUP_UID, {kept_dir: kept.dir});
    assert.deepEqual(actual.items.map(v => v.label), ['Local']);
    assert.deepEqual(await fs.promises.readdir(kept.dir), []);
});

test('a changed good pull replaces the kept copy', async function () {
    await using kept = await make_kept_dir();
    await using server = await make_text_server('Old   https://old.example.com/\n');
    const collection = parse(`% include: ${server.url}\n`);
    await collection_resolve_includes(collection, GROUP_UID, {kept_dir: kept.dir});

    server.text = 'New   https://new.example.com/\nNewer   https://newer.example.com/\n';
    const pulled = await collection_resolve_includes(collection, GROUP_UID, {kept_dir: kept.dir});
    assert.deepEqual(pulled.items.map(v => v.label), ['New', 'Newer']);

    await server.close();
    const actual = await collection_resolve_includes(collection, GROUP_UID, {kept_dir: kept.dir});
    assert.deepEqual(actual.items.map(v => v.label), ['New', 'Newer']);
    assert.equal((await fs.promises.readdir(kept.dir)).length, 1);
});

test('an answer that is not 2xx leaves the kept copy as it is', async function () {
    await using kept = await make_kept_dir();
    await using server = await make_text_server('Good   https://good.example.com/\n');
    const collection = parse(`% include: ${server.url}\n`);
    await collection_resolve_includes(collection, GROUP_UID, {kept_dir: kept.dir});

    server.status = 503;
    server.text = 'Service Unavailable   https://status.example.com/\n';
    const actual = await collection_resolve_includes(collection, GROUP_UID, {kept_dir: kept.dir});
    assert.deepEqual(actual.items.map(v => v.label), ['Good']);
});

test('a kept copy that cannot be written does not cost the pulled links', async function (t) {
    await using kept = await make_kept_dir();
    await using server = await make_text_server('Good   https://good.example.com/\n');
    const failed = t.mock.method(console, 'error', () => {});
    const collection = parse(`% include: ${server.url}\n`);
    // A file where the folder should be
    await fs.promises.writeFile(path.join(kept.dir, 'file'), '');
    const actual = await collection_resolve_includes(collection, GROUP_UID, {kept_dir: path.join(kept.dir, 'file', 'includes')});
    assert.deepEqual(actual.items.map(v => v.label), ['Good']);
    assert.equal(failed.mock.calls.length, 1);
    assert.match(failed.mock.calls[0].arguments[0], /^\[test\]\[include_keep_failed\] url=http:\/\/127\.0\.0\.1:\d+\/links\.md reason=/);
});

// A server that answers every request with `text` and `status`, both changeable; close() takes it down
async function make_text_server(text)
{
    const out = {
        url: null,
        text,
        status: 200,
        close: async function () {
            if (server.listening) {
                await new Promise(v => server.close(v));
            }
        },
        [Symbol.asyncDispose]: async function () {
            await out.close();
        },
    };
    const server = http.createServer(function (request, response) {
        response.statusCode = out.status;
        response.end(out.text);
    });
    await new Promise(v => server.listen(0, '127.0.0.1', v));
    out.url = `http://127.0.0.1:${server.address().port}/links.md`;

    return out;
}

// An empty folder for kept copies, removed with what it holds
async function make_kept_dir()
{
    const dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'navplace-includes-'));
    return {
        dir,
        [Symbol.asyncDispose]: async function () {
            await fs.promises.rm(dir, {recursive: true, force: true});
        },
    };
}

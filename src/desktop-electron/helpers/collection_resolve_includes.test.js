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

test('the title, subtitle and e-mail of a pulled document never become the page own', async function () {
    await using server = await make_text_server(`% title: Stranger
% subtitle: Strange links
% email: stranger@example.com
  %   title : Stranger again

Pulled  https://pulled.example.com/
`);
    const named = parse(`% title: Jane Roe
% subtitle: My links
% email: jane@example.com
% include: ${server.url}

Local   https://local.example.com/
`);
    const actual = await collection_resolve_includes(named, GROUP_UID);
    assert.deepEqual([actual.meta.title, actual.meta.subtitle, actual.meta.email], ['Jane Roe', 'My links', 'jane@example.com']);
    assert.deepEqual(actual.items.map(v => v.label), ['Local', 'Pulled']);

    // A pulling document that names none of them stays without: the design keeps its own words
    const unnamed = parse(`% include: ${server.url}

Local   https://local.example.com/
`);
    const bare = await collection_resolve_includes(unnamed, GROUP_UID);
    assert.deepEqual(Object.keys(bare.meta), ['include']);
    assert.deepEqual(bare.items.map(v => v.label), ['Local', 'Pulled']);
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
    // Pulled side by side, the lines come as the pulls end: sorted here
    const lines = logged.mock.calls.map(v => v.arguments[0]).sort();
    assert.deepEqual(actual.items.map(v => v.label), ['Local']);
    assert.equal(lines.length, 5);
    assert.match(lines[0], /^\[test\]\[include_failed\] url=http:\/\/127\.0\.0\.1:1\/links\.md reason=/);
    assert.match(lines[1], /^\[test\]\[include_failed\] url=invalid-url reason=/);
    assert.equal(lines[2], '[test][include_skipped] url=ftp://files.example.com/links.md');
    assert.equal(lines[3], '[test][include_skipped] url=invalid-url');
    assert.equal(lines[4], '[test][include_skipped] url=mailto:');
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

test('three silent urls and a good one take one time limit, not three', async function () {
    await using silent = await make_server(() => {});
    await using server = await make_text_server(REMOTE);
    const collection = parse(`% include: ${silent.url}?1
% include: ${silent.url}?2
% include: ${silent.url}?3
% include: ${server.url}

Local   https://local.example.com/
`);
    const time0 = Date.now();
    const actual = await collection_resolve_includes(collection, GROUP_UID, {time_limit_ms: 600});
    const elapsed = Date.now() - time0;
    assert.deepEqual(actual.items.map(v => v.label), ['Local', 'Jira', 'Netflix']);
    assert.ok((elapsed >= 590) && (elapsed < 1700), `took ${elapsed} ms: one limit is 600, three in a row are 1800`);
});

test('an answer that never ends is cut at the time limit', {timeout: 20000}, async function (t) {
    // A line every 50 ms, for ever: never silent for long, never whole
    await using server = await make_server(function (request, response) {
        const timer = setInterval(() => response.write('Drip   https://drip.example.com/\n'), 50);
        response.on('close', () => clearInterval(timer));
    });
    const failed = t.mock.method(console, 'error', () => {});
    const collection = parse(`% include: ${server.url}

Local   https://local.example.com/
`);
    const time0 = Date.now();
    const actual = await collection_resolve_includes(collection, GROUP_UID, {time_limit_ms: 600});
    const elapsed = Date.now() - time0;
    assert.deepEqual(actual.items.map(v => v.label), ['Local']);
    assert.ok((elapsed >= 590) && (elapsed < 1700), `took ${elapsed} ms with a limit of 600`);
    assert.match(failed.mock.calls[0].arguments[0], /^\[test\]\[include_failed\] url=http:\/\/127\.0\.0\.1:\d+\/links\.md reason="no whole answer in 600 ms"$/);
});

test('an answer over the size limit is refused, and the kept copy is used', async function (t) {
    await using kept = await make_kept_dir();
    await using server = await make_text_server('Small   https://small.example.com/\n');
    const collection = parse(`% include: ${server.url}\n`);
    await collection_resolve_includes(collection, GROUP_UID, {kept_dir: kept.dir, size_limit: 1024});

    const failed = t.mock.method(console, 'error', () => {});
    server.text = 'Large   https://large.example.com/\n'.repeat(100);
    const actual = await collection_resolve_includes(collection, GROUP_UID, {kept_dir: kept.dir, size_limit: 1024});
    assert.deepEqual(actual.items.map(v => v.label), ['Small']);
    assert.match(failed.mock.calls[0].arguments[0], /\[include_failed\] url=\S+ reason="maxContentLength size of 1024 exceeded"$/);

    // At the limit it is taken, and kept
    server.text = 'Exact   https://exact.example.com/\n'.padEnd(1024, '\n');
    const exact = await collection_resolve_includes(collection, GROUP_UID, {kept_dir: kept.dir, size_limit: 1024});
    assert.deepEqual(exact.items.map(v => v.label), ['Exact']);
});

test('200 000 pulled links do not throw', async function () {
    const lines = [];
    for (let i = 0; i < 200000; ++i) {
        lines.push(`Link ${i}   https://example.com/${i}`);
    }
    await using server = await make_text_server(lines.join('\n'));
    const collection = parse(`% include: ${server.url}

Local   https://local.example.com/
`);
    const actual = await collection_resolve_includes(collection, GROUP_UID, {size_limit: 16*1024*1024});
    assert.equal(actual.items.length, 200001);
    assert.deepEqual([actual.items[0].label, actual.items[1].label, actual.items[200000].label], ['Local', 'Link 0', 'Link 199999']);
});

test('the links keep the order of the include lines, whichever url answers first', async function () {
    await using slow = await make_text_server('Slow   https://slow.example.com/\n');
    await using fast = await make_text_server('Fast   https://fast.example.com/\n');
    slow.delay_ms = 150;
    const collection = parse(`% include: ${slow.url}
% include: ${fast.url}

Local   https://local.example.com/
`);
    const actual = await collection_resolve_includes(collection, GROUP_UID);
    assert.deepEqual(actual.items.map(v => v.label), ['Local', 'Slow', 'Fast']);
});

// A server that answers every request with `text` and `status` after `delay_ms`, all three
// changeable; close() takes it down
async function make_text_server(text)
{
    const out = await make_server(function (request, response) {
        setTimeout(function () {
            response.statusCode = out.status;
            response.end(out.text);
        }, out.delay_ms);
    });
    out.text = text;
    out.status = 200;
    out.delay_ms = 0;

    return out;
}

// A server on a port of its own; close() takes it down with the connections it still holds
async function make_server(handler)
{
    const server = http.createServer(handler);
    await new Promise(v => server.listen(0, '127.0.0.1', v));

    return {
        url: `http://127.0.0.1:${server.address().port}/links.md`,
        close,
        [Symbol.asyncDispose]: close,
    };

    async function close() {
        if (server.listening) {
            server.closeAllConnections();
            await new Promise(v => server.close(v));
        }
    }
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

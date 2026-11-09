const assert = require('node:assert/strict');
const collection_resolve_includes = require('./collection_resolve_includes');
const http = require('node:http');
const parse = require('../../../lib/parse');
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

async function make_text_server(text)
{
    const server = http.createServer((request, response) => response.end(text));
    await new Promise(v => server.listen(0, '127.0.0.1', v));

    return {
        url: `http://127.0.0.1:${server.address().port}/links.md`,
        [Symbol.asyncDispose]: async function () {
            await new Promise(v => server.close(v));
        },
    };
}

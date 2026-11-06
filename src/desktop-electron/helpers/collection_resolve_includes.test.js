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

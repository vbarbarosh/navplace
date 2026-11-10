const assert = require('node:assert/strict');
const picture_pull = require('./picture_pull');
const test = require('node:test');

const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex');
const SVG = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 8"><circle cx="4" cy="4" r="4"/></svg>');

test('picture_pull: the bytes of a picture and its kind, told by the bytes', async function () {
    const asked = [];
    const fetch_fn = make_fetch({'https://example.com/img/logo.png': () => new Response(PNG, {headers: {'Content-Type': 'text/plain'}})}, asked);
    const actual = await picture_pull('https://example.com/img/logo.png', {fetch_fn});
    assert.deepEqual(actual, {bytes: PNG, type: 'image/png'});
    assert.equal(asked.length, 1);
    assert.equal(asked[0].options.redirect, 'manual');
    assert.deepEqual(asked[0].options.headers, {'Accept': 'image/*', 'User-Agent': 'navplace-picture/1 (+https://navplace.com)'});
});

test('picture_pull: an http address is asked over https, a fragment left out', async function () {
    const asked = [];
    const fetch_fn = make_fetch({'https://example.com/a.svg?v=2': () => new Response(SVG)}, asked);
    const actual = await picture_pull('http://example.com/a.svg?v=2#top', {fetch_fn});
    assert.equal(actual.type, 'image/svg+xml');
    assert.deepEqual(asked.map(v => v.href), ['https://example.com/a.svg?v=2']);
});

test('picture_pull: an address that is not public https is not asked at all', async function () {
    const hrefs = [
        'https://localhost/a.png',
        'https://127.0.0.1/a.png',
        'https://192.168.1.1/a.png',
        'http://10.0.0.7/a.png',
        'https://[::1]/a.png',
        'https://2130706433/a.png',
        'https://0x7f.1/a.png',
        'https://router/a.png',
        'https://nas.local/a.png',
        'https://wiki.internal/a.png',
        'https://example.com:8443/a.png',
        'http://example.com:8080/a.png',
        'https://user:secret@example.com/a.png',
        'https://user@example.com/a.png',
        'ftp://example.com/a.png',
        'file:///etc/hostname',
        'data:image/png;base64,iVBORw0KGgo=',
        'private://a.png',
        'a.png',
        '',
    ];
    for (const href of hrefs) {
        const asked = [];
        await assert.rejects(picture_pull(href, {fetch_fn: make_fetch({}, asked)}), {message: 'not a public https address'}, href);
        assert.equal(asked.length, 0, href);
    }
});

test('picture_pull: a redirect is followed by hand, to public https only', async function () {
    const asked = [];
    const fetch_fn = make_fetch({
        'https://example.com/a.png': () => make_redirect('/img/a.png'),
        'https://example.com/img/a.png': () => make_redirect('http://cdn.example.org/a.png'),
        'https://cdn.example.org/a.png': () => new Response(PNG),
        'https://example.com/inside.png': () => make_redirect('https://192.168.1.1/admin'),
        'https://example.com/file.png': () => make_redirect('file:///etc/hostname'),
        'https://example.com/port.png': () => make_redirect('https://example.com:8443/a.png'),
    }, asked);
    assert.equal((await picture_pull('https://example.com/a.png', {fetch_fn})).type, 'image/png');
    assert.deepEqual(asked.map(v => v.href), ['https://example.com/a.png', 'https://example.com/img/a.png', 'https://cdn.example.org/a.png']);

    for (const href of ['https://example.com/inside.png', 'https://example.com/file.png', 'https://example.com/port.png']) {
        asked.length = 0;
        await assert.rejects(picture_pull(href, {fetch_fn}), {message: 'a redirect to an address that is not public https'}, href);
        assert.deepEqual(asked.map(v => v.href), [href]);
    }
});

test('picture_pull: three redirects are followed, a fourth is not', async function () {
    const asked = [];
    const fetch_fn = make_fetch({
        'https://example.com/0': () => make_redirect('/1'),
        'https://example.com/1': () => make_redirect('/2'),
        'https://example.com/2': () => make_redirect('/3'),
        'https://example.com/3': () => make_redirect('/4'),
        'https://example.com/4': () => new Response(PNG),
    }, asked);
    assert.equal((await picture_pull('https://example.com/1', {fetch_fn})).type, 'image/png');
    asked.length = 0;
    await assert.rejects(picture_pull('https://example.com/0', {fetch_fn}), {message: 'too many redirects'});
    assert.equal(asked.length, 4);
});

test('picture_pull: an answer that is not 2xx, or a redirect to nowhere, is its status', async function () {
    const fetch_fn = make_fetch({
        'https://example.com/gone.png': () => new Response('Not found', {status: 404}),
        'https://example.com/down.png': () => new Response(PNG, {status: 503}),
        'https://example.com/nowhere.png': () => new Response(null, {status: 302}),
    });
    await assert.rejects(picture_pull('https://example.com/gone.png', {fetch_fn}), {message: 'status 404'});
    await assert.rejects(picture_pull('https://example.com/down.png', {fetch_fn}), {message: 'status 503'});
    await assert.rejects(picture_pull('https://example.com/nowhere.png', {fetch_fn}), {message: 'status 302'});
});

test('picture_pull: what is not a picture is refused, whatever the address calls it', async function () {
    const fetch_fn = make_fetch({
        'https://example.com/page.png': () => new Response('<!DOCTYPE html><html><body>Sign in</body></html>', {headers: {'Content-Type': 'image/png'}}),
        'https://example.com/empty.png': () => new Response('', {headers: {'Content-Type': 'image/png'}}),
        'https://example.com/none.png': () => new Response(null, {status: 204}),
        'https://example.com/data.json': () => new Response('{"logo": "a.png"}'),
    });
    for (const href of ['https://example.com/page.png', 'https://example.com/empty.png', 'https://example.com/none.png', 'https://example.com/data.json']) {
        await assert.rejects(picture_pull(href, {fetch_fn}), {message: 'not a picture'}, href);
    }
});

test('picture_pull: an SVG with a script is refused', async function () {
    const texts = {
        'https://example.com/a.svg': '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
        'https://example.com/b.svg': '<svg xmlns="http://www.w3.org/2000/svg"><SCRIPT href="https://example.org/x.js"/></svg>',
        'https://example.com/c.svg': '<svg xmlns="http://www.w3.org/2000/svg" xmlns:s="http://www.w3.org/2000/svg"><s:script>alert(1)</s:script></svg>',
        'https://example.com/d.svg': '<svg xmlns="http://www.w3.org/2000/svg"><script\n type="text/javascript">alert(1)</script></svg>',
    };
    for (const href of Object.keys(texts)) {
        const fetch_fn = make_fetch({[href]: () => new Response(texts[href])});
        await assert.rejects(picture_pull(href, {fetch_fn}), {message: 'an SVG with a script'}, href);
    }
    // The word in a title is no script
    const plain = make_fetch({'https://example.com/e.svg': () => new Response('<svg xmlns="http://www.w3.org/2000/svg"><title>A script, a description</title></svg>')});
    assert.equal((await picture_pull('https://example.com/e.svg', {fetch_fn: plain})).type, 'image/svg+xml');
});

test('picture_pull: an answer over the size limit is refused, not cut', async function () {
    const big = Buffer.concat([PNG, Buffer.alloc(100)]);
    const fetch_fn = make_fetch({
        // One that says how long it is, and one that does not
        'https://example.com/said.png': () => new Response(big, {headers: {'Content-Length': String(big.length)}}),
        'https://example.com/unsaid.png': () => new Response(new Blob([big]).stream()),
        'https://example.com/fits.png': () => new Response(big.subarray(0, 100)),
    });
    await assert.rejects(picture_pull('https://example.com/said.png', {fetch_fn, size_limit: 100}), {message: 'over 100 bytes'});
    await assert.rejects(picture_pull('https://example.com/unsaid.png', {fetch_fn, size_limit: 100}), {message: 'over 100 bytes'});
    assert.equal((await picture_pull('https://example.com/fits.png', {fetch_fn, size_limit: 100})).bytes.length, 100);
});

test('picture_pull: five megabytes is the limit when none is given', async function () {
    const fetch_fn = make_fetch({
        'https://example.com/5mb.png': () => new Response(Buffer.concat([PNG, Buffer.alloc((5*1024*1024) - PNG.length)])),
        'https://example.com/over.png': () => new Response(Buffer.concat([PNG, Buffer.alloc((5*1024*1024) - PNG.length + 1)])),
    });
    assert.equal((await picture_pull('https://example.com/5mb.png', {fetch_fn})).bytes.length, 5*1024*1024);
    await assert.rejects(picture_pull('https://example.com/over.png', {fetch_fn}), {message: 'over 5242880 bytes'});
});

test('picture_pull: an address that does not answer in time, or stops half way, is given up', async function () {
    const time0 = Date.now();
    await assert.rejects(picture_pull('https://example.com/a.png', {fetch_fn: fetch_silent, time_limit_ms: 50}), {message: 'no whole answer in 50 ms'});
    await assert.rejects(picture_pull('https://example.com/a.png', {fetch_fn: fetch_half, time_limit_ms: 50}), {message: 'no whole answer in 50 ms'});
    assert.ok((Date.now() - time0) < 1000);

    // No answer until the request is given up
    function fetch_silent(href, options) {
        return new Promise(function (resolve, reject) {
            options.signal.addEventListener('abort', () => reject(options.signal.reason));
        });
    }

    // The first bytes come, the rest never does
    async function fetch_half(href, options) {
        const body = new ReadableStream({
            start: function (controller) {
                controller.enqueue(PNG);
                options.signal.addEventListener('abort', () => controller.error(options.signal.reason));
            },
        });
        return new Response(body);
    }
});

test('picture_pull: an error of the network comes out as it is', async function () {
    await assert.rejects(picture_pull('https://example.com/a.png', {fetch_fn: fetch_fail}), {message: 'getaddrinfo ENOTFOUND example.com'});

    async function fetch_fail() {
        throw new Error('getaddrinfo ENOTFOUND example.com');
    }
});

// A fetch that answers the addresses of `routes` and keeps what it was asked in `asked`; any
// other address is an error
function make_fetch(routes, asked = [])
{
    return async function (href, options) {
        asked.push({href, options});
        if (!routes[href]) {
            throw new Error(`not expected: ${href}`);
        }
        return routes[href]();
    };
}

function make_redirect(location)
{
    return new Response(null, {status: 302, headers: {Location: location}});
}

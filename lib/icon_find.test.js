const assert = require('assert');
const icon_find = require('./icon_find');

const GOOGLE_HREF = 'https://www.google.com/s2/favicons?domain=example.com&sz=64';
const PIECE_BYTES = 64*1024;

describe('icon_find', function () {
    it('asks no one, its library too, about a host that is not public', async function () {
        for (const domain of ['wiki.corp.internal', '192.168.1.1', 'localhost:3000', 'printer.local', '0x7f.1', 'foo.localhost', 'router.lan', 'metadata.google.internal', '[::1]', 'localhost', '']) {
            assert.equal(await icon_find(domain, fail_fetch, fail_fetch), null, domain);
        }
    });
    it('asks the site of a public host, then Google', async function () {
        const network = make_network({});
        assert.equal(await icon_find('example.com', network.fetch_fn), null);
        assert.deepStrictEqual(network.hrefs, ['https://example.com/', 'https://example.com/apple-touch-icon.png', 'https://example.com/favicon.ico', GOOGLE_HREF]);
    });

    describe('the limits of one lookup', function () {
        it('tries four icon links of a page that lists 5000', async function () {
            const network = make_network({'https://example.com/': make_html_route(make_links_html(5000))});
            assert.equal(await icon_find('example.com', network.fetch_fn), null);
            assert.deepStrictEqual(network.hrefs, [
                'https://example.com/',
                'https://example.com/apple-touch-icon.png',
                'https://example.com/i0.png',
                'https://example.com/i1.png',
                'https://example.com/i2.png',
                'https://example.com/i3.png',
                'https://example.com/favicon.ico',
                GOOGLE_HREF,
            ]);
        });
        it('tries the best four: an apple-touch-icon, an SVG, then the largest', async function () {
            const html = '<link rel="icon" href="/16.png" sizes="16x16"><link rel="icon" href="/32.png" sizes="32x32"><link rel="icon" href="/64.png" sizes="64x64"><link rel="icon" href="/192.png" sizes="192x192"><link rel="icon" type="image/svg+xml" href="/i.svg"><link rel="apple-touch-icon" href="/touch.png">';
            const network = make_network({'https://example.com/': make_html_route(html)});
            assert.equal(await icon_find('example.com', network.fetch_fn), null);
            assert.deepStrictEqual(network.hrefs.slice(1, 5), ['https://example.com/touch.png', 'https://example.com/i.svg', 'https://example.com/192.png', 'https://example.com/64.png']);
            assert.ok(!network.hrefs.includes('https://example.com/32.png'));
        });
        it('asks no address twice', async function () {
            const html = '<link rel="icon" href="/favicon.ico"><link rel="shortcut icon" href="https://example.com/favicon.ico#top"><link rel="icon" href="favicon.ico">';
            const network = make_network({'https://example.com/': make_html_route(html)});
            assert.equal(await icon_find('example.com', network.fetch_fn), null);
            assert.deepStrictEqual(network.hrefs, ['https://example.com/', 'https://example.com/apple-touch-icon.png', 'https://example.com/favicon.ico', GOOGLE_HREF]);
        });

        it('follows a redirect by hand, and reads a relative link against the address the page came from', async function () {
            const network = make_network({
                'https://example.com/': make_redirect_route('https://www.example.com/start/'),
                'https://www.example.com/start/': make_html_route('<link rel="apple-touch-icon" href="touch.png">'),
                'https://www.example.com/start/touch.png': make_png_route(),
            });
            const icon = await icon_find('example.com', network.fetch_fn);
            assert.equal(icon.type, 'image/png');
            assert.deepStrictEqual(network.hrefs, ['https://example.com/', 'https://www.example.com/start/', 'https://www.example.com/start/touch.png']);
            assert.ok(network.options.every(v => v.redirect === 'manual'));
        });
        it('never follows a redirect to a private address, to http, to a port', async function () {
            const locations = [
                'http://192.168.1.1:8080/x',
                'https://192.168.1.1/x',
                'https://0x7f.1/x',
                'https://[::1]/x',
                'https://localhost/x',
                'https://wiki.corp.internal/x',
                '//printer.local/x',
                'http://example.org/x',
                'https://example.org:8443/x',
                'https://name:word@example.org/x',
                'ftp://example.org/x',
                'https://',
            ];
            for (const location of locations) {
                const network = make_network({
                    'https://example.com/': make_redirect_route(location),
                    'https://example.com/apple-touch-icon.png': make_redirect_route(location),
                    'https://example.com/favicon.ico': make_redirect_route(location),
                    [GOOGLE_HREF]: make_redirect_route(location),
                });
                assert.equal(await icon_find('example.com', network.fetch_fn), null, location);
                assert.deepStrictEqual(network.hrefs, ['https://example.com/', 'https://example.com/apple-touch-icon.png', 'https://example.com/favicon.ico', GOOGLE_HREF], location);
            }
        });
        it('follows three redirects and never a fourth', async function () {
            const chain = {
                'https://example.com/favicon.ico': make_redirect_route('/r1'),
                'https://example.com/r1': make_redirect_route('/r2'),
                'https://example.com/r2': make_redirect_route('/r3'),
            };
            const near = make_network({...chain, 'https://example.com/r3': make_png_route()});
            assert.equal((await icon_find('example.com', near.fetch_fn)).type, 'image/png');
            const far = make_network({...chain, 'https://example.com/r3': make_redirect_route('/r4'), 'https://example.com/r4': make_redirect_route('/r5'), 'https://example.com/r5': make_png_route()});
            assert.equal(await icon_find('example.com', far.fetch_fn), null);
            assert.deepStrictEqual(far.hrefs.slice(2), ['https://example.com/favicon.ico', 'https://example.com/r1', 'https://example.com/r2', 'https://example.com/r3', GOOGLE_HREF]);
        });
        it('skips an icon link to a private address, to http or to a port', async function () {
            const html = '<link rel="icon" href="http://192.168.1.1:8080/i.png"><link rel="icon" href="https://printer.local/i.png"><link rel="icon" href="http://example.org/i.png"><link rel="icon" href="https://example.org:8443/i.png">';
            const network = make_network({'https://example.com/': make_html_route(html), 'https://example.com/favicon.ico': make_png_route('image/x-icon')});
            assert.equal((await icon_find('example.com', network.fetch_fn)).type, 'image/x-icon');
            assert.deepStrictEqual(network.hrefs, ['https://example.com/', 'https://example.com/apple-touch-icon.png', 'https://example.com/favicon.ico']);
        });

        it('stops reading an icon that never ends', async function () {
            const body = {bytes: 0, is_cancelled: false};
            const network = make_network({'https://example.com/favicon.ico': make_endless_route('image/png', '', body)});
            assert.equal(await icon_find('example.com', network.fetch_fn), null);
            assert.ok(body.bytes <= 200*1024 + 3*PIECE_BYTES, `${body.bytes} bytes`);
            assert.ok(body.is_cancelled);
        });
        it('reads the head of a page that never ends, and no more', async function () {
            const body = {bytes: 0, is_cancelled: false};
            const network = make_network({
                'https://example.com/': make_endless_route('text/html', '<!doctype html><html><head><link rel="apple-touch-icon" href="/touch.png">', body),
                'https://example.com/touch.png': make_png_route(),
            });
            assert.equal((await icon_find('example.com', network.fetch_fn)).type, 'image/png');
            assert.ok(body.bytes <= 512*1024 + 3*PIECE_BYTES, `${body.bytes} bytes`);
            assert.ok(body.is_cancelled);
        });

        it('ends in its time when the host never answers, a fetch that hears no signal too', async function () {
            const network = make_network({'https://example.com/': () => new Promise(function () {})});
            const time0 = Date.now();
            assert.equal(await icon_find('example.com', network.fetch_fn, null, 50), null);
            assert.ok(Date.now() - time0 < 1000);
            assert.deepStrictEqual(network.hrefs, ['https://example.com/']);
        });
        it('gives a fetch no more time than the lookup has left, and asks no one after it', async function () {
            const network = make_network({});
            // As fetch does: it ends when its signal says so
            async function silent_fetch(href, options) {
                await network.fetch_fn(href, options);
                return new Promise(function (resolve, reject) {
                    options.signal.addEventListener('abort', () => reject(options.signal.reason));
                });
            }
            assert.equal(await icon_find('example.com', silent_fetch, null, 50), null);
            await new Promise(v => setTimeout(v, 100));
            assert.ok(network.hrefs.length <= 2, `${network.hrefs.length} fetches`);
            assert.ok(network.options.every(v => v.signal.aborted));
        });
    });
});

// A stub network: `hrefs` lists every address asked, `options` what each fetch was given. As fetch
// does, it follows a redirect itself unless told `redirect: 'manual'`, and the address it went to
// is listed too. An address not listed answers 404
function make_network(route_by_href)
{
    const out = {hrefs: [], options: [], fetch_fn: null};
    out.fetch_fn = async function (href, options) {
        let next = href;
        out.options.push(options);
        for (let i = 0; i < 20; ++i) {
            out.hrefs.push(next);
            const route = route_by_href[next];
            const response = route ? await route() : new Response('Not found', {status: 404});
            const location = response.headers.get('Location');
            if ((options.redirect === 'manual') || !location) {
                return response;
            }
            next = new URL(location, next).href;
        }
        throw new TypeError('too many redirects');
    };
    return out;
}

function make_html_route(body)
{
    return function () {
        return new Response(`<!doctype html><html><head>${body}</head></html>`, {headers: {'Content-Type': 'text/html; charset=utf-8'}});
    };
}

function make_png_route(type = 'image/png')
{
    return function () {
        return new Response(new Uint8Array([137, 80, 78, 71]), {headers: {'Content-Type': type}});
    };
}

function make_redirect_route(location)
{
    return function () {
        return new Response(null, {status: 302, headers: {'Location': location}});
    };
}

// A body that keeps coming after `head`, a piece at a time; `body` counts what was handed over.
// 16 MB end it, so a lookup that reads on fails its test instead of filling the memory
function make_endless_route(type, head, body)
{
    return function () {
        const stream = new ReadableStream({
            start: function (controller) {
                if (head) {
                    controller.enqueue(new TextEncoder().encode(head));
                }
            },
            pull: function (controller) {
                if (body.bytes >= 16*1024*1024) {
                    controller.close();
                    return;
                }
                body.bytes += PIECE_BYTES;
                controller.enqueue(new Uint8Array(PIECE_BYTES));
            },
            cancel: function () {
                body.is_cancelled = true;
            },
        });
        return new Response(stream, {headers: {'Content-Type': type}});
    };
}

function make_links_html(count)
{
    const links = [];
    for (let i = 0; i < count; ++i) {
        links.push(`<link rel="icon" href="/i${i}.png">`);
    }
    return links.join('');
}

async function fail_fetch(href)
{
    throw new Error(`no fetch expected: ${href}`);
}

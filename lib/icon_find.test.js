const assert = require('assert');
const icon_find = require('./icon_find');

const GOOGLE_HREF = 'https://www.google.com/s2/favicons?domain=example.com&sz=64';
const PIECE_BYTES = 64*1024;
const PNG_BYTES = new Uint8Array([137, 80, 78, 71]);

describe('icon_find', function () {
    it('asks no one, its library too, about what is not a host at all', async function () {
        for (const domain of ['', ' ', 'exa mple.com', 'example.com/path', 'name@example.com', 'example.com?a', 'example.com#a', '..', ':80', 'localhost:', '[::1', 'localhost:99999', null, undefined]) {
            const network = make_network({});
            assert.equal(await icon_find(domain, network.fetch_fn, fail_library), null, String(domain));
            assert.deepStrictEqual(network.hrefs, [], String(domain));
        }
    });
    it('asks the site of a public host, then Google', async function () {
        const network = make_network({});
        assert.equal(await icon_find('example.com', network.fetch_fn), null);
        assert.deepStrictEqual(network.hrefs, ['https://example.com/', 'https://example.com/apple-touch-icon.png', 'https://example.com/favicon.ico', GOOGLE_HREF]);
    });

    it('calls fetch as a plain function: the fetch of a Cloudflare Worker refuses any other this', async function () {
        const network = make_network({'https://example.com/favicon.ico': make_png_route('image/x-icon')});
        function fetch_fn(...args) {
            if ((this !== undefined) && (this !== globalThis)) {
                throw new TypeError('Illegal invocation: function called with incorrect `this` reference.');
            }
            return network.fetch_fn(...args);
        }
        const icon = await icon_find('example.com', fetch_fn);
        assert.deepStrictEqual(icon, {bytes: PNG_BYTES, type: 'image/x-icon', source: 'site'});
    });

    it('says where the icon came from', async function () {
        const png = {bytes: PNG_BYTES, type: 'image/png'};
        const own = await icon_find('example.com', fail_fetch, async () => png);
        assert.deepStrictEqual(own, {bytes: png.bytes, type: 'image/png', source: 'library'});
        const linked = await icon_find('example.com', make_network({'https://example.com/': make_html_route('<link rel="icon" href="/i.png">'), 'https://example.com/i.png': make_png_route()}).fetch_fn);
        assert.deepStrictEqual(linked, {bytes: png.bytes, type: 'image/png', source: 'site'});
        const usual = await icon_find('example.com', make_network({'https://example.com/favicon.ico': make_png_route('image/x-icon')}).fetch_fn);
        assert.deepStrictEqual(usual, {bytes: png.bytes, type: 'image/x-icon', source: 'site'});
        const last = await icon_find('example.com', make_network({[GOOGLE_HREF]: make_png_route()}).fetch_fn);
        assert.deepStrictEqual(last, {bytes: png.bytes, type: 'image/png', source: 'google'});
    });

    // The desktop app's own links: such a host is asked itself, and its name goes to no one else
    describe('a host that is not public', function () {
        const own_hrefs = ['https://wiki.corp.internal/', 'https://wiki.corp.internal/apple-touch-icon.png', 'https://wiki.corp.internal/favicon.ico'];

        it('is asked itself for the icon its page links, over https', async function () {
            const network = make_network({
                'https://wiki.corp.internal/': make_html_route('<link rel="icon" href="/img/icon.png">'),
                'https://wiki.corp.internal/img/icon.png': make_png_route(),
                'http://wiki.corp.internal/': make_html_route('<link rel="icon" href="/img/icon.png">'),
                'http://wiki.corp.internal/img/icon.png': make_png_route(),
            });
            const icon = await icon_find('wiki.corp.internal', network.fetch_fn, fail_library);
            assert.deepStrictEqual(icon, {bytes: PNG_BYTES, type: 'image/png', source: 'site'});
            assert.deepStrictEqual(network.hrefs, ['https://wiki.corp.internal/', 'https://wiki.corp.internal/apple-touch-icon.png', 'https://wiki.corp.internal/img/icon.png']);
            assert.ok(network.options.every(v => v.redirect === 'manual'));
        });
        it('gives its /apple-touch-icon.png, its /favicon.ico or a data: icon of its page', async function () {
            const touch = await icon_find('wiki.corp.internal', make_network({'https://wiki.corp.internal/apple-touch-icon.png': make_png_route()}).fetch_fn, fail_library);
            assert.deepStrictEqual(touch, {bytes: PNG_BYTES, type: 'image/png', source: 'site'});
            const usual = await icon_find('wiki.corp.internal', make_network({'https://wiki.corp.internal/favicon.ico': make_png_route('image/x-icon')}).fetch_fn, fail_library);
            assert.deepStrictEqual(usual, {bytes: PNG_BYTES, type: 'image/x-icon', source: 'site'});
            const network = make_network({'https://wiki.corp.internal/': make_html_route('<link rel="apple-touch-icon" href="data:image/png;base64,iVBORw==">')});
            const inline = await icon_find('wiki.corp.internal', network.fetch_fn, fail_library);
            assert.deepStrictEqual(inline, {bytes: PNG_BYTES, type: 'image/png', source: 'site'});
            assert.deepStrictEqual(network.hrefs, ['https://wiki.corp.internal/']);
        });
        it('skips an icon link to any other host, a private one too, and asks the next source', async function () {
            const hrefs = [
                'https://cdn.example.com/x.png',
                'https://other.corp.internal/x.png',
                'https://corp.internal/x.png',
                'https://www.wiki.corp.internal/x.png',
                'https://wiki.corp.internal:8443/x.png',
                'https://name:word@wiki.corp.internal/x.png',
                'http://wiki.corp.internal/x.png',
                '//192.168.1.1/x.png',
            ];
            for (const href of hrefs) {
                const network = make_network({
                    'https://wiki.corp.internal/': make_html_route(`<link rel="apple-touch-icon" href="${href}">`),
                    'https://wiki.corp.internal/favicon.ico': make_png_route('image/x-icon'),
                    [new URL(href, 'https://wiki.corp.internal/').href]: make_png_route(),
                });
                assert.equal((await icon_find('wiki.corp.internal', network.fetch_fn, fail_library)).type, 'image/x-icon', href);
                assert.deepStrictEqual(network.hrefs, own_hrefs, href);
            }
        });
        it('never follows a redirect to another host, to http or to another port', async function () {
            for (const location of ['https://sso.corp.internal/login', 'https://example.com/', 'https://www.wiki.corp.internal/', 'https://192.168.1.1/', 'http://wiki.corp.internal/', 'https://wiki.corp.internal:8443/']) {
                const network = make_network({
                    'https://wiki.corp.internal/': make_redirect_route(location),
                    'https://wiki.corp.internal/apple-touch-icon.png': make_redirect_route(location),
                    'https://wiki.corp.internal/favicon.ico': make_redirect_route(location),
                    [location]: make_png_route(),
                });
                assert.equal(await icon_find('wiki.corp.internal', network.fetch_fn, fail_library), null, location);
                assert.deepStrictEqual(network.hrefs, own_hrefs, location);
            }
        });
        it('follows a redirect on the host itself', async function () {
            const network = make_network({
                'https://wiki.corp.internal/': make_redirect_route('/start/'),
                'https://wiki.corp.internal/start/': make_html_route('<link rel="apple-touch-icon" href="touch.png">'),
                'https://wiki.corp.internal/start/touch.png': make_png_route(),
            });
            assert.equal((await icon_find('wiki.corp.internal', network.fetch_fn, fail_library)).source, 'site');
            assert.deepStrictEqual(network.hrefs, ['https://wiki.corp.internal/', 'https://wiki.corp.internal/start/', 'https://wiki.corp.internal/start/touch.png']);
        });
        it('is null when the host has no icon: Google is never asked', async function () {
            const network = make_network({'https://www.google.com/s2/favicons?domain=wiki.corp.internal&sz=64': make_png_route()});
            assert.equal(await icon_find('wiki.corp.internal', network.fetch_fn, fail_library), null);
            assert.deepStrictEqual(network.hrefs, own_hrefs);
        });
        it('keeps a port and an address as the host they are', async function () {
            const origin_by_domain = {
                'localhost': 'https://localhost',
                'localhost:3000': 'https://localhost:3000',
                '192.168.1.1': 'https://192.168.1.1',
                '192.168.1.1:8080': 'https://192.168.1.1:8080',
                '[::1]:3000': 'https://[::1]:3000',
                '0x7f.1': 'https://127.0.0.1',
                'printer.local': 'https://printer.local',
            };
            for (const [domain, origin] of Object.entries(origin_by_domain)) {
                const network = make_network({
                    [`${origin}/`]: make_html_route('<link rel="apple-touch-icon" href="https://localhost:8443/x.png"><link rel="icon" href="https://intranet/x.png"><link rel="icon" href="i.png">'),
                    [`${origin}/i.png`]: make_png_route(),
                });
                assert.equal((await icon_find(domain, network.fetch_fn, fail_library)).source, 'site', domain);
                assert.deepStrictEqual(network.hrefs, [`${origin}/`, `${origin}/i.png`], domain);
            }
        });
        it('has the limits of any lookup', async function () {
            const network = make_network({'https://wiki.corp.internal/': make_html_route(make_links_html(5000))});
            assert.equal(await icon_find('wiki.corp.internal', network.fetch_fn, fail_library), null);
            assert.equal(network.hrefs.length, 7);
            assert.ok(network.hrefs.every(v => v.startsWith('https://wiki.corp.internal/')));
        });
    });

    describe('a source it cannot read', function () {
        it('goes past a broken icon link to the next one', async function () {
            for (const href of ['http://', 'https://[bad', 'https://exa mple.org/i.png', '//']) {
                const network = make_network({
                    'https://example.com/': make_html_route(`<link rel="apple-touch-icon" href="${href}"><link rel="icon" href="/i.png">`),
                    'https://example.com/i.png': make_png_route(),
                });
                assert.equal((await icon_find('example.com', network.fetch_fn)).type, 'image/png', href);
                assert.deepStrictEqual(network.hrefs, ['https://example.com/', 'https://example.com/i.png'], href);
            }
        });
        it('goes past a data: icon with a bare %, broken base64 or nothing in it', async function () {
            const hrefs = [
                'data:image/svg+xml,%3Csvg%3E%',
                `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100%'%3E%3C/svg%3E`,
                'data:image/png;base64,***',
                'data:image/png;base64,',
                'data:text/html,hello',
            ];
            for (const href of hrefs) {
                const network = make_network({
                    'https://example.com/': make_html_route(`<link rel="apple-touch-icon" href="${href}">`),
                    'https://example.com/favicon.ico': make_png_route('image/x-icon'),
                });
                assert.equal((await icon_find('example.com', network.fetch_fn)).type, 'image/x-icon', href);
            }
        });
        it('goes past a body that breaks off', async function () {
            function make_broken_route(type) {
                return function () {
                    const stream = new ReadableStream({
                        pull: function (controller) {
                            controller.error(new Error('connection lost'));
                        },
                    });
                    return new Response(stream, {headers: {'Content-Type': type}});
                };
            }
            const network = make_network({
                'https://example.com/': make_broken_route('text/html'),
                'https://example.com/apple-touch-icon.png': make_broken_route('image/png'),
                'https://example.com/favicon.ico': make_png_route('image/x-icon'),
            });
            assert.equal((await icon_find('example.com', network.fetch_fn)).type, 'image/x-icon');
        });
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
        return new Response(PNG_BYTES, {headers: {'Content-Type': type}});
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

async function fail_library(domain)
{
    throw new Error(`no library lookup expected: ${domain}`);
}

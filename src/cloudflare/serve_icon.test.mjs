import assert from 'assert';
import serve_icon from './serve_icon.mjs';

describe('serve_icon', function () {
    it('answers 403 to another site', async function () {
        const response = await serve_icon(make_request('github.com', {'Sec-Fetch-Site': 'cross-site'}), {fetch_fn: fail_fetch});
        assert.equal(response.status, 403);
    });
    it('answers 403 to a request with no page behind it', async function () {
        const response = await serve_icon(make_request('github.com', {}), {fetch_fn: fail_fetch});
        assert.equal(response.status, 403);
    });
    it('takes a Referer from navplace.com when there is no Sec-Fetch-Site', async function () {
        const fetch_fn = make_fetch({'https://a.com/': make_html_route('<link rel="icon" href="/i.png">'), 'https://a.com/i.png': make_png_route()});
        const response = await serve_icon(make_request('a.com', {'Referer': 'https://navplace.com/docs.html'}), {fetch_fn});
        assert.equal(response.status, 200);
        assert.equal(response.headers.get('Content-Type'), 'image/png');
    });
    it('reads an inline data: icon', async function () {
        const svg = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'%3E%3C/svg%3E";
        const fetch_fn = make_fetch({'https://a.com/': make_html_route(`<link rel="icon" href="${svg}">`)});
        const response = await serve_icon(make_request('a.com'), {fetch_fn});
        assert.equal(response.headers.get('Content-Type'), 'image/svg+xml');
        assert.equal(await response.text(), "<svg xmlns='http://www.w3.org/2000/svg'></svg>");
    });
    it("skips Safari's mask-icon and fluid-icon for the real icon", async function () {
        const fetch_fn = make_fetch({
            'https://a.com/': make_html_route('<link rel="fluid-icon" href="/fluid.png"><link rel="mask-icon" href="/mask.svg"><link rel="alternate icon" type="image/png" href="/i.png">'),
            'https://a.com/mask.svg': make_png_route('image/svg+xml'),
            'https://a.com/fluid.png': make_png_route('image/jpeg'),
            'https://a.com/i.png': make_png_route(),
        });
        const response = await serve_icon(make_request('a.com'), {fetch_fn});
        assert.equal(response.headers.get('Content-Type'), 'image/png');
    });
    it('takes an apple-touch-icon first, the unlinked /apple-touch-icon.png too', async function () {
        const linked = make_fetch({'https://a.com/': make_html_route('<link rel="icon" href="/i.svg"><link rel="apple-touch-icon" href="/t.png">'), 'https://a.com/i.svg': make_png_route('image/svg+xml'), 'https://a.com/t.png': make_png_route()});
        assert.equal((await serve_icon(make_request('a.com'), {fetch_fn: linked})).headers.get('Content-Type'), 'image/png');
        const usual = make_fetch({'https://a.com/': make_html_route('<link rel="icon" href="/i.svg">'), 'https://a.com/i.svg': make_png_route('image/svg+xml'), 'https://a.com/apple-touch-icon.png': make_png_route()});
        assert.equal((await serve_icon(make_request('a.com'), {fetch_fn: usual})).headers.get('Content-Type'), 'image/png');
    });
    it('falls back to /favicon.ico, then Google', async function () {
        const ico = await serve_icon(make_request('a.com'), {fetch_fn: make_fetch({'https://a.com/favicon.ico': make_png_route('image/x-icon')})});
        assert.equal(ico.headers.get('Content-Type'), 'image/x-icon');
        const google = await serve_icon(make_request('a.com'), {fetch_fn: make_fetch({'https://www.google.com/s2/favicons?domain=a.com&sz=64': make_png_route()})});
        assert.equal(google.headers.get('Content-Type'), 'image/png');
    });
    it('draws its own tile when no one has an icon, and never serves a page as one', async function () {
        const fetch_fn = make_fetch({'https://www.a.com/': make_html_route('<p>no icon</p>'), 'https://www.a.com/favicon.ico': make_html_route('<p>404 page</p>')});
        const response = await serve_icon(make_request('www.a.com'), {fetch_fn});
        assert.equal(response.headers.get('Content-Type'), 'image/svg+xml');
        assert.match(await response.text(), />A<\/text>/);
        assert.equal(response.headers.get('Cache-Control'), 'public, max-age=86400, s-maxage=86400');
    });
    it('looks nothing up for localhost or an address', async function () {
        for (const domain of ['localhost:3000', '127.0.0.1', '192.168.1.1']) {
            const response = await serve_icon(make_request(domain), {fetch_fn: fail_fetch});
            assert.equal(response.headers.get('Content-Type'), 'image/svg+xml', domain);
        }
    });
    it('looks nothing up for an address spelled another way or a private name, and keeps no such key', async function () {
        const cache = make_cache();
        for (const domain of ['0x7f.1', '0177.0.0.1', '2130706433', '[::1]', 'foo.localhost', 'router.lan', 'printer.local', 'wiki.corp.internal', 'metadata.google.internal']) {
            const response = await serve_icon(make_request(domain), {cache, fetch_fn: fail_fetch, assets: {fetch: fail_fetch}});
            assert.equal(response.status, 200, domain);
            assert.equal(response.headers.get('Content-Type'), 'image/svg+xml', domain);
            assert.equal(response.headers.get('Cache-Control'), 'public, max-age=86400, s-maxage=86400', domain);
        }
        assert.equal(cache.size(), 0);
    });
    it('draws a tile for a path with a broken escape, not an error', async function () {
        for (const path of ['%E0%A4%A', '%', 'a.com%', '%ZZ.com']) {
            const response = await serve_icon(make_request(path), {fetch_fn: fail_fetch});
            assert.equal(response.status, 200, path);
            assert.equal(response.headers.get('Content-Type'), 'image/svg+xml', path);
            assert.match(await response.text(), />\?<\/text>/, path);
        }
    });
    it('goes past an icon link it cannot read to the next source', async function () {
        const links = [
            '<link rel="icon" href="http://">',
            '<link rel="icon" href="https://[bad">',
            '<link rel="icon" href="data:image/svg+xml,%3Csvg%3E%">',
            '<link rel="icon" href="data:image/png;base64,***">',
            `<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100%'%3E%3C/svg%3E">`,
        ];
        for (const link of [...links, links.join('')]) {
            const fetch_fn = make_fetch({'https://a.com/': make_html_route(link), 'https://a.com/favicon.ico': make_png_route('image/x-icon')});
            const response = await serve_icon(make_request('a.com'), {fetch_fn});
            assert.equal(response.status, 200, link);
            assert.equal(response.headers.get('Content-Type'), 'image/x-icon', link);
        }
    });
    it('draws a tile, kept a day, when the lookup fails in a way no one foresaw', async function () {
        const cache = make_cache();
        const assets = {fetch: fail_fetch};
        const response = await serve_icon(make_request('a.com'), {cache, fetch_fn: fail_fetch, assets});
        assert.equal(response.status, 200);
        assert.equal(response.headers.get('Content-Type'), 'image/svg+xml');
        assert.equal(response.headers.get('Cache-Control'), 'public, max-age=86400, s-maxage=86400');
        assert.equal(cache.size(), 1);
    });
    it("keeps the site's icon and navplace's own a month, Google's a day", async function () {
        const site = await serve_icon(make_request('a.com'), {fetch_fn: make_fetch({'https://a.com/favicon.ico': make_png_route()})});
        assert.equal(site.headers.get('Cache-Control'), 'public, max-age=86400, s-maxage=2592000');
        const files = {
            'https://navplace.com/lib/icons/index.json': new Response(JSON.stringify({'a.com': 'a.com.svg'})),
            'https://navplace.com/lib/icons/a.com.svg': new Response('<svg/>'),
        };
        const assets = {fetch: async v => files[v.url]};
        const own = await serve_icon(make_request('a.com'), {fetch_fn: fail_fetch, assets});
        assert.equal(own.headers.get('Cache-Control'), 'public, max-age=86400, s-maxage=2592000');
        const google = await serve_icon(make_request('a.com'), {fetch_fn: make_fetch({'https://www.google.com/s2/favicons?domain=a.com&sz=64': make_png_route()})});
        assert.equal(google.headers.get('Content-Type'), 'image/png');
        assert.equal(google.headers.get('Cache-Control'), 'public, max-age=86400, s-maxage=86400');
    });
    it('answers from the cache without a lookup', async function () {
        const cache = make_cache();
        await serve_icon(make_request('a.com'), {cache, fetch_fn: make_fetch({'https://a.com/favicon.ico': make_png_route()})});
        const again = await serve_icon(make_request('a.com'), {cache, fetch_fn: fail_fetch});
        assert.equal(again.headers.get('Content-Type'), 'image/png');
    });
    it('sends the headers that keep it to navplace pages', async function () {
        const response = await serve_icon(make_request('a.com'), {fetch_fn: make_fetch({})});
        assert.equal(response.headers.get('Cross-Origin-Resource-Policy'), 'same-origin');
        assert.match(response.headers.get('Content-Security-Policy'), /sandbox/);
    });
    it("takes navplace's own icon from the site's files before asking the site", async function () {
        const files = {
            'https://navplace.com/lib/icons/index.json': new Response(JSON.stringify({'sentry.io': 'sentry.io.svg'})),
            'https://navplace.com/lib/icons/sentry.io.svg': new Response('<svg/>'),
        };
        const assets = {fetch: async request => files[request.url]?.clone() ?? new Response('', {status: 404})};
        const response = await serve_icon(make_request('acme.sentry.io'), {fetch_fn: fail_fetch, assets});
        assert.equal(response.headers.get('Content-Type'), 'image/svg+xml');
        assert.equal(await response.text(), '<svg/>');
    });
});

function make_request(domain, headers = {'Sec-Fetch-Site': 'same-origin'})
{
    return new Request(`https://navplace.com/icon/${domain}`, {headers});
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

// A url not listed answers 404
function make_fetch(route_by_href)
{
    return async function (href) {
        const route = route_by_href[href];
        if (!route) {
            return new Response('Not found', {status: 404});
        }
        const response = route();
        Object.defineProperty(response, 'url', {value: href});
        return response;
    };
}

async function fail_fetch(href)
{
    throw new Error(`no fetch expected: ${href}`);
}

function make_cache()
{
    const kept = new Map();
    return {
        match: async v => kept.get(v.url)?.clone() ?? null,
        put: async (request, response) => void kept.set(request.url, response),
        size: () => kept.size,
    };
}

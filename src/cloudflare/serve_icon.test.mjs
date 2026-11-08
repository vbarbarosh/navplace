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
    };
}

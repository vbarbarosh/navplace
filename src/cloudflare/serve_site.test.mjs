import assert from 'assert';
import fs from 'fs';
import serve_site from './serve_site.mjs';

const SITE_HEADERS = {
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'strict-origin-when-cross-origin',
    'strict-transport-security': 'max-age=31536000',
};
const PAGE_HEADERS = {
    'x-frame-options': 'DENY',
    'content-security-policy': "frame-ancestors 'none'",
};

describe('serve_site', function () {
    it('answers / with index.html, not to be framed', async function () {
        const response = await serve_site(make_request('/'), {assets: make_assets()});
        assert.equal(response.status, 200);
        assert.equal(await response.text(), 'the home page');
        assert.equal(response.headers.get('Content-Type'), 'text/html;charset=utf-8');
        assert.deepStrictEqual(headers_pick(response, [...Object.keys(SITE_HEADERS), ...Object.keys(PAGE_HEADERS)]), {...SITE_HEADERS, ...PAGE_HEADERS});
    });
    it('redirects /docs and /playground to their files, with a slash at the end too', async function () {
        const location_by_pathname = {'/docs': '/docs.html', '/docs/': '/docs.html', '/playground': '/playground.html', '/playground/': '/playground.html'};
        for (const [pathname, location] of Object.entries(location_by_pathname)) {
            const response = await serve_site(make_request(pathname), {assets: make_assets()});
            assert.equal(response.status, 308, pathname);
            assert.equal(response.headers.get('Location'), location, pathname);
            assert.deepStrictEqual(headers_pick(response, Object.keys(SITE_HEADERS)), SITE_HEADERS, pathname);
        }
    });
    it('keeps the query of a redirected address', async function () {
        const response = await serve_site(make_request('/playground?from=docs'), {assets: make_assets()});
        assert.equal(response.headers.get('Location'), '/playground.html?from=docs');
    });
    it("serves a design's index.html at /designs/<name>/, free to be framed", async function () {
        const response = await serve_site(make_request('/designs/cards/'), {assets: make_assets()});
        assert.equal(response.status, 200);
        assert.equal(await response.text(), 'the cards design');
        assert.deepStrictEqual(headers_pick(response, Object.keys(SITE_HEADERS)), SITE_HEADERS);
        assert.deepStrictEqual(headers_pick(response, Object.keys(PAGE_HEADERS)), {});
    });
    it('redirects /designs/<name> to the address with the slash, where its own files are found', async function () {
        const response = await serve_site(make_request('/designs/cards'), {assets: make_assets()});
        assert.equal(response.status, 308);
        assert.equal(response.headers.get('Location'), '/designs/cards/');
    });
    it('answers 404 with a small page for anything else, a design that is not there too', async function () {
        for (const pathname of ['/nothing', '/designs/nothing/', '/designs/nothing', '/designs/', '/designs/cards/more/', '/docs.html/', '/lib/nothing.js']) {
            const response = await serve_site(make_request(pathname), {assets: make_assets()});
            const html = await response.text();
            assert.equal(response.status, 404, pathname);
            assert.equal(response.headers.get('Content-Type'), 'text/html; charset=utf-8', pathname);
            assert.match(html, /<h1>Page not found<\/h1>/, pathname);
            assert.match(html, /<a href="\/">NavPlace home<\/a>/, pathname);
            assert.deepStrictEqual(headers_pick(response, Object.keys(SITE_HEADERS)), SITE_HEADERS, pathname);
        }
    });
    it('writes nothing of the address into the 404 page and loads nothing from outside', async function () {
        const response = await serve_site(make_request('/%3Cscript%3Ealert(1)%3C/script%3E?%3Cb%3E'), {assets: make_assets()});
        const html = await response.text();
        assert.doesNotMatch(html, /alert|<b>/);
        assert.doesNotMatch(html, /<link|\ssrc=|url\(|@import/);
    });
    it('puts the site headers on an icon, beside its own', async function () {
        const response = await serve_site(make_request('/icon/localhost', {'Sec-Fetch-Site': 'same-origin'}), {assets: make_assets(), fetch_fn: fail_fetch});
        assert.equal(response.status, 200);
        assert.equal(response.headers.get('Content-Type'), 'image/svg+xml');
        assert.equal(response.headers.get('Cross-Origin-Resource-Policy'), 'same-origin');
        assert.equal(response.headers.get('Content-Security-Policy'), "default-src 'none'; style-src 'unsafe-inline'; sandbox");
        assert.deepStrictEqual(headers_pick(response, Object.keys(SITE_HEADERS)), SITE_HEADERS);
        assert.equal(response.headers.get('X-Frame-Options'), null);
    });
    // Cloudflare sends _headers with the files and the Worker sets its own: one site, the same headers
    it('sets what src/www/_headers sends with the files', async function () {
        const headers_by_path = headers_read(fs.readFileSync(new URL('../www/_headers', import.meta.url), 'utf8'));
        assert.deepStrictEqual(Object.keys(headers_by_path), ['/*', '/index.html', '/docs.html', '/playground.html']);
        assert.deepStrictEqual(headers_by_path['/*'], SITE_HEADERS);
        for (const pathname of ['/index.html', '/docs.html', '/playground.html']) {
            assert.deepStrictEqual(headers_by_path[pathname], PAGE_HEADERS, pathname);
        }
    });
});

function make_request(pathname, headers = {})
{
    return new Request(`https://navplace.com${pathname}`, {headers});
}

// The site's files as env.ASSETS answers them: the exact path only, a 404 for the rest. A file comes
// from fetch, as in the Worker: such an answer does not let its headers be changed
function make_assets()
{
    const text_by_pathname = {
        '/index.html': 'the home page',
        '/designs/cards/index.html': 'the cards design',
    };
    return {
        fetch: async function (request) {
            const text = text_by_pathname[new URL(request.url).pathname];
            if (text === undefined) {
                return new Response(null, {status: 404});
            }
            return fetch(`data:text/html;charset=utf-8,${encodeURIComponent(text)}`);
        },
    };
}

async function fail_fetch(href)
{
    throw new Error(`no fetch expected: ${href}`);
}

// The headers of `names` the answer has, by name
function headers_pick(response, names)
{
    return Object.fromEntries(names.filter(v => response.headers.has(v)).map(v => [v, response.headers.get(v)]));
}

// _headers as {path: {header in lower case: value}}: a path on a line of its own, its headers
// indented under it, # for a comment
function headers_read(text)
{
    const out = {};
    let pathname = null;
    for (const line of text.split('\n')) {
        if (!line.trim() || line.trim().startsWith('#')) {
            continue;
        }
        if (!/^\s/.test(line)) {
            pathname = line.trim();
            out[pathname] = {};
            continue;
        }
        const colon_at = line.indexOf(':');
        out[pathname][line.slice(0, colon_at).trim().toLowerCase()] = line.slice(colon_at + 1).trim();
    }
    return out;
}

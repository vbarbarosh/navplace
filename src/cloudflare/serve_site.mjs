// navplace.com is its files: Cloudflare answers a request for one of them by itself, with the
// headers of src/www/_headers. The Worker gets the rest, the addresses that are no file:
//
//     /icon/<domain>          a site's icon (serve_icon.mjs)
//     /                       index.html
//     /docs, /playground      308 to /docs.html and /playground.html, with a slash at the end too
//     /designs/<name>/        that design's index.html: its own files keep their short addresses
//     /designs/<name>         308 to /designs/<name>/, where those addresses are right
//     anything else           404, a small page that says so
//
// _headers does not reach what a Worker answers, so the same headers are set here;
// serve_site.test.mjs holds the two together

import serve_icon from './serve_icon.mjs';

// On every answer
const SITE_HEADERS = {
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Strict-Transport-Security': 'max-age=31536000',
};
// On the pages too: no other site shows one in a frame. A design is made to be framed and has none
const PAGE_HEADERS = {
    'X-Frame-Options': 'DENY',
    'Content-Security-Policy': "frame-ancestors 'none'",
};
const REDIRECTS = {
    '/docs': '/docs.html',
    '/docs/': '/docs.html',
    '/playground': '/playground.html',
    '/playground/': '/playground.html',
};

// `assets` is env.ASSETS and `cache` caches.default in the Worker; `fetch_fn` is fetch, a fake in the tests
// GET /<what no file answers> (header:sec-fetch-site, header:referer)
async function serve_site(request, {assets, cache = null, fetch_fn = fetch} = {})
{
    const url = new URL(request.url);
    if (url.pathname.startsWith('/icon/')) {
        return headers_add(await serve_icon(request, {cache, fetch_fn, assets}), SITE_HEADERS);
    }
    if (url.pathname === '/') {
        const response = await assets.fetch(new Request(new URL('/index.html', url), request));
        return headers_add(response, {...SITE_HEADERS, ...PAGE_HEADERS});
    }
    if (Object.hasOwn(REDIRECTS, url.pathname)) {
        return make_redirect(`${REDIRECTS[url.pathname]}${url.search}`);
    }
    const design_match = url.pathname.match(/^\/designs\/([^/]+)(\/?)$/);
    if (design_match) {
        const response = await assets.fetch(new Request(new URL(`/designs/${design_match[1]}/index.html`, url), request));
        if (response.ok && !design_match[2]) {
            return make_redirect(`/designs/${design_match[1]}/${url.search}`);
        }
        if (response.ok) {
            return headers_add(response, SITE_HEADERS);
        }
    }
    // navplace.com is its files and /icon/: there is no server behind it
    return new Response(render_not_found_html(), {status: 404, headers: {...SITE_HEADERS, 'Content-Type': 'text/html; charset=utf-8'}});
}

// The answer with the headers on it, as a new one: an answer from the files or from the cache does
// not let its own be changed
function headers_add(response, headers)
{
    const out = new Response(response.body, response);
    for (const [name, value] of Object.entries(headers)) {
        out.headers.set(name, value);
    }
    return out;
}

// To the address within the site, so the answer is right on any host the Worker runs under
function make_redirect(location)
{
    return new Response(null, {status: 308, headers: {...SITE_HEADERS, 'Location': location}});
}

// The site's look in a few lines: its colours in both themes and the switch between them, nothing
// loaded from outside. The address asked for is not written into the page
function render_not_found_html()
{
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="robots" content="noindex">
    <title>Page not found — NavPlace</title>
    <script>
        // Apply theme before paint to avoid flash
        (function () {
            try {
                const saved = localStorage.getItem('navplace.theme');
                document.documentElement.dataset.theme = saved || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
            }
            catch {
                document.documentElement.dataset.theme = 'light';
            }
        })();
    </script>
    <style>
        :root {
            --bg: #fafaf9;
            --border: #e7e5e4;
            --text: #1c1917;
            --text-soft: #57534e;
            --accent: #0f766e;
            color-scheme: light;
        }

        :root[data-theme="dark"] {
            --bg: #0c0c0e;
            --border: #27272a;
            --text: #f4f4f5;
            --text-soft: #a1a1aa;
            --accent: #2dd4bf;
            color-scheme: dark;
        }

        body {
            margin: 0;
            font-family: -apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", Roboto, sans-serif;
            font-size: 16px;
            line-height: 1.6;
            color: var(--text-soft);
            background: var(--bg);
        }

        a {
            color: var(--accent);
        }

        header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            height: 56px;
            padding: 0 16px;
            border-bottom: 1px solid var(--border);
        }

        .brand {
            display: flex;
            align-items: center;
            gap: 9px;
            color: var(--text);
            font-weight: 720;
            font-size: 18px;
            letter-spacing: -0.6px;
            text-decoration: none;
        }

        .mark {
            display: grid;
            place-items: center;
            width: 29px;
            height: 29px;
            border-radius: 8px;
            color: #ffffff;
            background: #286445;
        }

        .theme-switch {
            padding: 4px 10px;
            border: 1px solid var(--border);
            border-radius: 8px;
            background: transparent;
            color: var(--text-soft);
            font: inherit;
            font-size: 13px;
            cursor: pointer;
        }

        main {
            padding: 72px 16px;
            text-align: center;
        }

        h1 {
            margin: 0 0 8px;
            color: var(--text);
            font-size: 34px;
            letter-spacing: -0.02em;
        }
    </style>
</head>
<body>
<header>
    <a class="brand" href="/" aria-label="NavPlace home">
        <span class="mark" aria-hidden="true"><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m5 19 4-14 10 10-14 4Z"/><path d="m9 5 3 7 7 3M12 12l-7 7"/></svg></span>
        NavPlace
    </a>
    <button class="theme-switch" type="button" title="Switch theme">Light / dark</button>
</header>
<main>
    <h1>Page not found</h1>
    <p>There is no page at this address (404).</p>
    <p><a href="/">NavPlace home</a> · <a href="/docs.html">Docs</a> · <a href="/playground.html">Playground</a></p>
</main>
<script>
    document.querySelector('.theme-switch').addEventListener('click', function () {
        const theme = (document.documentElement.dataset.theme === 'dark') ? 'light' : 'dark';
        document.documentElement.dataset.theme = theme;
        try {
            localStorage.setItem('navplace.theme', theme);
        }
        catch {
        }
    });
</script>
</body>
</html>
`;
}

export default serve_site;

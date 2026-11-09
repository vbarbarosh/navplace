// navplace.com/icon/<domain>: a site's icon for navplace's own pages, kept in
// Cloudflare's cache. Another site gets 403, and its browser refuses the
// picture too (Cross-Origin-Resource-Policy): the route is not a free icon
// service. A request can fake its headers; this keeps honest pages out.

import icon_find from '../../lib/icon_find.js';
import icon_library_file from '../../lib/icon_library_file.js';
import is_public_domain from '../../lib/is_public_domain.js';

const DAY = 86400;
// A new value drops every icon kept at the edge: what it keeps under the old one is never asked again
const CACHE_VERSION = 4;

// What any icon answer carries: same-origin only, and an SVG opened as a page runs nothing
const ICON_HEADERS = {
    'Cross-Origin-Resource-Policy': 'same-origin',
    'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; sandbox",
    'X-Content-Type-Options': 'nosniff',
};

// `cache` is caches.default in the Worker; `fetch_fn` is fetch, a fake in the tests
// GET /icon/<domain> (header:sec-fetch-site, header:referer)
async function serve_icon(request, {cache = null, fetch_fn = fetch, assets = null} = {})
{
    const url = new URL(request.url);
    if (!is_own_page(request, url.origin)) {
        return new Response('Icons are for navplace pages only', {status: 403, headers: ICON_HEADERS});
    }

    const domain = decodeURIComponent(url.pathname.slice('/icon/'.length)).toLowerCase();
    if (!is_public_domain(domain)) {
        // localhost, an address, a port, a private name: nothing to look up
        return make_icon_response(render_tile_svg(domain), 'image/svg+xml', DAY);
    }

    const key = new Request(`${url.origin}/icon/${domain}?v=${CACHE_VERSION}`);
    const kept = cache ? await cache.match(key) : null;
    if (kept) {
        return kept;
    }

    const icon = await icon_find(domain, fetch_fn, assets ? library_from_assets(assets, url.origin) : null);
    const response = icon
        ? make_icon_response(icon.bytes, icon.type, 30*DAY)
        : make_icon_response(render_tile_svg(domain), 'image/svg+xml', DAY);
    if (cache) {
        await cache.put(key, response.clone());
    }
    return response;
}

// The page asking is navplace's own: the browser says so in Sec-Fetch-Site, or
// in Referer when it is too old for that header
function is_own_page(request, origin)
{
    const site = request.headers.get('Sec-Fetch-Site');
    if (site) {
        return site === 'same-origin';
    }
    try {
        return new URL(request.headers.get('Referer')).origin === origin;
    }
    catch {
        return false;
    }
}

function make_icon_response(body, type, max_age)
{
    return new Response(body, {
        headers: {
            ...ICON_HEADERS,
            'Content-Type': type,
            // A browser asks again after a day; the edge keeps it for max_age
            'Cache-Control': `public, max-age=${Math.min(max_age, DAY)}, s-maxage=${max_age}`,
        },
    });
}

// navplace's own stand-in: the domain's first letter on its green
function render_tile_svg(domain)
{
    const name = domain.replace(/^www\./, '');
    const letter = (name.match(/[a-z0-9]/i)?.[0] ?? '?').toUpperCase();
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#286445"/><text x="32" y="43" font-family="system-ui, sans-serif" font-size="32" font-weight="600" fill="#fff" text-anchor="middle">${letter}</text></svg>`;
}

// navplace's own icons, from the site's files (lib/icons/, its index read once per request)
function library_from_assets(assets, origin)
{
    return async function (domain) {
        const index_response = await assets.fetch(new Request(`${origin}/lib/icons/index.json`));
        if (!index_response.ok) {
            return null;
        }
        const file = icon_library_file(domain, await index_response.json());
        if (!file) {
            return null;
        }
        const response = await assets.fetch(new Request(`${origin}/lib/icons/${file}`));
        if (!response.ok) {
            return null;
        }
        return {bytes: new Uint8Array(await response.arrayBuffer()), type: file.endsWith('.svg') ? 'image/svg+xml' : 'image/png'};
    };
}

export default serve_icon;

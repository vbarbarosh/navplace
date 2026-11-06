// navplace.com/icon/<domain>: a site's icon for navplace's own pages, kept in
// Cloudflare's cache. Another site gets 403, and its browser refuses the
// picture too (Cross-Origin-Resource-Policy): the route is not a free icon
// service. A request can fake its headers; this keeps honest pages out.

const DAY = 86400;
const MAX_BYTES = 200*1024;
const TIMEOUT_MS = 4000;
// A new value drops every icon kept at the edge: what it keeps under the old one is never asked again
const CACHE_VERSION = 3;

// What any icon answer carries: same-origin only, and an SVG opened as a page runs nothing
const ICON_HEADERS = {
    'Cross-Origin-Resource-Policy': 'same-origin',
    'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; sandbox",
    'X-Content-Type-Options': 'nosniff',
};

// `cache` is caches.default in the Worker; `fetch_fn` is fetch, a fake in the tests
// GET /icon/<domain> (header:sec-fetch-site, header:referer)
async function serve_icon(request, {cache = null, fetch_fn = fetch} = {})
{
    const url = new URL(request.url);
    if (!is_own_page(request, url.origin)) {
        return new Response('Icons are for navplace pages only', {status: 403, headers: ICON_HEADERS});
    }

    const domain = decodeURIComponent(url.pathname.slice('/icon/'.length)).toLowerCase();
    if (!is_public_domain(domain)) {
        // localhost, an address, a port: nothing to look up
        return make_icon_response(render_tile_svg(domain), 'image/svg+xml', DAY);
    }

    const key = new Request(`${url.origin}/icon/${domain}?v=${CACHE_VERSION}`);
    const kept = cache ? await cache.match(key) : null;
    if (kept) {
        return kept;
    }

    const icon = await icon_find(domain, fetch_fn);
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

function is_public_domain(domain)
{
    return (domain.length <= 253) && /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(domain) && !/^[\d.]+$/.test(domain);
}

// icon, shortcut icon, alternate icon, apple-touch-icon; never Safari's one-colour mask-icon or fluid-icon
function is_icon_rel(rel)
{
    return String(rel ?? '').toLowerCase().split(/\s+/).some(v => (v === 'icon') || v.startsWith('apple-touch-icon'));
}

function is_apple_link(link)
{
    return /apple-touch-icon/i.test(link.rel);
}

// The site's own icon, its /favicon.ico, then Google's; null when none has one
async function icon_find(domain, fetch_fn)
{
    return await page_icon_find(domain, fetch_fn)
        ?? await image_fetch(`https://${domain}/apple-touch-icon.png`, fetch_fn)
        ?? await image_fetch(`https://${domain}/favicon.ico`, fetch_fn)
        ?? await image_fetch(`https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`, fetch_fn);
}

// The best <link rel="…icon…"> of the home page, a data: one too. An
// apple-touch-icon, linked or at its usual /apple-touch-icon.png, comes before
// the rest: a square with its own background, it reads on a light and a dark tile
async function page_icon_find(domain, fetch_fn)
{
    const page = await response_fetch_ok(`https://${domain}/`, fetch_fn);
    if (!page || !String(page.headers.get('Content-Type')).includes('html')) {
        return null;
    }
    const html = (await page.text()).slice(0, 512*1024);
    const links = [];
    for (const link_match of html.matchAll(/<link\b[^>]*>/gi)) {
        const tag = link_match[0];
        const link = {rel: attr_from_tag(tag, 'rel'), href: attr_from_tag(tag, 'href'), type: attr_from_tag(tag, 'type'), sizes: attr_from_tag(tag, 'sizes')};
        if (is_icon_rel(link.rel) && link.href) {
            links.push(link);
        }
    }
    links.sort((a, b) => icon_link_rank(b) - icon_link_rank(a));
    if (!links.some(is_apple_link)) {
        links.unshift({rel: 'apple-touch-icon', href: '/apple-touch-icon.png'});
    }
    for (const link of links) {
        let icon = null;
        if (link.href.startsWith('data:')) {
            icon = icon_from_data_url(link.href);
        }
        else {
            const href = new URL(html_unescape(link.href), page.url || `https://${domain}/`).href;
            icon = await image_fetch(href, fetch_fn);
        }
        if (icon) {
            return icon;
        }
    }
    return null;
}

// An apple-touch-icon first, then an SVG, then the largest
function icon_link_rank(link)
{
    if (is_apple_link(link)) {
        return 2000;
    }
    if (/svg/i.test(link.type ?? '') || /\.svg(\?|$)|^data:image\/svg/i.test(link.href)) {
        return 1000;
    }
    return Math.max(0, ...String(link.sizes ?? '').split(/\s+/).map(v => parseInt(v, 10) || 0)) || 32;
}

function attr_from_tag(tag, name)
{
    const attr_match = tag.match(new RegExp(`\\s${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'));
    return attr_match ? (attr_match[2] ?? attr_match[3] ?? attr_match[4]) : null;
}

function html_unescape(text)
{
    return text.replaceAll('&amp;', '&');
}

function icon_from_data_url(href)
{
    const data_url_match = html_unescape(href).match(/^data:(image\/[\w.+-]+)?(;base64)?,(.*)$/is);
    if (!data_url_match) {
        return null;
    }
    const type = data_url_match[1] || 'image/png';
    const bytes = data_url_match[2]
        ? Uint8Array.from(atob(data_url_match[3]), v => v.charCodeAt(0))
        : new TextEncoder().encode(decodeURIComponent(data_url_match[3]));
    return (bytes.length && (bytes.length <= MAX_BYTES)) ? {bytes, type} : null;
}

// A picture, not a page, under MAX_BYTES; null for anything else
async function image_fetch(href, fetch_fn)
{
    const response = await response_fetch_ok(href, fetch_fn);
    if (!response) {
        return null;
    }
    const type = String(response.headers.get('Content-Type') ?? '').split(';')[0].trim();
    if (!type.startsWith('image/')) {
        return null;
    }
    const bytes = new Uint8Array(await response.arrayBuffer());
    return (bytes.length && (bytes.length <= MAX_BYTES)) ? {bytes, type} : null;
}

async function response_fetch_ok(href, fetch_fn)
{
    try {
        const response = await fetch_fn(href, {redirect: 'follow', signal: AbortSignal.timeout(TIMEOUT_MS), headers: {'User-Agent': 'navplace-icon/1 (+https://navplace.com)'}});
        return response.ok ? response : null;
    }
    catch {
        return null;
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

export default serve_icon;

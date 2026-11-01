// navplace.com/icon/<domain>: a site's icon for navplace's own pages, kept in
// Cloudflare's cache. Another site gets 403, and its browser refuses the
// picture too (Cross-Origin-Resource-Policy): the route is not a free icon
// service. A request can fake its headers; this keeps honest pages out.

const DAY = 86400;
const MAX_BYTES = 200 * 1024;
const TIMEOUT_MS = 4000;

// What any icon answer carries: same-origin only, and an SVG opened as a page runs nothing
const ICON_HEADERS = {
    'Cross-Origin-Resource-Policy': 'same-origin',
    'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; sandbox",
    'X-Content-Type-Options': 'nosniff',
};

// `cache` is caches.default in the Worker; `fetch_fn` is fetch, a fake in the tests
export async function serve_icon(request, {cache = null, fetch_fn = fetch} = {})
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

    const key = new Request(`${url.origin}/icon/${domain}`);
    const kept = cache ? await cache.match(key) : null;
    if (kept) {
        return kept;
    }

    const icon = await find_icon(domain, fetch_fn);
    const response = icon
        ? make_icon_response(icon.bytes, icon.type, 30 * DAY)
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
    return domain.length <= 253
        && /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(domain)
        && !/^[\d.]+$/.test(domain);
}

// The site's own icon, its /favicon.ico, then Google's; null when none has one
async function find_icon(domain, fetch_fn)
{
    return await find_page_icon(domain, fetch_fn)
        ?? await fetch_image(`https://${domain}/favicon.ico`, fetch_fn)
        ?? await fetch_image(`https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`, fetch_fn);
}

// The best <link rel="…icon…"> of the home page, a data: one too
async function find_page_icon(domain, fetch_fn)
{
    const page = await fetch_ok(`https://${domain}/`, fetch_fn);
    if (!page || !String(page.headers.get('Content-Type')).includes('html')) {
        return null;
    }
    const html = (await page.text()).slice(0, 512 * 1024);
    const links = [...html.matchAll(/<link\b[^>]*>/gi)]
        .map(m => ({rel: read_attr(m[0], 'rel'), href: read_attr(m[0], 'href'), type: read_attr(m[0], 'type'), sizes: read_attr(m[0], 'sizes')}))
        .filter(v => /\bicon\b/i.test(v.rel ?? '') && v.href);
    links.sort((a, b) => rank_icon_link(b) - rank_icon_link(a));
    for (const link of links) {
        const icon = link.href.startsWith('data:')
            ? decode_data_url(link.href)
            : await fetch_image(new URL(html_unescape(link.href), page.url || `https://${domain}/`).href, fetch_fn);
        if (icon) {
            return icon;
        }
    }
    return null;
}

// An SVG first, then the largest; apple-touch-icon as a big plain one
function rank_icon_link(link)
{
    if (/svg/i.test(link.type ?? '') || /\.svg(\?|$)|^data:image\/svg/i.test(link.href)) {
        return 1000;
    }
    const size = Math.max(0, ...String(link.sizes ?? '').split(/\s+/).map(v => parseInt(v, 10) || 0));
    return size || (/apple-touch-icon/i.test(link.rel) ? 180 : 32);
}

function read_attr(tag, name)
{
    const m = tag.match(new RegExp(`\\s${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'));
    return m ? (m[2] ?? m[3] ?? m[4]) : null;
}

function html_unescape(text)
{
    return text.replaceAll('&amp;', '&');
}

function decode_data_url(href)
{
    const m = html_unescape(href).match(/^data:(image\/[\w.+-]+)?(;base64)?,(.*)$/is);
    if (!m) {
        return null;
    }
    const type = m[1] || 'image/png';
    const bytes = m[2]
        ? Uint8Array.from(atob(m[3]), c => c.charCodeAt(0))
        : new TextEncoder().encode(decodeURIComponent(m[3]));
    return (bytes.length && bytes.length <= MAX_BYTES) ? {bytes, type} : null;
}

// A picture, not a page, under MAX_BYTES; null for anything else
async function fetch_image(href, fetch_fn)
{
    const response = await fetch_ok(href, fetch_fn);
    if (!response) {
        return null;
    }
    const type = String(response.headers.get('Content-Type') ?? '').split(';')[0].trim();
    if (!type.startsWith('image/')) {
        return null;
    }
    const bytes = new Uint8Array(await response.arrayBuffer());
    return (bytes.length && bytes.length <= MAX_BYTES) ? {bytes, type} : null;
}

async function fetch_ok(href, fetch_fn)
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
            'Cache-Control': `public, max-age=${max_age}`,
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

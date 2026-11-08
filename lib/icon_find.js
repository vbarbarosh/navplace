// A site's own icon, the best it has, for navplace.com's /icon/ route (src/cloudflare/serve_icon.mjs)
// and the desktop app's app://favicon/: the home page's icon links, an apple-touch-icon first, then
// /apple-touch-icon.png, /favicon.ico and last Google's. {bytes, type}, or null when none has one.
// `fetch_fn` is fetch, a fake in the tests.
const MAX_BYTES = 200*1024;
const TIMEOUT_MS = 4000;

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

// icon, shortcut icon, alternate icon, apple-touch-icon; never Safari's one-colour mask-icon or fluid-icon
function is_icon_rel(rel)
{
    return String(rel ?? '').toLowerCase().split(/\s+/).some(v => (v === 'icon') || v.startsWith('apple-touch-icon'));
}

function is_apple_link(link)
{
    return /apple-touch-icon/i.test(link.rel);
}

module.exports = icon_find;

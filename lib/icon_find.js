const is_public_domain = require('./is_public_domain');

// A site's own icon, the best it has, for navplace.com's /icon/ route (src/cloudflare/serve_icon.mjs)
// and the desktop app's app://favicon/: the home page's icon links, an apple-touch-icon first, then
// /apple-touch-icon.png, /favicon.ico and last Google's. {bytes, type, source}, or null when none
// has one; `source` says where it came from: 'library', 'site' or 'google', the last resort.
// `fetch_fn` is fetch, a fake in the tests. `library`, when given, is asked first: navplace's own
// icons (lib/icons/), (domain) => {bytes, type} or null.
// A source that cannot be read (a broken link, a broken data: icon, an error, no answer) does not
// count: the next one is asked.
// A host that is not public (lib/is_public_domain.js) is null at once: nothing is fetched for it,
// and no one, Google's service too, is told its name.
// A lookup has its limits, whatever the site answers: MAX_LINKS icon links of the page are tried,
// the best first; an address is asked once; a redirect is followed by hand, MAX_REDIRECTS times,
// and only to https on a public host with no port; a body is read up to its cap and dropped
// there; a fetch has TIMEOUT_MS, and after LOOKUP_TIMEOUT_MS (`lookup_timeout_ms`, less in the
// tests) the answer is null.
const LOOKUP_TIMEOUT_MS = 8000;
const MAX_BYTES = 200*1024;
const MAX_LINKS = 4;
const MAX_PAGE_BYTES = 512*1024;
const MAX_REDIRECTS = 3;
const TIMEOUT_MS = 4000;

async function icon_find(domain, fetch_fn, library = null, lookup_timeout_ms = LOOKUP_TIMEOUT_MS)
{
    if (!is_public_domain(domain)) {
        return null;
    }
    let timer = null;

    // What one lookup keeps: the moment it ends and the addresses it has asked
    const lookup = {fetch_fn, deadline: Date.now() + lookup_timeout_ms, hrefs: new Set()};
    const timeout = new Promise(function (resolve) {
        timer = setTimeout(resolve, lookup_timeout_ms, null);
    });
    try {
        return await Promise.race([sources_ask(domain, lookup, library), timeout]);
    }
    finally {
        clearTimeout(timer);
    }
}

async function sources_ask(domain, lookup, library)
{
    const own = await library?.(domain);
    if (own) {
        return {bytes: own.bytes, type: own.type, source: 'library'};
    }
    const site = await page_icon_find(domain, lookup)
        ?? await image_fetch(`https://${domain}/apple-touch-icon.png`, lookup)
        ?? await image_fetch(`https://${domain}/favicon.ico`, lookup);
    if (site) {
        return {bytes: site.bytes, type: site.type, source: 'site'};
    }
    const google = await image_fetch(`https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`, lookup);
    return google ? {bytes: google.bytes, type: google.type, source: 'google'} : null;
}

// The best <link rel="…icon…"> of the home page, a data: one too. An
// apple-touch-icon, linked or at its usual /apple-touch-icon.png, comes before
// the rest: a square with its own background, it reads on a light and a dark tile
async function page_icon_find(domain, lookup)
{
    const page = await response_fetch_ok(`https://${domain}/`, lookup);
    if (!page) {
        return null;
    }
    if (!String(page.response.headers.get('Content-Type')).includes('html')) {
        await response_drop(page.response);
        return null;
    }
    const bytes = await response_read_bytes(page.response, MAX_PAGE_BYTES);
    if (!bytes) {
        return null;
    }
    const html = new TextDecoder().decode(bytes.subarray(0, MAX_PAGE_BYTES));
    const links = [];
    for (const link_match of html.matchAll(/<link\b[^>]*>/gi)) {
        const tag = link_match[0];
        const link = {rel: attr_from_tag(tag, 'rel'), href: attr_from_tag(tag, 'href'), type: attr_from_tag(tag, 'type'), sizes: attr_from_tag(tag, 'sizes')};
        if (is_icon_rel(link.rel) && link.href) {
            links.push(link);
        }
    }
    links.sort((a, b) => icon_link_rank(b) - icon_link_rank(a));
    // A page may list thousands: the best few are tried
    links.splice(MAX_LINKS);
    if (!links.some(is_apple_link)) {
        links.unshift({rel: 'apple-touch-icon', href: '/apple-touch-icon.png'});
    }
    for (const link of links) {
        let icon = null;
        if (link.href.startsWith('data:')) {
            icon = icon_from_data_url(link.href);
        }
        else {
            // Against the address the page came from, a redirect followed
            icon = await image_fetch(html_unescape(link.href), lookup, page.href);
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
    // Broken base64 and a bare % (width='100%') throw: such an icon does not count
    try {
        const bytes = data_url_match[2]
            ? Uint8Array.from(atob(data_url_match[3]), v => v.charCodeAt(0))
            : new TextEncoder().encode(decodeURIComponent(data_url_match[3]));
        return (bytes.length && (bytes.length <= MAX_BYTES)) ? {bytes, type} : null;
    }
    catch {
        return null;
    }
}

// A picture, not a page, under MAX_BYTES; null for anything else. `base` is given with a page's
// link: the address it is read against
async function image_fetch(href, lookup, base = undefined)
{
    const image = await response_fetch_ok(href, lookup, base);
    if (!image) {
        return null;
    }
    const type = String(image.response.headers.get('Content-Type') ?? '').split(';')[0].trim();
    if (!type.startsWith('image/')) {
        await response_drop(image.response);
        return null;
    }
    const bytes = await response_read_bytes(image.response, MAX_BYTES);
    return (bytes?.length && (bytes.length <= MAX_BYTES)) ? {bytes, type} : null;
}

// {response, href}: the answer of `href` and the address it came from, its redirects followed by
// hand. Every address on the way is checked (href_resolve_public) and asked once in a lookup.
// null for anything else: an address not to ask, a redirect too many, an error, no answer in time
async function response_fetch_ok(href, lookup, base = undefined)
{
    let location = href;
    try {
        // The address itself, then MAX_REDIRECTS more
        for (let i = 0; i <= MAX_REDIRECTS; ++i) {
            const next = href_resolve_public(location, base);
            const ms = Math.min(TIMEOUT_MS, lookup.deadline - Date.now());
            if (!next || lookup.hrefs.has(next) || (ms <= 0)) {
                return null;
            }
            lookup.hrefs.add(next);
            const response = await lookup.fetch_fn(next, {redirect: 'manual', signal: AbortSignal.timeout(ms), headers: {'User-Agent': 'navplace-icon/1 (+https://navplace.com)'}});
            if (response.ok) {
                return {response, href: next};
            }
            await response_drop(response);
            location = ((response.status >= 300) && (response.status < 400)) ? response.headers.get('Location') : null;
            if (!location) {
                return null;
            }
            base = next;
        }
        return null;
    }
    catch {
        return null;
    }
}

// The body's bytes, read piece by piece and dropped once more than `max_bytes` have come: what
// comes back is then longer than `max_bytes`, by a piece at most. null when it cannot be read
async function response_read_bytes(response, max_bytes)
{
    const pieces = [];
    try {
        const reader = response.body.getReader();
        let size = 0;
        for (let piece = await reader.read(); !piece.done; piece = await reader.read()) {
            pieces.push(piece.value);
            size += piece.value.length;
            if (size > max_bytes) {
                await reader.cancel();
                break;
            }
        }
        return new Uint8Array(await new Blob(pieces).arrayBuffer());
    }
    catch {
        return null;
    }
}

// A body no one reads is let go, and its connection with it
async function response_drop(response)
{
    try {
        await response.body?.cancel();
    }
    catch {
    }
}

// `href`, against `base` when it is relative, as the address to ask: https, a public host
// (lib/is_public_domain.js), no port, no name and password. null for any other, a broken one too
function href_resolve_public(href, base)
{
    let url;
    try {
        url = new URL(href, base);
    }
    catch {
        return null;
    }
    url.hash = '';
    const is_public = (url.protocol === 'https:') && !url.port && !url.username && !url.password && is_public_domain(url.hostname);
    return is_public ? url.href : null;
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

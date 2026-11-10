const is_public_domain = require('../../../lib/is_public_domain');
const picture_type_from_bytes = require('./picture_type_from_bytes');

// The address itself, then this many redirects
const MAX_REDIRECTS = 3;
// A picture gets this many bytes: a bigger answer is refused, not cut,
const SIZE_LIMIT = 5*1024*1024;
// and this long, from the first request to the last byte of the answer, its redirects in it
const TIME_LIMIT_MS = 10000;

// The picture at a web address, for the app to keep: {bytes, type}. Anything else throws, its
// message the reason in a few words, for the log.
//
// The address is asked the way a site's icon is (lib/icon_find.js): over https, an http one
// too, as a browser asks it for a page of navplace.com; with no name and password in it; on a
// public host with no port (lib/is_public_domain.js). A pulled document names pictures as the
// user's own file does, and no address of either may reach a machine of the user's own network.
// A redirect is followed by hand, every address on the way held to the same.
//
// What comes back is a picture by its own bytes (helpers/picture_type_from_bytes.js), whatever
// the address calls it. An SVG with a script in it is refused: nothing runs it where a design
// shows it, and the app keeps none all the same.
// `fetch_fn` is fetch, a fake in the tests.
async function picture_pull(href, {fetch_fn = fetch, time_limit_ms = TIME_LIMIT_MS, size_limit = SIZE_LIMIT} = {})
{
    const signal = AbortSignal.timeout(time_limit_ms);
    try {
        const response = await response_fetch_ok(href, fetch_fn, signal);
        const bytes = await response_read_bytes(response, size_limit);
        const type = picture_type_from_bytes(bytes);
        if (!type) {
            throw new Error('not a picture');
        }
        if ((type === 'image/svg+xml') && /<([\w.-]+:)?script[\s/>]/i.test(new TextDecoder().decode(bytes))) {
            throw new Error('an SVG with a script');
        }
        return {bytes, type};
    }
    catch (error) {
        if (signal.aborted) {
            throw new Error(`no whole answer in ${time_limit_ms} ms`);
        }
        throw error;
    }
}

// The 2xx answer of `href`, its redirects followed by hand
async function response_fetch_ok(href, fetch_fn, signal)
{
    let base = undefined;
    let location = href;

    for (let i = 0; i <= MAX_REDIRECTS; ++i) {
        const next = href_resolve(location, base);
        if (!next) {
            throw new Error(i ? 'a redirect to an address that is not public https' : 'not a public https address');
        }
        const response = await fetch_fn(next, {redirect: 'manual', signal, headers: {'Accept': 'image/*', 'User-Agent': 'navplace-picture/1 (+https://navplace.com)'}});
        if (response.ok) {
            return response;
        }
        await response_drop(response);
        location = ((response.status >= 300) && (response.status < 400)) ? response.headers.get('Location') : null;
        if (!location) {
            throw new Error(`status ${response.status}`);
        }
        base = next;
    }
    throw new Error('too many redirects');
}

// The body's bytes, read piece by piece: one that says it is over `size_limit`, or turns out to
// be, is dropped there
async function response_read_bytes(response, size_limit)
{
    const pieces = [];
    let size = 0;

    if (Number(response.headers.get('Content-Length')) > size_limit) {
        await response_drop(response);
        throw new Error(`over ${size_limit} bytes`);
    }
    // An answer with no body at all, a 204
    if (!response.body) {
        return Buffer.alloc(0);
    }
    const reader = response.body.getReader();
    for (let piece = await reader.read(); !piece.done; piece = await reader.read()) {
        pieces.push(piece.value);
        size += piece.value.length;
        if (size > size_limit) {
            await reader.cancel();
            throw new Error(`over ${size_limit} bytes`);
        }
    }
    return Buffer.concat(pieces);
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

// `href`, against `base` when it is a redirect's, as the address to ask: https in place of
// http, no fragment. null for one the app does not ask: another scheme, a name or a password,
// a port, a host that is not public, a broken one
function href_resolve(href, base)
{
    let url;
    try {
        url = new URL(href, base);
    }
    catch {
        return null;
    }
    if (url.protocol === 'http:') {
        url.protocol = 'https:';
    }
    url.hash = '';
    const is_allowed = (url.protocol === 'https:') && !url.username && !url.password && !url.port && is_public_domain(url.hostname);
    return is_allowed ? url.href : null;
}

module.exports = picture_pull;

const crypto = require('crypto');
const fs = require('fs');
const fs_path_resolve = require('@vbarbarosh/node-helpers/src/fs_path_resolve');
const picture_key_from_href = require('./picture_key_from_href');
const picture_pull = require('./picture_pull');
const picture_type_from_bytes = require('./picture_type_from_bytes');
const url_drop_secrets = require('./url_drop_secrets');

// A picture that could not be fetched is asked for again no sooner than the next of these
const RETRY_MS = 60000;

// The web pictures of the links, each fetched once and kept in `dir`: a page asks the app for a
// picture, never the web, and with no network it still gets every picture fetched before.
//
//     const pictures = make_picture_store({dir, group_uid});
//     pictures.page_url(href)      // what a page shows the picture of `href` by: app://picture/<key>
//     await pictures.read(key)     // {bytes, type}: the kept copy, or the address asked now
//
// Only an address `page_url` was given can be read: a page names a picture by the hash of its
// address (helpers/picture_key_from_href.js) and cannot have the app ask one of its own.
// A copy is kept for good, a file named by that hash: the address is asked again only when no
// copy of it is kept. Asked by several at once, it is fetched once.
//
// One that could not be fetched (helpers/picture_pull.js says why, in the log) is not kept,
// and not asked again in the same minute. `page_url` then gives it another address every
// minute, `?try=<n>` after the key: a design asks an address once and marks one that failed,
// so with the same address the picture would stay away until the app starts again.
function make_picture_store({dir, group_uid, pull = picture_pull, retry_ms = RETRY_MS, now = Date.now})
{
    // Every address a page was given, by its key
    const hrefs = new Map();
    // The pulls that run now, by key
    const pulls = new Map();
    // When the last pull of a key failed, as a number of `retry_ms` since 1970
    const failed = new Map();

    return {page_url, read};

    function page_url(href) {
        const key = picture_key_from_href(href);
        hrefs.set(key, href);
        return failed.has(key) ? `app://picture/${key}?try=${turn_now()}` : `app://picture/${key}`;
    }

    async function read(key) {
        const href = hrefs.get(key);
        if (!href) {
            throw new Error('no such picture');
        }
        const kept = await kept_read(key);
        if (kept) {
            return kept;
        }
        if (failed.get(key) === turn_now()) {
            throw new Error('asked a moment ago');
        }
        if (!pulls.has(key)) {
            pulls.set(key, pull_keep(key, href));
        }
        return pulls.get(key);
    }

    function turn_now() {
        return Math.floor(now()/retry_ms);
    }

    async function pull_keep(key, href) {
        try {
            const picture = await pull(href);
            await kept_write(key, href, picture.bytes);
            failed.delete(key);
            console.log(`[${group_uid}][picture_ok] url=${url_drop_secrets(href)} type=${picture.type} bytes=${picture.bytes.length}`);
            return picture;
        }
        catch (error) {
            failed.set(key, turn_now());
            console.error(`[${group_uid}][picture_failed] url=${url_drop_secrets(href)} reason=${JSON.stringify(error.message)}`);
            throw error;
        }
        finally {
            pulls.delete(key);
        }
    }

    // The kept copy of a key, {bytes, type}; null when none is kept, or what is there is no picture
    async function kept_read(key) {
        let bytes;
        try {
            bytes = await fs.promises.readFile(fs_path_resolve(dir, key));
        }
        catch {
            return null;
        }
        const type = picture_type_from_bytes(bytes);
        return type ? {bytes, type} : null;
    }

    // Whole or not at all: written beside its place, then moved there. A copy that cannot be
    // written costs the next start its picture, never this one
    async function kept_write(key, href, bytes) {
        const file = fs_path_resolve(dir, key);
        const temp_file = `${file}.${crypto.randomUUID()}.tmp`;
        try {
            await fs.promises.mkdir(dir, {recursive: true});
            await fs.promises.writeFile(temp_file, bytes);
            await fs.promises.rename(temp_file, file);
        }
        catch (error) {
            console.error(`[${group_uid}][picture_keep_failed] url=${url_drop_secrets(href)} reason=${JSON.stringify(error.message)}`);
            await fs.promises.rm(temp_file, {force: true}).catch(() => {});
        }
    }
}

module.exports = make_picture_store;

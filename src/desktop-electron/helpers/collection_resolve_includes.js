const crypto = require('crypto');
const fs = require('fs');
const fs_mkdirp = require('@vbarbarosh/node-helpers/src/fs_mkdirp');
const fs_path_basename = require('@vbarbarosh/node-helpers/src/fs_path_basename');
const fs_path_resolve = require('@vbarbarosh/node-helpers/src/fs_path_resolve');
const fs_read_utf8 = require('@vbarbarosh/node-helpers/src/fs_read_utf8');
const fs_write = require('@vbarbarosh/node-helpers/src/fs_write');
const http_get_utf8 = require('@vbarbarosh/node-helpers/src/http_get_utf8');
const include_spec_from_text = require('./include_spec_from_text');
const parse = require('../../../lib/parse');

// An include address gets this long, counted from the request to the last byte of its answer,
const TIME_LIMIT_MS = 5000;
// and this many bytes of text: a longer answer is refused, not cut
const SIZE_LIMIT = 2*1024*1024;

// `% include:` pulls another document into this one. The directive belongs to
// the desktop app; the web app and the embed widget ignore it.
//
// A pulled document contributes links and sections only — its own directives
// are dropped before parsing, so it cannot switch the design, apply `% ns:`,
// or pull further documents. The pull happens first and `% ns:` runs after it:
// the filter of the pulling document gates local and pulled links alike. The
// request carries no access token: an include url is a stranger.
//
// The addresses are pulled side by side, so a reload takes as long as its
// slowest one and not as all of them in a row; the links stay in the order the
// file lists its includes.
//
// With a folder in `kept_dir` the last good text of every address is kept there
// and stands in for a pull that fails, however old it is: a laptop without its
// network keeps the pulled links. Without one a failed pull adds nothing.
async function collection_resolve_includes(collection, group_uid, {kept_dir = null, time_limit_ms = TIME_LIMIT_MS, size_limit = SIZE_LIMIT} = {})
{
    const specs = (collection.meta.include || []).map(include_spec_from_text);
    const options = {group_uid, ns: collection.meta.ns, kept_dir, time_limit_ms, size_limit};
    const lists = await Promise.all(specs.map(v => include_items_pull(v, options)));

    // flat(), not push(...list): a very long list as arguments does not fit the stack
    return {meta: collection.meta, items: [collection.items, ...lists].flat()};
}

// The links of one include: pulled, or of its kept copy when the pull fails, or none. One dead
// url keeps the rest of the collection alive
async function include_items_pull(spec, {group_uid, ns, kept_dir, time_limit_ms, size_limit})
{
    let text = null;
    let kept = null;

    // A query may carry a token, the address a user and a password: the
    // logs keep the url without them
    const url_without_secrets = url_drop_secrets(spec.url);
    if (!spec.url.startsWith('http://') && !spec.url.startsWith('https://')) {
        console.error(`[${group_uid}][include_skipped] url=${url_without_secrets}`);
        return [];
    }
    try {
        text = await include_text_pull(spec.url, time_limit_ms, size_limit);
    }
    catch (error) {
        console.error(`[${group_uid}][include_failed] url=${url_without_secrets} reason=${JSON.stringify(error.message)}`);
        kept = await include_kept_read(kept_dir, spec.url);
        if (!kept) {
            return [];
        }
        text = kept.text;
    }
    const included = parse(text_drop_directives(text), {prefix: spec.prefix, suffix: spec.suffix, tags: spec.tags, ns});
    if (kept) {
        console.log(`[${group_uid}][include_kept] url=${url_without_secrets} file=${fs_path_basename(kept.file)} kept_at=${kept.kept_at.toISOString()} items=${included.items.length}`);
    }
    else {
        console.log(`[${group_uid}][include_ok] url=${url_without_secrets} items=${included.items.length}`);
        await include_kept_write(kept_dir, spec.url, text, group_uid);
    }
    return included.items;
}

// The text an address answers with. The time limit is a total: an address that keeps sending
// a line now and then is cut like a silent one. Startup and every summon wait for this
async function include_text_pull(url, time_limit_ms, size_limit)
{
    const signal = AbortSignal.timeout(time_limit_ms);
    try {
        return await http_get_utf8(url, {signal, maxContentLength: size_limit});
    }
    catch (error) {
        if (signal.aborted) {
            throw new Error(`no whole answer in ${time_limit_ms} ms`);
        }
        throw error;
    }
}

// The kept copy of an address: {file, text, kept_at}, the time of its last good pull; null when
// nothing is kept
async function include_kept_read(kept_dir, url)
{
    if (!kept_dir) {
        return null;
    }
    const file = kept_file_from_url(kept_dir, url);
    try {
        const stat = await fs.promises.stat(file);
        return {file, text: await fs_read_utf8(file), kept_at: stat.mtime};
    }
    catch {
        return null;
    }
}

// A good pull replaces the kept copy, whole or not at all: written beside it, then moved over it.
// A copy that cannot be written costs the next offline hour its links, never this pull
async function include_kept_write(kept_dir, url, text, group_uid)
{
    if (!kept_dir) {
        return;
    }
    const file = kept_file_from_url(kept_dir, url);
    const temp_file = `${file}.${crypto.randomUUID()}.tmp`;
    try {
        await fs_mkdirp(kept_dir);
        await fs_write(temp_file, text);
        await fs.promises.rename(temp_file, file);
    }
    catch (error) {
        console.error(`[${group_uid}][include_keep_failed] url=${url_drop_secrets(url)} reason=${JSON.stringify(error.message)}`);
        await fs.promises.rm(temp_file, {force: true}).catch(() => {});
    }
}

// Named by a hash of the whole address: its user, password and query never reach a file name
function kept_file_from_url(kept_dir, url)
{
    return fs_path_resolve(kept_dir, `${crypto.createHash('sha256').update(url).digest('hex')}.md`);
}

function text_drop_directives(text)
{
    return text.split('\n').filter(v => !v.trim().startsWith('%')).join('\n');
}

// An address as the logs may keep it: no query, no fragment, no user and no
// password. One that does not parse is not repeated at all, and one with no
// `//` keeps its scheme only: nothing there tells a user and a password from
// the rest.
function url_drop_secrets(text)
{
    let url = null;
    try {
        url = new URL(text);
    }
    catch {
        return 'invalid-url';
    }
    if (!url.host && !url.pathname.startsWith('/')) {
        return url.protocol;
    }
    return `${url.protocol}//${url.host}${url.pathname}`;
}

module.exports = collection_resolve_includes;

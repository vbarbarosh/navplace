const assert = require('node:assert/strict');
const fs = require('node:fs');
const make_picture_store = require('./make_picture_store');
const os = require('node:os');
const path = require('node:path');
const picture_key_from_href = require('./picture_key_from_href');
const test = require('node:test');

const GROUP_UID = 'test';
const HREF = 'https://example.com/img/logo.png?token=abc';
const KEY = picture_key_from_href(HREF);
const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex');
const SVG = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>');

test('make_picture_store: a picture is fetched once, kept, and read from its copy ever after', async function (t) {
    await using kept = await make_kept_dir();
    const logged = t.mock.method(console, 'log', () => {});
    const pull = make_pull({[HREF]: PNG});
    const pictures = make_picture_store({dir: kept.dir, group_uid: GROUP_UID, pull});

    assert.equal(pictures.page_url(HREF), `app://picture/${KEY}`);
    assert.deepEqual(await pictures.read(KEY), {bytes: PNG, type: 'image/png'});
    assert.deepEqual(await pictures.read(KEY), {bytes: PNG, type: 'image/png'});
    assert.deepEqual(pull.asked, [HREF]);
    assert.deepEqual(await fs.promises.readdir(kept.dir), [KEY]);
    assert.deepEqual(logged.mock.calls.map(v => v.arguments[0]), ['[test][picture_ok] url=https://example.com/img/logo.png type=image/png bytes=16']);

    // The app started again, the address gone from the web: the copy is all it takes
    const dead = make_pull({});
    const again = make_picture_store({dir: kept.dir, group_uid: GROUP_UID, pull: dead});
    assert.equal(again.page_url(HREF), `app://picture/${KEY}`);
    assert.deepEqual(await again.read(KEY), {bytes: PNG, type: 'image/png'});
    assert.deepEqual(dead.asked, []);
});

test('make_picture_store: only a picture a page was given an address for can be read', async function () {
    await using kept = await make_kept_dir();
    const pull = make_pull({[HREF]: PNG});
    const pictures = make_picture_store({dir: kept.dir, group_uid: GROUP_UID, pull});

    await assert.rejects(pictures.read(KEY), {message: 'no such picture'});
    await assert.rejects(pictures.read('../../etc/hostname'), {message: 'no such picture'});
    await assert.rejects(pictures.read(''), {message: 'no such picture'});
    assert.deepEqual(pull.asked, []);

    // A copy kept by an earlier run is not handed out either, until a link shows it
    await fs.promises.writeFile(path.join(kept.dir, KEY), PNG);
    await assert.rejects(pictures.read(KEY), {message: 'no such picture'});
    pictures.page_url(HREF);
    assert.deepEqual(await pictures.read(KEY), {bytes: PNG, type: 'image/png'});
    assert.deepEqual(pull.asked, []);
});

test('make_picture_store: asked by several at once, an address is fetched once', async function (t) {
    await using kept = await make_kept_dir();
    t.mock.method(console, 'log', () => {});
    const pull = make_pull({[HREF]: PNG}, 20);
    const pictures = make_picture_store({dir: kept.dir, group_uid: GROUP_UID, pull});

    pictures.page_url(HREF);
    const actual = await Promise.all([pictures.read(KEY), pictures.read(KEY), pictures.read(KEY)]);
    assert.deepEqual(actual.map(v => v.type), ['image/png', 'image/png', 'image/png']);
    assert.deepEqual(pull.asked, [HREF]);
});

test('make_picture_store: two addresses are two copies, each of its own kind', async function (t) {
    await using kept = await make_kept_dir();
    t.mock.method(console, 'log', () => {});
    const other = 'https://example.org/logo';
    const pull = make_pull({[HREF]: PNG, [other]: SVG});
    const pictures = make_picture_store({dir: kept.dir, group_uid: GROUP_UID, pull});

    assert.notEqual(pictures.page_url(other), pictures.page_url(HREF));
    assert.equal((await pictures.read(KEY)).type, 'image/png');
    assert.deepEqual(await pictures.read(picture_key_from_href(other)), {bytes: SVG, type: 'image/svg+xml'});
    assert.equal((await fs.promises.readdir(kept.dir)).length, 2);
});

test('make_picture_store: one that failed is not kept, and is asked again a minute later under a new address', async function (t) {
    let clock = 600000;

    await using kept = await make_kept_dir();
    t.mock.method(console, 'log', () => {});
    const failed = t.mock.method(console, 'error', () => {});
    const pull = make_pull({});
    const pictures = make_picture_store({dir: kept.dir, group_uid: GROUP_UID, pull, now: () => clock});

    assert.equal(pictures.page_url(HREF), `app://picture/${KEY}`);
    await assert.rejects(pictures.read(KEY), {message: 'status 404'});
    assert.deepEqual(failed.mock.calls.map(v => v.arguments[0]), ['[test][picture_failed] url=https://example.com/img/logo.png reason="status 404"']);
    assert.deepEqual(await fs.promises.readdir(kept.dir), []);

    // The same minute: another address for the page, the web is not asked
    clock += 30000;
    assert.equal(pictures.page_url(HREF), `app://picture/${KEY}?try=10`);
    await assert.rejects(pictures.read(KEY), {message: 'asked a moment ago'});
    assert.deepEqual(pull.asked, [HREF]);

    // The next minute: a new address, the web asked once more, and it fails again
    clock += 30000;
    assert.equal(pictures.page_url(HREF), `app://picture/${KEY}?try=11`);
    await assert.rejects(pictures.read(KEY), {message: 'status 404'});
    await assert.rejects(pictures.read(KEY), {message: 'asked a moment ago'});
    assert.deepEqual(pull.asked, [HREF, HREF]);

    // The picture is there at last: fetched, kept, and its address is the plain one again
    pull.bytes_by_href[HREF] = PNG;
    clock += 60000;
    assert.equal(pictures.page_url(HREF), `app://picture/${KEY}?try=12`);
    assert.deepEqual(await pictures.read(KEY), {bytes: PNG, type: 'image/png'});
    assert.equal(pictures.page_url(HREF), `app://picture/${KEY}`);
    assert.deepEqual(pull.asked, [HREF, HREF, HREF]);
    assert.deepEqual(await fs.promises.readdir(kept.dir), [KEY]);
});

test('make_picture_store: a copy that is no picture does not count as kept', async function (t) {
    await using kept = await make_kept_dir();
    t.mock.method(console, 'log', () => {});
    const pull = make_pull({[HREF]: PNG});
    const pictures = make_picture_store({dir: kept.dir, group_uid: GROUP_UID, pull});

    await fs.promises.writeFile(path.join(kept.dir, KEY), 'half a file');
    pictures.page_url(HREF);
    assert.deepEqual(await pictures.read(KEY), {bytes: PNG, type: 'image/png'});
    assert.deepEqual(pull.asked, [HREF]);
    assert.deepEqual(await fs.promises.readFile(path.join(kept.dir, KEY)), PNG);
});

test('make_picture_store: a copy that cannot be written does not cost the picture', async function (t) {
    await using kept = await make_kept_dir();
    t.mock.method(console, 'log', () => {});
    const failed = t.mock.method(console, 'error', () => {});
    const pull = make_pull({[HREF]: PNG});
    // A file where the folder should be
    await fs.promises.writeFile(path.join(kept.dir, 'file'), '');
    const pictures = make_picture_store({dir: path.join(kept.dir, 'file', 'pictures'), group_uid: GROUP_UID, pull});

    pictures.page_url(HREF);
    assert.deepEqual(await pictures.read(KEY), {bytes: PNG, type: 'image/png'});
    assert.equal(pictures.page_url(HREF), `app://picture/${KEY}`);
    assert.equal(failed.mock.calls.length, 1);
    assert.match(failed.mock.calls[0].arguments[0], /^\[test\]\[picture_keep_failed\] url=https:\/\/example\.com\/img\/logo\.png reason=/);
});

test('make_picture_store: no half-written file is left beside the copies', async function (t) {
    await using kept = await make_kept_dir();
    t.mock.method(console, 'log', () => {});
    const pictures = make_picture_store({dir: kept.dir, group_uid: GROUP_UID, pull: make_pull({[HREF]: PNG})});

    pictures.page_url(HREF);
    await pictures.read(KEY);
    assert.deepEqual(await fs.promises.readdir(kept.dir), [KEY]);
});

// A pull that answers the addresses of `bytes_by_href`, a PNG or an SVG each, after `delay_ms`,
// and keeps what it was asked in `asked`; any other address is a 404
function make_pull(bytes_by_href, delay_ms = 0)
{
    pull.asked = [];
    pull.bytes_by_href = bytes_by_href;

    return pull;

    async function pull(href) {
        pull.asked.push(href);
        await new Promise(v => setTimeout(v, delay_ms));
        const bytes = pull.bytes_by_href[href];
        if (!bytes) {
            throw new Error('status 404');
        }
        return {bytes, type: (bytes[0] === 0x89) ? 'image/png' : 'image/svg+xml'};
    }
}

// An empty folder for kept copies, removed with what it holds
async function make_kept_dir()
{
    const dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'navplace-pictures-'));
    return {
        dir,
        [Symbol.asyncDispose]: async function () {
            await fs.promises.rm(dir, {recursive: true, force: true});
        },
    };
}

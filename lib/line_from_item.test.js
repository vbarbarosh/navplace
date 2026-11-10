#!/usr/bin/env mocha

const assert = require('assert');
const line_from_item = require('./line_from_item');
const parse = require('./parse');

describe('line_from_item', function () {
    it('changes only the part that changed, spacing kept', function () {
        assert.equal(line_edit('Mail     #work   https://gmail.com/', {label: 'Mail Box'}), 'Mail Box     #work   https://gmail.com/');
        assert.equal(line_edit('Mail     #work   https://gmail.com/', {href: 'https://mail.google.com/'}), 'Mail     #work   https://mail.google.com/');
    });

    it('rewrites the tags where the first one stood', function () {
        assert.equal(line_edit('Mail #a Inbox #b https://x.com/', {tags: ['a', 'c']}), 'Mail #a #c Inbox https://x.com/');
        assert.equal(line_edit('Mail #a #b https://x.com/', {tags: []}), 'Mail https://x.com/');
        assert.equal(line_edit('Mail https://x.com/', {tags: ['work']}), 'Mail #work https://x.com/');
    });

    it('adds, changes and drops meta', function () {
        assert.equal(line_edit('Mail #w=2 https://x.com/', {meta: {w: '3'}}), 'Mail #w=3 https://x.com/');
        assert.equal(line_edit('Mail #work https://x.com/', {meta: {w: '2'}}), 'Mail #work #w=2 https://x.com/');
        assert.equal(line_edit('Mail #w=2 https://x.com/', {meta: {}}), 'Mail https://x.com/');
    });

    it('adds, changes and drops the picture', function () {
        assert.equal(line_edit('Mail https://x.com/', {image_url: 'private://m.png'}), 'Mail @m.png https://x.com/');
        assert.equal(line_edit('Mail @m.png https://x.com/', {image_url: '@n.png'}), 'Mail @n.png https://x.com/');
        assert.equal(line_edit('Mail @m.png https://x.com/', {image_url: null}), 'Mail https://x.com/');
    });

    it('puts a label in front of a bare link', function () {
        assert.equal(line_edit('https://github.com/', {label: 'GitHub'}), 'GitHub https://github.com/');
    });

    // A line that opens with # is a section: the tag needs a name before it
    it('gives a link with no name the name parse shows for it when it takes a tag or meta', function () {
        assert.equal(line_edit('https://github.com/', {tags: ['dev']}), 'github.com #dev https://github.com/');
        assert.equal(line_edit('  https://github.com/', {tags: ['dev']}), '  github.com #dev https://github.com/');
        assert.equal(line_edit('https://example.com/a/b?c=1', {meta: {w: '2'}}), 'example.com/a/b #w=2 https://example.com/a/b?c=1');
        assert.equal(line_edit('Mail #work https://x.com/', {label: ''}), 'x.com #work https://x.com/');
        assert.equal(line_edit('@g.png https://github.com/', {tags: ['dev']}), 'github.com #dev @g.png https://github.com/');
        assert.deepStrictEqual(parts_read(line_edit('@g.png https://github.com/', {tags: ['dev']})), {label: 'github.com', href: 'https://github.com/', tags: ['dev'], image_url: 'private://g.png', meta: {}});
    });

    it('writes that name in the address\'s own letters, as parse shows it', function () {
        assert.equal(line_edit('https://пример.рф/путь?стр=2', {tags: ['dev']}), 'пример.рф/путь #dev https://пример.рф/путь?стр=2');
        assert.equal(line_edit('https://example.com/%D0%BF/a%20b', {meta: {w: '2'}}), 'example.com/п/a b #w=2 https://example.com/%D0%BF/a%20b');
        assert.equal(line_edit('https://example.com/%FF', {tags: ['dev']}), 'example.com/%FF #dev https://example.com/%FF');
        assert.throws(() => line_edit('https://example.com/%20%23b', {tags: ['dev']}), /^Error: "label" cannot be written into the line as it is: it would read back as "example\.com\/"\.$/);
    });

    it('leaves a link with no name without one while it has no tag or meta', function () {
        assert.equal(line_edit('Mail https://x.com/', {label: ''}), 'https://x.com/');
        assert.equal(line_edit('Mail #a https://x.com/', {label: '', tags: []}), 'https://x.com/');
        assert.equal(line_edit('https://x.com/', {href: 'https://y.org/z'}), 'https://y.org/z');
    });

    it('writes several parts changed at once', function () {
        assert.equal(line_edit('https://x.com/', {label: 'New Name', href: 'https://y.org/z'}), 'New Name https://y.org/z');
        assert.equal(line_edit('Mail  https://x.com/', {label: '', meta: {q: '9'}}), 'x.com #q=9  https://x.com/');
        assert.equal(line_edit('https://x.com/', {label: 'Mail', tags: ['a'], image_url: 'm.png', meta: {w: '2'}}), 'Mail #a #w=2 @m.png https://x.com/');
        assert.equal(line_edit('  Mail   #a   @m.png   https://x.com/  ', {label: '', tags: [], image_url: null}), '  https://x.com/  ');
    });

    it('keeps the space of a part taken out for the part glued to it', function () {
        assert.equal(line_edit('A #thttps://x.com/', {tags: []}), 'A https://x.com/');
        assert.equal(line_edit('A #t,B https://x.com/', {tags: []}), 'A ,B https://x.com/');
        assert.equal(line_edit('A #w=2https://x.com/', {meta: {}}), 'A https://x.com/');
    });

    it('keeps a # inside a word in the name: a tag stands after a space', function () {
        assert.equal(line_edit('F#minor chords https://a.com/', {tags: ['music']}), 'F#minor chords #music https://a.com/');
        assert.equal(line_edit('Mail#work https://x.com/', {label: ''}), 'https://x.com/');
        assert.equal(line_edit('Mail https://x.com/', {label: 'Issue#12'}), 'Issue#12 https://x.com/');
    });

    it('writes a value with a # in it, and an empty one', function () {
        assert.equal(line_edit('Mail https://x.com/', {meta: {color: '#fff'}}), 'Mail #color=#fff https://x.com/');
        assert.equal(line_edit('Mail #color=#fff https://x.com/', {meta: {color: '#000'}}), 'Mail #color=#000 https://x.com/');
        assert.equal(line_edit('Mail #w=2 https://x.com/', {meta: {w: ''}}), 'Mail #w= https://x.com/');
        assert.equal(line_edit('Mail #w= #dev https://x.com/', {meta: {w: 'a#b'}}), 'Mail #w=a#b #dev https://x.com/');
        assert.equal(line_edit('Mail #w= https://x.com/', {meta: {}}), 'Mail https://x.com/');
        assert.deepStrictEqual(parts_read(line_edit('https://x.com/', {meta: {w: ''}})), {label: 'x.com', href: 'https://x.com/', tags: [], image_url: null, meta: {w: ''}});
    });

    it('refuses what a link line cannot hold, saying which part', function () {
        assert.throws(() => line_edit('Mail https://x.com/', {label: 'Mail @home'}), /^Error: "label" cannot be written into the line as it is: it would read back as "Mail"\.$/);
        assert.throws(() => line_edit('Mail https://x.com/', {label: 'Fix #12'}), /"label" cannot be written/);
        assert.throws(() => line_edit('Mail https://x.com/', {meta: {w: 'a b'}}), /"label" cannot be written into the line as it is: it would read back as "Mail b"\.$/);
        assert.throws(() => line_edit('Mail https://x.com/', {label: '%off'}), /^Error: This cannot be written as a link: the line "%off https:\/\/x\.com\/" would not read as one\.$/);
        assert.throws(() => line_edit('Mail https://x.com/', {href: 'https://a:b'}), /would not read as one/);
        assert.throws(() => line_edit('Mail https://x.com/', {image_url: 'https://example.com/p.png'}), /"image_url" cannot be written/);
        assert.throws(() => line_edit('Mail https://x.com/', {image_url: 'private://'}), /"image_url" cannot be written/);
        assert.throws(() => line_edit('file:///', {tags: ['x']}), /^Error: A link with no name cannot take tags or meta: give it a "label" first\.$/);
        // The same label is fine where a tag follows it: then @home is not the last word before the url
        assert.equal(line_edit('Mail #w https://x.com/', {label: 'Mail @home'}), 'Mail @home #w https://x.com/');
    });

    it('puts a picture in front of a bare link, and parse reads it back', function () {
        const line = line_edit('https://github.com/', {image_url: 'private://g.png'});
        assert.equal(line, '@g.png https://github.com/');
        const item = parse(line).items[0];
        assert.deepStrictEqual({label: item.label, image_url: item.image_url}, {label: 'github.com', image_url: 'private://g.png'});
    });

    it('leaves a label split by a tag alone when its words stay', function () {
        const line = 'Mail #a Inbox #b https://x.com/';
        const once = line_edit(line, {tags: ['a', 'c']});
        assert.equal(once, 'Mail #a #c Inbox https://x.com/');
        const item = parse(line, {spans: true}).items[0];
        assert.equal(line_edit(once, {label: item.label, tags: ['a', 'c']}), once);
    });

    it('keeps a label split by a tag in one piece', function () {
        assert.equal(line_edit('Mail #a Inbox https://x.com/', {label: 'Post'}), 'Post #a https://x.com/');
    });

    it('gives back what parse reads as the edit', function () {
        const line = '  Mail #work @m.png https://gmail.com/';
        const edited = {label: 'Box', href: 'https://box.com/', tags: ['home', 'new'], image_url: null, meta: {w: '2'}};
        const item = parse(line_edit(line, edited)).items[0];
        assert.deepStrictEqual({label: item.label, href: item.href, tags: item.tags, image_url: item.image_url, meta: item.meta}, edited);
    });

    // Seeded: a failure names its line and its edit, and the same run comes again
    it('writes any edit into any line so that parse reads the edit back', function () {
        const random = make_random(20261110);
        for (let i = 0; i < 5000; ++i) {
            const line = make_line(random);
            const item = parse(line, {spans: true}).items[0];
            const edited = make_edit(random, item);
            const what = `${JSON.stringify(line)} with ${JSON.stringify(edited)}`;
            const written = line_from_item(line, item, edited);
            // A link with no name keeps none: it shows the address it has now
            const is_named = !!edited.label.trim() && ((item.spans.label.length > 0) || (words_of(edited.label) !== words_of(item.label)));
            const wanted = {...edited, label: is_named ? words_of(edited.label) : parse(edited.href).items[0].label, image_url: edited.image_url && `private://${edited.image_url.replace(/^private:\/\/|^@/, '')}`};
            assert.deepStrictEqual(parts_read(written), wanted, `${what} gave ${JSON.stringify(written)}`);
            assert.equal(written.match(/^ */)[0], line.match(/^ */)[0], `${what}: the indent moved`);
            if (JSON.stringify(parts_read(line)) === JSON.stringify(wanted)) {
                assert.equal(written, line, `${what}: nothing changed, the line did`);
            }
        }
    });
});

function line_edit(line, changes)
{
    const item = parse(line, {spans: true}).items[0];
    const edited = {label: item.label, href: item.href, tags: item.tags, image_url: item.image_url, meta: item.meta, ...changes};
    return line_from_item(line, item, edited);
}

// The parts a person may change, as parse reads them from a line; the label by its words
function parts_read(line)
{
    const parsed = parse(line);
    assert.equal(parsed.items.length, 1, `${JSON.stringify(line)} is not one link`);
    assert.equal(parsed.warnings, undefined, `${JSON.stringify(line)} has warnings`);
    const item = parsed.items[0];
    return {label: words_of(item.label), href: item.href, tags: item.tags, image_url: item.image_url, meta: item.meta};
}

function words_of(text)
{
    return text.trim().replace(/\s+/g, ' ');
}

// mulberry32: the same numbers in [0, 1) for the same seed
function make_random(seed)
{
    let state = seed;
    return function () {
        state = (state + 0x6D2B79F5) | 0;
        let mixed = Math.imul(state ^ (state >>> 15), 1 | state);
        mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
        return ((mixed ^ (mixed >>> 14)) >>> 0)/4294967296;
    };
}

function make_pick(random, values)
{
    return values[Math.floor(random()*values.length)];
}

// 0 to `max` of the values, each at most once, in a random order
function make_picks(random, values, max)
{
    const out = [];
    const count = Math.floor(random()*(max + 1));
    while (out.length < Math.min(count, values.length)) {
        const value = make_pick(random, values);
        if (!out.includes(value)) {
            out.push(value);
        }
    }
    return out;
}

function make_label(random)
{
    const words = ['Mail', 'Inbox', 'GitHub', 'Почта', 'Ёлка', '日本語', 'Café', 'Zoë', 'C++', 'a.b', 'x_y', 'Dr.', "it's", '№5', '100%', 'A&B', '😀', 'e@mail', 'see', 'https://example.net/x', '(old)', 'C#', 'F#minor', 'Issue#12', 'a#b=c'];
    const out = [make_pick(random, words)];
    while (random() < 0.45) {
        out.push(make_pick(random, words));
    }
    return out;
}

function make_meta(random)
{
    const keys = make_picks(random, ['w', 'q', 'size', 'data-x', 'k_1', '2'], 2);
    return Object.fromEntries(keys.map(v => [v, make_pick(random, ['2', '9', 'a.b', 'x/y', '50%', 'v=1', 'ü', '@m', '', '#fff', 'a#b', '#', '#k=v'])]));
}

function make_href(random)
{
    return make_pick(random, ['https://x.com/', 'https://github.com/', 'https://example.com/a/b?c=1&d=2', 'https://example.org/page#part', 'http://localhost:3000/', 'http://192.168.1.1/admin', 'https://почта.example/путь', 'file:///home/user/notes.html', 'https://example.com/@user/post', 'https://y.org/z', 'https://example.com/%D0%BF%D1%83%D1%82%D1%8C/a%20b', 'https://example.com/%FF/x', 'https://Example.com/Docs/']);
}

function make_picture(random)
{
    return make_pick(random, ['m.png', 'g.svg', 'pics/a-1.webp', 'фото.jpg', 'x']);
}

function make_tags(random)
{
    return make_picks(random, ['dev', 'work', 'a-b', 'x_1', '2024', 'W'], 3);
}

// A link line: leading spaces, a name of words with tags and #key=value among them, a picture, the
// url, 1 to 3 spaces between the parts. A line with no name has no tags: it would be a section
function make_line(random)
{
    const lead = ' '.repeat(make_pick(random, [0, 0, 2, 4, 7]));
    const tail = make_pick(random, ['', '', ' ', '  ']);
    const picture = (random() < 0.4) ? [`@${make_picture(random)}`] : [];
    if (random() < 0.25) {
        return `${lead}${[...picture, make_href(random)].join(' '.repeat(1 + Math.floor(random()*3)))}${tail}`;
    }
    const words = make_label(random);
    const marks = [...make_tags(random).map(v => `#${v}`), ...Object.entries(make_meta(random)).map(v => `#${v[0]}=${v[1]}`)];
    const rest = [...words.slice(1), ...marks].map(v => [random(), v]).sort((a, b) => a[0] - b[0]).map(v => v[1]);
    const parts = [words[0], ...rest, ...picture, make_href(random)];
    return `${lead}${parts.map((v, i) => `${i ? ' '.repeat(1 + Math.floor(random()*3)) : ''}${v}`).join('')}${tail}`;
}

// Each part of the item changed or left as it is, several at once more often than not
function make_edit(random, item)
{
    const out = {label: item.label, href: item.href, tags: item.tags, image_url: item.image_url, meta: item.meta};
    if (random() < 0.5) {
        out.label = (random() < 0.3) ? '' : make_label(random).join(make_pick(random, [' ', ' ', '  ']));
    }
    if (random() < 0.3) {
        out.href = make_href(random);
    }
    if (random() < 0.5) {
        out.tags = make_tags(random);
    }
    if (random() < 0.4) {
        out.image_url = make_pick(random, [null, `private://${make_picture(random)}`, `@${make_picture(random)}`, make_picture(random)]);
    }
    if (random() < 0.4) {
        out.meta = make_meta(random);
    }
    return out;
}

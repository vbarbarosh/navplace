#!/usr/bin/env mocha

const assert = require('assert');
const parse = require('./parse');

describe('parse', function () {
    it('happy path', function () {
        const actual = parse(`
ChatGPT https://chatgpt.com/
GitHub  https://github.com/
Gmail   https://mail.google.com/
`);
        assert.ok(actual.items.length > 1);
    });

    it('meta, tags, and images', function () {
        const actual = parse(`
% design: github
% foo: bar

ChatGPT #aa #xx=yy https://chatgpt.com/
GitHub  #aa https://github.com/
Gmail   #bb @img/gmail.png https://mail.google.com/
`);
        assert.deepStrictEqual(actual, {
            meta: {design: 'github', foo: 'bar'},
            items: [
                {
                    label: 'ChatGPT',
                    href: 'https://chatgpt.com/',
                    icon_url: 'app://favicon/chatgpt.com?letter=C',
                    image_url: null,
                    tags: ['aa'],
                    meta: {xx: 'yy'},
                    search1: 'chatgpt aa',
                    search2: 'https://chatgpt.com/',
                    namespaces: [],
                },
                {
                    label: 'GitHub',
                    href: 'https://github.com/',
                    icon_url: 'app://favicon/github.com?letter=G',
                    image_url: null,
                    tags: ['aa'],
                    meta: {},
                    search1: 'github aa',
                    search2: 'https://github.com/',
                    namespaces: [],
                },
                {
                    label: 'Gmail',
                    href: 'https://mail.google.com/',
                    icon_url: 'app://favicon/mail.google.com?letter=G',
                    image_url: 'private://img/gmail.png',
                    tags: ['bb'],
                    meta: {},
                    search1: 'gmail bb',
                    search2: 'https://mail.google.com/',
                    namespaces: [],
                },
            ],
        });
    });

    it('skips invalid lines', function () {
        const actual = parse(`
asdfa asf saf
GitHub https://github.com/
`);
        assert.equal(actual.items.length, 1);
        assert.equal(actual.items[0].label, 'GitHub');
    });

    it('collects every include directive', function () {
        const actual = parse(`
% design: github
% include: https://a.example.com/links.md
% include: https://b.example.com/links.md #work #prefix=ACME/
`);
        assert.deepStrictEqual(actual.meta, {
            design: 'github',
            include: [
                'https://a.example.com/links.md',
                'https://b.example.com/links.md #work #prefix=ACME/',
            ],
        });
    });

    it('filters by the ns given in options, not by the one in the document', function () {
        const text = `
% ns: Personal

# Work
Jira    https://jira.example.com/

# Personal
Netflix https://netflix.example.com/
`;
        const actual = parse(text, {ns: ['Work']});
        assert.deepStrictEqual(actual.items.map(v => v.label), ['Jira']);
    });

    it('decorates items with prefix, suffix, and common tags', function () {
        const actual = parse('GitHub #dev https://github.com/', {prefix: 'ACME', suffix: '↗', tags: ['work']});
        assert.deepStrictEqual(actual.items, [
            {
                label: 'ACME GitHub ↗',
                href: 'https://github.com/',
                icon_url: 'app://favicon/github.com?letter=G',
                image_url: null,
                tags: ['dev', 'work'],
                meta: {},
                search1: 'acme github ↗ dev work',
                search2: 'https://github.com/',
                namespaces: [],
            },
        ]);
    });

    it('marks each link\'s line and where its parts sit, when asked', function () {
        const text = `% design: basic
# Mail | Work
  Mail #work Inbox #w=2 @m.png https://gmail.com/
https://github.com/`;
        const actual = parse(text, {spans: true});
        const [mail, github] = actual.items;
        const line = text.split('\n')[2];
        function part_from_at(at) {
            return line.slice(at[0], at[1]);
        }
        assert.equal(mail.line, 3);
        assert.deepStrictEqual(mail.spans.label.map(part_from_at), ['Mail', 'Inbox']);
        assert.equal(part_from_at(mail.spans.href), 'https://gmail.com/');
        assert.equal(part_from_at(mail.spans.image), '@m.png');
        assert.deepStrictEqual(mail.spans.tags.map(v => [v.name, part_from_at(v.at)]), [['work', '#work']]);
        assert.deepStrictEqual(mail.spans.meta.map(v => [v.key, v.value, part_from_at(v.at)]), [['w', '2', '#w=2']]);
        assert.equal(github.line, 4);
        assert.deepStrictEqual(github.spans, {label: [], href: [0, 19], image: null, tags: [], meta: []});
    });

    it('leaves the items as they were without spans', function () {
        const item = parse('GitHub https://github.com/').items[0];
        assert.equal(item.line, undefined);
        assert.equal(item.spans, undefined);
    });
    it('gives @name the url of % picture name:, declared anywhere', function () {
        const actual = parse(`Kimi @kimi https://kimi.com/
Foo @foobar https://foo.com/
Mail @img/m.png https://gmail.com/

% picture kimi: data:image/png;base64,iVBORw0KGgo=
% picture foobar: https://img.example.com/img1.jpg
`);
        assert.deepStrictEqual(actual.meta, {picture: {kimi: 'data:image/png;base64,iVBORw0KGgo=', foobar: 'https://img.example.com/img1.jpg'}});
        assert.deepStrictEqual(actual.items.map(v => v.image_url), ['data:image/png;base64,iVBORw0KGgo=', 'https://img.example.com/img1.jpg', 'private://img/m.png']);
    });

    it('takes @name opening a line with no label, the label from the url', function () {
        const actual = parse('% picture a: https://x.com/1.png\n   @a https://a.com/', {spans: true});
        const item = actual.items[0];
        assert.equal(item.label, 'a.com');
        assert.equal(item.image_url, 'https://x.com/1.png');
        assert.deepStrictEqual(item.spans.image, [3, 5]);
        assert.deepStrictEqual(item.spans.label, []);
    });

    it('lets the last % picture of a name win', function () {
        const actual = parse('% picture a: https://x.com/1.png\n% picture a: https://x.com/2.png\nA @a https://a.com/');
        assert.equal(actual.items[0].image_url, 'https://x.com/2.png');
    });

    it('skips a picture that is not a web or data url, with a warning', function () {
        for (const line of ['% picture a: img/a.png', '% picture a b: https://x.com/1.png', '% picture a: javascript:alert(1)']) {
            const actual = parse(`A @a https://a.com/\n${line}`);
            assert.deepStrictEqual(actual.meta, {});
            assert.equal(actual.items[0].image_url, 'private://a');
            assert.deepStrictEqual(actual.warnings, [{line: 2, text: line, message: `Invalid picture line: ${line}`}]);
        }
    });

    it('skips a % picture with no name, with a warning: meta.picture is the names and their urls only', function () {
        for (const line of ['% picture: https://x.com/1.png', '%picture : https://x.com/1.png', '% picture: data:image/png;base64,iVBORw0KGgo=', '% picture: kimi']) {
            const actual = parse(`% picture a: https://x.com/a.png\n${line}\nA @a https://a.com/\nB @picture https://b.com/`);
            assert.deepStrictEqual(actual.meta, {picture: {a: 'https://x.com/a.png'}}, line);
            assert.deepStrictEqual(actual.items.map(v => v.image_url), ['https://x.com/a.png', 'private://picture'], line);
            assert.deepStrictEqual(actual.warnings, [{line: 2, text: line, message: `Invalid picture line: ${line}`}]);
        }
        assert.deepStrictEqual(parse('% picture: https://x.com/1.png'), {meta: {}, items: [], warnings: [{line: 1, text: '% picture: https://x.com/1.png', message: 'Invalid picture line: % picture: https://x.com/1.png'}]});
        assert.deepStrictEqual(parse('% pictures: all').meta, {pictures: 'all'});
    });

    it('skips a line that does not parse, keeps the rest and names it in warnings', function () {
        const actual = parse('% design: cards\n% oops\nA https://a.com/\nB https://[b\n% title: T\nC https://c.com/');
        assert.deepStrictEqual(actual.meta, {design: 'cards', title: 'T'});
        assert.deepStrictEqual(actual.items.map(v => v.label), ['A', 'C']);
        assert.deepStrictEqual(actual.warnings, [
            {line: 2, text: '% oops', message: 'Invalid meta line: % oops'},
            {line: 4, text: 'B https://[b', message: 'Invalid link line: B https://[b'},
        ]);
    });

    it('has no warnings key when every line parses', function () {
        assert.deepStrictEqual(Object.keys(parse('% design: cards\nA https://a.com/')), ['meta', 'items']);
    });

    it('keeps the warnings when % ns filters the links', function () {
        const actual = parse('% ns: Work\n% oops\n# Work\nA https://a.com/\n# Home\nB https://b.com/');
        assert.deepStrictEqual(actual.items.map(v => v.label), ['A']);
        assert.equal(actual.warnings.length, 1);
    });

    it('searches a link with no tags by its name alone, so $ meets the name', function () {
        const actual = parse('GitHub https://github.com/\nDocs #dev https://docs.github.com/');
        assert.deepStrictEqual(actual.items.map(v => v.search1), ['github', 'docs dev']);
    });

    it('lowers and transliterates what is typed the way it does a name, the filter\'s marks kept', function () {
        const item = parse('Почта GitHub https://example.com/').items[0];
        assert.equal(item.search1, 'pochta github');
        assert.equal(parse.text_transliterate('ПОЧТА GitHub'), item.search1);
        assert.equal(parse.text_transliterate('почта'), 'pochta');
        assert.equal(parse.text_transliterate('GITHUB'), 'github');
        assert.equal(parse.text_transliterate('^Git/!Hub$'), '^git/!hub$');
    });

    it('drops ь and ъ, which have no Latin letter, and keeps what is not Cyrillic', function () {
        const actual = parse('Письма https://example.com/\nОбъявления #news https://example.org/\nCafé № 5 https://example.net/');
        assert.deepStrictEqual(actual.items.map(v => v.search1), ['pisma', 'obyavleniya news', 'café № 5']);
        assert.equal(parse.text_transliterate('ПИСЬМА'), 'pisma');
    });

    it('takes a tag or a #key=value at the start of a word only: a # inside a word is the name\'s own', function () {
        const actual = parse('F#minor chords https://a.com/\nC# and F# #music https://b.com/\nIssue#12 a#b=c #k=v https://c.com/');
        assert.deepStrictEqual(actual.items.map(v => [v.label, v.tags, v.meta]), [
            ['F#minor chords', [], {}],
            ['C# and F#', ['music'], {}],
            ['Issue#12 a#b=c', [], {k: 'v'}],
        ]);
        assert.equal(actual.items[0].search1, 'f#minor chords');
    });

    it('lets a value run to the next space, a # in it too, and be empty', function () {
        const actual = parse('A #color=#fff https://a.com/\nA #k= https://a.com/\nA #q=a#b=c #dev #w= B https://a.com/\nA #k=https://a.com/', {spans: true});
        assert.deepStrictEqual(actual.items.map(v => [v.label, v.tags, v.meta]), [
            ['A', [], {color: '#fff'}],
            ['A', [], {k: ''}],
            ['A B', ['dev'], {q: 'a#b=c', w: ''}],
            ['A', [], {k: ''}],
        ]);
        assert.deepStrictEqual(actual.items[0].spans.meta, [{key: 'color', value: '#fff', at: [2, 13]}]);
        assert.deepStrictEqual(actual.items[1].spans, {label: [[0, 1]], href: [6, 20], image: null, tags: [], meta: [{key: 'k', value: '', at: [2, 5]}]});
    });

    it('leaves one space where a tag stood in the middle of a name, and the name\'s own spaces as they are', function () {
        const actual = parse('Mail #a Inbox https://x.com/\nMail   #a\t#w=2   Inbox https://x.com/\nMail  Inbox #a https://x.com/\nA #t,B https://x.com/');
        assert.deepStrictEqual(actual.items.map(v => v.label), ['Mail Inbox', 'Mail Inbox', 'Mail  Inbox', 'A ,B']);
        assert.deepStrictEqual(actual.items.map(v => v.search1), ['mail inbox a', 'mail inbox a', 'mail  inbox a', 'a ,b t']);
    });

    // Seeded: a failure names its line, and the same run comes again
    it('reads the same parts for a link and for its spans, the ones the rule gives a word at a time', function () {
        const random = make_random(20261110);
        const words = ['Mail', 'Inbox', 'Почта', 'C#', 'F#minor', 'a#b=c', '#dev', '#work', '#a-b', '#x_1', '#w=2', '#k=', '#color=#fff', '#q=a#b', '#w=3', '#дев', '#', '##', '#=1', '#t,B', '#a#b', '@m.png', '@', 'e@mail', '=', '😀'];
        const gaps = [' ', ' ', ' ', '  ', '\t', ' \t ', '\u00a0', ''];
        const hrefs = ['https://x.com/', 'https://example.com/a/b?c=1#part', 'http://localhost:3000/', 'file:///home/user/notes.html'];
        for (let i = 0; i < 3000; ++i) {
            let line = make_pick(random, ['', '', '  ', '\t']);
            for (let j = 0, end = Math.floor(random()*6); j < end; ++j) {
                line = `${line}${make_pick(random, words)}${make_pick(random, gaps)}`;
            }
            line = `${line}${make_pick(random, hrefs)}${make_pick(random, ['', '', ' '])}`;
            const what = JSON.stringify(line);
            const item = parse(line, {spans: true}).items[0];
            // A line that opens with # is a section
            if (line.trim()[0] === '#') {
                assert.equal(item, undefined, what);
                continue;
            }
            const spans = item.spans;
            const named = parts_from_words(line.trim().slice(0, -item.href.length));
            const wanted = {...named, label: named.label || parse(item.href).items[0].label};
            assert.deepStrictEqual({label: item.label.replace(/\s+/g, ' '), tags: item.tags, image_url: item.image_url, meta: item.meta}, wanted, what);
            assert.equal(line.slice(spans.href[0], spans.href[1]), item.href, what);
            assert.equal(spans.label.map(v => line.slice(v[0], v[1])).join(' ') || parse(item.href).items[0].label, item.label, what);
            assert.deepStrictEqual(spans.tags.map(v => line.slice(v.at[0], v.at[1])), item.tags.map(v => `#${v}`), what);
            assert.deepStrictEqual(spans.tags.map(v => v.name), item.tags, what);
            assert.deepStrictEqual(spans.meta.map(v => line.slice(v.at[0], v.at[1])), spans.meta.map(v => `#${v.key}=${v.value}`), what);
            assert.deepStrictEqual(Object.fromEntries(spans.meta.map(v => [v.key, v.value])), item.meta, what);
            assert.equal(spans.image ? `private://${line.slice(spans.image[0] + 1, spans.image[1])}` : null, item.image_url, what);
        }
    });

    it('names a link that has no name by its address as it is written, in its own letters', function () {
        const label_by_line = {
            'https://пример.рф/путь': 'пример.рф/путь',
            'https://пример.рф/': 'пример.рф',
            'https://пример.рф': 'пример.рф',
            '@p https://пример.рф/путь?стр=2#часть': 'пример.рф/путь',
            'https://example.com/?q=1': 'example.com',
            'https://example.com#part': 'example.com',
            'https://Example.com/Docs/': 'Example.com/Docs/',
            'https://user:secret@example.com/a@b': 'example.com/a@b',
            'https://user@пример.рф': 'пример.рф',
            'https://user@example.com\\@example.org/': 'example.com\\@example.org/',
        };
        const actual = parse(Object.keys(label_by_line).join('\n'));
        assert.equal(actual.warnings, undefined);
        assert.deepStrictEqual(actual.items.map(v => v.label), Object.values(label_by_line));
    });

    it('shows the escapes of such an address as the text they stand for, and leaves the ones that are no text', function () {
        const label_by_line = {
            'https://example.com/%D0%BF%D1%83%D1%82%D1%8C': 'example.com/путь',
            'https://example.com/%d0%bf/a%20b/%E2%82%AC5': 'example.com/п/a b/€5',
            'https://example.com/%FF%FE/x': 'example.com/%FF%FE/x',
            'https://example.com/%D0%BF/%D0/%D0%BF%FF': 'example.com/п/%D0/%D0%BF%FF',
            'https://example.com/a%0Ab%00c%E2%80%A8d': 'example.com/a%0Ab%00c%E2%80%A8d',
            'https://example.com/100%/%zz/%2': 'example.com/100%/%zz/%2',
            'https://example.com/%2525': 'example.com/%25',
        };
        assert.deepStrictEqual(parse(Object.keys(label_by_line).join('\n')).items.map(v => v.label), Object.values(label_by_line));
    });

    it('names a Latin address as it did: the host, and the path when it is not /', function () {
        const label_by_line = {
            'https://github.com/': 'github.com',
            'https://github.com/example-user': 'github.com/example-user',
            'https://docs.example.com/a/b': 'docs.example.com/a/b',
            'https://www.example.com/in/someone/': 'www.example.com/in/someone/',
            'https://example.com': 'example.com',
            'https://example.com/a/b?c=1&d=2': 'example.com/a/b',
            'https://example.org/page#part': 'example.org/page',
            'https://example.com/@user/post': 'example.com/@user/post',
            'https://example.com//': 'example.com//',
            'http://localhost:3000/': 'localhost:3000',
            'http://192.168.1.1/admin': '192.168.1.1/admin',
            'http://[::1]:8080/x': '[::1]:8080/x',
            'https://xn--e1afmkfd.xn--p1ai/a': 'xn--e1afmkfd.xn--p1ai/a',
            'file:///home/user/notes.html': '/home/user/notes.html',
            'file://server/share/a.txt': 'server/share/a.txt',
            'file:///': '',
        };
        const actual = parse(Object.keys(label_by_line).join('\n'));
        const urls = actual.items.map(v => new URL(v.href));
        assert.deepStrictEqual(actual.items.map(v => v.label), Object.values(label_by_line));
        assert.deepStrictEqual(actual.items.map(v => v.label), urls.map(v => `${v.host}${(v.pathname === '/') ? '' : v.pathname}`));
    });

    it('keeps the parsed host for the icon of such a link, and searches it by the name shown', function () {
        const item = parse('https://пример.рф/путь').items[0];
        assert.equal(item.icon_url, 'app://favicon/xn--e1afmkfd.xn--p1ai?letter=%D0%9F');
        assert.equal(item.search1, 'primer.rf/put');
        assert.equal(item.search2, 'https://primer.rf/put');
        assert.equal(parse('https://example.com/%D0%BF%D1%83%D1%82%D1%8C #dev', {tags: ['work']}).items.length, 0);
        assert.equal(parse('https://example.com/%D0%BF%D1%83%D1%82%D1%8C', {prefix: 'ACME', tags: ['work']}).items[0].search1, 'acme example.com/put work');
    });

    // Seeded. parse read a line with patterns that tried it from every position; now it reads it in
    // one pass, and every line has to read as it did: the address and the picture, for the link and for its spans
    it('finds the address and the picture of any line where the patterns it had found them', function () {
        const random = make_random(20261110);
        const hrefs = ['https://x.com/', 'http://a.b/c?d=1#e', 'file:///home/a.txt', 'https://пример.рф/путь', 'Namehttps://x.com/', 'https://[', 'https://', 'http://', 'file://', 'http:/', 'ttps://y.org/'];
        const words = [...hrefs, 'Mail', 'Имя', '日本語', '😀', 'x', '@p', '@img/a.png', '@p', '@', '@a@b', 'e@mail', '#t', '#k=v', ':', '%'];
        const gaps = ['', '', ' ', ' ', ' ', ' ', ' ', ' ', '  ', '  ', '\t', ' \t', '\u00a0', '\u3000', '\ufeff', '\v', '\r', '\u2028', '\u2029', '\u0085'];
        const counts = {links: 0, pictures: 0, warnings: 0, skipped: 0};
        for (let i = 0; i < 6000; ++i) {
            let line = make_pick(random, ['', '', ' ', '\t ', '\u00a0']);
            for (let j = 0, end = Math.floor(random()*6); j < end; ++j) {
                line = `${line}${make_pick(random, words)}${make_pick(random, gaps)}`;
            }
            // Most lines end with an address, as a link line does, a whole one more often than not
            line = (random() < 0.7) ? `${line}${make_pick(random, hrefs.slice(0, 7))}${make_pick(random, ['', '', ' ', '\t', '\r'])}` : line;
            // A line that opens with % or # is no link line
            line = /^\s*[%#]/.test(line) ? `A${line}` : line;
            const what = JSON.stringify(line);
            const wanted = spans_from_patterns(line);
            const actual = parse(line, {spans: true});
            if (!wanted) {
                assert.deepStrictEqual(actual, {meta: {}, items: []}, what);
                counts.skipped += 1;
                continue;
            }
            const href = line.slice(wanted.href[0], wanted.href[1]);
            if (actual.warnings) {
                assert.throws(() => new URL(href), what);
                assert.deepStrictEqual(actual, {meta: {}, items: [], warnings: [{line: 1, text: line.trim(), message: `Invalid link line: ${line.trim()}`}]}, what);
                counts.warnings += 1;
                continue;
            }
            const item = actual.items[0];
            assert.equal(item.href, href, what);
            assert.deepStrictEqual(item.spans.href, wanted.href, what);
            assert.deepStrictEqual(item.spans.image, wanted.image, what);
            assert.equal(item.image_url, wanted.image ? `private://${line.slice(wanted.image[0] + 1, wanted.image[1])}` : null, what);
            counts.links += 1;
            counts.pictures += wanted.image ? 1 : 0;
        }
        // The lines are of every kind, each in its hundreds
        assert.ok(Object.values(counts).every(v => v > 100), JSON.stringify(counts));
    });

    // Seeded, the same way, for the pattern a `% key: value` line was read with
    it('reads any % line as the pattern it had read it', function () {
        const random = make_random(20261110);
        const words = ['title', 'k', 'ключ', 'a b', 'v', 'значение', 'https://x.com/a.png', '#', '%', '😀', ':', ':', '::', ' : ', ' ', ' ', '  ', '\t', '\u00a0', '\r', '\u2028', '\u0085'];
        const counts = {read: 0, warnings: 0};
        for (let i = 0; i < 4000; ++i) {
            let line = `${make_pick(random, ['', '', ' ', '\t'])}%`;
            for (let j = 0, end = Math.floor(random()*7); j < end; ++j) {
                line = `${line}${make_pick(random, words)}`;
            }
            const what = JSON.stringify(line);
            const meta_match = line.trim().match(/^%\s*([^:]+)\s*:\s*(.+)$/);
            if (!meta_match) {
                assert.deepStrictEqual(parse(line), {meta: {}, items: [], warnings: [{line: 1, text: line.trim(), message: `Invalid meta line: ${line.trim()}`}]}, what);
                counts.warnings += 1;
                continue;
            }
            assert.deepStrictEqual(parse(line), {meta: {[meta_match[1].trim().replace(/\s+/g, ' ')]: meta_match[2].trim()}, items: []}, what);
            counts.read += 1;
        }
        assert.ok(Object.values(counts).every(v => v > 100), JSON.stringify(counts));
    });

    // A line of each shape took seconds with the patterns, the first % one over a day: a pulled file can hold
    // such a line. The short length stops a pattern whose time grows with the cube before the long one hangs on it
    it('reads a hostile line of 100 000 characters in a moment', function () {
        // [start, what repeats, end]
        const shapes = [
            ['', 'http://', ' x'],
            ['', 'file://', ' x'],
            ['', 'http://', 'x'],
            ['A ', 'https://', ''],
            ['A', ' ', 'B https://example.com/'],
            ['A', '\t', '@p https://example.com/'],
            ['A', ' @', ' https://example.com/'],
            ['A', ' #a', ' https://example.com/'],
            ['A ', '#', ' https://example.com/'],
            ['A #k=', '#a=', ' https://example.com/'],
            ['%', ' ', 'x'],
            ['% k', ' ', 'x'],
            ['% k:', ' ', 'v\rw'],
            ['% picture', ' ', 'a b: https://example.com/a.png'],
            ['% ns: ', 'a | ', 'b'],
            ['https://example.com/', '%D0%BF%FF', ''],
        ];
        for (const shape of shapes) {
            for (const length of [3000, 100000]) {
                const line = `${shape[0]}${shape[1].repeat(Math.ceil(length/shape[1].length))}${shape[2]}`;
                const time0 = Date.now();
                parse(line, {spans: true});
                assert.ok(Date.now() - time0 < 200, `over 200 ms: ${JSON.stringify(shape)} of ${line.length} characters`);
            }
        }
    });

    // A page has `window` and `self`; node, the desktop app's own process, has neither
    describe('icon_url', function () {
        const private_hrefs = ['https://wiki.corp.internal/', 'http://192.168.1.1/', 'http://localhost:3000/', 'https://printer.local/', 'http://0x7f.1/', 'http://[::1]/'];

        afterEach(function () {
            delete global.window;
            delete global.self;
        });

        it('is app://favicon/ with the link\'s letter in the desktop app, a private host too', function () {
            assert.equal(parse('Wiki https://wiki.corp.internal/').items[0].icon_url, 'app://favicon/wiki.corp.internal?letter=W');
            global.window = {ElectronApp: {}};
            global.self = {origin: 'navplace://app'};
            assert.equal(parse('Wiki https://wiki.corp.internal/').items[0].icon_url, 'app://favicon/wiki.corp.internal?letter=W');
            assert.equal(parse('Docs https://example.com/').items[0].icon_url, 'app://favicon/example.com?letter=D');
        });

        it('is the Worker\'s /icon/ on navplace.com, a private host too', function () {
            global.window = {};
            global.self = {origin: 'https://navplace.com'};
            assert.equal(parse('Docs https://example.com/').items[0].icon_url, '/icon/example.com');
            assert.equal(parse('Wiki https://wiki.corp.internal/').items[0].icon_url, '/icon/wiki.corp.internal');
            assert.equal(parse('Dev http://localhost:3000/').items[0].icon_url, '/icon/localhost:3000');
        });

        it('is icon.horse on another site for a public host', function () {
            global.window = {};
            global.self = {origin: 'https://example.org'};
            assert.equal(parse('Docs https://example.com/').items[0].icon_url, 'https://icon.horse/icon/example.com');
            assert.equal(parse('https://docs.example.com/guide').items[0].icon_url, 'https://icon.horse/icon/docs.example.com');
        });

        it('is a tile made in place on another site for a host that is not public: its name goes nowhere', function () {
            global.window = {};
            global.self = {origin: 'https://example.org'};
            for (const href of private_hrefs) {
                const icon_url = parse(`Wiki ${href}`).items[0].icon_url;
                assert.ok(icon_url.startsWith('data:image/svg+xml,'), href);
                assert.match(decodeURIComponent(icon_url), /^data:image\/svg\+xml,<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" [^]*>W<\/text><\/svg>$/, href);
                assert.ok(!icon_url.includes(new URL(href).hostname.replace(/[[\]]/g, '')), href);
            }
        });

        it('draws the tile\'s letter from the label, a question mark when it has none, and keeps the address plain', function () {
            global.window = {};
            global.self = {origin: 'https://example.org'};
            const letters = ['Жук http://192.168.1.1/', '"<b>&\' http://192.168.1.1/', '★ http://192.168.1.1/'].map(v => decodeURIComponent(parse(v).items[0].icon_url).match(/>([^<]*)<\/text>/)[1]);
            assert.deepStrictEqual(letters, ['Ж', 'B', '?']);
            for (const line of ['Жук http://192.168.1.1/', '"<b>&\' http://192.168.1.1/', 'http://localhost:3000/']) {
                assert.match(parse(line).items[0].icon_url, /^data:image\/svg\+xml,[A-Za-z0-9%.()!*~_-]+$/, line);
            }
        });
    });
});

// The rule in words, for a link's line without its url: the last word is the picture when it is
// `@name`; a word that opens with `#name` is a tag, with `#name=` a value to the word's end; what
// is left is the name. {label, tags, image_url, meta}, the label '' when the name is the url's
function parts_from_words(head)
{
    const words = head.split(/\s+/).filter(Boolean);
    const image_url = /^@./.test(words.at(-1) ?? '') ? `private://${words.pop().slice(1)}` : null;
    const names = [];
    const tags = [];
    const meta = {};
    for (const word of words) {
        const tag_match = word.match(/^#([a-zA-Z0-9_-]+)(=?)(.*)$/);
        if (!tag_match) {
            names.push(word);
        }
        else if (tag_match[2]) {
            meta[tag_match[1]] = tag_match[3];
        }
        else {
            tags.push(tag_match[1]);
            names.push(tag_match[3]);
        }
    }
    return {label: names.filter(Boolean).join(' '), tags, image_url, meta};
}

// Where the patterns found the address and the picture of a link line, as its spans say it: {href, image},
// or null for a line with no address. The two patterns are the ones lib/parse.js had
function spans_from_patterns(line)
{
    const lead = line.length - line.trimStart().length;
    const href_match = line.trim().match(/^(.*?)(file:\/\/\S+|https?:\/\/\S+)$/);
    if (!href_match) {
        return null;
    }
    const image_match = href_match[1].trimEnd().match(/(?:^|\s+)(@\S+)\s*$/);
    const image_begin = image_match ? lead + image_match.index + image_match[0].indexOf('@') : null;
    return {href: [lead + href_match[1].length, lead + line.trim().length], image: image_match ? [image_begin, image_begin + image_match[1].length] : null};
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

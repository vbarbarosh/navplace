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
                    icon_url: 'app://favicon/chatgpt.com',
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
                    icon_url: 'app://favicon/github.com',
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
                    icon_url: 'app://favicon/mail.google.com',
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
                icon_url: 'app://favicon/github.com',
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
});

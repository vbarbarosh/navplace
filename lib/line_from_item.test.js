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

    it('puts a label or tags in front of a bare link', function () {
        assert.equal(line_edit('https://github.com/', {label: 'GitHub'}), 'GitHub https://github.com/');
        assert.equal(line_edit('  https://github.com/', {tags: ['dev']}), '  #dev https://github.com/');
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
});

function line_edit(line, changes)
{
    const item = parse(line, {spans: true}).items[0];
    const edited = {label: item.label, href: item.href, tags: item.tags, image_url: item.image_url, meta: item.meta, ...changes};
    return line_from_item(line, item, edited);
}

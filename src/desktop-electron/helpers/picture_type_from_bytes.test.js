const assert = require('node:assert/strict');
const picture_type_from_bytes = require('./picture_type_from_bytes');
const test = require('node:test');

test('picture_type_from_bytes: a picture is told by how its bytes begin', function () {
    assert.equal(picture_type_from_bytes(Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex')), 'image/png');
    assert.equal(picture_type_from_bytes(Buffer.from('ffd8ffe000104a464946', 'hex')), 'image/jpeg');
    assert.equal(picture_type_from_bytes(Buffer.from('ffd8ffe1001845786966', 'hex')), 'image/jpeg');
    assert.equal(picture_type_from_bytes(Buffer.from('GIF89a\x01\x00\x01\x00', 'latin1')), 'image/gif');
    assert.equal(picture_type_from_bytes(Buffer.from('GIF87a\x01\x00\x01\x00', 'latin1')), 'image/gif');
    assert.equal(picture_type_from_bytes(Buffer.from('RIFF\x24\x00\x00\x00WEBPVP8 ', 'latin1')), 'image/webp');
});

test('picture_type_from_bytes: an avif names itself among the brands of its first box', function () {
    assert.equal(picture_type_from_bytes(Buffer.from('\x00\x00\x00\x1cftypavif\x00\x00\x00\x00avifmif1miaf', 'latin1')), 'image/avif');
    assert.equal(picture_type_from_bytes(Buffer.from('\x00\x00\x00\x1cftypmif1\x00\x00\x00\x00mif1avifmiaf', 'latin1')), 'image/avif');
    assert.equal(picture_type_from_bytes(Buffer.from('\x00\x00\x00\x1cftypavis\x00\x00\x00\x00msf1iso8', 'latin1')), 'image/avif');
    // A video, and a box that names avif only after its own end
    assert.equal(picture_type_from_bytes(Buffer.from('\x00\x00\x00\x18ftypisom\x00\x00\x02\x00isomiso2', 'latin1')), null);
    assert.equal(picture_type_from_bytes(Buffer.from('\x00\x00\x00\x14ftypisom\x00\x00\x02\x00isomavif', 'latin1')), null);
    // The minor version is a number, not a brand
    assert.equal(picture_type_from_bytes(Buffer.from('\x00\x00\x00\x14ftypisomavifisom', 'latin1')), null);
});

test('picture_type_from_bytes: a favicon.ico is told by its list of pictures', function () {
    assert.equal(picture_type_from_bytes(Buffer.from('00000100010010100000010020006804000016000000', 'hex')), 'image/x-icon');
    assert.equal(picture_type_from_bytes(Buffer.from('00000100030030300000010020a82500003600000020', 'hex')), 'image/x-icon');
    // No picture in it, a cursor, a list cut short, a byte that is never set
    assert.equal(picture_type_from_bytes(Buffer.from('00000100000010100000010020006804000016000000', 'hex')), null);
    assert.equal(picture_type_from_bytes(Buffer.from('00000200010010100000010020006804000016000000', 'hex')), null);
    assert.equal(picture_type_from_bytes(Buffer.from('00000100010010100000', 'hex')), null);
    assert.equal(picture_type_from_bytes(Buffer.from('00000100010010100007010020006804000016000000', 'hex')), null);
});

test('picture_type_from_bytes: an svg is a file whose first tag is <svg>', function () {
    assert.equal(picture_type_from_bytes(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>')), 'image/svg+xml');
    assert.equal(picture_type_from_bytes(Buffer.from('<svg>\n</svg>')), 'image/svg+xml');
    assert.equal(picture_type_from_bytes(Buffer.from('﻿<?xml version="1.0" encoding="UTF-8"?>\n<!-- drawn by hand -->\n<!-- twice -->\n<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">\n<svg width="8" height="8"/>')), 'image/svg+xml');
    assert.equal(picture_type_from_bytes(Buffer.from('<!DOCTYPE svg [<!ENTITY a "b">]>\n<svg ></svg>')), 'image/svg+xml');
    assert.equal(picture_type_from_bytes(Buffer.from(`<!--${' '.repeat(5000)}-->\n<svg viewBox="0 0 8 8"/>`)), 'image/svg+xml');
});

test('picture_type_from_bytes: anything else is no picture', function () {
    assert.equal(picture_type_from_bytes(Buffer.alloc(0)), null);
    assert.equal(picture_type_from_bytes(Buffer.from('<!DOCTYPE html>\n<html><body><svg></svg></body></html>')), null);
    assert.equal(picture_type_from_bytes(Buffer.from('<html><svg/></html>')), null);
    assert.equal(picture_type_from_bytes(Buffer.from('<svgs/>')), null);
    assert.equal(picture_type_from_bytes(Buffer.from('<!-- a comment with no end <svg/>')), null);
    assert.equal(picture_type_from_bytes(Buffer.from('{"error": "not found"}')), null);
    assert.equal(picture_type_from_bytes(Buffer.from('Not found')), null);
    assert.equal(picture_type_from_bytes(Buffer.from('%PDF-1.7\n')), null);
    assert.equal(picture_type_from_bytes(Buffer.from('00000100010010100000', 'hex')), null);
    assert.equal(picture_type_from_bytes(Buffer.from('89504e47', 'hex')), null);
    assert.equal(picture_type_from_bytes(Buffer.from('RIFF\x24\x00\x00\x00WAVEfmt ', 'latin1')), null);
    assert.equal(picture_type_from_bytes(Buffer.from('ffd8', 'hex')), null);
});

test('picture_type_from_bytes: a megabyte of comments is read in a moment', function () {
    const time0 = Date.now();
    assert.equal(picture_type_from_bytes(Buffer.from(`${'<!---->'.repeat(150000)}<svg/>`)), null);
    assert.equal(picture_type_from_bytes(Buffer.from(`${'<!--'.repeat(250000)}`)), null);
    assert.ok((Date.now() - time0) < 500);
});

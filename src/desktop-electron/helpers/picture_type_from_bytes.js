// The kind of picture these bytes are, told by the bytes themselves: 'image/png', 'image/jpeg',
// 'image/gif', 'image/webp', 'image/avif', 'image/x-icon' or 'image/svg+xml'; null for anything
// else. What an address calls its answer does not count: a page sent as image/png is still a page
function picture_type_from_bytes(bytes)
{
    if (is_begin(bytes, 0, [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])) {
        return 'image/png';
    }
    if (is_begin(bytes, 0, [0xFF, 0xD8, 0xFF])) {
        return 'image/jpeg';
    }
    if (is_text(bytes, 0, 'GIF87a') || is_text(bytes, 0, 'GIF89a')) {
        return 'image/gif';
    }
    if (is_text(bytes, 0, 'RIFF') && is_text(bytes, 8, 'WEBP')) {
        return 'image/webp';
    }
    if (is_avif(bytes)) {
        return 'image/avif';
    }
    if (is_ico(bytes)) {
        return 'image/x-icon';
    }
    if (is_svg(bytes)) {
        return 'image/svg+xml';
    }
    return null;
}

function is_begin(bytes, at, expected)
{
    return (bytes.length >= at + expected.length) && expected.every((v, i) => bytes[at + i] === v);
}

function is_text(bytes, at, text)
{
    return is_begin(bytes, at, Array.from(text, v => v.charCodeAt(0)));
}

// An `ftyp` box first, `avif` or `avis` among its brands: the main one at 8, the others from 16
// to the end of the box
function is_avif(bytes)
{
    if (!is_text(bytes, 4, 'ftyp')) {
        return false;
    }
    const box_end = Math.min(bytes.length, (bytes[0]*0x1000000) + (bytes[1] << 16) + (bytes[2] << 8) + bytes[3], 256);
    for (let at = 8; at + 4 <= box_end; at += 4) {
        if ((at !== 12) && (is_text(bytes, at, 'avif') || is_text(bytes, at, 'avis'))) {
            return true;
        }
    }
    return false;
}

// A site's favicon.ico: 0, 0, 1, 0, then how many pictures it holds, one at least, and the list
// of them, whose every fourth byte is 0
function is_ico(bytes)
{
    return is_begin(bytes, 0, [0x00, 0x00, 0x01, 0x00]) && (bytes.length >= 22) && ((bytes[4] + bytes[5]) > 0) && (bytes[9] === 0);
}

// The text of an XML file whose first tag is <svg>: before it only a byte order mark, spaces, the
// <?xml … ?> line, comments and a <!DOCTYPE>. Looked for in the first 8 KB
function is_svg(bytes)
{
    let rest = new TextDecoder().decode(bytes.subarray(0, 8192)).replace(/^﻿/, '');
    for (let lead = svg_lead_length(rest); lead > 0; lead = svg_lead_length(rest)) {
        rest = rest.slice(lead);
    }
    return /^<svg[\s>]/.test(rest);
}

// How much of the text's beginning is something that may stand before the first tag: 0 for none
function svg_lead_length(text)
{
    const lead_match = text.match(/^(\s+|<\?[^>]*\?>|<!--[^]*?-->|<!DOCTYPE[^>[]*(\[[^\]]*\])?[^>]*>)/);
    return lead_match ? lead_match[0].length : 0;
}

module.exports = picture_type_from_bytes;

const assert = require('node:assert/strict');
const letter_tile_svg = require('./letter_tile_svg');
const test = require('node:test');

test('letter_tile_svg: the letter, upper case, on the site\'s colour', function () {
    const svg = letter_tile_svg('h', 'app.hubstaff.com');
    assert.match(svg, />H<\/text>/);
    assert.equal(svg.match(/fill="(#[0-9a-f]{6})"/)[1], letter_tile_svg('x', 'app.hubstaff.com').match(/fill="(#[0-9a-f]{6})"/)[1]);
});

test('letter_tile_svg: no letter gives a question mark; markup is escaped', function () {
    assert.match(letter_tile_svg('', 'example.com'), />\?<\/text>/);
    assert.match(letter_tile_svg('<', 'example.com'), />&#60;<\/text>/);
});

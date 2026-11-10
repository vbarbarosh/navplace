const assert = require('node:assert/strict');
const parse = require('../../../lib/parse');
const test = require('node:test');
const text_design_set = require('./text_design_set');

test('text_design_set: the line the text has is written anew', function () {
    assert.equal(text_design_set('% design: cards\n\nDocs https://example.com/docs\n', 'palette'), '% design: palette\n\nDocs https://example.com/docs\n');
});

test('text_design_set: a text with no such line gets it as its first', function () {
    assert.equal(text_design_set('Docs https://example.com/docs\n', 'palette'), '% design: palette\nDocs https://example.com/docs\n');
    assert.equal(text_design_set('', 'palette'), '% design: palette\n');
});

test('text_design_set: of two lines the last is written, the one the parser obeys', function () {
    const text = text_design_set('% design: cards\nDocs https://example.com/docs\n% design: github\n', 'palette');
    assert.equal(text, '% design: cards\nDocs https://example.com/docs\n% design: palette\n');
    assert.equal(parse(text).meta.design, 'palette');
});

test('text_design_set: a line written loosely, indented or with no spaces, is the line too', function () {
    assert.equal(text_design_set('  %design:cards\nDocs https://example.com/docs', 'palette'), '% design: palette\nDocs https://example.com/docs');
    assert.equal(parse(text_design_set('% design: cards\n   %  design :  github  \nDocs https://example.com/docs', 'palette')).meta.design, 'palette');
});

test('text_design_set: a line of another key, or a link that names a design, is left alone', function () {
    const text = text_design_set('% designer: someone\nA design: notes https://example.com/design\n', 'palette');
    assert.equal(text, '% design: palette\n% designer: someone\nA design: notes https://example.com/design\n');
});

const assert = require('assert');
const design_from_name = require('./design_from_name');
const fs = require('fs');

describe('design_from_name', function () {
    it('leads each name that is gone to classic', function () {
        for (const name of ['basic', 'first', 'basic-for-internal2', 'basic-for-internal3-with-groups', 'basic-for-kids', 'basic-for-kids2', 'basic-for-portfolio', 'basic-for-recipes']) {
            assert.equal(design_from_name(name), 'classic', name);
        }
    });
    it('keeps the name of every design the project has', function () {
        const names = fs.readdirSync(`${__dirname}/../designs`);
        assert.ok(names.includes('classic'));
        for (const name of names) {
            assert.equal(design_from_name(name), name, name);
        }
    });
    it('keeps what is no name of a design that is gone', function () {
        for (const name of ['nothing', '', 'Basic', 'basic-for', undefined]) {
            assert.equal(design_from_name(name), name, String(name));
        }
    });
});

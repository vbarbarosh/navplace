const assert = require('node:assert/strict');
const setup_stamp_from_raw = require('./setup_stamp_from_raw');
const test = require('node:test');

test('setup_stamp_from_raw: a version and a file come back as they are', function () {
    assert.deepEqual(setup_stamp_from_raw({version: '1.4.3', appimage_file: '/opt/apps/NavPlace-1.4.3.AppImage'}), {version: '1.4.3', appimage_file: '/opt/apps/NavPlace-1.4.3.AppImage'});
});

test('setup_stamp_from_raw: what else it holds is dropped', function () {
    assert.deepEqual(setup_stamp_from_raw({version: '1.4.3', appimage_file: '/opt/apps/NavPlace-1.4.3.AppImage', at: 'today'}), {version: '1.4.3', appimage_file: '/opt/apps/NavPlace-1.4.3.AppImage'});
});

test('setup_stamp_from_raw: a missing or wrong value is no stamp', function () {
    const raws = [
        undefined,
        null,
        {},
        [],
        'text',
        {version: '1.4.3'},
        {appimage_file: '/opt/apps/NavPlace-1.4.3.AppImage'},
        {version: '', appimage_file: '/opt/apps/NavPlace-1.4.3.AppImage'},
        {version: 143, appimage_file: '/opt/apps/NavPlace-1.4.3.AppImage'},
        {version: '1.4.3', appimage_file: null},
        {version: '1.4.3', appimage_file: ''},
    ];
    for (const raw of raws) {
        assert.equal(setup_stamp_from_raw(raw), null, JSON.stringify(raw));
    }
});

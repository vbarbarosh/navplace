const assert = require('node:assert/strict');
const is_gnome_desktop = require('./is_gnome_desktop');
const test = require('node:test');

test('is_gnome_desktop: GNOME alone, and in the list of a desktop built on it', function () {
    for (const text of ['GNOME', 'ubuntu:GNOME', 'GNOME-Classic:GNOME', 'Budgie:GNOME', 'pop:GNOME', 'gnome', ' GNOME ']) {
        assert.equal(is_gnome_desktop(text), true, text);
    }
});

test('is_gnome_desktop: another desktop is not, a name that only starts like it neither', function () {
    for (const text of ['KDE', 'XFCE', 'X-Cinnamon', 'sway', 'GNOME-Flashback', 'LXQt:KDE']) {
        assert.equal(is_gnome_desktop(text), false, text);
    }
});

test('is_gnome_desktop: no name at all is not GNOME', function () {
    assert.equal(is_gnome_desktop(''), false);
    assert.equal(is_gnome_desktop(undefined), false);
    assert.equal(is_gnome_desktop(null), false);
});

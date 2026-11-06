const assert = require('node:assert/strict');
const chrome_wm_class_by_desktop_file = require('./chrome_wm_class_by_desktop_file');
const test = require('node:test');

test('maps packaged Google Chrome desktop files to their window classes', function () {
    for (const [desktop_file, wm_class] of [
        ['google-chrome.desktop', 'google-chrome'],
        ['google-chrome-beta.desktop', 'google-chrome-beta'],
        ['google-chrome-unstable.desktop', 'google-chrome-unstable'],
    ]) {
        assert.equal(chrome_wm_class_by_desktop_file.get(desktop_file) ?? null, wm_class, desktop_file);
    }
});

test('rejects ambiguous, unrelated, and Chrome-app desktop files', function () {
    for (const desktop_file of [
        '',
        'firefox.desktop',
        'chromium.desktop',
        'chrome-random-profile.desktop',
        'com.brave.Browser.desktop',
        'com.google.Chrome.desktop',
    ]) {
        assert.equal(chrome_wm_class_by_desktop_file.get(desktop_file) ?? null, null, desktop_file);
    }
});

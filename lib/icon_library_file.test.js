const assert = require('assert');
const icon_library_file = require('./icon_library_file');

describe('icon_library_file', function () {
    const index = {'sentry.io': 'sentry.io.svg', 'mail.google.com': 'mail.google.com.png', 'google.com': 'google.com.png', 'xe.com': 'xe.com.png'};
    it('takes the host itself first', function () {
        assert.equal(icon_library_file('mail.google.com', index), 'mail.google.com.png');
    });
    it('drops www.', function () {
        assert.equal(icon_library_file('www.xe.com', index), 'xe.com.png');
    });
    it('falls back to a parent domain', function () {
        assert.equal(icon_library_file('acme.sentry.io', index), 'sentry.io.svg');
        assert.equal(icon_library_file('news.google.com', index), 'google.com.png');
    });
    it('never stops at a top-level domain alone', function () {
        assert.equal(icon_library_file('example.io', index), null);
    });
});

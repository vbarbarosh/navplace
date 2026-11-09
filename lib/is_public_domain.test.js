const assert = require('assert');
const is_public_domain = require('./is_public_domain');
const parse = require('./parse');

// [host, is it public]
const HOSTS = [
    ['example.com', true],
    ['Example.COM', true],
    ['www.example.co.uk', true],
    ['docs.example.org', true],
    ['xn--80ak6aa92e.com', true],
    // A private word inside a public name is not an ending
    ['local.example.com', true],
    ['internal.example.org', true],
    ['thelan.example.net', true],
    ['x.localhost.example.com', true],
    // One label
    ['localhost', false],
    ['intranet', false],
    ['wiki', false],
    // An address, in every spelling a URL takes
    ['127.0.0.1', false],
    ['192.168.1.1', false],
    ['10.0.0.1', false],
    ['203.0.113.7', false],
    ['0x7f.1', false],
    ['0x7f.0.0.1', false],
    ['0177.0.0.1', false],
    ['127.1', false],
    ['017700000001', false],
    ['2130706433', false],
    ['0x7f000001', false],
    ['[::1]', false],
    ['[fe80::1]', false],
    ['[2001:db8::1]', false],
    // A port
    ['localhost:3000', false],
    ['example.com:8080', false],
    ['192.168.1.1:8080', false],
    ['[::1]:3000', false],
    // A reserved or commonly private ending
    ['foo.localhost', false],
    ['printer.local', false],
    ['wiki.corp.internal', false],
    ['metadata.google.internal', false],
    ['router.lan', false],
    ['nas.home', false],
    ['git.corp', false],
    ['portal.intranet', false],
    ['db.private', false],
    ['site.test', false],
    ['site.invalid', false],
    ['site.example', false],
    ['gw.home.arpa', false],
    ['home.arpa', false],
    ['Wiki.Corp.INTERNAL', false],
    // Not a name at all
    ['example.com.', false],
    ['a..example.com', false],
    ['my_host.example.com', false],
    ['example.123', false],
    ['1.2.3.4.5', false],
];

describe('is_public_domain', function () {
    it('tells a public host from an address, a port, one label and a private ending', function () {
        for (const [host, expected] of HOSTS) {
            assert.equal(is_public_domain(host), expected, host);
        }
    });
    it('takes nothing, and what is not a host, as not public', function () {
        for (const host of ['', null, undefined, ' ', 'exa mple.com', 'example.com/path', 'user@example.com', 'example.com\n', `${'a'.repeat(250)}.com`]) {
            assert.equal(is_public_domain(host), false, String(host));
        }
    });

    describe('on a page of another site', function () {
        before(function () {
            global.window = {};
            global.self = {origin: 'https://example.org'};
        });
        after(function () {
            delete global.window;
            delete global.self;
        });
        // lib/parse.js keeps its own copy of the decision: a link's icon is asked of
        // icon.horse there only when its host is public here
        it('agrees with lib/parse.js on every host', function () {
            for (const [host] of HOSTS) {
                const item = parse(`http://${host}/`).items[0];
                const is_asked_outside = Boolean(item) && item.icon_url.startsWith('https://icon.horse/icon/');
                assert.equal(is_asked_outside, is_public_domain(host), host);
            }
        });
    });
});

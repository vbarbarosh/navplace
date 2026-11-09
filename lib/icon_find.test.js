const assert = require('assert');
const icon_find = require('./icon_find');

describe('icon_find', function () {
    it('asks no one, its library too, about a host that is not public', async function () {
        for (const domain of ['wiki.corp.internal', '192.168.1.1', 'localhost:3000', 'printer.local', '0x7f.1', 'foo.localhost', 'router.lan', 'metadata.google.internal', '[::1]', 'localhost', '']) {
            assert.equal(await icon_find(domain, fail_fetch, fail_fetch), null, domain);
        }
    });
    it('asks the site of a public host, then Google', async function () {
        const hrefs = [];
        const icon = await icon_find('example.com', function (href) {
            hrefs.push(href);
            return new Response('Not found', {status: 404});
        });
        assert.equal(icon, null);
        assert.equal(hrefs[0], 'https://example.com/');
        assert.equal(hrefs.at(-1), 'https://www.google.com/s2/favicons?domain=example.com&sz=64');
    });
});

async function fail_fetch(href)
{
    throw new Error(`no fetch expected: ${href}`);
}

// A name the whole internet can reach: only such a host is named to anyone but itself. One that
// is not public is given to no outside icon service and to no other host, and the Worker's /icon/
// looks nothing up for it; the desktop app asks that host itself for its icon, and no one else
// (lib/icon_find.js). Not public: nothing, one label, an address in any spelling a URL takes
// (127.0.0.1, 0x7f.1, 2130706433, [::1]), anything with a port, and a name under an ending no
// public site has. lib/parse.js keeps a copy of this decision, as a page loads it alone:
// lib/is_public_domain.test.js feeds both the same hosts.
const MAX_LENGTH = 253;
const PRIVATE_ENDINGS = /(^|\.)(localhost|local|internal|lan|home|corp|intranet|private|test|invalid|example|home\.arpa)$/;

function is_public_domain(domain)
{
    const name = String(domain ?? '').toLowerCase();
    // Two labels or more of letters, digits and hyphens: no port, no brackets, no dotted number
    if ((name.length > MAX_LENGTH) || !/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(name) || /^[\d.]+$/.test(name) || PRIVATE_ENDINGS.test(name)) {
        return false;
    }
    // An address spelled another way (0x7f.1, 0177.0.0.1) is not the name a URL makes of it
    try {
        return new URL(`http://${name}/`).hostname === name;
    }
    catch {
        return false;
    }
}

module.exports = is_public_domain;

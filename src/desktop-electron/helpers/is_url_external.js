// `mailto:` and one plain mail address, nothing before it and nothing after: letters, digits and
// `._+-` up to the `@`, letters, digits, `.` and `-` after it. The system's mail opener reads the
// rest of such an address as orders: `?` and `&` start fields (cc, body, attach), `%` and `\`
// write any character in disguise, a quote ends the address, `,` adds a second one
const MAILTO_PLAIN = /^mailto:[a-z0-9._+-]+@[a-z0-9.-]+$/i;

// Whether an address a page asked for may be handed to the system: a web address, or `mailto:`
// with a plain mail address. Any other kind (ssh:, smb:, vscode:, file:, a mailto: that says
// more than whom to write to) would start whatever program the system keeps for it, with what
// the address tells it
function is_url_external(url)
{
    let protocol = null;
    try {
        protocol = new URL(url).protocol;
    }
    catch {
        return false;
    }
    return (protocol === 'http:') || (protocol === 'https:') || MAILTO_PLAIN.test(url);
}

module.exports = is_url_external;

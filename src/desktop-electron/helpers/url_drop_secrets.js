// An address as the logs may keep it: no query, no fragment, no user and no
// password. One that does not parse is not repeated at all, and one with no
// `//` keeps its scheme only: nothing there tells a user and a password from
// the rest.
function url_drop_secrets(text)
{
    let url = null;
    try {
        url = new URL(text);
    }
    catch {
        return 'invalid-url';
    }
    if (!url.host && !url.pathname.startsWith('/')) {
        return url.protocol;
    }
    return `${url.protocol}//${url.host}${url.pathname}`;
}

module.exports = url_drop_secrets;

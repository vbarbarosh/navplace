const crypto = require('crypto');

// The name a web picture goes by inside the app: in the address a page asks the app for it with,
// and in the folder of kept copies. A hash of the whole address: its query, which may carry a
// token, reaches neither
function picture_key_from_href(href)
{
    return crypto.createHash('sha256').update(href).digest('hex');
}

module.exports = picture_key_from_href;

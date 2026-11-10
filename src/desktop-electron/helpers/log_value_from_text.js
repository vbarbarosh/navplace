// A value of a log line, `key=value`: a plain word is written as it is; a text with a space, a
// quote, a backslash, a square bracket or anything outside printable ASCII is JSON-quoted, so it
// stays one value on one line. Anything that is not a string, null among them, is compact JSON.
//
//     /opt/apps/NavPlace-1.4.3.AppImage   →   /opt/apps/NavPlace-1.4.3.AppImage
//     /opt/My Apps/NavPlace (1).AppImage  →   "/opt/My Apps/NavPlace (1).AppImage"
function log_value_from_text(text)
{
    if ((typeof text === 'string') && /^[!#-Z^-~]+$/.test(text)) {
        return text;
    }
    return JSON.stringify(text);
}

module.exports = log_value_from_text;

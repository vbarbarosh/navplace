// The file of lib/icons/ for a link's host: the host itself, then without www., then each parent
// domain down to two labels (acme.sentry.io takes sentry.io); null when none has one.
// `index` is lib/icons/index.json: {domain: file}.
function icon_library_file(domain, index)
{
    const host = String(domain).toLowerCase().replace(/^www\./, '');
    const labels = host.split('.');
    for (let i = 0; i <= labels.length - 2; ++i) {
        const file = index[labels.slice(i).join('.')];
        if (file) {
            return file;
        }
    }
    return null;
}

module.exports = icon_library_file;

// @vbarbarosh/node-helpers 3.79.1, src/plural.js, as a browser global
function plural(n, singular, plural, zero)
{
    if (n === 0 && typeof zero === 'string') {
        return zero;
    }
    if (n === 1) {
        return singular.split('#').join(n);
    }
    return plural.split('#').join(n);
}

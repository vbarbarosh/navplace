// The environment of a process as an object, from the text Linux keeps of it in
// /proc/<pid>/environ: `NAME=value` after `NAME=value`, each ended by a NUL. A part with no
// `=` is left out; of a name given twice the first one counts, as getenv reads it.
function env_from_text(text)
{
    const out = {};
    for (const part of text.split('\0')) {
        const end = part.indexOf('=');
        if ((end > 0) && !Object.hasOwn(out, part.slice(0, end))) {
            out[part.slice(0, end)] = part.slice(end + 1);
        }
    }
    return out;
}

module.exports = env_from_text;

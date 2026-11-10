// The file a `private://` address names, as paths to try inside the links folder, the likeliest
// first. A page writes a picture's name into the address as the links file has it, and the
// browser escapes what an address cannot hold, a space as %20: so the escapes are undone. A `%`
// of the name itself is no escape (`50%.png`) and is left as it is; and a name may hold what
// only looks like one (`a%20b.png`), so the name as it came is tried after it.
//
//     private://my%20photo.png   →   ['my photo.png', 'my%20photo.png']
//     private://50%.png          →   ['50%.png']
function private_paths_from_url(url)
{
    const raw = url.slice('private://'.length);
    const unescaped = raw.replace(/(?:%[0-9A-Fa-f]{2})+/g, escapes_undo);
    return (unescaped === raw) ? [raw] : [unescaped, raw];
}

// A run of escapes as the text it stands for; a run that is no UTF-8 text stays as it is
function escapes_undo(escapes)
{
    try {
        return decodeURIComponent(escapes);
    }
    catch {
        return escapes;
    }
}

module.exports = private_paths_from_url;

const path = require('path');

// Whether a path names something inside a folder; a path that is not absolute is read from that
// folder. The folder itself, a folder beside it whose name starts the same and anything `..`
// reaches are outside. Only the text of the two paths decides: a link inside the folder may still
// lead out of it.
function file_is_inside(file, dir)
{
    const root = path.resolve(dir);
    const prefix = root.endsWith(path.sep) ? root : `${root}${path.sep}`;
    const abs = path.resolve(root, file);
    return (abs !== root) && abs.startsWith(prefix);
}

module.exports = file_is_inside;

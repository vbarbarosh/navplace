const fs = require('fs');
const path = require('path');

// Names a system may start instead of show, whatever their mode says: launchers, scripts, installers
const PROGRAM_SUFFIXES = ['.app', '.appimage', '.bat', '.cmd', '.command', '.desktop', '.exe', '.jar', '.msi', '.pl', '.py', '.rb', '.run', '.sh'];

// Whether opening a path could run it. The system's opener is handed the path and does with it
// what the desktop decides: some start a launcher or a program. So a file with an execute bit, and
// any name that ends as a program's does, is one; `mode` is the mode of its fs.Stats. A folder's
// execute bits only let it be entered
function is_program_file(file, mode)
{
    const is_regular = (mode & fs.constants.S_IFMT) === fs.constants.S_IFREG;
    const name = path.basename(file).toLowerCase();
    return (is_regular && ((mode & 0o111) !== 0)) || PROGRAM_SUFFIXES.some(v => name.endsWith(v));
}

module.exports = is_program_file;

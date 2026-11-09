const assert = require('node:assert/strict');
const gnome_command_from_args = require('./gnome_command_from_args');
const test = require('node:test');

test('gnome_command_from_args: node and the launcher, each by its absolute path', function () {
    assert.equal(gnome_command_from_args(['/usr/bin/node', '/home/user/.config/navplace/launcher.js']), `'"/usr/bin/node" "/home/user/.config/navplace/launcher.js"'`);
});

test('gnome_command_from_args: a space stays inside its argument', function () {
    assert.equal(gnome_command_from_args(['/opt/node 22/bin/node', '/home/user/.config/navplace/launcher.js']), `'"/opt/node 22/bin/node" "/home/user/.config/navplace/launcher.js"'`);
});

test('gnome_command_from_args: a single quote and a backslash are escaped for dconf', function () {
    assert.equal(gnome_command_from_args(["/opt/it's/node", '/opt/a\\b.js']), `'"/opt/it\\'s/node" "/opt/a\\\\\\\\b.js"'`);
});

test('gnome_command_from_args: read back as dconf and then GNOME read it, every argument is itself again', function () {
    const args_list = [
        ['/usr/bin/node', '/home/user/.config/navplace/launcher.js'],
        ['/home/user/.nvm/versions/node/v22.11.0/bin/node', '/home/user/.config/navplace/launcher.js'],
        ['/opt/node 22 (lts)/bin/node', "/home/user/it's mine/launcher.js"],
        ['/opt/100%/node', '/opt/$HOME/`id`/"x"/a\\b/launcher.js'],
    ];
    for (const args of args_list) {
        assert.deepEqual(command_args_parse(gnome_command_from_args(args)), args);
    }
});

// A GVariant string undone, then the command split as GLib splits a command line
function command_args_parse(text)
{
    const out = [];
    assert.match(text, /^'(?:[^'\\]|\\.)*'$/s);
    const command = text.slice(1, -1).replace(/\\(.)/gs, (match, v) => ((v === 'n') ? '\n' : v));
    for (const [, quoted] of command.matchAll(/"((?:[^"\\]|\\.)*)"/gs)) {
        const arg = quoted.replace(/\\(["`$\\])/g, '$1');
        assert.doesNotMatch(arg.replaceAll('%%', ''), /%/, 'a lone percent would be a field code');
        out.push(arg.replaceAll('%%', '%'));
    }
    return out;
}

const assert = require('node:assert/strict');
const gnome_args_from_command = require('./gnome_args_from_command');
const gnome_command_from_args = require('./gnome_command_from_args');
const test = require('node:test');

test('gnome_args_from_command: node and the launcher, as the setup writes the command', function () {
    assert.deepEqual(gnome_args_from_command(`'"/usr/bin/node" "/opt/home/.config/navplace/launcher.js"'`), ['/usr/bin/node', '/opt/home/.config/navplace/launcher.js']);
});

test('gnome_args_from_command: the launcher alone, as releases up to 1.4.2 wrote it', function () {
    assert.deepEqual(gnome_args_from_command("'/opt/home/.config/navplace/launcher.js'\n"), ['/opt/home/.config/navplace/launcher.js']);
});

test('gnome_args_from_command: a space inside quotes stays in its argument, outside it parts two', function () {
    assert.deepEqual(gnome_args_from_command(`'"/opt/node 22/bin/node" /opt/launcher.js  --flag'`), ['/opt/node 22/bin/node', '/opt/launcher.js', '--flag']);
    assert.deepEqual(gnome_args_from_command(`'/opt/node\\\\ 22/node'`), ['/opt/node 22/node']);
    assert.deepEqual(gnome_args_from_command(`"/opt/'node 22'/node x"`), ['/opt/node 22/node', 'x']);
});

test('gnome_args_from_command: a shortcut that is not there has no arguments', function () {
    assert.deepEqual(gnome_args_from_command(''), []);
    assert.deepEqual(gnome_args_from_command('\n'), []);
    assert.deepEqual(gnome_args_from_command("''"), []);
    assert.deepEqual(gnome_args_from_command("['a']"), []);
});

test('gnome_args_from_command: what gnome_command_from_args wrote is read back', function () {
    const args_list = [
        ['/usr/bin/node', '/opt/home/.config/navplace/launcher.js'],
        ['/opt/home/.nvm/versions/node/v22.11.0/bin/node', '/opt/home/.config/navplace/launcher.js'],
        ['/opt/node 22 (lts)/bin/node', "/opt/it's mine/launcher.js"],
        ['/opt/100%/node', '/opt/$HOME/`id`/"x"/a\\b/launcher.js'],
        ['/opt/launcher.js'],
    ];
    for (const args of args_list) {
        assert.deepEqual(gnome_args_from_command(gnome_command_from_args(args)), args);
    }
});

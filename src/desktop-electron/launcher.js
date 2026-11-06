#!/usr/bin/env node

const child_process = require('child_process');
const net = require('net');
const os = require('os');
const path = require('path');

main();

function main()
{
    // Keep in sync with src/desktop-electron/config — this launcher is intentionally
    // dependency-free (Node builtins only) so the hotkey can fire it without
    // loading node_modules or unpacking the AppImage.
    const config_home = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
    const socket_file = path.join(config_home, 'navplace', 'navplace.sock');

    let connected = false;

    const client = net.createConnection(socket_file);
    client.on('connect', function () {
        connected = true;
        client.end();
    });
    client.on('error', function () {
        if (connected) {
            return;
        }
        // ~/.local/share/applications/navplace.desktop
        child_process.spawn('gtk-launch', ['navplace'], {detached: true, stdio: 'ignore'}).unref();
    });

    client.setTimeout(150);
    client.on('timeout', () => client.destroy());
}

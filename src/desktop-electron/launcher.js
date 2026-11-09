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
        const starter = child_process.spawn('gtk-launch', ['navplace'], {detached: true, stdio: 'ignore'});
        // No gtk-launch on this system: say that, not that the app is starting
        starter.on('error', function (error) {
            notification_send(['NavPlace could not start', `gtk-launch: ${error.message}`]);
        });
        // gtk-launch ends as soon as it has started the app, or could not
        starter.on('exit', function (code) {
            if (code === 0) {
                // Booting the AppImage takes a few seconds: say so, or the hotkey seems to do nothing
                notification_send(['--expire-time=4000', 'NavPlace is starting…', 'It opens in a few seconds. Next time it starts with your login.']);
                return;
            }
            notification_send(['NavPlace could not start', `"gtk-launch navplace" ended with code ${code}. Run the AppImage with --configure-gnome to set it up again.`]);
        });
    });

    client.setTimeout(150);
    client.on('timeout', () => client.destroy());
}

// A desktop notification; a system without notify-send stays silent
function notification_send(args)
{
    const notify = child_process.spawn('notify-send', ['--app-name=NavPlace', ...args], {detached: true, stdio: 'ignore'});
    notify.on('error', () => {});
    notify.unref();
}

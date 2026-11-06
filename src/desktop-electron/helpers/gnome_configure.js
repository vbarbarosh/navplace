const config = require('../config');
const fs = require('fs');
const fs_exists = require('@vbarbarosh/node-helpers/src/fs_exists');
const fs_mkdirp = require('@vbarbarosh/node-helpers/src/fs_mkdirp');
const fs_path_dirname = require('@vbarbarosh/node-helpers/src/fs_path_dirname');
const fs_path_join = require('@vbarbarosh/node-helpers/src/fs_path_join');
const fs_path_resolve = require('@vbarbarosh/node-helpers/src/fs_path_resolve');
const fs_read = require('@vbarbarosh/node-helpers/src/fs_read');
const fs_write = require('@vbarbarosh/node-helpers/src/fs_write');
const shell_spawn = require('@vbarbarosh/node-helpers/src/shell_spawn');

// Install the GNOME hotkey for the AppImage build, invoked as
// `NavPlace.AppImage --configure-gnome`.
//
// The launcher must live on disk OUTSIDE the bundle: the whole point of the
// socket architecture is that summoning the app never mounts/boots the AppImage.
// So we extract the (dependency-free) launcher next to the socket and bind the
// hotkey to it; the .desktop's Exec points back at the AppImage for cold start.
//
// Returns {launcher_file, appimage_file, node_bin}; the caller reports success.
async function gnome_configure()
{
    const appimage_file = config.appimage_file;
    if (!appimage_file) {
        throw new Error('--configure-gnome must be run from the AppImage (APPIMAGE is not set)');
    }

    // The hotkey fires the extracted launcher via its `env node` shebang, so node
    // must be resolvable on PATH — check before writing anything, fail fast if not.
    const node_bin = await node_bin_find();
    if (!node_bin) {
        throw new Error('node was not found in PATH — the hotkey launcher needs Node.js. Install it (or add it to PATH) and run --configure-gnome again.');
    }

    const launcher_file = fs_path_join(config.user_data_dir, 'launcher.js');
    const desktop_file = fs_path_join(config.data_home_dir, 'applications', 'navplace.desktop');

    await fs_mkdirp(config.user_data_dir);

    // 1. extract the dependency-free launcher (read+write works across the asar boundary)
    await fs_write(launcher_file, await fs_read(fs_path_resolve(__dirname, '../launcher.js')));
    await fs.promises.chmod(launcher_file, 0o755);

    // 2. extract the app icon (best-effort; the AppImage runtime exposes APPDIR)
    const icon = await icon_extract();

    await keybinding_register(launcher_file);

    // 3. .desktop -> the AppImage; `gtk-launch navplace` (the launcher's cold path) lands here
    await fs_mkdirp(fs_path_dirname(desktop_file));
    await fs_write(desktop_file, [
        '[Desktop Entry]',
        'Type=Application',
        'Name=NavPlace',
        'Comment=The fastest way to open your links',
        `Icon=${icon}`,
        `Exec=${appimage_file}`,
        'Categories=Utility;',
        'StartupWMClass=NavPlace',
        '',
    ].join('\n'));

    return {launcher_file, appimage_file, node_bin};
}

async function icon_extract()
{
    const appimage_mount_dir = config.appimage_mount_dir;
    if (!appimage_mount_dir) {
        return 'application-x-executable';
    }
    for (const name of ['navplace.png', '.DirIcon']) {
        const src = fs_path_join(appimage_mount_dir, name);
        if (await fs_exists(src)) {
            const dest = fs_path_join(config.user_data_dir, 'navplace.png');
            await fs_write(dest, await fs_read(src));
            return dest;
        }
    }
    return 'application-x-executable';
}

async function node_bin_find()
{
    try {
        await command_run(['node', '--version']);
        return 'node';
    }
    catch {
        return null;
    }
}

async function keybinding_register(launcher_file)
{
    const base = '/org/gnome/settings-daemon/plugins/media-keys/custom-keybindings';
    const slot = `${base}/navplace/`;

    const raw = (await command_run(['dconf', 'read', base])).trim().replace(/^@as\s+/, '');
    const slots = raw ? JSON.parse(raw.replaceAll("'", '"')) : [];
    if (!slots.includes(slot)) {
        slots.push(slot);
        await command_run(['dconf', 'write', base, JSON.stringify(slots).replaceAll('"', "'")]);
    }

    await command_run(['dconf', 'load', '/'], [
        '[org/gnome/settings-daemon/plugins/media-keys/custom-keybindings/navplace]',
        "binding='<Ctrl><Shift><Alt>N'",
        `command='${launcher_file}'`,
        "name='navplace'",
        '',
    ].join('\n'));
}

async function command_run(args, input)
{
    let stdout = '';
    let stderr = '';

    const proc = shell_spawn(args, {stdio: ['pipe', 'pipe', 'pipe']});
    proc.stdout.on('data', v => stdout = `${stdout}${v}`);
    proc.stderr.on('data', v => stderr = `${stderr}${v}`);

    // shell_spawn rejects BOTH init() and promise() on a spawn error — keep a
    // handler on promise() so ENOENT (node/dconf missing) doesn't leak.
    const exited = proc.promise();
    exited.catch(() => {});

    try {
        await proc.init();
        if (input) {
            proc.stdin.end(input);
        }
        else {
            proc.stdin.end();
        }
        await exited;
    }
    catch (error) {
        error.message = stderr ? `${error.message}\n${stderr}` : error.message;
        throw error;
    }

    return stdout;
}

module.exports = gnome_configure;

const Promise = require('bluebird');
const autostart_set = require('./helpers/autostart_set');
const chrome_window_focus = require('./helpers/chrome_window_focus');
const cli = require('@vbarbarosh/node-helpers/src/cli');
const collection_resolve_includes = require('./helpers/collection_resolve_includes');
const config = require('./config');
const crypto = require('crypto');
const electron = require('electron');
const format_date = require('@vbarbarosh/node-helpers/src/format_date');
const fs = require('fs');
const fs_exists = require('@vbarbarosh/node-helpers/src/fs_exists');
const fs_mkdirp = require('@vbarbarosh/node-helpers/src/fs_mkdirp');
const fs_path_dirname = require('@vbarbarosh/node-helpers/src/fs_path_dirname');
const fs_path_resolve = require('@vbarbarosh/node-helpers/src/fs_path_resolve');
const fs_read = require('@vbarbarosh/node-helpers/src/fs_read');
const fs_read_utf8 = require('@vbarbarosh/node-helpers/src/fs_read_utf8');
const fs_readdir = require('@vbarbarosh/node-helpers/src/fs_readdir');
const fs_write = require('@vbarbarosh/node-helpers/src/fs_write');
const gnome_configure = require('./helpers/gnome_configure');
const gnome_hotkey_set = require('./helpers/gnome_hotkey_set');
const http_get_buffer = require('@vbarbarosh/node-helpers/src/http_get_buffer');
const make = require('@vbarbarosh/type-helpers');
const make_socket_server = require('./helpers/make_socket_server');
const parse = require('../../lib/parse');
const sanitize_filename = require('@vbarbarosh/node-helpers/src/sanitize_filename');
const settings_from_raw = require('./helpers/settings_from_raw');
const url_from_path = require('url').pathToFileURL;
const urlmod = require('@vbarbarosh/node-helpers/src/urlmod');

const DEFAULT_README = `% design: github

ChatGPT          https://chatgpt.com/
GitHub           https://github.com/
Gmail            https://mail.google.com/
Google Calendar  https://calendar.google.com/
Google Drive     https://drive.google.com/
MDN Web Docs     https://developer.mozilla.org/
Node.js          https://nodejs.org/en/docs
Electron         https://www.electronjs.org/docs/latest/
`;

cli(main);

async function main()
{
    // Designs load their libraries from /lib/…: on a navplace://app/ page that is
    // the app's own lib/, where on a file:// page it would be the root of the disk.
    // Only before the app is ready, so before anything is awaited.
    electron.protocol.registerSchemesAsPrivileged([
        {scheme: 'navplace', privileges: {standard: true, secure: true, supportFetchAPI: true}},
    ]);

    // What the settings window changed, kept between runs
    let settings = await settings_load();

    if (process.argv.includes('--configure-gnome')) {
        const info = await gnome_configure({hotkey: settings.hotkey});
        console.log(`✓ ${hotkey_label(settings.hotkey)} successfully registered — NavPlace will summon instantly.`);
        console.log(`  launcher:   ${info.launcher_file}`);
        console.log(`  cold start: ${info.appimage_file}`);
        console.log(`  node:       ${info.node_bin}`);
        console.log(`  at login:   ${info.autostart_file} (starts hidden; log out and in, or run it with --background now)`);
        electron.app.exit(0);
        return;
    }

    if (!electron.app.requestSingleInstanceLock()) {
        electron.app.quit();
        process.exit(0);
    }

    const app_uid = crypto.randomUUID();
    console.log(`[${app_uid}][group_spawn]`);

    await electron.app.whenReady();

    let parsed_collection = await collection_load();

    electron.ipcMain.handle('api_ping', function () {
        return `pong ${format_date(new Date())}`;
    });
    electron.ipcMain.handle('api_items_all', async function () {
        return parsed_collection;
    });

    const win = new electron.BrowserWindow({
        show: false,
        autoHideMenuBar: true,
        alwaysOnTop: settings.on_top,
        width: 1200,
        height: 1000,
        center: true,
        backgroundColor: '#bec2bd',
        webPreferences: {
            zoomFactor: settings.zoom,
            contextIsolation: true,
            nodeIntegration: false,
            preload: fs_path_resolve(__dirname, 'renderer.js'),
        },
    });

    // Each design's index.html sets its own <title>, which replaces the
    // window title on load — append the app version whenever that happens.
    win.on('page-title-updated', function (event, title) {
        event.preventDefault();
        win.setTitle(`${title} — v${electron.app.getVersion()}`);
    });

    electron.app.on('second-instance', async function () {
        console.log(`[${app_uid}][second_instance]`);
        await window_show();
    });
    await using _ = await make_socket_server({
        socket_file: config.socket_file,
        connection_accept: async function () {
            console.log(`[${app_uid}][socket_connection]`);
            await window_show();
        },
    });

    electron.protocol.handle('private', async function (request) {
        let root = null;
        let abs = null;

        const rel = decodeURIComponent(request.url.slice('private://'.length));
        try {
            root = `${await fs.promises.realpath(config.config_dir)}/`;
            abs = await fs.promises.realpath(fs_path_resolve(root, rel));
        }
        catch {
            return new Response('Not found', {status: 404});
        }
        if (!abs.startsWith(root)) {
            return new Response('Forbidden', {status: 403});
        }
        const buf = await fs_read(abs);
        return new Response(buf, {
            headers: {
                'Content-Type': abs.endsWith('.svg') ? 'image/svg+xml' : 'image/png',
                'Cache-Control': 'max-age=86400',
            },
        });
    });
    electron.protocol.handle('app', async function (request) {
        if (!request.url.startsWith('app://favicon/')) {
            return new Response('Not found', {status: 404});
        }
        const domain = decodeURIComponent(request.url.slice('app://favicon/'.length));
        const file = fs_path_resolve(electron.app.getPath('userData'), `favicons/${sanitize_filename(domain)}.png`);
        await fs_mkdirp(fs_path_dirname(file));
        const buf = await cache_read({
            get: () => fs_read(file),
            put: v => fs_write(file, v),
            refresh: () => http_get_buffer(urlmod('https://www.google.com/s2/favicons?domain=&sz=64', {domain})).then(v => Buffer.from(v)),
        });
        return new Response(buf, {
            headers: {
                'Content-Type': 'image/png',
                'Cache-Control': 'max-age=86400',
            },
        });
    });

    // navplace://app/designs/…, navplace://app/lib/… and navplace://app/settings/…, from the app's own folders
    electron.protocol.handle('navplace', async function (request) {
        let root = null;
        let abs = null;

        const url = new URL(request.url);
        const path = decodeURIComponent(url.pathname);
        // The settings page sits inside app.asar: the URL is already normalized, and the archive has no links
        if ((url.host === 'app') && path.startsWith('/settings/')) {
            return electron.net.fetch(url_from_path(fs_path_resolve(config.settings_page_dir, path.slice('/settings/'.length))).href);
        }
        const dir_by_prefix = {'/designs/': config.designs_dir, '/lib/': config.lib_dir};
        const prefix = Object.keys(dir_by_prefix).find(v => path.startsWith(v)) ?? null;
        if ((url.host !== 'app') || !prefix) {
            return new Response('Not found', {status: 404});
        }
        try {
            root = `${await fs.promises.realpath(dir_by_prefix[prefix])}/`;
            abs = await fs.promises.realpath(fs_path_resolve(root, path.slice(prefix.length)));
        }
        catch {
            return new Response('Not found', {status: 404});
        }
        if (!abs.startsWith(root)) {
            return new Response('Forbidden', {status: 403});
        }
        return electron.net.fetch(url_from_path(abs).href);
    });

    electron.session.defaultSession.webRequest.onBeforeRequest(function (params, callback) {
        const prefixes = [
            'app://favicon/',
            'blob:',
            'chrome://',
            'chrome-devtools://',
            'data:',
            'devtools://',
            'file://',
            'navplace://app/',
            'private://',
        ];
        callback({cancel: !prefixes.some(v => params.url.startsWith(v))});
    });

    win.webContents.setWindowOpenHandler(function (details) {
        url_open_external(details.url);
        return {action: 'deny'};
    });

    let design = await design_of_collection(parsed_collection);
    await win.loadURL(design_url(design));
    // Started at login (`--background`, from ~/.config/autostart): it waits hidden for the hotkey
    if (process.argv.includes('--background')) {
        console.log(`[${app_uid}][window_waits_hidden]`);
    }
    else {
        win.show();
    }
    refresh_collection_in_background();

    win.on('blur', function () {
        if (settings.hide_on_blur) {
            win.hide();
        }
    });

    // The settings window: the gear beside the theme switch opens it, one at a time
    let settings_win = null;
    electron.ipcMain.handle('settings_open', function () {
        settings_window_show();
    });
    electron.ipcMain.handle('settings_state', settings_only(settings_state));
    electron.ipcMain.handle('settings_links_write', settings_only(async function (event, text) {
        await links_write(text);
        return {state: await settings_state()};
    }));
    electron.ipcMain.handle('settings_design_set', settings_only(async function (event, name, text) {
        const links_text = text_design_set(text, name);
        await links_write(links_text);
        return {links_text, state: await settings_state()};
    }));
    electron.ipcMain.handle('settings_set', settings_only(async function (event, patch) {
        await settings_patch(patch);
        return settings_state();
    }));
    electron.ipcMain.handle('settings_links_open', settings_only(async function () {
        await readme_ensure_default();
        await electron.shell.openPath(config.readme_file);
    }));
    electron.ipcMain.handle('settings_updates_check', settings_only(updates_check));
    electron.ipcMain.handle('settings_url_open', settings_only(async function (event, url) {
        if (/^https:\/\/github\.com\/vbarbarosh\/navplace\//.test(url)) {
            await electron.shell.openExternal(url);
        }
    }));

    await emitter_once(win, {
        closed: function () {
            console.log(`[${app_uid}][window_closed]`);
        },
    });

    function settings_window_show() {
        if (settings_win) {
            settings_win.show();
            settings_win.focus();
            return;
        }
        settings_win = new electron.BrowserWindow({
            width: 980,
            height: 860,
            center: true,
            autoHideMenuBar: true,
            title: 'NavPlace settings',
            backgroundColor: '#fafaf9',
            webPreferences: {
                contextIsolation: true,
                nodeIntegration: false,
                preload: fs_path_resolve(__dirname, 'settings_preload.js'),
            },
        });
        settings_win.on('closed', function () {
            settings_win = null;
        });
        settings_win.loadURL('navplace://app/settings/index.html');
    }

    // A settings handler answers the settings window only
    function settings_only(handler) {
        return function (event, ...args) {
            if (!settings_win || (event.sender !== settings_win.webContents)) {
                throw new Error('only the settings window may ask this');
            }
            return handler(event, ...args);
        };
    }

    async function settings_state() {
        await readme_ensure_default();
        return {
            links_file: config.readme_file,
            links_text: await fs_read_utf8(config.readme_file),
            design,
            designs: ['github', ...(await fs_readdir(config.designs_dir)).filter(v => v !== 'github').sort()],
            settings,
            zooms: settings_from_raw.ZOOMS,
            autostart: {on: await fs_exists(config.autostart_file), possible: !!config.appimage_file},
            hotkey_possible: await fs_exists(config.launcher_file),
            version: electron.app.getVersion(),
        };
    }

    // The links file written; the window takes its links, and its design when `% design:` changed
    async function links_write(text) {
        await fs_mkdirp(config.config_dir);
        await fs_write(config.readme_file, text);
        let next = design;
        try {
            next = await design_of_collection(parse(text));
        }
        catch {
        }
        if (next !== design) {
            design = next;
            await win.loadURL(design_url(design));
        }
        refresh_collection_in_background();
    }

    // {zoom, on_top, hide_on_blur, hotkey, autostart}: each one given applied to the app and kept
    async function settings_patch(patch) {
        const next = settings_from_raw({...settings, ...patch});
        if (('hotkey' in patch) && (next.hotkey !== patch.hotkey)) {
            throw new Error('Ctrl, Alt or Super with a letter or a digit');
        }
        if (next.hotkey !== settings.hotkey) {
            await gnome_hotkey_set(config.launcher_file, next.hotkey);
        }
        if ('autostart' in patch) {
            await autostart_set(!!patch.autostart, {appimage_file: config.appimage_file, icon: await icon_file_find()});
        }
        win.webContents.setZoomFactor(next.zoom);
        win.setAlwaysOnTop(next.on_top);
        settings = next;
        await settings_save(settings);
    }

    async function refresh_collection() {
        parsed_collection = await collection_resolve_includes(await collection_load(), app_uid);
        win.webContents.send('api_items_changed', parsed_collection);
    }

    // Never awaited by anything that shows the window.
    function refresh_collection_in_background() {
        refresh_collection().catch(e => console.error(`[${app_uid}][collection_refresh_failed] reason=${JSON.stringify(e.message)}`));
    }

    async function window_show() {
        // Links change while the app waits in the background, so every summon
        // reloads them. The window goes up first; the renderer redraws when the
        // items arrive.
        refresh_collection_in_background();
        if (win.isMinimized()) {
            win.restore();
        }
        if (!win.isVisible()) {
            win.show();
        }
        win.focus();
        await win.webContents.executeJavaScript(`{
            const input = document.querySelector('input');
            if (input) {
                input.focus();
                input.value = '';
                input.dispatchEvent(new Event('input', {bubbles: true}));
            }
        }`);
    }
}

async function url_open_external(url)
{
    const scheme = url.match(/^(https?):\/\//)?.[1] ?? null;
    if ((process.platform === 'linux') && config.is_wayland && scheme) {
        try {
            await chrome_window_focus(scheme);
        }
        catch {
            // Handler lookup and Window Calls are optional; fall back to normal URL opening.
        }
    }
    await electron.shell.openExternal(url);
}

// The local file only. `% include:` urls are pulled by refresh_collection,
// which never runs in front of the window.
async function collection_load()
{
    await readme_ensure_default();
    return parse(await fs_read_utf8(config.readme_file));
}

async function readme_ensure_default()
{
    if (await fs_exists(config.readme_file)) {
        return;
    }

    await fs_mkdirp(config.config_dir);
    await fs_write(config.readme_file, DEFAULT_README, {encoding: 'utf8', flag: 'wx'});
}

async function settings_load()
{
    try {
        return settings_from_raw(JSON.parse(await fs_read_utf8(config.settings_file)));
    }
    catch {
        return settings_from_raw({});
    }
}

async function settings_save(settings)
{
    await fs_mkdirp(config.user_data_dir);
    await fs_write(config.settings_file, `${JSON.stringify(settings, null, 4)}\n`);
}

// The design a collection names with `% design:`, github when it names none or one the app has not
async function design_of_collection(collection)
{
    return make(collection.meta.design, {type: 'enum', options: ['github', ...await fs_readdir(config.designs_dir)]});
}

function design_url(design)
{
    return `navplace://app/designs/${encodeURIComponent(design)}/index.html`;
}

// The text with `% design: <design>` in place of the line it had, or as a first line
function text_design_set(text, design)
{
    const line = `% design: ${design}`;
    const re = /^[ \t]*%[ \t]*design[ \t]*:.*$/m;
    return re.test(text) ? text.replace(re, line) : `${line}\n${text}`;
}

// GNOME's <Ctrl><Shift><Alt>N as people write it, Ctrl+Shift+Alt+N
function hotkey_label(hotkey)
{
    return hotkey.replace(/<(\w+)>/g, '$1+');
}

// The icon --configure-gnome took out of the AppImage, or the system's own
async function icon_file_find()
{
    const file = fs_path_resolve(config.user_data_dir, 'navplace.png');
    return (await fs_exists(file)) ? file : 'application-x-executable';
}

// The newest release on GitHub (electron-v1.2.3): {latest, url, newer}; Node's fetch, which the
// window's network gate does not see
async function updates_check()
{
    const response = await fetch('https://api.github.com/repos/vbarbarosh/navplace/releases/latest', {headers: {Accept: 'application/vnd.github+json'}});
    if (!response.ok) {
        throw new Error(`GitHub answered ${response.status}`);
    }
    const release = await response.json();
    const latest = String(release.tag_name ?? '').replace(/^electron-v/, '');
    return {latest, url: release.html_url, newer: version_compare(latest, electron.app.getVersion()) > 0};
}

// Like a.localeCompare(b) for versions: 1.10.0 after 1.9.0
function version_compare(a, b)
{
    const pa = a.split('.').map(Number);
    const pb = b.split('.').map(Number);
    for (let i = 0; i < 3; ++i) {
        if ((pa[i] ?? 0) !== (pb[i] ?? 0)) {
            return ((pa[i] ?? 0) > (pb[i] ?? 0)) ? 1 : -1;
        }
    }
    return 0;
}

async function emitter_once(emitter, handler_by_event)
{
    const listeners = [];
    return new Promise(function (resolve) {
        for (const name of Object.keys(handler_by_event)) {
            async function handler(...args) {
                for (const listener of listeners) {
                    emitter.off(listener.name, listener.handler);
                }
                resolve(await handler_by_event[name](...args));
            }
            listeners.push({name, handler});
            emitter.on(name, handler);
        }
    });
}

async function cache_read({get, put, refresh})
{
    try {
        return await get();
    }
    catch {
    }

    const value = await refresh();
    await put(value);
    return value;
}

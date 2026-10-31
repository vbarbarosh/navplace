const Promise = require('bluebird');
const WebSocket = require('ws');
const cli = require('@vbarbarosh/node-helpers/src/cli');
const config = require('./config');
const configure_gnome = require('./helpers/configure_gnome');
const electron = require('electron');
const focus_chrome_window = require('./helpers/focus_chrome_window');
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
const http_get_buffer = require('@vbarbarosh/node-helpers/src/http_get_buffer');
const http_get_json = require('@vbarbarosh/node-helpers/src/http_get_json');
const make = require('@vbarbarosh/type-helpers');
const parse = require('../../lib/parse');
const resolve_includes = require('./helpers/resolve_includes');
const sanitize_filename = require('@vbarbarosh/node-helpers/src/sanitize_filename');
const urlmod = require('@vbarbarosh/node-helpers/src/urlmod');
const wait_for_socket_connections = require('./helpers/wait_for_socket_connections');

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
    if (process.argv.includes('--configure-gnome')) {
        try {
            const info = await configure_gnome();
            console.log('✓ Ctrl+Shift+Alt+N successfully registered — NavPlace will summon instantly.');
            console.log(`  launcher:   ${info.launcher_file}`);
            console.log(`  cold start: ${info.appimage}`);
            console.log(`  node:       ${info.node_bin}`);
            electron.app.exit(0);
        }
        catch (error) {
            console.error(`✗ ${error.message}`);
            electron.app.exit(1);
        }
        return;
    }

    if (!electron.app.requestSingleInstanceLock()) {
        electron.app.quit();
        process.exit(0);
    }

    await electron.app.whenReady();

    let parsed_collection = await load_collection();

    electron.ipcMain.handle('api_ping', function () {
        return `pong ${format_date(new Date())}`;
    });
    electron.ipcMain.handle('api_items_all', async function () {
        return parsed_collection;
    });

    const win = new electron.BrowserWindow({
        show: false,
        autoHideMenuBar: true,
        alwaysOnTop: true,
        width: 1200,
        height: 1000,
        center: true,
        backgroundColor: '#bec2bd',
        webPreferences: {
            zoomFactor: 1.25,
            // (node:127005) electron: The default of contextIsolation
            // is deprecated and will be changing from false to true
            // in a future release of Electron. See
            // https://github.com/electron/electron/issues/23506 for
            // more information
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
        console.log('second-instance');
        await show_window();
    });
    await using _ = await wait_for_socket_connections({
        socket: config.socket_file,
        connection: async function () {
            console.log('socket connection');
            await show_window();
        },
    });
    await using __ = connect_events(refresh_collection);

    electron.protocol.handle('private', async function (request) {
        // XXX fs.promises.realpath will throw if file does not exist
        const root = await fs.promises.realpath(config.config_dir) + '/';
        const rel = decodeURIComponent(request.url.slice('private://'.length));
        const abs = await fs.promises.realpath(fs_path_resolve(root, rel));
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
        const buf = await cache({
            get: () => fs_read(file),
            set: v => fs_write(file, v),
            refresh: () => http_get_buffer(urlmod('https://www.google.com/s2/favicons?domain=&sz=64', {domain})).then(v => Buffer.from(v)),
        });
        return new Response(buf, {
            headers: {
                'Content-Type': 'image/png', // response.headers.get('content-type') || 'image/png',
                'Cache-Control': 'max-age=86400',
            },
        });
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
            'private://',
        ];
        callback({cancel: !prefixes.some(v => params.url.startsWith(v))});
    });

    win.webContents.setWindowOpenHandler(function (event) {
        open_external(event.url);
        return {action: 'deny'};
    });

    // 🔶 Ctrl+Shift+I to open
    // win.webContents.openDevTools({mode: 'bottom', activate: false});
    //
    // setInterval(function () {
    //     win.webContents.executeJavaScript('console.log("js from main", new Date())');
    // }, 2000);

    // await win.loadFile(fs_path_resolve(__dirname, '../../designs/basic/index.html'));
    // await win.loadFile(fs_path_resolve(__dirname, '../../designs/google-chrome/index.html'));
    const design = make(parsed_collection.meta.design, {type: 'enum', options: ['github', ...await fs_readdir(config.designs_dir)]});
    await win.loadFile(fs_path_resolve(__dirname, `../../designs/${design}/index.html`));
    win.show();
    start_refresh();

    // await once(win, {
    //     closed: function () {
    //         console.log('__closed');
    //     },
    //     blur: function () {
    //         console.log('__blur');
    //         win.close();
    //     },
    win.on('blur', function () {
        win.hide();
    });

    await once(win, {
        closed: function () {
            console.log('__closed');
        },
    });

    async function refresh_collection()
    {
        parsed_collection = await resolve_includes(await load_collection());
        win.webContents.send('api_items_changed', parsed_collection);
    }

    // Never awaited by anything that shows the window.
    function start_refresh()
    {
        refresh_collection().catch(error => console.error('[collection_refresh_failed]', error.stack || error.message));
    }

    async function show_window()
    {
        // Links change while the app waits in the background, so every summon
        // reloads them. The window goes up first; the renderer redraws when the
        // items arrive.
        start_refresh();
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
                // input.select();
            }
        }`);
    }
}

async function open_external(url)
{
    const scheme = url.startsWith('http://') ? 'http' : url.startsWith('https://') ? 'https' : null;
    if (process.platform === 'linux' && process.env.XDG_SESSION_TYPE === 'wayland' && scheme) {
        try {
            await focus_chrome_window(scheme);
        }
        catch {
            // Handler lookup and Window Calls are optional; fall back to normal URL opening.
        }
    }
    await electron.shell.openExternal(url);
}

// The local source only. `% include:` urls are pulled by refresh_collection,
// which never runs in front of the window.
async function load_collection()
{
    if (config.collection_url) {
        return parse(await fetch_collection_contents());
    }
    await ensure_default_readme();
    return parse(await fs_read_utf8(config.readme_file));
}

async function ensure_default_readme()
{
    if (await fs_exists(config.readme_file)) {
        return;
    }

    await fs_mkdirp(config.config_dir);
    await fs_write(config.readme_file, DEFAULT_README, {encoding: 'utf8', flag: 'wx'});
}

async function fetch_collection_contents()
{
    const json = await http_get_json(config.collection_url, {headers: {Authorization: `Bearer ${config.personal_access_token}`}});
    if (typeof json.contents === 'string') {
        return json.contents;
    }
    throw new Error('Collection response JSON must contain string field "contents"');
}

function connect_events(refresh_collection)
{
    if (!config.collection_url || !config.events_url) {
        return {
            async [Symbol.asyncDispose]() {
            },
        };
    }

    let closed = false;
    let ws = null;
    let reconnect_timer = null;
    let refresh_timer = null;

    connect();

    return {
        async [Symbol.asyncDispose]() {
            closed = true;
            clearTimeout(reconnect_timer);
            clearTimeout(refresh_timer);
            ws?.close();
        },
    };

    function connect()
    {
        if (closed) {
            return;
        }
        console.log('[ws_connect]', config.events_url);
        ws = new WebSocket(config.events_url, {headers: {Authorization: `Bearer ${config.personal_access_token}`}});
        ws.on('open', function () {
            console.log('[ws_open]', config.events_url);
        });
        ws.on('message', function (data) {
            const text = data.toString();
            console.log('[ws_message]', text);
            let event;
            try {
                event = JSON.parse(text);
                if (typeof event === 'string') {
                    event = JSON.parse(event);
                }
            }
            catch {
                console.error('[ws_message_invalid]', text);
                return;
            }
            if (event.type === 'hello' || String(event.type).startsWith('collection.')) {
                console.log('[ws_event]', event.type);
                schedule_refresh();
            }
        });
        ws.on('close', function (code, reason) {
            console.log('[ws_close]', code, reason.toString());
            reconnect();
        });
        ws.on('error', function (error) {
            console.error('[ws_error]', error.message);
            reconnect();
        });
    }

    function reconnect()
    {
        if (closed || reconnect_timer) {
            return;
        }
        console.log('[ws_reconnect]', '5000ms');
        reconnect_timer = setTimeout(function () {
            reconnect_timer = null;
            connect();
        }, 5000);
    }

    function schedule_refresh()
    {
        clearTimeout(refresh_timer);
        refresh_timer = setTimeout(async function () {
            refresh_timer = null;
            try {
                await refresh_collection();
            }
            catch (error) {
                console.error('[collection_refresh_failed]', error.stack || error.message);
            }
        }, 250);
    }
}

async function once(inst, spec)
{
    const listeners = [];
    return new Promise(function (resolve) {
        Object.keys(spec).forEach(function (name) {
            async function handler(...args) {
                listeners.forEach(v => inst.off(v.name, v.handler));
                resolve(await spec[name](...args));
            }
            listeners.push({name, handler});
            inst.on(name, handler);
        });
    });
}

async function cache({get, set, refresh})
{
    try {
        return await get();
    }
    catch {
    }

    const value = await refresh();
    await set(value);
    return value;
}

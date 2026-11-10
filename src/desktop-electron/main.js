const Promise = require('bluebird');
const appimage_entries_repoint = require('./helpers/appimage_entries_repoint');
const appimage_move = require('./helpers/appimage_move');
const appimage_target_from_entry = require('./helpers/appimage_target_from_entry');
const autostart_set = require('./helpers/autostart_set');
const child_process = require('child_process');
const chrome_window_focus = require('./helpers/chrome_window_focus');
const cli = require('@vbarbarosh/node-helpers/src/cli');
const collection_resolve_includes = require('./helpers/collection_resolve_includes');
const config = require('./config');
const config_appimage_file_set = require('./config/config_appimage_file_set');
const crypto = require('crypto');
const desktop_exec_args_from_entry = require('./helpers/desktop_exec_args_from_entry');
const electron = require('electron');
const env_from_text = require('./helpers/env_from_text');
const file_from_href = require('./helpers/file_from_href');
const file_hrefs_from_collection = require('./helpers/file_hrefs_from_collection');
const file_is_inside = require('./helpers/file_is_inside');
const format_date = require('@vbarbarosh/node-helpers/src/format_date');
const fs = require('fs');
const fs_exists = require('@vbarbarosh/node-helpers/src/fs_exists');
const fs_mkdirp = require('@vbarbarosh/node-helpers/src/fs_mkdirp');
const fs_path_basename = require('@vbarbarosh/node-helpers/src/fs_path_basename');
const fs_path_dirname = require('@vbarbarosh/node-helpers/src/fs_path_dirname');
const fs_path_resolve = require('@vbarbarosh/node-helpers/src/fs_path_resolve');
const fs_read = require('@vbarbarosh/node-helpers/src/fs_read');
const fs_read_utf8 = require('@vbarbarosh/node-helpers/src/fs_read_utf8');
const fs_readdir = require('@vbarbarosh/node-helpers/src/fs_readdir');
const fs_readlink = require('@vbarbarosh/node-helpers/src/fs_readlink');
const fs_write = require('@vbarbarosh/node-helpers/src/fs_write');
const gnome_configure = require('./helpers/gnome_configure');
const gnome_hotkey_set = require('./helpers/gnome_hotkey_set');
const gnome_setup_carry = require('./helpers/gnome_setup_carry');
const gnome_setup_failure_text = require('./helpers/gnome_setup_failure_text');
const gnome_setup_read = require('./helpers/gnome_setup_read');
const icon_find = require('../../lib/icon_find');
const icon_library_file = require('../../lib/icon_library_file');
const instance_from_raw = require('./helpers/instance_from_raw');
const is_app_process = require('./helpers/is_app_process');
const is_appimage_move_offered = require('./helpers/is_appimage_move_offered');
const is_instance_takeover = require('./helpers/is_instance_takeover');
const is_pid_running = require('./helpers/is_pid_running');
const is_program_file = require('./helpers/is_program_file');
const is_url_external = require('./helpers/is_url_external');
const letter_tile_svg = require('./helpers/letter_tile_svg');
const log_value_from_text = require('./helpers/log_value_from_text');
const make = require('@vbarbarosh/type-helpers');
const make_newest_gate = require('./helpers/make_newest_gate');
const make_pid_lock = require('./helpers/make_pid_lock');
const make_socket_server = require('./helpers/make_socket_server');
const os = require('os');
const parse = require('../../lib/parse');
const pid_from_lock_target = require('./helpers/pid_from_lock_target');
const sanitize_filename = require('@vbarbarosh/node-helpers/src/sanitize_filename');
const settings_from_raw = require('./helpers/settings_from_raw');
const start_failure_text = require('./helpers/start_failure_text');
const text_design_set = require('./helpers/text_design_set');
const url_from_path = require('url').pathToFileURL;

// This instance quits for a start that takes its place (`second-instance` in main): whatever it
// was doing then, its own start too, breaks off, and that is no failed start to tell the user of
let is_giving_way = false;

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

const START_FAILURE_TITLE = 'NavPlace could not start';

// Why a move of the AppImage did not happen, in plain words; any other reason in the system's own
const MOVE_REASON_BY_CODE = {
    EEXIST: 'A file with its name is already there',
    EACCES: 'Permission denied',
    EPERM: 'Permission denied',
    ENOSPC: 'The disk is full',
    EROFS: 'The disk is read-only',
};

// A takeover (lock_take_over): how often the running instance is looked at, how long one that
// knows the takeover has to quit by itself, how long one told to end has to end, and how many
// times the lock is asked for once it is gone
const TAKEOVER_POLL_MS = 100;
const TAKEOVER_QUIT_MS = 2000;
const TAKEOVER_TERM_MS = 5000;
const TAKEOVER_LOCK_TRIES = 20;

// How long a start waits for its turn to ask for the lock (lock_request) before it asks anyway
const LOCK_TURN_MS = 3000;

cli(main, start_failure_report);

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
        const info = await gnome_configure({hotkey: settings.hotkey, version: electron.app.getVersion()});
        console.log(`✓ ${hotkey_label(settings.hotkey)} successfully registered — NavPlace will summon instantly.`);
        console.log(`  launcher:   ${info.launcher_file}`);
        console.log(`  cold start: ${info.appimage_file}`);
        console.log(`  node:       ${info.node_bin}`);
        console.log(`  at login:   ${info.autostart_file} (starts hidden; log out and in, or run it with --background now)`);
        electron.app.exit(0);
        return;
    }

    const app_uid = crypto.randomUUID();
    console.log(`[${app_uid}][group_spawn]`);

    // One instance runs at a time. The lock is told who starts: a running instance of another
    // AppImage file or of another version quits on hearing it (`second-instance` below) and this
    // start takes its place; a running one of this very file and version shows its window, and
    // this start ends
    const instance = {pid: process.pid, appimage_file: config.appimage_file, version: electron.app.getVersion()};
    if (!await lock_request(instance)) {
        if (!await lock_take_over(instance, app_uid)) {
            // The start ends here, in so many words: `exit` may take a moment to end the process, and
            // nothing more of the start may run in that moment. It would write itself down as the
            // running instance and open the hotkey's socket in place of the one that runs
            electron.app.exit(0);
            return;
        }
    }
    await instance_write(instance, app_uid);

    // The order matters: the question reads where the previous version is from the .desktop entry,
    // which entries_repoint then points at this file, where it was left or where it was moved
    if (config.appimage_file) {
        await appimage_move_offer(instance, app_uid);
        entries_repoint(app_uid);
        setup_carry(app_uid);
    }

    await electron.app.whenReady();

    let parsed_collection = await start_step('The links file could not be read', config.readme_file, collection_load());
    // The `file:` addresses of the user's own file, taken before its includes are added: the only
    // ones a page may ask the app to open
    let file_hrefs = file_hrefs_from_collection(parsed_collection);
    // Chosen before anything can ask for a reload: a reload reads it and may change it
    let design = await design_of_collection(parsed_collection);
    const refresh_gate = make_newest_gate();

    electron.ipcMain.handle('api_ping', function () {
        return `pong ${format_date(new Date())}`;
    });
    electron.ipcMain.handle('api_items_all', async function () {
        return parsed_collection;
    });
    electron.ipcMain.handle('api_file_open', function (event, href) {
        file_link_open(href);
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

    // A second start says who it is. Another AppImage file or another version was started on
    // purpose: this one quits and that one takes its place. A release from before the takeover
    // (1.4.2 and older) says nothing and ends by itself: it only gets the window, as a second
    // start of this very file does
    electron.app.on('second-instance', async function (event, argv, cwd, raw) {
        const starter = instance_from_raw(raw);
        if (starter && is_instance_takeover(instance, starter)) {
            console.log(`[${app_uid}][second_instance_takes_over] pid=${starter.pid} appimage=${log_value_from_text(starter.appimage_file)} version=${log_value_from_text(starter.version)}`);
            is_giving_way = true;
            electron.app.quit();
            return;
        }
        console.log(`[${app_uid}][second_instance]`);
        await window_show();
    });
    await using _ = await start_step('The socket the hotkey talks to could not be opened', config.socket_file, make_socket_server({
        socket_file: config.socket_file,
        connection_accept: async function () {
            console.log(`[${app_uid}][socket_connection]`);
            await window_show();
        },
    }));

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
        // app://favicon/<domain>?letter=<the link's first letter>
        const url = new URL(request.url);
        const domain = decodeURIComponent(url.pathname.slice(1));
        // favicons-v3/: navplace's own icons first, then the site's; favicons/ and favicons-v2/ held older ones
        const file = fs_path_resolve(electron.app.getPath('userData'), `favicons-v3/${sanitize_filename(domain)}.json`);
        // The site has no icon anywhere: kept a day, so a summon does not ask again
        const missing_file = `${file}.missing`;
        await fs_mkdirp(fs_path_dirname(file));
        if (await file_is_younger(missing_file, 24*60*60*1000)) {
            return make_tile_response();
        }
        // {type, base64}: the site's own icon (lib/icon_find.js, as on navplace.com), or null
        let icon;
        try {
            icon = await cache_read({
                get: async () => JSON.parse(await fs_read_utf8(file)),
                put: v => fs_write(file, JSON.stringify(v)),
                refresh: async function () {
                    const found = await icon_find(domain, fetch, icon_library_read);
                    if (!found) {
                        // Offline, nothing is found either: only a miss while online is kept
                        if (await is_online()) {
                            await fs_write(missing_file, `${new Date().toISOString()}\n`);
                        }
                        throw new Error('no icon');
                    }
                    return {type: found.type, base64: Buffer.from(found.bytes).toString('base64')};
                },
            });
        }
        catch {
            return make_tile_response();
        }
        return new Response(Buffer.from(icon.base64, 'base64'), {
            headers: {
                'Content-Type': icon.type,
                'Cache-Control': 'max-age=86400',
            },
        });

        // The link's letter on a tile: what a site with no icon gets
        function make_tile_response() {
            return new Response(letter_tile_svg(url.searchParams.get('letter'), domain), {
                headers: {
                    'Content-Type': 'image/svg+xml',
                    'Cache-Control': 'max-age=3600',
                },
            });
        }
    });

    // navplace://app/designs/…, navplace://app/lib/… and navplace://app/settings/…, from the app's own folders
    electron.protocol.handle('navplace', async function (request) {
        let root = null;
        let abs = null;

        const url = new URL(request.url);
        const path = decodeURIComponent(url.pathname);
        // The settings page sits inside app.asar, which has no links: the path as written decides.
        // A `%2F` is a slash by now, so `..` can still lead out of the folder
        if ((url.host === 'app') && path.startsWith('/settings/')) {
            abs = fs_path_resolve(config.settings_page_dir, path.slice('/settings/'.length));
            if (!file_is_inside(abs, config.settings_page_dir)) {
                return new Response('Forbidden', {status: 403});
            }
            return electron.net.fetch(url_from_path(abs).href);
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

    // A page gets nothing it asks for: no reading of the clipboard, no location, camera, microphone
    // or notifications, no program of the system started for an address. One thing is left, writing
    // to the clipboard: a design's Copy button
    electron.session.defaultSession.setPermissionRequestHandler(function (web_contents, permission, callback) {
        callback(permission === 'clipboard-sanitized-write');
    });
    electron.session.defaultSession.setPermissionCheckHandler((web_contents, permission) => permission === 'clipboard-sanitized-write');

    // A link opened, by Enter, a click or several at once: the search starts over, so the window
    // that comes back shows every link with the first one selected
    let search_reset_timer = null;
    win.webContents.setWindowOpenHandler(function (details) {
        link_open(details.url);
        return {action: 'deny'};
    });
    // A design whose link is a plain <a href>, or a page that sets its location: the window never
    // leaves its page, and the link opens as window.open opens it
    win.webContents.on('will-navigate', function (event) {
        event.preventDefault();
        link_open(event.url);
    });

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
    // The same setup as `--configure-gnome`, from the settings window: the page then draws what is
    // set up now, the hotkey and the start at login with it
    electron.ipcMain.handle('settings_gnome_setup', settings_only(async function () {
        try {
            await gnome_configure({hotkey: settings.hotkey, version: electron.app.getVersion()});
        }
        catch (error) {
            console.error(`[${app_uid}][settings_gnome_setup_failed] reason=${JSON.stringify(error.message)}`);
            throw new Error(gnome_setup_failure_text(error));
        }
        return settings_state();
    }));
    electron.ipcMain.handle('settings_updates_check', settings_only(updates_check));
    // Back to the links: the settings window closes and the app's window comes up
    electron.ipcMain.handle('settings_back', settings_only(async function () {
        settings_win.close();
        await window_show();
    }));
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

    // The links window is the app: the socket the hotkey talks to goes when it closes. A settings
    // window left open kept the app half alive, with no hotkey and no way to start again. So it
    // goes too and the app quits: the next press of the hotkey is a clean cold start
    if (settings_win) {
        settings_win.destroy();
    }
    electron.app.quit();

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
        // The settings page stays what this window shows: it opens no window and goes to no other page
        settings_win.webContents.setWindowOpenHandler(() => ({action: 'deny'}));
        settings_win.webContents.on('will-navigate', v => v.preventDefault());
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
            gnome: await gnome_setup_read(),
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
        await design_load(next);
        refresh_collection_in_background();
    }

    // The design the links file names now: the window loads it only when it is another one
    async function design_load(next) {
        if ((next === design) || win.isDestroyed()) {
            return;
        }
        console.log(`[${app_uid}][design_changed] from=${design} to=${next}`);
        design = next;
        await win.loadURL(design_url(design));
    }

    // {zoom, on_top, hide_on_blur, hotkey, autostart}: each one given applied to the app and kept
    async function settings_patch(patch) {
        const next = settings_from_raw({...settings, ...patch});
        if (('hotkey' in patch) && (next.hotkey !== patch.hotkey)) {
            throw new Error('Ctrl, Alt or Super with a letter, a digit or an F key');
        }
        if (next.hotkey !== settings.hotkey) {
            // No launcher, no shortcut to change: GNOME would get keys that run nothing
            if (!await fs_exists(config.launcher_file)) {
                throw new Error('The hotkey needs the GNOME setup first');
            }
            await gnome_hotkey_set(config.launcher_file, next.hotkey);
        }
        if ('autostart' in patch) {
            await autostart_set(!!patch.autostart, {appimage_file: config.appimage_file, icon: await icon_file_find()});
        }
        // The links window may have closed while the lines above waited: the app is quitting
        if (!win.isDestroyed()) {
            win.webContents.setZoomFactor(next.zoom);
            win.setAlwaysOnTop(next.on_top);
        }
        settings = next;
        await settings_save(settings);
    }

    // The file is read again, so `% design:` is too: a design named since the last reload is loaded
    // before the includes are pulled, the same one again leaves the page as it is. Every summon
    // starts a reload while an older one may still pull its includes: the newest one chooses the
    // design, and links that come back after a newer reload's are dropped
    async function refresh_collection() {
        const pass = refresh_gate.enter();
        const collection = await collection_load();
        if (pass.is_newest()) {
            await design_load(await design_of_collection(collection));
        }
        // includes/: the last good text of every `% include:` address, for the time it does not answer
        const kept_dir = fs_path_resolve(electron.app.getPath('userData'), 'includes');
        const resolved = await collection_resolve_includes(collection, app_uid, {kept_dir});
        if (!pass.leave()) {
            console.log(`[${app_uid}][collection_refresh_dropped] refresh=${pass.number}`);
            return;
        }
        parsed_collection = resolved;
        file_hrefs = file_hrefs_from_collection(collection);
        if (!win.isDestroyed()) {
            win.webContents.send('api_items_changed', parsed_collection);
        }
    }

    // Never awaited by anything that shows the window.
    function refresh_collection_in_background() {
        refresh_collection().catch(e => console.error(`[${app_uid}][collection_refresh_failed] reason=${JSON.stringify(e.message)}`));
    }

    async function window_show() {
        // A summon that comes while the app quits finds no window
        if (win.isDestroyed()) {
            return;
        }
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
        await search_reset();
    }

    // A link a page asked for: opened outside, and the search starts over
    function link_open(url) {
        url_open_external(url, app_uid);
        search_reset_later();
    }

    // A `file:` link a page asked the app to open, which the page cannot do itself: the same
    function file_link_open(href) {
        file_open_external(href, file_hrefs, app_uid);
        search_reset_later();
    }

    // Several links opened at once start the search over once
    function search_reset_later() {
        clearTimeout(search_reset_timer);
        search_reset_timer = setTimeout(() => search_reset().catch(() => {}), 100);
    }

    // An empty search box, focused: the design shows every link again, the first one selected
    async function search_reset() {
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

// Electron's single-instance lock asked for, by one start at a time. Two starts that asked in the
// same instant were both told the lock was theirs: the second then failed at the hotkey's socket,
// "could not start", and stayed as a second NavPlace. So a start asks while it holds a lock file
// of the app's own (helpers/make_pid_lock.js), and one that comes in the same instant asks after
// it, and hears that the lock is taken. A turn that does not come in time is not waited for
async function lock_request(instance)
{
    try {
        await fs_mkdirp(config.user_data_dir);
    }
    catch {
    }
    await using _ = await make_pid_lock({file: config.lock_turn_file, wait_ms: LOCK_TURN_MS});
    return electron.app.requestSingleInstanceLock(instance);
}

// Another instance holds the lock; whether this start has it when this returns. A running one of
// this very file and version has shown its window by now, and this start ends as it always did.
// One of another AppImage file or version gives way: the user started this one on purpose
async function lock_take_over(instance, group_uid)
{
    let holder = await lock_holder_read();
    // No link any more: the instance that refused the lock a moment ago quit while this start
    // looked, a running one that gave way at once. The lock is free, unless another start was
    // faster and holds it now
    if (holder.target === null) {
        if (await lock_request(instance)) {
            console.log(`[${group_uid}][lock_found_free]`);
            return true;
        }
        holder = await lock_holder_read();
    }
    if (holder.pid === null) {
        console.error(`[${group_uid}][lock_holder_unknown] target=${log_value_from_text(holder.target)}`);
        return false;
    }
    if (!is_instance_takeover(instance, holder)) {
        console.log(`[${group_uid}][instance_summoned] pid=${holder.pid}`);
        return false;
    }
    console.log(`[${group_uid}][takeover_begin] pid=${holder.pid} appimage=${log_value_from_text(holder.appimage_file)} version=${log_value_from_text(holder.version)}`);
    let failure = await lock_holder_end(holder, group_uid);
    if (!failure && !await lock_wait(instance)) {
        failure = `the lock stayed taken after pid ${holder.pid} was gone`;
    }
    if (failure) {
        console.error(`[${group_uid}][takeover_end_error] reason=${JSON.stringify(failure)}`);
        return false;
    }
    console.log(`[${group_uid}][takeover_end_ok]`);
    return true;
}

// The instance that holds the lock, by what this machine knows of it: its pid from the
// SingletonLock link Electron keeps in userData, its program and its AppImage file from /proc,
// and whether those prove it to be NavPlace (helpers/is_app_process.js). An instance that wrote
// instance.json says its file and version itself, and knows the takeover; a release from before
// it (1.4.2 and older) wrote none: its version stays null. `pid` is null when the lock names no
// other process of this machine
async function lock_holder_read()
{
    let target = null;
    let said = null;
    let program = null;
    let appimage_file = null;
    let is_app = false;

    try {
        target = await fs_readlink(fs_path_resolve(electron.app.getPath('userData'), 'SingletonLock'));
    }
    catch {
    }
    const pid = pid_from_lock_target(target, os.hostname());
    if ((pid === null) || (pid === process.pid)) {
        return {pid: null, target};
    }
    try {
        const environ_text = await fs_read_utf8(`/proc/${pid}/environ`);
        const cmdline_text = await fs_read_utf8(`/proc/${pid}/cmdline`);
        program = cmdline_text.split('\0')[0];
        appimage_file = env_from_text(environ_text).APPIMAGE ?? null;
        is_app = is_app_process({environ_text, cmdline_text}, process.execPath);
    }
    catch {
    }
    try {
        said = instance_from_raw(JSON.parse(await fs_read_utf8(config.instance_file)));
    }
    catch {
    }
    if (said?.pid === pid) {
        return {pid, target, program, is_app, appimage_file: said.appimage_file, version: said.version, knows_takeover: true};
    }
    return {pid, target, program, is_app, appimage_file, version: null, knows_takeover: false};
}

// The running instance brought to its end: null when it is gone, else why it is still there. One
// that knows the takeover heard who starts and quits by itself; any may be gone already, by its
// own doing. One that still runs is sent SIGTERM, on which Electron quits as when its window is
// closed; but only a process that /proc proves to be NavPlace: any other is never signalled
async function lock_holder_end(holder, group_uid)
{
    if (await pid_wait_end(holder.pid, holder.knows_takeover ? TAKEOVER_QUIT_MS : 0)) {
        return null;
    }
    if (!holder.is_app) {
        return `pid ${holder.pid} is not proved to be NavPlace, its program is ${holder.program}: nothing was signalled`;
    }
    try {
        process.kill(holder.pid, 'SIGTERM');
    }
    catch (error) {
        return (error.code === 'ESRCH') ? null : `pid ${holder.pid} could not be signalled: ${error.code}`;
    }
    console.log(`[${group_uid}][takeover_sigterm_sent] pid=${holder.pid} program=${log_value_from_text(holder.program)} appimage=${log_value_from_text(holder.appimage_file)}`);
    if (!await pid_wait_end(holder.pid, TAKEOVER_TERM_MS)) {
        return `pid ${holder.pid} still runs after SIGTERM`;
    }
    return null;
}

// The lock asked for until it is given, a few times: the instance that held it is gone, and what
// it left of the lock Electron clears by itself
async function lock_wait(instance)
{
    for (let i = 0; i < TAKEOVER_LOCK_TRIES; ++i) {
        if (await lock_request(instance)) {
            return true;
        }
        await Promise.delay(TAKEOVER_POLL_MS);
    }
    return false;
}

// Waits until no process has this pid, `ms` at most; whether it is gone
async function pid_wait_end(pid, ms)
{
    const time0 = Date.now();
    while (is_pid_running(pid)) {
        if ((Date.now() - time0) >= ms) {
            return false;
        }
        await Promise.delay(TAKEOVER_POLL_MS);
    }
    return true;
}

// Who runs, kept for the next start to read (lock_holder_read). Never the failure of this start:
// an instance that could not write it is taken for a release from before the takeover
async function instance_write(instance, group_uid)
{
    try {
        await fs_mkdirp(config.user_data_dir);
        await fs_write(config.instance_file, `${JSON.stringify(instance)}\n`);
    }
    catch (error) {
        console.error(`[${group_uid}][instance_write_failed] reason=${JSON.stringify(error.message)}`);
    }
}

// A new version is run where it was downloaded, while the one it replaces has its place in
// another folder: the user is asked once whether this one moves there. That place is the folder
// of the program the .desktop entry starts, the entry --configure-gnome wrote for the previous
// version; whatever the answer, entries_repoint then points the entry at this file, so the next
// start asks nothing. Nothing is asked at a start in the background, with no such entry, or when
// that folder cannot be written to (helpers/is_appimage_move_offered.js). The old file is never
// touched. After a move `instance` and the config name the new place
async function appimage_move_offer(instance, group_uid)
{
    let is_same_dir = false;
    let is_dir_writable = false;

    const appimage_file = config.appimage_file;
    const appimage_dir = fs_path_dirname(appimage_file);
    const entry_file = await entry_program_read();
    if (!entry_file) {
        return;
    }
    const entry_dir = fs_path_dirname(entry_file);
    // Two paths may name one folder, through a link: the folders themselves are compared
    try {
        const dir = await fs.promises.realpath(entry_dir);
        is_same_dir = (dir === await fs.promises.realpath(appimage_dir));
        await fs.promises.access(dir, fs.constants.W_OK | fs.constants.X_OK);
        is_dir_writable = true;
    }
    catch {
    }
    if (!is_appimage_move_offered({appimage_file, entry_file, is_same_dir, is_dir_writable, is_background: process.argv.includes('--background')})) {
        return;
    }

    const target_file = appimage_target_from_entry(appimage_file, entry_file);
    // The old file may be gone by now, deleted by hand: its folder is still the place
    const verb = (await fs_exists(entry_file)) ? 'is' : 'was';
    await electron.app.whenReady();
    // Asked before the button is drawn: a name that is taken there is said, not offered
    if (await file_is_there(target_file)) {
        console.log(`[${group_uid}][appimage_move_name_taken] target=${log_value_from_text(target_file)}`);
        await electron.dialog.showMessageBox({
            type: 'info',
            title: 'NavPlace',
            message: `This version of NavPlace stays in ${appimage_dir}.`,
            detail: `The version it replaces ${verb} in ${entry_dir}, where a file named ${fs_path_basename(target_file)} already exists. Nothing was moved.`,
            buttons: ['OK'],
        });
        return;
    }
    const answer = await electron.dialog.showMessageBox({
        type: 'question',
        title: 'NavPlace',
        message: `This version of NavPlace was started from ${appimage_dir}.`,
        detail: `The version it replaces ${verb} in ${entry_dir}. This one can move there too; the old file is not deleted.`,
        buttons: ['Move it there', 'Leave it here'],
        defaultId: 0,
        cancelId: 1,
        noLink: true,
    });
    if (answer.response !== 0) {
        console.log(`[${group_uid}][appimage_left] appimage=${log_value_from_text(appimage_file)}`);
        return;
    }
    try {
        await appimage_move(appimage_file, target_file);
    }
    catch (error) {
        console.error(`[${group_uid}][appimage_move_failed] target=${log_value_from_text(target_file)} reason=${JSON.stringify(error.message)}`);
        await electron.dialog.showMessageBox({
            type: 'warning',
            title: 'NavPlace',
            message: `NavPlace could not be moved to ${entry_dir}.`,
            detail: `${MOVE_REASON_BY_CODE[error.code] ?? error.message}. It stays in ${appimage_dir}.`,
            buttons: ['OK'],
        });
        return;
    }
    config_appimage_file_set(target_file);
    instance.appimage_file = target_file;
    await instance_write(instance, group_uid);
    console.log(`[${group_uid}][appimage_moved] from=${log_value_from_text(appimage_file)} to=${log_value_from_text(target_file)}`);
}

// The program the .desktop entry starts, the AppImage --configure-gnome wrote there; null when
// there is no entry, or it starts nothing
async function entry_program_read()
{
    try {
        return desktop_exec_args_from_entry(await fs_read_utf8(config.desktop_file))[0] ?? null;
    }
    catch {
        return null;
    }
}

// A name is taken by whatever bears it, a link that leads nowhere too
async function file_is_there(file)
{
    try {
        await fs.promises.lstat(file);
        return true;
    }
    catch {
        return false;
    }
}

// After an update the AppImage is another file: the entries --configure-gnome wrote for the old
// one, the hotkey's cold start and the start at login, are pointed at the running one. Never
// awaited by the start, and never its failure
async function entries_repoint(group_uid)
{
    try {
        const files = await appimage_entries_repoint({appimage_file: config.appimage_file, desktop_file: config.desktop_file, autostart_file: config.autostart_file});
        if (files.length) {
            console.log(`[${group_uid}][entries_repointed] appimage=${config.appimage_file} files=${files.join(',')}`);
        }
    }
    catch (error) {
        console.error(`[${group_uid}][entries_repoint_failed] reason=${JSON.stringify(error.message)}`);
    }
}

// The rest of what --configure-gnome set up for the AppImage of before, the launcher copy and
// the hotkey's command, set up again for this one (helpers/gnome_setup_carry.js): once per new
// version or file, with no question. Never awaited by the start, and never its failure: a piece
// that could not be done is one line here, and tried again at the next start
async function setup_carry(group_uid)
{
    try {
        const carried = await gnome_setup_carry({version: electron.app.getVersion()});
        if (!carried) {
            return;
        }
        for (const failure of carried.failures) {
            console.error(`[${group_uid}][setup_carry_piece_failed] piece=${failure.piece} reason=${JSON.stringify(failure.reason)}`);
        }
        console.log(`[${group_uid}][setup_carried] launcher=${carried.launcher} hotkey=${carried.hotkey} stamped=${!carried.failures.length}`);
    }
    catch (error) {
        console.error(`[${group_uid}][setup_carry_failed] reason=${JSON.stringify(error.message)}`);
    }
}

// A step of the start: when it fails, the error carries what could not be done and the path
// concerned, for the box of a failed start
async function start_step(sentence, file, promise)
{
    try {
        return await promise;
    }
    catch (error) {
        error.start_step = {sentence, file};
        throw error;
    }
}

// A start that fails says so to the user and ends with code 1: started by the hotkey or at login,
// nobody reads stderr. A box, which holds the app until it is closed; before the app is ready
// Linux shows none, so a notification then. `--configure-gnome` runs in a terminal: stderr is read
function start_failure_report(error)
{
    if (is_giving_way) {
        return;
    }
    console.error(error);
    if (process.argv.includes('--configure-gnome')) {
        return;
    }
    const text = start_failure_text(error);
    if (electron.app.isReady()) {
        electron.dialog.showErrorBox(START_FAILURE_TITLE, text);
        return;
    }
    child_process.spawnSync('notify-send', ['--app-name=NavPlace', START_FAILURE_TITLE, text], {stdio: 'ignore'});
}

// Only a web address or a plain mail address is handed to the system (helpers/is_url_external.js):
// any other kind (ssh:, smb:, vscode:, file:, a mailto: that says more than whom to write to)
// would start whatever program the system keeps for it. A `file:` link has its own way in,
// file_open_external
async function url_open_external(url, group_uid)
{
    let protocol = null;
    try {
        protocol = new URL(url).protocol;
    }
    catch {
    }
    if (!is_url_external(url)) {
        console.error(`[${group_uid}][link_skipped] protocol=${protocol ?? 'invalid-url'}`);
        return;
    }
    // Chrome's window is brought up for a web address only: a mail address opens in the mail program
    if ((protocol !== 'mailto:') && (process.platform === 'linux') && config.is_wayland) {
        try {
            await chrome_window_focus(protocol.slice(0, -1));
        }
        catch {
            // Handler lookup and Window Calls are optional; fall back to normal URL opening.
        }
    }
    await electron.shell.openExternal(url);
}

// A `file:` address is opened only when the user's own links file lists it (`file_hrefs`): a link
// of an included file is someone else's text. A folder or a plain file goes to the system's
// program for it; one that opening could run (helpers/is_program_file.js) is shown in its folder.
// The logs keep no path
async function file_open_external(href, file_hrefs, group_uid)
{
    let stat = null;

    const file = file_from_href(href, file_hrefs);
    if (!file) {
        console.error(`[${group_uid}][file_link_skipped] listed=${file_hrefs.has(href)}`);
        return;
    }
    try {
        stat = await fs.promises.stat(file);
    }
    catch (error) {
        console.error(`[${group_uid}][file_link_stat_failed] code=${error.code}`);
        return;
    }
    if (is_program_file(file, stat.mode)) {
        console.log(`[${group_uid}][file_link_shown_in_folder]`);
        electron.shell.showItemInFolder(file);
        return;
    }
    const failure = await electron.shell.openPath(file);
    if (failure) {
        console.error(`[${group_uid}][file_link_open_failed] reason=${JSON.stringify(failure)}`);
    }
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

// Google's empty page answers: the network is up
async function is_online()
{
    try {
        return (await fetch('https://www.google.com/generate_204', {signal: AbortSignal.timeout(4000)})).status === 204;
    }
    catch {
        return false;
    }
}

// navplace's own icon for a domain, from the app's lib/icons/; null when it has none
async function icon_library_read(domain)
{
    let index;
    try {
        index = JSON.parse(await fs_read_utf8(fs_path_resolve(config.lib_dir, 'icons/index.json')));
    }
    catch {
        return null;
    }
    const file = icon_library_file(domain, index);
    if (!file) {
        return null;
    }
    return {bytes: await fs_read(fs_path_resolve(config.lib_dir, 'icons', file)), type: file.endsWith('.svg') ? 'image/svg+xml' : 'image/png'};
}

async function file_is_younger(file, ms)
{
    try {
        return (Date.now() - (await fs.promises.stat(file)).mtimeMs) < ms;
    }
    catch {
        return false;
    }
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

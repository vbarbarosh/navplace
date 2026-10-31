import WebSocket from 'ws';
import { dirname, extname, isAbsolute, join, relative, resolve } from 'node:path';
import { ensureDir, loadConfig } from './config.ts';
import type { Config } from './config.ts';
import { parseCollection } from './parse.ts';
import type { NavPlaceCollection } from './parse.ts';

type BrowserWindowConstructor = new (options?: BrowserWindowOptions) => BrowserWindowLike;

interface BrowserWindowOptions {
    title?: string;
    width?: number;
    height?: number;
    alwaysOnTop?: boolean;
    resizable?: boolean;
}

interface BrowserWindowLike {
    bind(name: string, handler: (...args: unknown[]) => unknown): void;
    executeJs(code: string): Promise<unknown>;
    navigate(url: string): void;
    show(): void;
    hide(): void;
    focus(): void;
    isVisible(): boolean;
    isClosed(): boolean;
    addEventListener(name: string, handler: (event: Event) => void): void;
}

interface SingleInstanceSocket {
    primary: boolean;
    close(): Promise<void>;
}

interface EventConnection {
    close(): void;
}

interface SseHub {
    response(): Response;
    broadcast(event: string, value: unknown): void;
}

const DEFAULT_README = `% design: github

ChatGPT          https://chatgpt.com/
GitHub           https://github.com/
Gmail            https://mail.google.com/
Google Calendar  https://calendar.google.com/
Google Drive     https://drive.google.com/
MDN Web Docs     https://developer.mozilla.org/
Node.js          https://nodejs.org/en/docs
Deno Desktop     https://docs.deno.com/runtime/desktop/
`;

const BRIDGE_JS = String.raw`
(() => {
  if (window.ElectronApp) return;

  const callbacks = new Set();
  const hasBindings = typeof globalThis.bindings === "object" && globalThis.bindings !== null;

  function call(name, ...args) {
    if (hasBindings && typeof globalThis.bindings[name] === "function") {
      return globalThis.bindings[name](...args);
    }
    if (name === "api_ping") {
      return fetch("/api/ping").then((response) => response.text());
    }
    if (name === "api_items_all") {
      return fetch("/api/items").then((response) => response.json());
    }
    if (name === "api_open_external") {
      return fetch("/api/open-external", {
        method: "POST",
        headers: {"content-type": "application/json"},
        body: JSON.stringify({href: args[0]}),
      }).then((response) => {
        if (!response.ok) throw new Error("open-external failed");
      });
    }
    return Promise.reject(new Error("Unknown desktop API: " + name));
  }

  window.ElectronApp = {
    api_ping: () => call("api_ping"),
    api_items_all: () => call("api_items_all"),
    api_items_changed: (callback) => {
      if (typeof callback !== "function") return () => {};
      callbacks.add(callback);
      return () => callbacks.delete(callback);
    },
    api_open_external: (href) => call("api_open_external", href),
  };

  window.__NavPlaceDesktop = {
    itemsChanged(value) {
      for (const callback of callbacks) {
        try {
          callback(value);
        }
        catch (error) {
          setTimeout(() => { throw error; }, 0);
        }
      }
    },
  };

  if (!hasBindings) {
    try {
      const source = new EventSource("/api/events");
      source.addEventListener("items_changed", (event) => {
        window.__NavPlaceDesktop.itemsChanged(JSON.parse(event.data));
      });
    }
    catch {
    }
  }

  const originalOpen = window.open.bind(window);
  window.open = function (url, target, features) {
    if (url) {
      window.ElectronApp.api_open_external(String(url)).catch(console.error);
      return null;
    }
    return originalOpen(url, target, features);
  };

  document.documentElement.style.zoom = "1.25";

  document.addEventListener("click", (event) => {
    const anchor = event.target?.closest?.("a[href]");
    if (!anchor) return;
    const url = new URL(anchor.getAttribute("href"), location.href);
    if ((url.protocol === "http:" || url.protocol === "https:" || url.protocol === "file:") && url.origin !== location.origin) {
      event.preventDefault();
      window.ElectronApp.api_open_external(url.href).catch(console.error);
    }
  }, true);
})();
`;

if (import.meta.main) {
    main().catch((error) => {
        console.error(error?.stack || error?.message || String(error));
        Deno.exit(1);
    });
}

async function main(): Promise<void>
{
    const config = await loadConfig();
    let parsedCollection = await loadCollection(config);
    const design = await selectDesign(config, parsedCollection);
    const sse = createSseHub();

    let win: BrowserWindowLike | null = null;
    const single = await createSingleInstanceSocket(config.socketFile, () => {
        if (win) {
            void summonWindow(win);
        }
    });
    if (!single.primary) {
        Deno.exit(0);
    }

    const BrowserWindow = getBrowserWindow();
    if (BrowserWindow) {
        win = new BrowserWindow({
            title: 'NavPlace',
            width: 1200,
            height: 1000,
            alwaysOnTop: true,
        });

        win.bind('api_ping', () => `pong ${new Date().toISOString()}`);
        win.bind('api_items_all', () => parsedCollection);
        win.bind('api_open_external', (href) => openExternal(href));
        win.addEventListener('blur', () => {
            if (win && !win.isClosed()) {
                win.hide();
            }
        });
    }

    const events = connectEvents(config, async () => {
        parsedCollection = await loadCollection(config);
        await notifyItemsChanged(win, sse, parsedCollection);
    });

    const server = Deno.serve(
        {
            onListen: ({ hostname, port }) => {
                const base = `http://${hostname === '0.0.0.0' ? '127.0.0.1' : hostname}:${port}`;
                console.log(`NavPlace Deno Desktop serving ${base}`);
                if (win) {
                    win.navigate(`${base}/designs/${encodeURIComponent(design)}/index.html`);
                    win.show();
                    void summonWindow(win);
                }
            },
        },
        (request) => handleRequest(request, config, sse, () => parsedCollection, design),
    );

    try {
        await server.finished;
    } finally {
        events.close();
        await single.close();
    }
}

async function loadCollection(config: Config): Promise<NavPlaceCollection>
{
    if (config.collectionUrl) {
        return parseCollection(await fetchCollectionContents(config), {
            desktopUrls: true,
        });
    }
    await ensureDefaultReadme(config);
    return parseCollection(await Deno.readTextFile(config.readmeFile), {
        desktopUrls: true,
    });
}

async function ensureDefaultReadme(config: Config): Promise<void>
{
    try {
        await Deno.stat(config.readmeFile);
    }
    catch (error) {
        if (!(error instanceof Deno.errors.NotFound)) {
            throw error;
        }
        await ensureDir(config.configDir);
        await Deno.writeTextFile(config.readmeFile, DEFAULT_README, {
            createNew: true,
        });
    }
}

async function fetchCollectionContents(config: Config): Promise<string>
{
    if (!config.collectionUrl) {
        throw new Error('collectionUrl is not configured');
    }
    const headers = new Headers();
    if (config.personalAccessToken) {
        headers.set('Authorization', `Bearer ${config.personalAccessToken}`);
    }
    const response = await fetch(config.collectionUrl, { headers });
    if (!response.ok) {
        throw new Error(`Collection request failed: ${response.status}`);
    }
    const json = await response.json();
    if (typeof json.contents === 'string') {
        return json.contents;
    }
    throw new Error('Collection response JSON must contain string field "contents"');
}

async function selectDesign(config: Config, collection: NavPlaceCollection): Promise<string>
{
    const design = typeof collection.meta.design === 'string' ? collection.meta.design : 'github';
    const designs = new Set<string>();
    for await (const entry of Deno.readDir(config.designsDir)) {
        if (entry.isDirectory) {
            designs.add(entry.name);
        }
    }
    if (!designs.has(design)) {
        throw new Error(`Unknown design "${design}". Available designs: ${[...designs].sort().join(', ')}`);
    }
    return design;
}

async function handleRequest(request: Request, config: Config, sse: SseHub, getCollection: () => NavPlaceCollection, design: string): Promise<Response>
{
    try {
        const url = new URL(request.url);

        if (url.pathname === '/') {
            return new Response(null, {
                status: 302,
                headers: {
                    location: `/designs/${encodeURIComponent(design)}/index.html`,
                },
            });
        }
        if (url.pathname === '/api/ping') {
            return new Response(`pong ${new Date().toISOString()}`, {
                headers: { 'content-type': 'text/plain; charset=utf-8' },
            });
        }
        if (url.pathname === '/api/items') {
            return Response.json(getCollection());
        }
        if (url.pathname === '/api/events') {
            return sse.response();
        }
        if (url.pathname === '/api/open-external' && request.method === 'POST') {
            const body = await request.json();
            await openExternal(body?.href);
            return new Response(null, { status: 204 });
        }
        if (url.pathname.startsWith('/app/favicon/')) {
            return await serveFavicon(config, decodeURIComponent(url.pathname.slice('/app/favicon/'.length)));
        }
        if (url.pathname.startsWith('/private/')) {
            return await servePrivateFile(config, url.pathname.slice('/private/'.length));
        }
        if (url.pathname.startsWith('/designs/')) {
            return await serveFile(config.designsDir, url.pathname.slice('/designs/'.length), { injectBridge: url.pathname.endsWith('.html') });
        }
        if (url.pathname.startsWith('/lib/')) {
            return await serveFile(config.libDir, url.pathname.slice('/lib/'.length));
        }
        if (url.pathname.startsWith('/unpkg/')) {
            return await serveUnpkg(config, url);
        }
        if (url.pathname === '/favicon.ico') {
            return new Response(null, { status: 204 });
        }
        return new Response('Not found', { status: 404 });
    }
    catch (error) {
        if (error instanceof HttpError) {
            return new Response(error.message, { status: error.status });
        }
        console.error(error);
        return new Response('Internal Server Error', { status: 500 });
    }
}

async function serveFile(root: string, encodedPath: string, options: { injectBridge?: boolean } = {}): Promise<Response>
{
    const relPath = decodePath(encodedPath);
    const file = resolve(root, relPath);
    assertInside(root, file);
    let body = await Deno.readFile(file);
    let type = contentType(file);

    if (options.injectBridge) {
        const text = new TextDecoder().decode(body);
        body = new TextEncoder().encode(injectBridge(text));
        type = 'text/html; charset=utf-8';
    }

    return new Response(body, {
        headers: {
            'content-type': type,
            'cache-control': type.startsWith('text/html') ? 'no-store' : 'max-age=86400',
        },
    });
}

async function servePrivateFile(config: Config, encodedPath: string): Promise<Response>
{
    const relPath = decodePath(encodedPath);
    const root = await realPathOrCreate(config.configDir);
    let file: string;
    try {
        file = await Deno.realPath(resolve(root, relPath));
    }
    catch (error) {
        if (error instanceof Deno.errors.NotFound) {
            throw new HttpError(404, 'Not found');
        }
        throw error;
    }
    assertInside(root, file);
    return new Response(await Deno.readFile(file), {
        headers: {
            'content-type': contentType(file),
            'cache-control': 'max-age=86400',
        },
    });
}

async function serveFavicon(config: Config, domain: string): Promise<Response>
{
    if (!domain) {
        throw new HttpError(404, 'Not found');
    }
    const file = join(config.userDataDir, 'favicons', `${sanitizeFilename(domain)}.png`);
    await ensureDir(dirname(file));
    const bytes = await cache({
        get: () => Deno.readFile(file),
        set: (value) => Deno.writeFile(file, value),
        refresh: async () => {
            const url = new URL('https://www.google.com/s2/favicons');
            url.searchParams.set('domain', domain);
            url.searchParams.set('sz', '64');
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`Favicon request failed: ${response.status}`);
            }
            return new Uint8Array(await response.arrayBuffer());
        },
    });
    return new Response(bytes, {
        headers: {
            'content-type': 'image/png',
            'cache-control': 'max-age=86400',
        },
    });
}

async function serveUnpkg(config: Config, url: URL): Promise<Response>
{
    const encodedPath = url.pathname.slice('/unpkg/'.length);
    const relPath = decodePath(encodedPath);
    const localCandidates = [resolve(config.repoRoot, 'unpkg'), resolve(config.repoRoot, 'src/desktop-electron/static/unpkg')];

    for (const root of localCandidates) {
        try {
            const file = resolve(root, relPath);
            assertInside(root, file);
            return new Response(await Deno.readFile(file), {
                headers: {
                    'content-type': contentType(file),
                    'cache-control': 'max-age=86400',
                },
            });
        }
        catch (error) {
            if (!(error instanceof Deno.errors.NotFound)) {
                throw error;
            }
        }
    }

    const upstream = await fetch(`https://unpkg.com/${encodedPath}${url.search}`);
    if (!upstream.ok || !upstream.body) {
        throw new HttpError(upstream.status || 502, 'Unable to load unpkg asset');
    }
    return new Response(upstream.body, {
        status: upstream.status,
        headers: {
            'content-type': upstream.headers.get('content-type') || contentType(relPath),
            'cache-control': 'max-age=86400',
        },
    });
}

function connectEvents(config: Config, refreshCollection: () => Promise<void>): EventConnection
{
    if (!config.collectionUrl || !config.eventsUrl) {
        return { close() {} };
    }

    let closed = false;
    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
    let refreshTimer: ReturnType<typeof setTimeout> | undefined;

    connect();

    return {
        close() {
            closed = true;
            if (reconnectTimer !== undefined) {
                clearTimeout(reconnectTimer);
            }
            if (refreshTimer !== undefined) {
                clearTimeout(refreshTimer);
            }
            ws?.close();
        },
    };

    function connect()
    {
        if (closed || !config.eventsUrl) {
            return;
        }
        console.log('[ws_connect]', config.eventsUrl);
        ws = new WebSocket(config.eventsUrl, {
            headers: config.personalAccessToken ? { Authorization: `Bearer ${config.personalAccessToken}` } : undefined,
        });
        ws.on('open', () => console.log('[ws_open]', config.eventsUrl));
        ws.on('message', (data: { toString(): string }) => {
            const text = data.toString();
            console.log('[ws_message]', text);
            let event: unknown;
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
            if (isRefreshEvent(event)) {
                scheduleRefresh();
            }
        });
        ws.on('close', (code: number, reason: { toString(): string }) => {
            console.log('[ws_close]', code, reason.toString());
            reconnect();
        });
        ws.on('error', (error: Error) => {
            console.error('[ws_error]', error.message);
            reconnect();
        });
    }

    function reconnect()
    {
        if (closed || reconnectTimer !== undefined) {
            return;
        }
        console.log('[ws_reconnect]', '5000ms');
        reconnectTimer = setTimeout(() => {
            reconnectTimer = undefined;
            connect();
        }, 5000);
    }

    function scheduleRefresh()
    {
        if (refreshTimer !== undefined) {
            clearTimeout(refreshTimer);
        }
        refreshTimer = setTimeout(async () => {
            refreshTimer = undefined;
            try {
                await refreshCollection();
            }
            catch (error) {
                console.error('[collection_refresh_failed]', error);
            }
        }, 250);
    }
}

function isRefreshEvent(event: unknown): boolean
{
    if (!event || typeof event !== 'object' || !('type' in event)) {
        return false;
    }
    const type = String((event as { type: unknown }).type);
    return type === 'hello' || type.startsWith('collection.');
}

async function createSingleInstanceSocket(socketFile: string, onConnection: () => void): Promise<SingleInstanceSocket>
{
    if (Deno.build.os === 'windows') {
        return { primary: true, async close() {} };
    }

    try {
        const conn = await Deno.connect({ transport: 'unix', path: socketFile });
        conn.close();
        return { primary: false, async close() {} };
    }
    catch {
        await ensureDir(dirname(socketFile));
        try {
            await Deno.remove(socketFile);
        }
        catch {
            // Missing stale socket files are fine.
        }
    }

    let listener: Deno.Listener;
    try {
        listener = Deno.listen({ transport: 'unix', path: socketFile });
    }
    catch (error) {
        if (error instanceof Deno.errors.AddrInUse) {
            const conn = await Deno.connect({ transport: 'unix', path: socketFile });
            conn.close();
            return { primary: false, async close() {} };
        }
        throw error;
    }

    void (async () => {
        try {
            for await (const conn of listener) {
                conn.close();
                onConnection();
            }
        }
        catch (error) {
            if (!(error instanceof Deno.errors.BadResource)) {
                console.error(error);
            }
        }
    })();

    return {
        primary: true,
        async close() {
            listener.close();
            try {
                await Deno.remove(socketFile);
            }
            catch {
                // The socket file may already be gone during shutdown.
            }
        },
    };
}

async function summonWindow(win: BrowserWindowLike): Promise<void>
{
    if (win.isClosed()) {
        return;
    }
    if (!win.isVisible()) {
        win.show();
    }
    win.focus();
    await win
        .executeJs(
            String.raw`
    {
      const input = document.querySelector('input[type=search]') || document.querySelector('input');
      if (input) {
        input.focus();
        input.value = '';
        input.dispatchEvent(new Event('input', {bubbles: true}));
      }
    }
  `,
        )
        .catch((error) => console.error(error));
}

async function notifyItemsChanged(win: BrowserWindowLike | null, sse: SseHub, collection: NavPlaceCollection): Promise<void>
{
    sse.broadcast('items_changed', collection);
    if (!win || win.isClosed()) {
        return;
    }
    await win.executeJs(`window.__NavPlaceDesktop?.itemsChanged(${JSON.stringify(collection)});`).catch((error) => console.error(error));
}

async function openExternal(value: unknown): Promise<void>
{
    const href = assertExternalHref(value);
    const command = externalOpenCommand(href);
    const status = await new Deno.Command(command.cmd, {
        args: command.args,
        stdin: 'null',
        stdout: 'null',
        stderr: 'null',
    }).spawn().status;
    if (!status.success) {
        throw new Error(`Failed to open ${href}`);
    }
}

function assertExternalHref(value: unknown): string
{
    if (typeof value !== 'string') {
        throw new Error('href must be a string');
    }
    const url = new URL(value);
    if (!['http:', 'https:', 'file:'].includes(url.protocol)) {
        throw new Error(`Unsupported URL protocol: ${url.protocol}`);
    }
    return url.href;
}

function externalOpenCommand(href: string): { cmd: string; args: string[] }
{
    if (Deno.build.os === 'darwin') {
        return { cmd: 'open', args: [href] };
    }
    if (Deno.build.os === 'windows') {
        return { cmd: 'rundll32', args: ['url.dll,FileProtocolHandler', href] };
    }
    return { cmd: 'xdg-open', args: [href] };
}

function createSseHub(): SseHub
{
    const encoder = new TextEncoder();
    const clients = new Set<ReadableStreamDefaultController<Uint8Array>>();

    return {
        response() {
            let client: ReadableStreamDefaultController<Uint8Array> | null = null;
            const stream = new ReadableStream<Uint8Array>({
                start(controller) {
                    client = controller;
                    clients.add(controller);
                    controller.enqueue(encoder.encode(': connected\n\n'));
                },
                cancel() {
                    if (client) {
                        clients.delete(client);
                    }
                },
            });

            return new Response(stream, {
                headers: {
                    'content-type': 'text/event-stream',
                    'cache-control': 'no-cache',
                    connection: 'keep-alive',
                },
            });
        },
        broadcast(event, value) {
            const data = encoder.encode(`event: ${event}\ndata: ${JSON.stringify(value)}\n\n`);
            for (const client of [...clients]) {
                try {
                    client.enqueue(data);
                }
                catch {
                    clients.delete(client);
                }
            }
        },
    };
}

function getBrowserWindow(): BrowserWindowConstructor | null
{
    return (Deno as unknown as { BrowserWindow?: BrowserWindowConstructor }).BrowserWindow ?? null;
}

function injectBridge(html: string): string
{
    const script = `<script>${BRIDGE_JS}</script>`;
    if (html.includes('</head>')) {
        return html.replace('</head>', `${script}\n</head>`);
    }
    return `${script}\n${html}`;
}

function decodePath(path: string): string
{
    const decoded = path.split('/').map(decodeURIComponent).join('/');
    if (decoded.includes('\0')) {
        throw new HttpError(400, 'Invalid path');
    }
    return decoded;
}

async function realPathOrCreate(path: string): Promise<string>
{
    await ensureDir(path);
    return await Deno.realPath(path);
}

function assertInside(root: string, file: string): void
{
    const rel = relative(resolve(root), resolve(file));
    if (rel && (rel.startsWith('..') || isAbsolute(rel))) {
        throw new HttpError(403, 'Forbidden');
    }
}

function contentType(path: string): string
{
    switch (extname(path).toLowerCase()) {
        case '.html':
            return 'text/html; charset=utf-8';
        case '.css':
            return 'text/css; charset=utf-8';
        case '.js':
            return 'text/javascript; charset=utf-8';
        case '.json':
            return 'application/json; charset=utf-8';
        case '.svg':
            return 'image/svg+xml';
        case '.png':
            return 'image/png';
        case '.jpg':
        case '.jpeg':
            return 'image/jpeg';
        case '.gif':
            return 'image/gif';
        case '.webp':
            return 'image/webp';
        case '.ico':
            return 'image/x-icon';
        case '.woff':
            return 'font/woff';
        case '.woff2':
            return 'font/woff2';
        default:
            return 'application/octet-stream';
    }
}

function sanitizeFilename(value: string): string
{
    let out = '';
    for (const ch of value) {
        out += ch.charCodeAt(0) < 32 || '<>:"/\\|?*'.includes(ch) ? '_' : ch;
    }
    return out.replace(/^\.+$/, '_').slice(0, 255);
}

async function cache<T>({ get, set, refresh }: { get(): Promise<T>; set(value: T): Promise<unknown>; refresh(): Promise<T> }): Promise<T>
{
    try {
        return await get();
    }
    catch {
        // Cache miss; refresh below.
    }

    const value = await refresh();
    await set(value);
    return value;
}

class HttpError extends Error {
    constructor(
        public status: number,
        message: string,
    ) {
        super(message);
    }
}

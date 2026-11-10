# NavPlace — Project Facts

Slogan: "Navigation at your fingertips"
License: MIT.
Repo: https://github.com/vbarbarosh/navplace
Author: Vladimir Barbarosh <hello@navplace.com>
`src/desktop-electron/package.json` description: "The fastest way to open your links".

## What it is

NavPlace renders a plain-text list of links via three surfaces, all driven by the same source document and the same parser:

| Surface | Entry point | Source of links |
|---|---|---|
| Desktop app (Electron) | `src/desktop-electron/main.js` | `~/.navplace/README.md` |
| Playground | `src/www/playground.html` on navplace.com | Its own text, kept in the browser's localStorage, sent to the design by `postMessage` |
| Embed widget | `<script src=".../lib/embed.js" data-links="…">` | Inline `data-links` attribute on the host page |

The shared parser is `lib/parse.js`. The shared filter compiler is `lib/filter1_from_spec.js`. The shared search over the links is `lib/items_search.js`. The shared runtime that wires input → filter → navigation is `lib/navplace.js`.

## Source format (DSL)

Plain text. Parsed by `lib/parse.js`. The grammar uses three prefix characters that should never be conflated:

- **`%` is document-level meta** — `% key: value` directives that apply to the whole file.
- **`#` is per-section or per-item** — never document-level. Three distinct uses depending on position.
- **`@` is per-item images** — inline on a link line, references a local image file or a picture named by `% picture`.

Grammar:

- `label  url` — link line. `label` optional; if absent, the name is the url as written, in its own letters, not punycode: without the scheme, a user and password, the query and the fragment, and without a path that is only `/` (`https://пример.рф/путь?x=1` → `пример.рф/путь`). A run of `%XX` escapes is shown decoded when it is valid UTF-8 with no control character, and left as written otherwise. `icon_url` keeps the parsed host. `url` matches `^(https?|file)://\S+$` and must be the last token on the line.
- **`% key: value`** — **document-level directive**; starts a line with `%`. Known keys: `design`, `title`, `email`, `ns`, `include`, `picture <name>`. Unknown keys are stored in the document-level `meta` object verbatim. Read by the design via the `navplace({ meta: { … } })` DOM-mapping parameter, on the web and in the desktop app alike; a key the file does not have leaves the design's own text and link.
- **`% ns: a | b`** — restricts output to items whose namespaces include `a` or `b`.
- **`% picture name: url`** — names a picture for `@name`; `url` is an `http://`, `https://` or `data:image/` url. Repeatable; goes into `meta.picture` as `{name: url}`. A line with no name (`% picture: url`) or with another kind of value is skipped with a warning, so `meta.picture` is never anything but that map. In the desktop app a web url is fetched by the app itself, once, and kept: the design gets `app://picture/<key>` in `image_url` and shows the kept copy. Asked over https on a public host only; kept when it is a picture of 5 MB at most (PNG, JPEG, GIF, WebP, AVIF, ICO, or an SVG with no script).
- **`% include: url`** — desktop app only; pulls the document at `url` and appends its links. The pulled document's own `%` lines are dropped, so only the user's own file sets `title`, `subtitle` and `email`; its `% picture` lines stay and name the pictures of its own `@name` links only, and an `@name` it names no picture for is no picture (`image_url: null`), never a file of the user's `~/.navplace/`. Repeatable; goes into `meta.include` as a list.
- **`# Section`** — **section heading**; starts a line with `#`. Multiple section labels can be joined with `|`: `# Work | Side projects`. A heading block (consecutive `#` lines) attaches its namespaces to every link line that follows it, until the next heading block; a blank line does not end it. Goes into each item's `namespaces` array.
- **`#tag`** — inline on a link line; **per-item tag** (no value). Goes into the item's `tags` array. It starts a word: a `#` inside a word (`F#minor`) is label text.
- **`#tag=value`** — inline on a link line; **per-item tag with a value**. Goes into the item's `meta` object (`{tag: 'value'}`). Despite the field name, this is a tag with a value, not document-level meta. The value runs to the next space: it may hold `#` (`#color=#fff`) and may be empty (`#k=` gives `{k: ''}`).
- **`@path`** — inline on a link line, **immediately before the URL**; **per-item image**. The parser turns it into `private://<path>`, which Electron serves from `~/.navplace/<path>`. The path may contain `/` (e.g. `@img/gmail.png` → `private://img/gmail.png`). Goes into the item's `image_url` field. When the file has `% picture <path>: <url>`, `image_url` is that url instead. Outside Electron the `private://` protocol won't resolve, so designs should fall back to `icon_url` when the picture fails to load.

**Two `meta` objects exist** in the parser output and must not be confused:

- `parse(source).meta` — the **document-level** object, populated by `% key: value` lines.
- `parse(source).items[i].meta` — the **per-item** object, populated by `#tag=value` inline syntax on that link's line.

A line that does not parse is skipped and listed in `parse(source).warnings` as `{line, text, message}`; the field is there only when there are any.

See `lib/parse.test.js` (`'meta, tags, and images'`) for a single worked example that exercises `%` directives, `#tag`, `#tag=value`, and `@path` together.

Parser output shape per item:

```
{ label, href, icon_url, image_url, tags, meta, search1, search2, namespaces }
```

- `search1` = transliterated `label + tags` (lowercased, Cyrillic→Latin).
- `search2` = transliterated `href`.
- `icon_url` = `app://favicon/<host>?letter=<L>` inside Electron, `/icon/<host>` on navplace.com (its Worker, `src/cloudflare/serve_icon.mjs`), `https://icon.horse/icon/<host>` elsewhere. A host that is not public (`lib/is_public_domain.js`, with a copy inside `lib/parse.js`: an IP address in any spelling, a port, one label, an ending such as `.local`, `.internal`, `.lan`) is never named to an outside service: elsewhere it gets an inline `data:image/svg+xml` letter tile, navplace.com's Worker answers a tile without a lookup, and `lib/icon_find.js` (the desktop app) asks only that host itself, over https: its page's icon links, `/apple-touch-icon.png`, `/favicon.ico`; no library, no Google, no redirect or icon link to another host.

## Filter language

Implemented in `lib/items_search.js`, which compiles each part with `lib/filter1_from_spec.js`, and applied by `lib/navplace.js` on every `input` event.

### Basic usage (the everyday path)

Type one or more characters; the input is lowercased and transliterated as the labels are, then matched as a substring against each item's label, each of its tags and its href (`search2`). The top match opens on Enter. This is the path almost every interaction takes — copy and UI should treat it as the default.

### Multi-open (slightly advanced, signature feature)

Input is split on `\s+`. Each whitespace-separated expression is compiled independently and selects **one** link (the first match). Hitting Enter calls `navplace.navigate` once, and it opens **every** selected link, the current one in place of the last expression's — N expressions → N links open; an address picked twice opens once. Typical use: `gh mail cal` opens three sites at once.

### Power-user operators (advanced; rarely needed)

Within a single expression, a few operators are available. Most users will not type these; document them only when explaining advanced search.

- Parts are separated by `/`. All parts must match (AND). Each part is tried on the label, on each tag and on the href, and the parts of one expression may be found in different ones.
- `^foo` — part must appear at the start of the label, of a tag or of the href.
- `foo$` — part must appear at the end of one of them.
- `!foo` — part must NOT appear in any of them (each `!` toggles negation; odd count = negated).
- Modifiers combine: `^git/!hub$/api` = starts with `git`, does not end with `hub`, contains `api`.

Match order: items whose parts all hold on the label and tags first, then the items that need the href, each group in the file's order.

Navigation behavior in `lib/navplace.js`:

- Inside Electron (`window.ElectronApp` defined): `window.open(href, '_blank', 'noopener,noreferrer')`. The Electron `setWindowOpenHandler` then routes the URL to `electron.shell.openExternal` — the link opens in the OS default browser. Only `http:` and `https:` addresses and a plain `mailto:` address (one address, nothing after it: no `?`, `&` or `%`, no second address), which opens in the mail program, are handed over; any other kind is skipped and logged. The window never leaves its page: a navigation (`will-navigate`) is cancelled and opened the same way.
- A `file:` link inside Electron takes another way: `navplace.navigate` calls `window.ElectronApp.api_file_open(href)`, and the app opens it only when the user's own `~/.navplace/README.md` lists that address; a `file:` link that came from an included file is never opened. A folder or a plain file opens in the system's program for it; a program (an executable file, a `.desktop`, `.sh`, `.AppImage` and the like) is shown in its folder instead of being run. On the web a `file:` link stays the browser's, which refuses it from a web page.
- Outside Electron: `window.open(href, '_top', 'noopener,noreferrer')` for the current link; with several expressions the other links open first, each with `'_blank'`.
- A click with Ctrl, Cmd, Shift or the middle button on an `<a href>` is left to the browser.

## Desktop app

Role: host any NavPlace design full-window. The only UI of its own is the settings window (below); `src/desktop-electron/main.js` reads `~/.navplace/README.md` (writing a starter file when it is missing), parses it, picks the design from `% design:` (falling back to `github`), and calls `win.loadURL('navplace://app/designs/<name>/index.html')`. `% design:` is read again at every summon, and the window loads the design only when it is another one. A start that fails says why in an error box and exits with code 1.

Window config (`src/desktop-electron/main.js`):
- `width: 1200, height: 1000, center: true`
- `alwaysOnTop: settings.on_top` (default `true`), `autoHideMenuBar: true`
- `webPreferences.contextIsolation: true, nodeIntegration: false, preload: src/desktop-electron/renderer.js`
- `backgroundColor: '#bec2bd'`, `webPreferences.zoomFactor: settings.zoom` (default `1.25`)

Settings window (`src/desktop-electron/settings/index.html`, opened by the gear `lib/theme_switch.js` puts beside the theme switch, in the app only): a Links tab with `~/.navplace/README.md` in an editor that saves itself, and a Settings tab with the design (writes `% design:`), the hotkey, start at login, zoom (100% to 200%), on top of other windows, hides when it loses focus, and a check for updates against the GitHub releases. Zoom, on top, hide on blur and the hotkey are kept in `${XDG_CONFIG_HOME:-~/.config}/navplace/settings.json`, each checked by `helpers/settings_from_raw.js`.

IPC channels (`electron.ipcMain.handle`):
- `api_ping` → returns `pong <formatted date>`.
- `api_items_all` → returns the collection the app holds: `~/.navplace/README.md` parsed, with the links of its `% include:` urls once they are pulled.
- `api_file_open` → opens a `file:` link when the user's own links file lists it (see Navigation behavior above).
- `settings_open` → opens the settings window. The other `settings_…` channels answer the settings window only.

Each reloaded collection is sent to the window on `api_items_changed`.

Custom protocols registered in `src/desktop-electron/main.js`:
- `private://<path>` → serves a file under `~/.navplace/`, sandboxed via `fs.realpath` prefix check. Used for `@image-name` references. Content-Type is `image/svg+xml` for `.svg`, otherwise `image/png`. Cache-Control: `max-age=86400`.
- `app://favicon/<domain>?letter=<L>` → the icon from `lib/icon_find.js` (the same finder as navplace.com's `/icon/`: navplace's own in `lib/icons/` by `lib/icon_library_file.js`, then the page's icon links, `/apple-touch-icon.png`, `/favicon.ico`, then Google's), cached on disk at `app.getPath('userData')/favicons-v3/<sanitized-domain>.json`; when the site has none, an SVG tile of the letter (the miss kept a day in `<…>.json.missing`, only when online).
- `navplace://app/designs/…`, `navplace://app/lib/…`, `navplace://app/settings/…` → the app's own `designs/`, `lib/` and settings page, each path kept inside its folder. A design's `/lib/…` is the app's `lib/` there.

Network gate (`electron.session.defaultSession.webRequest.onBeforeRequest`): only allows `app://favicon/`, `blob:`, `chrome://`, `chrome-devtools://`, `data:`, `devtools://`, `file://`, `navplace://app/`, `private://`. All other requests (including normal HTTPS) are cancelled — the desktop window cannot make outbound web requests. A page is refused every permission it asks for except writing to the clipboard (`clipboard-sanitized-write`).

Recommended designs for the desktop app: list- or table-style designs (search input on top, dense rows below). Showcase- or grid-style designs render but are tuned for presentation pages, not navigation.

### Instant-launch mechanism

Goal: every summon after the first is a socket ping, not a process start.

1. The AppImage's `--configure-gnome` flag (`src/desktop-electron/helpers/gnome_configure.js`, run once on Linux/GNOME) copies the launcher to `${XDG_CONFIG_HOME:-~/.config}/navplace/launcher.js`, writes a `dconf` custom keybinding mapping **Ctrl+Shift+Alt+N** to node's absolute path plus that launcher, installs `~/.local/share/applications/navplace.desktop` (Exec=the AppImage's path in quotes, StartupWMClass=`NavPlace`), and writes `~/.config/autostart/navplace.desktop`, which starts the AppImage at login with `--background`: its window stays hidden until the hotkey. When a newer AppImage starts, both entries are pointed at it (`helpers/appimage_entries_repoint.js`).
2. `src/desktop-electron/launcher.js` is a tiny Node script (no Electron boot). It connects to a Unix socket at `${XDG_CONFIG_HOME:-~/.config}/navplace/navplace.sock` with a 150ms timeout.
3. If the connection succeeds, the running Electron process (which is listening via `src/desktop-electron/helpers/make_socket_server.js`) starts a reload of the links, shows the window, focuses it, clears the input, and dispatches a synthetic `input` event.
4. If the connection fails, the launcher invokes `gtk-launch navplace` to start Electron, says so in a desktop notification, then exits.
5. Single-instance is enforced via `electron.app.requestSingleInstanceLock()`. A second start fires the `second-instance` handler, which shows the window the same way the socket path does.
6. `win.on('blur', …)` hides the window when `settings.hide_on_blur` is on (the default), and the process stays resident between summons. Closing the links window quits the app.

Other desktop environments are not wired by `--configure-gnome`; the socket mechanism is portable, the dconf glue is not.

## The site

navplace.com is a Cloudflare Worker (`src/cloudflare/worker.js`) serving `build/www/`, which `bin/build` puts together: the pages in `src/www/`, `lib/` and `designs/`. The Worker also answers `/icon/<host>`; anything else is a 404. There is no server, no database and no account: to keep links in one place, a collection in the desktop app pulls them from any url with `% include: <url>`.

## Embed widget

File: `lib/embed.js`. Behavior:

1. Reads the host `<script>` element's `data-links` attribute.
2. Parses `% design:` lines from `data-links` to decide which design to load (override: `data-design` attribute on the script; default `basic`).
3. Creates an `<iframe>` pointing at `<script-src>/../designs/<name>/index.html` (override: `data-src`), with `width:100%; height:100%; border:0`.
4. Listens for `postMessage({type:'navplace:ready'})` from the iframe and replies with `postMessage({type:'navplace:items-text', text: <data-links>})`, sent to the iframe's own origin only.
5. Forwards a character typed while nothing on the host page has the focus to the iframe as `postMessage({type:'navplace:focus', key})`: the design focuses its search input and types the character. Space and keys with Ctrl, Alt or Cmd stay with the host page.

Designs respond to the same two message types via `lib/navplace.js`, and only when they come from the page around the iframe.

## Designs

Each design is a folder under `designs/<name>/` with its own `index.html`, loading the shared runtime from `/lib/`. The parser produces items; the design HTML controls layout, typography, and behavior. Switch designs with one line: `% design: <name>`.

Inventory (as of this writing):

- **Canonical / battle-tested** — `showcase` (presentation) and `github` (launcher). These are the production-quality references; use them as the template for new designs and lead with them when recommending designs to users.
- Launcher-style (search input + list/grid): `github` ★, `palette`, `basic`, `first`, `google-chrome`, `basic-for-internal2`, `basic-for-internal3-with-groups`.
- Presentation-style (themed, content-first): `showcase` ★, `cards`, `basic-for-portfolio`, `basic-for-kids`, `basic-for-kids2`, `basic-for-recipes`.

`showcase` is used by https://vbarbarosh.com (a single embed tag, no build step). `github` is the default fallback in `src/desktop-electron/main.js` when `% design:` is missing or unknown.

## Repository layout

```
lib/                   shared frontend code (parser, filter, runtime, embed)
  parse.js             DSL parser
  parse.test.js        mocha tests for the parser
  filter1_from_spec.js filter compiler (^ $ ! /)
  items_search.js      what the typed text finds among the links
  navplace.js          input → filter → navigate runtime
  theme_switch.js      the light/dark switch every design loads
  embed.js             third-party embed script
src/desktop-electron/  desktop app
  main.js              window, IPC, protocols, socket server
  launcher.js          tiny hotkey-side socket pinger
  renderer.js          contextBridge preload
  settings/            the settings window's page
  helpers/make_socket_server.js
src/cloudflare/        the Worker on navplace.com: build/www and /icon/
designs/               one folder per design, each with index.html
src/www/               the site: index, docs, playground
demos/                 standalone HTML demos of four designs
bin/                   shell scripts (configure, build, self-check, deploy-www, test)
docs/                  the product brief, the design guide, the desktop app
notes/                 working notes: design prompts, similar projects, findings
img/                   the cover and the GNOME install's icon
package.json           name: "navplace"; the desktop app has its own in src/desktop-electron/
```

## Commands

From the root `package.json`:

- `npm test` — runs `mocha 'lib/**/*.test.js' 'src/cloudflare/**/*.test.mjs'`.

From `src/desktop-electron/package.json`, run inside `src/desktop-electron`:

- `npm start` — launches Electron (`electron .`).
- `npm test` — runs `node --test 'helpers/**/*.test.js'`.
- `npm run build` — `electron-builder` (AppImage on Linux, appId `com.navplace`, productName `NavPlace`).

Setup: `./NavPlace-*.AppImage --configure-gnome` — registers the GNOME hotkey, installs `navplace.desktop` and the login entry. Run once. For an AppImage built from source, `src/desktop-electron/bin/configure-gnome` registers the hotkey and installs `navplace.desktop`.

## Data and persistence

- Desktop source: single file at `~/.navplace/README.md`. Plain text. User-owned.
- Desktop image assets: any file under `~/.navplace/` (referenced via `@name` and served through the `private://` protocol).
- Desktop favicon cache: `app.getPath('userData')/favicons-v3/<sanitized-domain>.json`.
- Desktop settings: `${XDG_CONFIG_HOME:-~/.config}/navplace/settings.json`.
- Desktop includes: the last good text of every `% include:` url, in `app.getPath('userData')/includes/`; it stands in when a pull fails.
- Desktop pictures: every picture a `% picture` line names by a web url, fetched once, in `app.getPath('userData')/pictures/`, a file named by the hash of its url. Never fetched again while the copy is there.
- Playground: its text in the browser's localStorage.
- Embed widget: no persistence; links are inline in the host page's HTML.

There is no server: the surfaces share the parser and the format, not storage. `% include: <url>` pulls links into the desktop app's collection from any url.

## Notable dependencies

- `electron` — desktop shell.
- `@vbarbarosh/node-helpers`, `@vbarbarosh/type-helpers` — author's utility packages.
- `mocha` — the tests of `lib/` and the Worker; the desktop app's helpers are tested with `node --test`.

## Copy library

Reusable strings for designs UI, landing pages, and profile pages. Each entry is self-contained — pick whichever length fits the slot. Use these verbatim when generating UI copy; do not invent new claims (e.g. about pricing, sync, or platform support) that aren't backed by facts elsewhere in this file.

### Slogans

- Primary: **Navigation at your fingertips**
- Alt (the desktop app's package.json description): **The fastest way to open your links.**
- Imperative: **Pick a design, paste your links, you're done.**

### One-line descriptions

- Marketing: NavPlace turns a plain-text list of links into a launcher you can summon, a page you can share, and a widget you can embed.
- Functional: Organize, navigate, and present your links from a single text-based source.
- Speed-focused: Open the right page in a couple of keystrokes, dozens of times a day.
- Developer: One plain-text file. Three surfaces: desktop launcher, Playground, embed widget.
- Reductive: One file. Many faces.
- Positioning: The smallest possible tool, done right.

### Paragraph pitches

- Long (≈60 words, landing hero):
  > You spend the day jumping between the same few dozen places — docs, dashboards, repos, side projects. NavPlace makes that jump take a couple of keystrokes. Write your links once in plain text and render them three ways: a desktop launcher you summon with a hotkey, a page you can share, and a widget you can embed in any web page.

- Medium (≈35 words, secondary hero):
  > Write your links once in plain text. NavPlace renders them as a desktop launcher you summon with a hotkey, a page you can share, and a widget you can embed anywhere.

- Short (≈15 words, social meta):
  > Plain-text links, three surfaces: hotkey launcher, Playground, embeddable widget.

- Lede (under-hero subhead):
  > Pick a design — your links become a homepage, a recipe card, a dev portfolio, a kids' launcher. Same source. Different presentation.

- Positioning (why-it-exists):
  > Built for the way you actually think about your work — by topic, by project, by mood. Not by date, not by URL bar.

### Feature blurbs (one-liners)

- **Desktop launcher** — A global hotkey opens NavPlace full-window. Type a few letters, hit Enter — the link opens in your default browser.
- **Find anything fast** — Type any part of a link's name or URL. The top match opens on Enter. That's the whole search.
- **Multi-open (advanced)** — Add a space and another query to open multiple links at once. `gh mail cal` opens three sites in one keystroke.
- **Embed widget** — One `<script>` tag turns any HTML page into a NavPlace surface. No build, no framework.
- **Designs** — Swap visual presentation with one line: `% design: showcase`. Same links, different look.
- **Plain-text source** — Your collection is a plain-text file. No JSON, no UI, no lock-in.

### Section headings (landing-style)

- "One source, three surfaces."
- "Same source. Different presentation."
- "One file. Many faces."
- "The smallest possible tool, done right."
- "Three steps. No friction."
- "Keystrokes, not clicks."
- "Designed for keyboards."
- "Bring your own design."
- "Embed it anywhere."
- "Plain text. Your file. Your rules."
- "Open source."

### Eyebrow labels (small caps over a heading)

- "Why NavPlace"
- "The designs"
- "How it works"
- "NavPlace for desktop"
- "FAQ"

### Hero meta chips (three-up under a hero)

- "Plain-text source"
- "One-line embed"
- "Open source"
- "Three surfaces, one source"
- "Swap designs in one line"

### Closing line (final CTA section)

- "A quiet home for the parts of the web that matter to you."

### Design pair labels (name + one-line descriptor)

For design pickers, tab strips, and gallery tiles.

| Design | Tab label | One-liner |
|---|---|---|
| `showcase` | Showcase | Personal portfolio |
| `basic-for-recipes` | Recipes | Warm card grid |
| `github` | Dev tools | Search + dense table |
| `basic-for-kids2` | For kids | Bright tile launcher |
| `google-chrome` | Start page | New-tab-style search |
| `basic` | Basic | Minimal search + tiles |

### Call-to-action button labels

- Primary: "Try the widget"
- Secondary: "Install the desktop app"
- Tertiary: "View on GitHub"
- Demo: "See examples"
- Authoring: "Open the editor"

### Empty states

- No links yet: *Add your first link. Format: `Label  https://example.com`*
- No matches: *No matches. Try a shorter query, or combine with `/`.*
- No design selected: *Pick a design to preview your collection.*

### Microcopy

- Search placeholder: `Search… (Enter to open first match)`
- Multi-link tip: *Tip: separate by space to open multiple links at once.*
- Advanced search tip (only when surfacing power features): *For tighter filters, use `/` (AND), `^` (prefix), `$` (suffix), `!` (negation).*
- Design picker label: `Design`
- Source field label: `Links (one per line)`
- Saved indicator: `saved`
- Hotkey hint (Linux/GNOME): `Press Ctrl+Shift+Alt+N anywhere to summon.`

### FAQ (for landing / docs / chatbot answers)

Each Q/A is self-contained. Do not edit answers to imply features that don't exist (no sync, no accounts, no pricing model, hotkey is GNOME-only).

**Q: What is NavPlace?**
A tool that turns a plain-text list of links into a fast launcher, a web page, and an embeddable widget — all from one shared source. The DSL is intentionally minimal: `label  url` lines, `# Section` headings, and `% key: value` directives. Inline `#tag`, `#key=value`, and `@image` give per-item metadata when needed.

**Q: How do designs work?**
A design is an HTML folder under `designs/<name>/` that consumes the parsed items and decides how to draw them. Switch designs by changing one line — `% design: <name>` — at the top of your source. Launcher-style designs (`basic`, `github`, `google-chrome`) put a search input on top of a dense list; presentation-style designs (`showcase`, `basic-for-portfolio`, `basic-for-kids2`, `basic-for-recipes`) treat the same links as a themed page.

**Q: Can I embed NavPlace on my own site?**
Yes. One `<script src="…/embed.js" data-links="…">` tag in any HTML page. The script creates an iframe pointing at the chosen design and pipes the `data-links` text into it via `postMessage`. The iframe sizes itself to its container.

**Q: Where is my data stored?**
It depends on the surface. The desktop app reads a single file from disk: `~/.navplace/README.md`. The embed widget keeps links inline in the host page's HTML. The Playground keeps its text in your browser. There is no server; `% include: <url>` pulls links into the desktop app from any url.

**Q: Is there a global hotkey for the desktop app?**
On GNOME/Linux, **Ctrl+Shift+Alt+N** is wired up by running the AppImage once with `--configure-gnome`; the settings window changes the keys. The hotkey runs a copy of `src/desktop-electron/launcher.js`, a tiny Node script that pings a Unix socket — summoning the app after first launch is essentially instant. Other desktop environments aren't wired up yet.

**Q: How do I open multiple links at once?**
Separate what you type with spaces. `gh mail cal` opens three links — the top match for each. (Inside a single expression, `/`, `^`, `$`, and `!` are also available for tighter filtering; treat these as advanced and don't lead with them in introductory copy.)

**Q: Is it open source?**
Yes — MIT licensed, on GitHub.

### Voice & tone (when generating new copy)

- **Direct and declarative.** "NavPlace opens X." not "We help you open X."
- **Concrete actions over abstractions.** "Type, hit Enter, open" beats "streamlines navigation".
- **Plain-text framing is a core value.** Copy that emphasizes *no build, no JSON, no UI, one line* lands in voice.
- **Speed is the headline benefit.** "A couple of keystrokes" beats "fast".
- **No superlatives.** Avoid *amazing*, *powerful*, *seamless*, *revolutionary*. Show, don't claim.
- **Avoid second-person hype.** "You'll love it" → drop. Stick with what the tool does.
- **Honor the facts in this file.** Do not invent platform support, pricing, sync, or accounts that aren't documented above.

### Reserved terminology

Use these terms consistently across UI; do not substitute synonyms.

- **NavPlace** — product name. Not *NavPlase*, *Navplace*, or *Nav Place*.
- **Collection** — a single NavPlace document (the plain-text source).
- **Design** — a swappable visual renderer of a collection. Not *theme*, *skin*, or *template*.
- **Surface** — one of the three places a collection renders: desktop app, the Playground on navplace.com, embed widget.
- **Embed widget** — the `<script>`-tag widget. Not *plugin* or *snippet*.
- **Section** — a `# Heading` group inside a collection. Not *category* or *folder*.
- **Directive** — a `% key: value` line. Not *front matter* or *config line*.

### Inaccurate claims to avoid

The following claims have appeared in AI-generated drafts of NavPlace pages and copy. They are not true. Do not use them, even when paraphrased.

- **"⌥Space" / "Option+Space" / "menubar app"** — wrong hotkey, wrong platform framing. Actual hotkey is **Ctrl+Shift+Alt+N** by default (the settings window changes it), on GNOME/Linux only. The desktop app is an Electron window, not a macOS menubar app. No system tray either.
- **"Download for macOS / Windows"** — only Linux AppImage is configured in `electron-builder`. Don't advertise platforms that aren't built.
- **"Comments live behind %"** — wrong. `%` introduces directives (`% key: value`), not comments. The parser has no comment syntax.
- **"Encrypted copy synced to NavPlace's servers"** — no sync of any kind exists in the code, and there is no server to sync to. Don't claim it.
- **"Searches every link across every collection"** — the desktop app reads one source file (`~/.navplace/README.md`); there are no multiple collections in the desktop launcher.
- **"any of your collections" / "every collection"** — same problem. The desktop launcher is single-collection.
- **"Free while in public beta"**, **"personal tier"**, **"team plan"**, **"shared collections"** — no pricing, accounts, tiers, or beta status exists in the codebase. Drop the pricing section unless given real facts.
- **"Built quietly in San Francisco"** — invented location. No HQ claim should appear unless provided.
- **"The widget updates when you edit it"** — the embed widget reads inline `data-links` on the host page; there is no remote-edit-pushes-to-widget feature.
- **"Team dashboard"** — there are no accounts or team features. Use *shared page* instead.
- **"Sign in to sync"** — there is no login, no account and no server in this repo. Don't promise sign-in flows that aren't built.

When in doubt, prefer the smaller, true claim over the larger, evocative one. "Plain-text file, three renderers" is fine; "your second brain, synced everywhere" is not.


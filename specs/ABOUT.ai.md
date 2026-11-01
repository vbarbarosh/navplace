# NavPlace — Project Facts

Slogan: "Navigation at your fingertips"
License: MIT.
Repo: https://github.com/vbarbarosh/navplace
Author: Vladimir Barbarosh <hello@navplace.com>
`package.json` description: "The fastest way to open your links".

## What it is

NavPlace renders a plain-text list of links via three surfaces, all driven by the same source document and the same parser:

| Surface | Entry point | Source of links |
|---|---|---|
| Desktop app (Electron) | `desktop-electron/main.js` | `~/.navplace/README.md` |
| Playground | `www/playground.html` on navplace.com | Its own text, kept in the browser's localStorage, sent to the design by `postMessage` |
| Embed widget | `<script src=".../lib/embed.js" data-links="…">` | Inline `data-links` attribute on the host page |

The shared parser is `lib/parse.js`. The shared filter compiler is `lib/filter1_from_spec.js`. The shared runtime that wires input → filter → navigation is `lib/navplace.js`.

## Source format (DSL)

Plain text. Parsed by `lib/parse.js`. The grammar uses three prefix characters that should never be conflated:

- **`%` is document-level meta** — `% key: value` directives that apply to the whole file.
- **`#` is per-section or per-item** — never document-level. Three distinct uses depending on position.
- **`@` is per-item images** — inline on a link line, references a local image file.

Grammar:

- `label  url` — link line. `label` optional; if absent, the parser uses the URL host (plus pathname when non-`/`). `url` matches `^(https?|file)://\S+$` and must be the last token on the line.
- **`% key: value`** — **document-level directive**; starts a line with `%`. Known keys: `design`, `title`, `email`, `ns`. Unknown keys are stored in the document-level `meta` object verbatim. Read by the design via the `navplace({ meta: { … } })` DOM-mapping parameter.
- **`% ns: a | b`** — restricts output to items whose namespaces include `a` or `b`.
- **`# Section`** — **section heading**; starts a line with `#`. Multiple section labels can be joined with `|`: `# Work | Side projects`. A heading block (consecutive `#` lines) attaches its namespaces to every link line that follows it, until the next blank line. Goes into each item's `namespaces` array.
- **`#tag`** — inline on a link line; **per-item tag** (no value). Goes into the item's `tags` array.
- **`#tag=value`** — inline on a link line; **per-item tag with a value**. Goes into the item's `meta` object (`{tag: 'value'}`). Despite the field name, this is a tag with a value, not document-level meta.
- **`@path`** — inline on a link line, **immediately before the URL**; **per-item image**. The parser turns it into `private://<path>`, which Electron serves from `~/.navplace/<path>`. The path may contain `/` (e.g. `@img/gmail.png` → `private://img/gmail.png`). Goes into the item's `image_url` field. Outside Electron the `private://` protocol won't resolve, so designs should fall back to `icon_url`.

**Two `meta` objects exist** in the parser output and must not be confused:

- `parse(source).meta` — the **document-level** object, populated by `% key: value` lines.
- `parse(source).items[i].meta` — the **per-item** object, populated by `#tag=value` inline syntax on that link's line.

See `lib/parse.test.js` (`'meta, tags, and images'`) for a single worked example that exercises `%` directives, `#tag`, `#tag=value`, and `@path` together.

Parser output shape per item:

```
{ label, href, icon_url, image_url, tags, meta, search1, search2, namespaces }
```

- `search1` = transliterated `label + tags` (lowercased, Cyrillic→Latin).
- `search2` = transliterated `href`.
- `icon_url` = `app://favicon/<host>` inside Electron, `/icon/<host>` on navplace.com (its Worker, `src/cloudflare/icon.mjs`), `https://icon.horse/icon/<host>` elsewhere.

## Filter language

Implemented in `lib/filter1_from_spec.js` and applied by `lib/navplace.js` on every `input` event.

### Basic usage (the everyday path)

Type one or more characters; the input is matched as a case-insensitive substring against each item's `search1` (label + tags, transliterated) and `search2` (href, transliterated). The top match opens on Enter. This is the path almost every interaction takes — copy and UI should treat it as the default.

### Multi-open (slightly advanced, signature feature)

Input is split on `\s+`. Each whitespace-separated expression is compiled independently and selects **one** link (the first match). Hitting Enter calls `navplace.navigate` for **every** selected link — N expressions → N links open. Typical use: `gh mail cal` opens three sites at once.

### Power-user operators (advanced; rarely needed)

Within a single expression, a few operators are available. Most users will not type these; document them only when explaining advanced search.

- Parts are separated by `/`. All parts must match (AND).
- `^foo` — part must appear at the start of `search1`/`search2`.
- `foo$` — part must appear at the end.
- `!foo` — part must NOT appear (each `!` toggles negation; odd count = negated).
- Modifiers combine: `^git/!hub$/api` = starts with `git`, does not end with `hub`, contains `api`.

Match order: items matching `search1` first, then items matching `search2` not already included.

Navigation behavior in `lib/navplace.js`:

- Inside Electron (`window.ElectronApp` defined): `window.open(href, '_blank', 'noopener,noreferrer')`. The Electron `setWindowOpenHandler` then routes the URL to `electron.shell.openExternal` — the link opens in the OS default browser.
- Outside Electron: `window.open(href, '_top', 'noopener,noreferrer')`.

## Desktop app

Role: host any NavPlace design full-window. The desktop app has no UI of its own; `desktop-electron/main.js` reads `~/.navplace/README.md`, parses it, picks the design from `% design:` (falling back to `github`), and calls `win.loadFile('designs/<name>/index.html')`.

Window config (`desktop-electron/main.js`):
- `width: 1200, height: 1000, center: true`
- `alwaysOnTop: true, autoHideMenuBar: true`
- `webPreferences.contextIsolation: true, nodeIntegration: false, preload: desktop-electron/renderer.js`
- `backgroundColor: '#bec2bd', webPreferences.zoomFactor: 1.25`

IPC channels (`electron.ipcMain.handle`):
- `api_ping` → returns `pong <formatted date>`.
- `api_items_all` → returns `parse(fs.readFile('~/.navplace/README.md'))`.

Custom protocols registered in `desktop-electron/main.js`:
- `private://<path>` → serves a file under `~/.navplace/`, sandboxed via `fs.realpath` prefix check. Used for `@image-name` references. Content-Type is `image/svg+xml` for `.svg`, otherwise `image/png`. Cache-Control: `max-age=86400`.
- `app://favicon/<domain>` → returns a Google favicon (`https://www.google.com/s2/favicons?domain=<domain>&sz=64`), cached on disk at `app.getPath('userData')/favicons/<sanitized-domain>.png`.

Network gate (`electron.session.defaultSession.webRequest.onBeforeRequest`): only allows `app://favicon/`, `blob:`, `chrome://`, `chrome-devtools://`, `data:`, `devtools://`, `file://`, `private://`. All other requests (including normal HTTPS) are cancelled — the desktop window cannot make outbound web requests.

Recommended designs for the desktop app: list- or table-style designs (search input on top, dense rows below). Showcase- or grid-style designs render but are tuned for presentation pages, not navigation.

### Instant-launch mechanism

Goal: every summon after the first is a socket ping, not a process start.

1. `bin/configure-gnome` (run once on Linux/GNOME) writes a `dconf` custom keybinding mapping **Ctrl+Shift+Alt+N** to `desktop-electron/launcher.js`, and installs `~/.local/share/applications/navplace.desktop` (Exec=`npm start`, StartupWMClass=`@vbarbarosh/navplace`).
2. `desktop-electron/launcher.js` is a tiny Node script (no Electron boot). It connects to a Unix socket at `${XDG_CONFIG_HOME:-~/.config}/navplace/navplace.sock` with a 150ms timeout.
3. If the connection succeeds, the running Electron process (which is listening via `desktop-electron/helpers/wait_for_socket_connections.js`) shows the window, focuses it, clears the input, and dispatches a synthetic `input` event.
4. If the connection fails, the launcher invokes `gtk-launch navplace` to start Electron, then exits.
5. Single-instance is enforced via `electron.app.requestSingleInstanceLock()`. A second `npm start` fires the same `second-instance` handler used by the socket path.
6. `win.on('blur', () => win.hide())` keeps the process resident between summons.

Other desktop environments are not wired by `bin/configure-gnome`; the socket mechanism is portable, the dconf glue is not.

## The site

navplace.com is a Cloudflare Worker (`src/cloudflare/worker.js`) serving `build/www/`, which `bin/build-www` puts together: the pages in `www/`, `lib/` and `designs/`. The Worker also answers `/icon/<host>`; anything else is a 404. There is no server, no database and no account: to keep links in one place, a collection pulls them from any url with `% include: <url>`.

## Embed widget

File: `lib/embed.js`. Behavior:

1. Reads the host `<script>` element's `data-links` attribute.
2. Parses `% design:` lines from `data-links` to decide which design to load (override: `data-design` attribute on the script; default `basic`).
3. Creates an `<iframe>` pointing at `<script-src>/../designs/<name>/index.html`, with `width:100%; height:100%; border:0`.
4. Listens for `postMessage({type:'navplace:ready'})` from the iframe and replies with `postMessage({type:'navplace:items-text', text: <data-links>})`.
5. Forwards every host-page `keydown` to the iframe as `postMessage({type:'navplace:focus'})` so the iframe's search input stays focused.

Designs respond to the same two message types via `lib/navplace.js`.

## Designs

Each design is a self-contained folder under `designs/<name>/` with its own `index.html`. The parser produces items; the design HTML controls layout, typography, and behavior. Switch designs with one line: `% design: <name>`.

Inventory (as of this writing):

- **Canonical / battle-tested** — `showcase` (presentation) and `github` (launcher). These are the production-quality references; use them as the template for new designs and lead with them when recommending designs to users.
- Launcher-style (search input + list/grid): `github` ★, `palette`, `basic`, `google-chrome`, `basic-for-internal2`, `basic-for-internal3-with-groups`.
- Presentation-style (themed, content-first): `showcase` ★, `cards`, `basic-for-portfolio`, `basic-for-kids`, `basic-for-kids2`, `basic-for-recipes`.

`showcase` is used by https://vbarbarosh.com (a single embed tag, no build step). `github` is the default fallback in `desktop-electron/main.js` when `% design:` is missing or unknown.

## Repository layout

```
lib/                   shared frontend code (parser, filter, runtime, embed)
  parse.js             DSL parser
  parse.test.js        mocha tests for the parser
  filter1_from_spec.js filter compiler (^ $ ! /)
  navplace.js          input → filter → navigate runtime
  embed.js             third-party embed script
desktop-electron/              desktop app
  main.js              window, IPC, protocols, socket server
  launcher.js          tiny hotkey-side socket pinger
  renderer.js          contextBridge preload
  helpers/wait_for_socket_connections.js
src/cloudflare/        the Worker on navplace.com: build/www and /icon/
designs/               one folder per design, each with index.html
www/                   the site: index, docs, playground
demos/                 standalone HTML demos of each design
bin/                   shell scripts (configure-gnome, build, watch, migrate, test, run)
ubuntu/                .desktop file and icon for GNOME install
package.json           name: "navplace", main: "desktop-electron/main.js"
```

## Commands

From `package.json`:

- `npm start` — launches Electron (`electron .`).
- `npm test` — runs `mocha 'lib/**/*.test.js'`.
- `npm run dist` — `electron-builder` (AppImage on Linux, appId `com.navplace`, productName `NavPlace`).

Setup script: `bin/configure-gnome` — registers the GNOME hotkey and installs `navplace.desktop`. Run once.

## Data and persistence

- Desktop source: single file at `~/.navplace/README.md`. Plain text. User-owned.
- Desktop image assets: any file under `~/.navplace/` (referenced via `@name` and served through the `private://` protocol).
- Desktop favicon cache: `app.getPath('userData')/favicons/<domain>.png`.
- Playground: its text in the browser's localStorage.
- Embed widget: no persistence; links are inline in the host page's HTML.

There is no server: the surfaces share the parser and the format, not storage. `% include: <url>` pulls links into a collection from any url.

## Notable dependencies

- `electron` — desktop shell.
- `@vbarbarosh/node-helpers`, `@vbarbarosh/type-helpers` — author's utility packages.
- `sanitize-filename` — favicon cache path safety (desktop app).
- `mocha` — the tests.

## Copy library

Reusable strings for designs UI, landing pages, and profile pages. Each entry is self-contained — pick whichever length fits the slot. Use these verbatim when generating UI copy; do not invent new claims (e.g. about pricing, sync, or platform support) that aren't backed by facts elsewhere in this file.

### Slogans

- Primary: **Navigation at your fingertips**
- Alt (package.json description): **The fastest way to open your links.**
- Imperative: **Pick a design, paste your links, you're done.**

### One-line descriptions

- Marketing: NavPlace turns a plain-text list of links into a launcher you can summon, a page you can share, and a widget you can embed.
- Functional: Organize, navigate, and present your links from a single text-based source.
- Speed-focused: Open the right page in a couple of keystrokes, dozens of times a day.
- Developer: One plain-text file. Three surfaces: desktop launcher, hosted page, embed widget.
- Reductive: One file. Many faces.
- Positioning: The smallest possible tool, done right.

### Paragraph pitches

- Long (≈60 words, landing hero):
  > You spend the day jumping between the same few dozen places — docs, dashboards, repos, side projects. NavPlace makes that jump take a couple of keystrokes. Write your links once in plain text and render them three ways: a desktop launcher you summon with a hotkey, a hosted page you can share, and a widget you can embed in any web page.

- Medium (≈35 words, secondary hero):
  > Write your links once in plain text. NavPlace renders them as a desktop launcher you summon with a hotkey, a hosted page you can share, and a widget you can embed anywhere.

- Short (≈15 words, social meta):
  > Plain-text links, three surfaces: hotkey launcher, hosted page, embeddable widget.

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
| `github` | Dev tools | Terminal-ish, dark |
| `basic-for-kids2` | For kids | Bright tile launcher |
| `google-chrome` | Start page | New-tab-style search |
| `basic` | Basic | Minimal search + list |

### Call-to-action button labels

- Primary: "Try the widget"
- Secondary: "Install the desktop app"
- Tertiary: "View on GitHub"
- Demo: "See examples"
- Authoring: "Open the editor"
- Account: "Sign in"

### Empty states

- No links yet: *Add your first link. Format: `Label  https://example.com`*
- No matches: *No matches. Try a shorter query, or combine with `/`.*
- No collections: *Create a collection. Paste links, pick a design, you're done.*
- No design selected: *Pick a design to preview your collection.*

### Microcopy

- Search placeholder: `Search… (Enter to open first match)`
- Multi-link tip: *Tip: separate by space to open multiple links at once.*
- Advanced search tip (only when surfacing power features): *For tighter filters, use `/` (AND), `^` (prefix), `$` (suffix), `!` (negation).*
- Design picker label: `Design`
- Source field label: `Links (one per line)`
- Save button: `Save`
- Saved indicator: `Saved.`
- Hotkey hint (Linux/GNOME): `Press Ctrl+Shift+Alt+N anywhere to summon.`

### FAQ (for landing / docs / chatbot answers)

Each Q/A is self-contained. Do not edit answers to imply features that don't exist (sync is in progress, no pricing model, hotkey is GNOME-only).

**Q: What is NavPlace?**
A tool that turns a plain-text list of links into a fast launcher, a hosted page, and an embeddable widget — all from one shared source. The DSL is intentionally minimal: `label  url` lines, `# Section` headings, and `% key: value` directives. Inline `#tag`, `#key=value`, and `@image` give per-item metadata when needed.

**Q: How do designs work?**
A design is a self-contained HTML folder under `designs/<name>/` that consumes the parsed items and decides how to draw them. Switch designs by changing one line — `% design: <name>` — at the top of your source. Launcher-style designs (`basic`, `github`, `google-chrome`) put a search input on top of a dense list; presentation-style designs (`showcase`, `basic-for-portfolio`, `basic-for-kids2`, `basic-for-recipes`) treat the same links as a themed page.

**Q: Can I embed NavPlace on my own site?**
Yes. One `<script src="…/embed.js" data-links="…">` tag in any HTML page. The script creates an iframe pointing at the chosen design and pipes the `data-links` text into it via `postMessage`. The iframe sizes itself to its container.

**Q: Where is my data stored?**
It depends on the surface. The desktop app reads a single file from disk: `~/.navplace/README.md`. The embed widget keeps links inline in the host page's HTML. The Playground keeps its text in your browser. There is no server; `% include: <url>` pulls links from any url.

**Q: Is there a global hotkey for the desktop app?**
On GNOME/Linux, **Ctrl+Shift+Alt+N** is wired up by running `bin/configure-gnome` once. The hotkey runs `desktop-electron/launcher.js`, a tiny Node script that pings a Unix socket — summoning the app after first launch is essentially instant. Other desktop environments aren't wired up yet.

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

- **"⌥Space" / "Option+Space" / "menubar app"** — wrong hotkey, wrong platform framing. Actual hotkey is **Ctrl+Shift+Alt+N** on GNOME/Linux only. The desktop app is an Electron window, not a macOS menubar app. No system tray either.
- **"Download for macOS / Windows"** — only Linux AppImage is configured in `electron-builder`. Don't advertise platforms that aren't built.
- **"Comments live behind %"** — wrong. `%` introduces directives (`% key: value`), not comments. The parser has no comment syntax.
- **"Encrypted copy synced to NavPlace's servers"** — no encrypted sync exists in the code. Cross-surface sync is in active development; until it ships, don't claim it.
- **"Searches every link across every collection"** — the desktop app reads one source file (`~/.navplace/README.md`); there are no multiple collections in the desktop launcher.
- **"any of your collections" / "every collection"** — same problem. The desktop launcher is single-collection.
- **"Free while in public beta"**, **"personal tier"**, **"team plan"**, **"shared collections"** — no pricing, accounts, tiers, or beta status exists in the codebase. Drop the pricing section unless given real facts.
- **"Built quietly in San Francisco"** — invented location. No HQ claim should appear unless provided.
- **"The widget updates when you edit it"** — the embed widget reads inline `data-links` on the host page; there is no remote-edit-pushes-to-widget feature.
- **"Team dashboard"** — there are no accounts or team features. Use *hosted page* or *shared page* instead.
- **"Sign in to sync"** — there is no first-party login UI in this repo; auth is external (header `x-auth-user`). Don't promise sign-in flows that aren't built.

When in doubt, prefer the smaller, true claim over the larger, evocative one. "Plain-text file, three renderers" is fine; "your second brain, synced everywhere" is not.


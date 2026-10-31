# NavPlace

> Navigation at your fingertips

NavPlace turns a plain-text list of links into a launcher you can summon, a
page you can share, and a widget you can embed — all from the same source.

NavPlace is more of a **starting point** than a **final destination**. Each time
you need to reach some place, you begin with every option on screen and narrow
them down a few letters at a time, then hit Enter once you reach it.

## The idea

Pick a design, paste your links, you're done.

You spend the day jumping between the same few dozen places: docs, dashboards,
repos, side projects. NavPlace makes that jump take a couple of keystrokes.

- **Primary goal:** navigate to the right place in a couple of keystrokes,
  dozens of times a day.
- **Secondary goal:** render the same source as a hosted page or an embedded
  widget, with no extra work.

## One source, three surfaces

Every collection is a small plain-text document. The same file drives all three
surfaces:

- **Electron app** — a global hotkey opens a window that hosts your chosen design full-window. Type a few letters, hit Enter, the link opens in your default browser. Built for speed.
- **Web app** — edit, host, and share collections. Each collection gets a URL you can bookmark or send to someone.
- **Embed widget** — a one-line `<script>` tag (`embed.js`) renders the same collection inside any web page.

## Desktop app

The desktop app is intentionally thin: it loads your chosen design full-window and feeds it your links — there's no UI of its own. The `% design:` line in `~/.navplace/README.md` picks which design to host at startup.

Any NavPlace design works in the desktop app, but it feels best with **list- or table-style designs** — a search box at the top and a dense list/table of links below give the snappiest type-and-go experience. Showcase- or grid-style designs render fine but are oriented toward presentation, not navigation.

### Instant launch

The app is designed to open instantly. It doesn't cold-start on every keypress; it stays resident and just *shows itself* when you ask.

How it works:

1. `bin/configure-gnome` binds **Ctrl+Shift+Alt+N** to `desktop-electron/launcher.js` via `dconf`, and installs `navplace.desktop` for the system.
2. `launcher.js` is a tiny Node script (no Electron boot) that tries to connect to a Unix socket at `~/.config/navplace/navplace.sock`.
3. If the socket is alive, the running Electron instance receives the ping and immediately shows, focuses, and clears its input.
4. If the socket isn't there, `gtk-launch navplace` starts Electron once; every summon after that is just a socket ping, not a process start.
5. When the window loses focus it hides itself (`win.on('blur', …)`) rather than closing — so the next summon is just as fast.

Single-instance is enforced via `electron.app.requestSingleInstanceLock()`; a second `npm start` re-shows the existing window instead of spawning another.

Every summon reloads the links, and the reload never runs in front of the window: it opens on what it already has and redraws when the new links arrive. See [The window never waits](../docs/instant-launch.md).

## The source format

A small plain-text DSL — no JSON, no YAML, no UI required to author one:

```
% design: showcase
% title: Vladimir Barbarosh

# GitHub
node-helpers            https://vbarbarosh.github.io/node-helpers
vue-modal     #frontend  https://vbarbarosh.github.io/vue-modal

# LinkedIn
LinkedIn                https://www.linkedin.com/in/vbarbarosh/
```

Syntax:

- `label  url` — one link per line. Label is optional; if omitted the domain is used.
- `# Section` — group links under a heading. Multiple sections can be combined with `|` (`# Work | Side projects`).
- `% key: value` — directives at the top of the file: `design`, `title`, `email`, `ns`, …
- `#tag` and `#key=value` — inline on a link line, attach tags or per-item metadata.
- `@image-name` — inline reference to a local image (`~/.navplace/<image-name>`), used by designs that show artwork next to links.

The same parser (`lib/parse.js`) is used by Electron, the web app, and the embed widget — behavior stays identical across surfaces. It also transliterates Cyrillic to Latin so typing `git` finds an item labeled `Гитхаб`.

The Electron app reads its source from **`~/.navplace/README.md`**.

## Filtering

Type a few letters, hit Enter — the top match opens. The search is a case-insensitive substring match across each item's label, tags, and URL. That's the whole interaction for almost everything you'll do day to day.

### Open multiple links at once

Separate what you type with spaces. Each space-separated expression picks one link (its top match); Enter opens all of them. `gh mail cal` opens the top match for each of `gh`, `mail`, `cal` — three links from one line of typing. Useful for "open my whole morning" in a single keystroke.

### Advanced operators

For tighter filters inside one expression, the input language supports a few operators: `/` is AND between substrings, `^` anchors to the start, `$` to the end, `!` negates. So `^git/api` matches items that start with `git` *and* contain `api`. Most users never need these — typing a few characters and hitting Enter does the job.

## Designs

A **design** is a swappable visual theme applied to a collection. The same links can be rendered as a kid-friendly grid, a recipe wall, a developer showcase, a Chrome-new-tab clone, or a minimal launcher — by changing a single `% design:` line.

Designs that ship in this repo, grouped by intent:

- **Launchers** — `basic`, `google-chrome`, `basic-for-internal2`, `basic-for-internal3-with-groups`.
- **Showcases / portfolios** — `showcase`, `github`, `basic-for-portfolio`.
- **Themed grids** — `basic-for-kids`, `basic-for-kids2`, `basic-for-recipes`.

Each design is a self-contained folder under `designs/<name>/` with its own `index.html`; the parser hands it a list of items and the design decides how to draw them.

## In the wild

The author's personal site (`vbarbarosh.com`) is, in full, a single HTML page that embeds NavPlace:

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <title>Vladimir Barbarosh</title>
    <style>.fix-f { position: fixed; inset: 0; }</style>
</head>
<body>
<div class="fix-f">
    <script src="https://navplace.com/lib/embed.js" data-links="
% design: showcase
% title: Vladimir Barbarosh
% email: hello@vbarbarosh.com

# GitHub
navplace                https://github.com/vbarbarosh/navplace/
node-helpers            https://vbarbarosh.github.io/node-helpers
vue-modal               https://vbarbarosh.github.io/vue-modal

# LinkedIn
LinkedIn                https://www.linkedin.com/in/vbarbarosh/
"></script>
</div>
</body>
</html>
```

No build step, no framework, no CMS — one `<script>` tag and a plain-text list of links is the whole site.

## FAQ

**What is NavPlace?**
A small tool that turns a plain-text list of links into a fast launcher, a hosted page, and an embeddable widget — all from one shared source. The DSL is intentionally minimal: `label  url` lines, `# Section` headings, and `% key: value` directives. Inline `#tag`, `#key=value`, and `@image` give you per-item metadata when you want it.

**How do designs work?**
A design is a self-contained HTML folder under `designs/<name>/` that consumes the parsed items and decides how to draw them. You switch designs by changing one line — `% design: <name>` — at the top of your source. A quick tour of what ships in the repo:

- `basic`, `github`, `google-chrome` — minimal, search-first launchers with an input at the top and a list/grid of links below.
- `showcase` — a personal page: name header, email link, grid of items. (This is what `vbarbarosh.com` uses.)
- `basic-for-kids2`, `basic-for-recipes` — themed presentations with their own typography, colors, and layout.
- `basic-for-portfolio`, `basic-for-internal2`, `basic-for-internal3-with-groups` — a portfolio and two internal-tool launchers.

**Can I embed NavPlace on my own site?**
Yes. One `<script src="…/embed.js" data-links="…">` tag in any HTML page. The script creates an iframe pointing at the chosen design and pipes the `data-links` text into it via `postMessage`. The iframe sizes itself to its container — the example in `www/index.html` pins it to the viewport with `position: fixed; inset: 0`.

**Where is my data stored?**
It depends on the surface:

- **Desktop app** — a single file on your machine: `~/.navplace/README.md`. Edit it in any text editor.
- **Web app** — collections are stored server-side via the Express API in `src/http/` (MySQL via Knex).
- **Embed widget** — fully self-contained; links live inline in `data-links` on the host page.

A cross-surface sync layer is in active development. Until it lands, collections move with the file, the URL, or the embed tag.

**Is there a global hotkey for the desktop app?**
On GNOME/Linux, **Ctrl+Shift+Alt+N** is wired up by running `bin/configure-gnome` once. It registers the keybinding via `dconf` and installs `navplace.desktop`. The hotkey runs `desktop-electron/launcher.js` — a tiny Node script that pings a Unix socket at `~/.config/navplace/navplace.sock`, so summoning the app is essentially instant after the first launch. Other desktop environments aren't wired up yet; the underlying mechanism (socket + hide-on-blur) is portable, the keybinding glue isn't.

**How do I open multiple links at once?**
Separate what you type with spaces. `gh mail cal` opens three links — the top match for each. (For tighter filters, NavPlace also supports `/`, `^`, `$`, and `!` inside a single expression, but most users never need them.)

**Is it open source?**
Yes — MIT licensed, on GitHub.

## How it's built

- **`lib/parse.js`** — the shared parser; the single source of truth for what a NavPlace document means.
- **`lib/filter1_from_spec.js`** — the filter compiler (`^`, `$`, `!`, `/`).
- **`lib/navplace.js`** — runtime that wires the input box to the filter, manages selection, and dispatches `navigate`.
- **`lib/embed.js`** — third-party embed; loads the chosen design in an iframe and forwards `data-links` via `postMessage`.
- **`desktop-electron/`** — `main.js` (window, socket server, single-instance lock, favicon cache, `private://` and `app://` protocol handlers), `launcher.js` (the fast Unix-socket ping), `renderer.js` (preload bridge).
- **`src/http/`** — Express server: landing pages, collection API, dashboard, static `/lib` and `/designs`.
- **`designs/`** — each design is a self-contained HTML folder that consumes the parsed items.

## Status & contributing

NavPlace is open source. Issues and pull requests are welcome at https://github.com/vbarbarosh/navplace.

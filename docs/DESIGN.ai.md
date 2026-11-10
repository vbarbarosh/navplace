# NavPlace Design Spec

This file is the complete contract for building a NavPlace design. Hand it to
an AI agent along with a design brief; the agent has everything it needs to
produce a working `index.html`.

## Reference designs (read these first)

Two existing designs are the canonical, battle-tested references. When generating a new design, base patterns on these — not on the less polished `basic-for-*` designs.

- **`designs/showcase/`** — the canonical **presentation-style** reference. Powers https://vbarbarosh.com in production. Vanilla JS, no framework. Uses `meta` mapping to bind `% title:` / `% email:` / `% subtitle:` into the page chrome. Shows the shared light/dark switch (`/lib/theme_switch.js`) in its topbar. Uses `navplace.navigate(item, e)` on click so multi-open works.

- **`designs/github/`** — the canonical **launcher-style** reference. Default fallback in `src/desktop-electron/main.js` when `% design:` is missing or unknown. Vanilla JS, no framework. Search input + dense table of rows (icon / label / href). Each row holds a real link, the label, that fills the row. Marks the current link (`np-current`) that the runtime's Up/Down move; opens via `navplace.navigate(item, event)` to preserve multi-open. Explicit "No matches." empty state.

Both are single-HTML-file plus a single `theme.css`, with no build step and no external dependencies — match that shape for new designs.

**Full source of both designs is inlined at the bottom of this file (Appendix A and Appendix B).** Use them as direct templates rather than fetching the files separately.

## What a design is

A **design** is an HTML page in a folder of its own that renders a NavPlace collection. It receives a list of parsed items at runtime and decides how to display them. Designs are swappable per-collection by changing one line in the source: `% design: <name>`.

A design must work in **three runtime contexts** without any context-specific code:

1. **Desktop app (Electron)** — the file is loaded from the app's own folders, at `navplace://app/designs/<name>/index.html`. Items come from `window.ElectronApp.api_items_all()`, and again after every reload of the links.
2. **navplace.com and its Playground** — the file is served as a static asset from `build/www/` by the Cloudflare Worker. Items come from postMessage.
3. **Embed widget** — the file runs inside an `<iframe>` on a third-party page. Items come from postMessage.

The NavPlace runtime (`lib/navplace.js`) handles all three transparently. A design just needs to follow the contract below.

## File layout

```
designs/<your-design-name>/
  index.html        # required, the entry point
  theme.css         # optional, scoped stylesheet
  links.txt         # optional, the sample the Playground loads with the design
  <assets…>         # optional, images/svgs you bundle with the design
```

- Folder name = design name (referenced as `% design: <your-design-name>`).
- The design's own files (`theme.css`, pictures) are referenced **relative to the design folder**.
- The shared libraries are loaded from **`/lib/…`**, the site's root, never `../../lib/…` (`bin/self-check` fails the build on it). The desktop app shows designs at `navplace://app/designs/<name>/`, where `/lib` is its own copy.
- The shared runtime lives at `/lib/navplace.js`.
- Optional shared vendor libs (Vue, smcss) live under `/lib/vendor/`, a folder per major: Vue at `vue-3/`, smcss at `smcss-2/` (an upgrade replaces the files; a new major gets a folder of its own) — three existing designs use these (`basic`, `first`, `google-chrome`), but a design can equally well be vanilla JS with no deps.

## Runtime API

Load `/lib/navplace.js`. It exposes a global function `navplace(...)` and a helper `navplace.navigate(...)`; `navplace.order_set(...)`, `navplace.current_set(...)` and `navplace.selected_items` are described below.

### `navplace(params)` — call this once on init

```js
navplace({
  input: '#search',                 // string selector OR HTMLElement (default: 'input[type=search]')
  update: (items, {current}) => { /* … */ },   // called every time the list or the current link changes (required)
  meta: {                           // optional: map directive keys → CSS selectors
    title: '.identity h1',
    email: '.identity a',
    subtitle: '.section-title',
  },
  navigate: (item) => { /* … */ }   // optional: override Enter-key navigation (no design here does)
});
```

- `input` — the search `<input>` element. The runtime listens to its `input` event, re-runs the filter, and calls `update(items)` with the new list. The runtime also auto-focuses this element when the user starts typing anywhere on the page. When the page has no such element, `navplace()` returns at once and does nothing, without an error.
- `update(items, {current})` — called once on init (with the full list), again on every filter change, and on every Up/Down. The design re-renders from this list and puts the class `np-current` on the element of `items[current]`. The runtime owns Up, Down and Enter: Up/Down move `current` (0 after each new search, −1 when there are no links) and scroll `.np-current` into view; Enter opens `items[current]`. Enter and Space on a focused button or link are left to it: the button does its work, the link opens as a click on it does. A design with a bar stuck above its links (`position: sticky` or `fixed`) gives the links a `scroll-margin-top`, or their scroller a `scroll-padding-top`, as tall as that bar, or going Up the current link stops under it. A default ring styles `.np-current`; restyle it in the design, for both themes. `update` also gets `{item}`, the current link itself. A design that shows other links than it was given, or in another order (a section picked, links grouped), tells the runtime with `navplace.order_set(shown)`, the links it shows in their screen order: ↑ ↓ and Enter then walk those. The order lasts until the next search, so the design sets it each time it draws. `navplace.current_set(index)` makes the link at that place in the order the current one (a row under the mouse). Items are sorted: the links that match by label and tags first, then those that need the href to match, each group in the file's order.
- `meta` — optional. Maps directive keys from the collection's `% key: value` lines to CSS selectors in your template. When the source has `% title: Vladimir Barbarosh`, the runtime writes `Vladimir Barbarosh` into the `innerText` of the element matched by `.identity h1`. Useful for designs with author / contact / section labels in the chrome. Only `title`, `email`, `subtitle` are wired in the existing designs, but any key works — and `email` on an `<a>` also sets its `href` to `mailto:…` when the value is a plain mail address; any other value leaves the element without a link. A key the file does not have leaves the element as the design wrote it, its text and its link, and a key taken out of the file puts them back. It works the same in the desktop app, at every reload of the links; only the user's own file sets these, never an included one.
- `navigate(item)` — optional, for a design that opens links its own way. Called on Enter once for each link Enter opens: the top link of every expression before the last, then the current link. No design in this repo passes it: the default, `navplace.navigate(item)` (which respects the multi-open selection — see below), is what they use.

### `navplace.navigate(item, event?)` — call this from click handlers

For click-to-open links in your rendered list, **use `navplace.navigate(item, event)` rather than a raw `<a href>` click**. Only the runtime function honors multi-link selection. With the `event` it also leaves a click with Ctrl, Cmd, Shift or the middle button on an `<a href>` to the browser, which opens that one link its own way. In the desktop app it hands a `file://` link to the app (`window.ElectronApp.api_file_open(href)`), which a page cannot open itself: the app opens it when the user's own links file lists it.

```js
const linkEl = document.createElement('a');
linkEl.href = item.href;        // still set href so middle-click and "open in new tab" work
linkEl.onclick = e => navplace.navigate(item, e);
```

### How multi-link works (so you render the right thing)

The user can type space-separated expressions in the input: `gh mail cal`. The runtime compiles each expression separately and selects **one item per expression** (the first match). `update(items)` receives the items matching the **last** expression typed, so the list visible to the user reflects what's currently being narrowed. The selected items are in `navplace.selected_items`, one for each expression that matches anything, for a design that shows what Enter will open (`palette` does).

On Enter (or on a `navplace.navigate(item, e)` click), the runtime opens **every** selected item, the current or clicked one in place of the last expression's — not just the one clicked or the one at the top. An address selected twice opens once. This is a signature feature; do not break it by short-circuiting with `<a href target="_blank">` alone. On the web the last one takes the page's place and the others open in new tabs; when the browser blocks pop-ups only the first of those tabs opens, until pop-ups are allowed for the site.

## Item shape

Every item passed to `update(items)` has this shape:

```js
{
  label:      'node-helpers',                           // string — user-visible name
  href:       'https://vbarbarosh.github.io/node-helpers',
  icon_url:   'app://favicon/vbarbarosh.github.io?letter=N',     // see "icons" section
  image_url:  null,                                     // string|null — set if source had `@image-name`
  tags:       ['frontend'],                             // string[] — from inline `#tag` (no equals)
  meta:       { padding: '1' },                         // object — from inline `#tag=value` (tag-with-value)
  search1:    'node-helpers frontend',                  // already filtered; don't re-use
  search2:    'https://vbarbarosh.github.io/node-helpers',
  namespaces: ['GitHub']                                // string[] — from the preceding `# Section` heading
}
```

Most designs only use `label`, `href`, `icon_url`, `image_url`, and optionally `tags`, `meta`, `namespaces`. Don't try to re-implement filtering — the runtime already did it.

### `tags` vs `meta` vs `image_url` vs `namespaces` — what comes from where

These four per-item fields are populated from different DSL syntax. Don't conflate them. See `lib/parse.test.js` (`'meta, tags, and images'`) for the canonical worked example.

- **`item.tags`** — from inline **`#tag`** (no equals sign) on a link line.
  Example: `node-helpers #frontend https://…` → `tags: ['frontend']`.
- **`item.meta`** — from inline **`#tag=value`** (tag with a value) on a link line. Conceptually still a tag, just one that carries a value; the parser stores them in a separate object for convenience.
  Example: `node-helpers #padding=1 https://…` → `meta: { padding: '1' }`.
- **`item.image_url`** — from inline **`@path`** (an at-sign followed by a relative path) on a link line, **immediately before the URL**. The parser turns it into `private://<path>`, which Electron serves from `~/.navplace/<path>`. The path may contain `/`.
  Example: `Gmail #bb @img/gmail.png https://mail.google.com/` → `image_url: 'private://img/gmail.png'`.
  When the file names the picture with `% picture <path>: <url>` (an `http://`, `https://` or `data:image/` url, on a line anywhere in the file), `image_url` is that url instead; in the desktop app a web url comes as `app://picture/<key>`, the app's kept copy of the picture.
  Default when absent: `null`. Outside Electron (web/embed surfaces), the `private://` protocol won't resolve, so always fall back: `item.image_url ?? item.icon_url` for a link with no picture, and `icon_url` again when the picture fails to load (the `<img>`'s `error` event).
- **`item.namespaces`** — from a **`# Section`** heading **at the start of a line** that precedes the link.
  Example: `# GitHub` on its own line, then `node-helpers https://…` → `namespaces: ['GitHub']`.

Note: there is **also** a document-level `meta` returned by the parser at the top of its output (from `% key: value` directives like `% design: github`, `% title: …`). That's a separate object on the file root — not on each item — and you don't see it in `update(items)`. It's wired into the DOM via the `meta: { title: '.identity h1' }` param to `navplace({...})` instead.

So `%` is for document-wide directives; `#` and `@` are always per-item or per-section.

### Icons

- `item.icon_url` is always set. Inside Electron, it's `app://favicon/<host>?letter=<L>` (served by the desktop app's protocol handler with a disk cache; a letter tile when no icon is found for the site). On navplace.com it's `/icon/<host>`, answered by the site's Worker for navplace pages only; anywhere else it's `https://icon.horse/icon/<host>`, or, for a host that is not public (an IP address, a port, `localhost`, a private name such as `wiki.corp.internal`), an inline `data:image/svg+xml` letter tile.
- Use it directly as `<img src="…">`. Don't construct your own favicon URL — you'd break the desktop favicon cache.

### Images

- `item.image_url` is set when the source line has `@filename` before the URL (e.g. `Atari @atari.png https://atari.com`). It resolves to `private://<filename>` and is served from `~/.navplace/<filename>` (Electron only — the web/embed surfaces won't have these files: `image_url` is still `private://<filename>` there, and does not load).
- With `% picture atari.png: <url>` in the file, `image_url` is that url on the web. In the desktop app a `data:` url comes as it is, and a web url comes as `app://picture/<key>`: the app fetches the picture once and answers with its kept copy. Use `image_url` as it comes, in an `<img>`; one the app could not fetch fails to load like any other.
- Fall back gracefully: `item.image_url ?? item.icon_url`, and `item.icon_url` when the picture fails to load.

### The picture behind the links

- With `% picture background: <url>` in the user's own file, the runtime sets `--picture-background: url("<url>")` on `<html>` (in the desktop app `app://picture/<key>`, the kept copy), and takes it away when the line goes or the picture does not load. Use it with your own picture as the fallback: `background: var(--picture-background, url("photo.jpg"));`. A design with no picture behind its links can leave it alone.

## Required behavior

A design **must**:

1. Render a search `<input>` element and pass it to `navplace({...})`.
2. Render items received via `update(items, {current})`, the current one with the class `np-current`. Empty list at start is normal — render nothing or an empty state.
3. Make item clicks call `navplace.navigate(item, e)` (not just rely on `<a href>`).
4. Work without network access (see "Desktop network gate" below).
5. Be a single `index.html` plus a `theme.css` (plus any local assets). No build step.
6. Have a light and a dark theme with the shared switch: `<script src="/lib/theme_switch.js"></script>` in `<head>`, before the design's CSS; light colours on `:root`, dark ones on `:root[data-theme="dark"]` (the rulebook's UI-01 to UI-04). `bin/self-check` fails the build for a design without it, for one that never names `np-current`, for a script that does not parse, and for a `src` or `href` that names a file the build does not have.
7. Put everything from the links file (`label`, `href`, `icon_url`, `image_url`, `tags`, `meta` values, `namespaces`) into the page as text, never as HTML: `textContent` and set attributes (`a.href = …`, `img.src = …`), or, in an HTML string, every value through an `html_escape` that covers `& < > " '`, attribute values included. The file is not trusted (an embed's `data-links`, another person's file pulled in by `% include:`): a link named `<img src=x onerror=…>` must show as exactly that text.

A design **should**:

- Show the search input prominently. The runtime auto-focuses it on any keystroke, but visually it should look like the primary interaction.
- Render an item's `label`, `href` host, and `icon_url`/`image_url` at minimum.
- Handle empty state (no items, no matches) without layout collapse.
- Be responsive down to ~360px width if you want it to work in embedded contexts.

## Desktop network gate (critical)

The Electron app blocks **all outbound network requests** from the design except for these protocols:

```
app://favicon/   app://picture/   blob:   chrome://   chrome-devtools://
data:   devtools://   file://   navplace://app/   private://
```

This means:

- ❌ **No Google Fonts**, no `@import url(https://…)` in CSS.
- ❌ **No CDN libraries** loaded via `<script src="https://…">` (use the bundled `/lib/vendor/...` paths or vanilla JS).
- ❌ **No remote images** in your design's chrome (decorative SVGs, background art). Inline them as `data:` URLs or local files.
- ✅ **Item icons via `item.icon_url`** — these go through the allowed `app://favicon/` protocol.
- ✅ **Item images via `item.image_url`** — these go through the allowed `private://` protocol, or `data:` and `app://picture/` for a `% picture`.
- ✅ **The design's own files and `/lib/…`** — these go through `navplace://app/`.

The app also refuses a page every permission but writing to the clipboard, and the window never leaves the design: a navigation is cancelled, and its address opens outside when it is an `http://` or `https://` one or a plain `mailto:` address. A `file://` link is not opened this way: `navplace.navigate` asks the app for it.

If a design needs external fonts or images, inline them. The web/embed surfaces don't block these, but the desktop app will silently produce a font-of-shame fallback if you forget.

## Minimal working template

Copy this and modify. It's a complete, working design with no dependencies — drop it in `designs/<name>/index.html` and it runs.

```html
<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title><!-- Design Name --> | NavPlace</title>
    <script src="/lib/theme_switch.js"></script>
    <link href="theme.css" rel="stylesheet">
</head>
<body>

<div class="page">
    <header class="hdr">
        <h1 class="title">Untitled</h1>
        <input id="search" type="search" placeholder="Search…" autocomplete="off" spellcheck="false">
    </header>
    <main id="list" class="list"></main>
</div>

<script src="/lib/navplace.js"></script>
<script>
(function () {
    navplace({
        input: '#search',
        meta: {
            title: '.title',           // % title: Foo  → .title.innerText = 'Foo'
        },
        update: render,
    });

    const listEl = document.getElementById('list');

    function render(items, {current}) {
        listEl.replaceChildren(...items.map((item, i) => make_row(item, i === current)));
    }

    function make_row(item, is_current) {
        const a = document.createElement('a');
        a.href = item.href;                          // for middle-click / "open in new tab"
        a.className = is_current ? 'row np-current' : 'row';   // the link ↑ ↓ moved to, which Enter opens
        a.onclick = e => navplace.navigate(item, e); // signature multi-open behavior
        // The links file is not trusted: its text enters as text or a set attribute, never as HTML
        a.innerHTML = '<img class="row-icon" alt=""><span class="row-label"></span><span class="row-host"></span>';
        a.querySelector('.row-icon').src = item.image_url ?? item.icon_url;
        a.querySelector('.row-label').textContent = item.label;
        a.querySelector('.row-host').textContent = new URL(item.href).host;
        return a;
    }
})();
</script>

</body>
</html>
```

And a starter `theme.css`:

```css
:root {
    --bg: #fbfaf7;
    --fg: #1a1a1a;
    --muted: #888;
    --row-hover: rgba(0,0,0,.04);
    --accent: #2563eb;
    --np-scrollbar-thumb: rgba(26,26,26,.35);
}
:root[data-theme="dark"] {
    --bg: #1a1a1a;
    --fg: #fbfaf7;
    --row-hover: rgba(255,255,255,.06);
    --np-scrollbar-thumb: rgba(251,250,247,.35);
}
* { box-sizing: border-box; }
html, body { margin: 0; height: 100%; font-family: system-ui, -apple-system, sans-serif; background: var(--bg); color: var(--fg); }
.page { max-width: 720px; margin: 0 auto; padding: 32px 16px; }
.hdr { display: grid; gap: 12px; margin-bottom: 24px; }
.title { margin: 0; font-size: 24px; font-weight: 600; }
#search { width: 100%; padding: 10px 14px; font: inherit; border: 1px solid color-mix(in srgb, var(--fg) 15%, transparent); border-radius: 8px; background: transparent; color: inherit; }
#search:focus { outline: none; border-color: var(--accent); }
.list { display: grid; gap: 2px; }
.row { display: grid; grid-template-columns: 24px 1fr auto; align-items: center; gap: 12px; padding: 8px 10px; border-radius: 6px; color: inherit; text-decoration: none; }
.row:hover { background: var(--row-hover); }
.row-icon { width: 20px; height: 20px; }
.row-label { font-weight: 500; }
.row-host { color: var(--muted); font-size: 13px; }
```

## Design styles (taxonomy)

When designing, decide which family the brief belongs to. Each has a different rendering bias.

- **Launcher style** — search-first, dense list/table, keyboard-driven. Best for the desktop app. Optimize for typing speed and information density.
  - **Canonical reference: `designs/github/`.** Imitate this for launcher briefs.
  - Other examples: `palette` (a command palette), and the less polished `basic`, `first`, `google-chrome`, `basic-for-internal2`, `basic-for-internal3-with-groups`.
- **Presentation style** — themed page with personality, items as a styled grid or wall, search is secondary. Best for hosted pages and embeds. Optimize for visual identity.
  - **Canonical reference: `designs/showcase/`.** Imitate this for presentation briefs.
  - Other examples: `cards` (sections as categories), and the less polished `basic-for-portfolio`, `basic-for-kids`, `basic-for-kids2`, `basic-for-recipes`.

## Common patterns

### Reading directives

The `meta` parameter wires directive values into the DOM declaratively. For one-off use elsewhere in your code, parse the source yourself via `lib/parse.js` (already loaded by `navplace.js`):

```js
// Get the design-level directives via meta-DOM wiring (preferred).
navplace({
    input: '#search',
    meta: { title: 'h1.name', email: 'a.email', subtitle: '.section' },
    update: render,
});
```

### Filtering by namespace (sections)

The collection author can pre-filter via `% ns: GitHub | LinkedIn`. The runtime applies this before items reach your `update()`. You don't need to do anything; just render what arrives.

### Per-item tags and tag-values

A link line can carry inline tags. Two flavors, same `#` prefix:

- `#name` (no equals) → goes into `item.tags`.
- `#name=value` (with equals) → goes into `item.meta` (keyed by `name`).

Use them for visual variation:

```js
function make_row(item) {
    const a = document.createElement('a');
    if (item.tags.includes('frontend')) a.classList.add('is-frontend');
    if (item.meta.padding) a.style.padding = `${item.meta.padding}px`;
    // …
}
```

### Multiple sections

Items carry their `namespaces` array. Group them at render time:

```js
function render(items) {
    const groups = {};
    for (const item of items) {
        const ns = item.namespaces[0] || '';
        (groups[ns] ??= []).push(item);
    }
    listEl.replaceChildren(...Object.entries(groups).flatMap(([ns, group]) => [
        Object.assign(document.createElement('h2'), { textContent: ns }),
        ...group.map(make_row),
    ]));
}
```

### Light/dark theme and scrollbars

`/lib/theme_switch.js`, loaded in `<head>`, does it for every design, the same way:

- It sets `data-theme="light"` or `"dark"` on `<html>` before the page shows: the choice saved in `localStorage` under `navplace.design.theme` (one for all designs), or the OS setting when nothing is saved yet. There is no System option: one button, sun for light, crescent for dark. A design that is open takes a new saved choice at once, from another design, another tab, or the home page, whose own switch turns the designs it shows with it.
- The button goes into the design's `<span data-theme-switch></span>` when it has one (a header or a footer); otherwise it sits in the page's top-right corner. In the desktop app a gear goes before it, in the same place, and opens the app's settings; leave room for two buttons there. Restyle it through `.np-theme-switch` or `--np-switch-bg`, `--np-switch-fg`, `--np-switch-border`.
- Scrollbars are thin and take `--np-scrollbar-thumb` and `--np-scrollbar-track` (transparent by default); set both for each theme.
- Keep pictures readable in dark: a black logo on a transparent picture needs a muted plate behind it, not a near-black one.

## What breaks designs (don't do these)

1. **Raw `<a href>` only.** Clicks bypass the runtime, multi-open silently breaks.
2. **External fonts / scripts / images.** Blocked by the Electron network gate.
3. **Re-running the filter inside `update()`.** Items are already filtered. Re-filtering hides matches the user is currently narrowing toward.
4. **Hardcoded copy in the template.** Use the `meta` mapping so the source file can override.
5. **Assuming items have a non-empty `namespaces`.** Items without a `# Section` heading have `namespaces: []`.
6. **Adding a build step.** Designs are plain HTML/CSS/JS, served as static files. No bundler, no JSX, no preprocessor.
7. **Calling `navplace()` more than once.** Multiple subscriptions will fight over the input.
8. **Adding outbound API calls.** The design is a renderer, not a client. Items are pushed in; navigation is the only side effect.

## Testing a new design

1. Drop the folder in `designs/<your-name>/`.
2. Build the site and open it in the Playground: `bin/build`, then `python3 -m http.server -d build/www` and visit `http://localhost:8000/playground.html`, or open `http://localhost:8000/designs/<your-name>/index.html` directly. Not from disk: on a `file://` page `/lib` is the root of the disk, and nothing loads. The runtime falls back to a built-in demo source (`ChatGPT / GitHub / Gmail`) so you'll see real items right away.
3. To test with real items, create `~/.navplace/README.md` with `% design: <your-name>` and a few link lines, then `src/desktop-electron/bin/run` to open it in the desktop app.
4. To test the embed surface, paste into any HTML page:
   ```html
   <script src="http://localhost:<port>/lib/embed.js" data-design="<your-name>" data-links="…"></script>
   ```
5. Verify: typing in the input filters; Up and Down move the current link; clicking a link opens it; typing `gh mail` (or similar) and hitting Enter opens two items.

## Briefing format for AI-generated designs

When asking an AI agent to produce a new design, pair this file with a brief that answers:

1. **Name** — folder slug, kebab-case (e.g. `dark-minimal`).
2. **Style family** — launcher or presentation.
3. **Audience and tone** — who reads this, what mood it should evoke.
4. **Layout sketch** — describe the chrome (header? sidebar? grid? list?), where the search input goes, how items are rendered (tiles? rows? cards?).
5. **Color palette** — primary, background, foreground, accent, for the light theme and for the dark one.
6. **Typography** — system fonts only (network gate). Names like "ui-monospace, monospace" or "system-ui, sans-serif".
7. **Directives to wire** — usually `title`, sometimes `email`, `subtitle`, custom ones.
8. **Per-item tag/meta handling** — any visual variations driven by tags or meta values.
9. **Empty state** — what's visible when no items are loaded yet.

A complete brief plus this spec is enough for an AI agent to produce a working `designs/<name>/index.html` plus `theme.css` that drops straight into the repo.

---

## Appendix A: Reference design — `showcase` (presentation style)

The canonical presentation-style design. Powers https://vbarbarosh.com. Vanilla JS, no framework, no build step. Uses the `meta` mapping, the shared light/dark switch in its topbar, and `navplace.navigate(item, e)` on click. Use this as the direct template for presentation-style design briefs.

### `designs/showcase/index.html`

```html
<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>Showcase Theme | NavPlace</title>
    <script src="/lib/theme_switch.js"></script>
    <link href="theme.css" rel="stylesheet" />
</head>
<body>
<div class="page">

    <div class="topbar">
        <div class="identity">
            <h1>John Doe</h1>
            <a href="mailto:hello@example.com">hello@example.com</a>
        </div>
        <span data-theme-switch></span>
    </div>

    <div class="search">
        <input id="search" type="search" placeholder="Search" autocomplete="off" aria-label="Search" />
    </div>

    <h2 class="section-title">Showcase</h2>
    <div id="grid" class="grid"></div>
    <p id="empty" class="empty" hidden></p>
</div>

<script src="/lib/navplace.js"></script>
<script>
main();

function main()
{
    navplace({
        input: '#search',
        meta: {title: '.identity h1', email: '.identity a', subtitle: '.section-title'},
        update: (v, {current = 0} = {}) => refresh_grid(v, current),
    });

    // `current`: the link ↑ and ↓ chose (lib/navplace.js), the one Enter opens
    function refresh_grid(items, current) {
        const grid = document.getElementById('grid');
        grid.replaceChildren(...items.map(function (item, i) {
            const templ = document.createElement('template');
            templ.innerHTML = `
                <a class="tile">
                    <div class="icon">
                        <img>
                    </div>
                    <div>
                        <div class="label"></div>
                        <div class="sub"></div>
                    </div>
                </a>
            `;
            const out = templ.content.firstElementChild;
            // The links file is not trusted: its text enters as text or a set attribute, never as HTML
            out.href = item.href;
            out.querySelector('img').src = item.icon_url;
            // An icon that cannot be loaded: the link's first letter stands in its tile (.icon[data-letter] in theme.css)
            out.querySelector('img').addEventListener('error', function (event) {
                event.target.parentElement.dataset.letter = letter_from_label(item.label);
            });
            out.querySelector('.label').textContent = item.label;
            // A name too long for its tile is cut with an ellipsis: its full text is in the title
            out.querySelector('.label').title = item.label;
            out.querySelector('.sub').textContent = new URL(item.href).host;
            out.classList.toggle('np-current', i === current);
            out.onclick = function (event) {
                navplace.navigate(item, event);
            };
            return out;
        }));
        // No link to show: a search that finds nothing is told apart from a file with no links by the search box
        const empty = document.getElementById('empty');
        empty.hidden = (items.length > 0);
        empty.textContent = document.getElementById('search').value.trim() ? 'Nothing found' : 'No links yet';
    }

    // The first letter or digit of a link's name, in capitals; ? for a name that has none
    function letter_from_label(label) {
        return (String(label).match(/[\p{L}\p{N}]/u)?.[0] ?? '?').toUpperCase();
    }
}
</script>
</body>
</html>
```

### `designs/showcase/theme.css`

```css
:root {
    --bg: #ffffff;
    --fg: #111111;
    --muted: #666666;
    --border: #e6e6e6;
    --card-bg: #fafafa;
    --card-bg-hover: #f2f2f2;
    --shadow: 0 1px 2px rgba(0, 0, 0, .05);
    --shadow-hover: 0 6px 18px rgba(0, 0, 0, .08);
    --radius: 14px;
    --gap: 14px;
    --max: 1100px;
    --accent: #5b2fd6;
    --input-bg: #f6f6f6;
    --focus-ring: rgba(0, 0, 0, 0.25); /* light mode */
    --focus-bg: rgba(0, 0, 0, 0.03);
    /* /lib/theme_switch.js: its button and the scrollbars */
    --np-switch-bg: var(--card-bg);
    --np-switch-fg: var(--muted);
    --np-switch-border: var(--border);
    --np-scrollbar-thumb: #c9c9cf;
    --np-scrollbar-track: var(--bg);
}

:root[data-theme="dark"] {
    --bg: #0f1115;
    --fg: #f4f5f7;
    --muted: #a7abb3;
    --border: #242832;
    --card-bg: #141824;
    --card-bg-hover: #191f2d;
    --shadow: 0 1px 2px rgba(0, 0, 0, .35);
    --shadow-hover: 0 10px 26px rgba(0, 0, 0, .45);
    --accent: #8a6dff;
    --input-bg: #141824;
    --focus-ring: rgba(255, 255, 255, 0.25); /* dark mode */
    --focus-bg: rgba(255, 255, 255, 0.05);
    --np-scrollbar-thumb: #343a48;
}

html,
body {
    margin: 0;
    background: var(--bg);
    color: var(--fg);
    font-family: system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Arial, sans-serif;
}

a {
    color: inherit;
    text-decoration: none;
}

a:hover {
    text-decoration: underline;
}

.page {
    max-width: var(--max);
    margin: 0 auto;
    padding: 28px 18px 60px;
}

/* Header */

.topbar {
    display: flex;
    gap: 12px;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 22px;
}

.identity h1 {
    margin: 0;
    font-size: 36px;
    letter-spacing: -0.02em;
}

.identity a {
    color: var(--muted);
    font-size: 14px;
}

/* Theme switch: /lib/theme_switch.js puts its button in [data-theme-switch] */

.np-theme-switch {
    width: 38px;
    height: 38px;
}

.np-theme-switch:hover {
    color: var(--accent);
    border-color: var(--accent);
}

/* Search */

.search {
    margin: 18px 0 26px;
}

.search input {
    width: 100%;
    padding: 14px 16px;
    font-size: 15px;
    border-radius: 999px;
    border: 1px solid var(--border);
    background: var(--input-bg);
    color: var(--fg);
}

.search input:focus {
    caret-color: var(--accent);
    outline: none;
    border-color: var(--border);
    box-shadow: 0 0 0 2px var(--focus-ring),
    inset 0 0 0 1px var(--focus-bg);
}

.search input:focus-visible {
    transition: box-shadow 80ms ease;
}

.search input::placeholder {
    color: var(--muted);
}

/* Section */

.section-title {
    margin: 0 0 12px;
    font-size: 14px;
    color: var(--muted);
    letter-spacing: .08em;
    text-transform: uppercase;
}

/* Grid */

.grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: var(--gap);
}

@media (max-width: 900px) {
    .grid {
        grid-template-columns: repeat(3, 1fr);
    }
}

@media (max-width: 640px) {
    .grid {
        grid-template-columns: repeat(2, 1fr);
    }
}

@media (max-width: 420px) {
    .grid {
        grid-template-columns: 1fr;
    }
}

.tile {
    display: grid;
    grid-template-columns: 44px minmax(0, 1fr);
    gap: 12px;
    padding: 14px;
    border-radius: var(--radius);
    border: 1px solid var(--border);
    background: var(--card-bg);
    transition: .12s ease;
}

.tile:hover {
    background: var(--card-bg-hover);
    box-shadow: var(--shadow-hover);
}

/* The link ↑ and ↓ chose (lib/navplace.js); Enter opens it */
.tile.np-current {
    border-color: var(--accent);
    outline: 2px solid var(--accent);
    outline-offset: 1px;
    background: var(--card-bg-hover);
}

.icon {
    width: 44px;
    height: 44px;
    border-radius: 10px;
    background: rgba(127, 127, 127, .15);
    display: grid;
    place-items: center;
}

.icon img {
    width: 26px;
    height: 26px;
}

/* An icon that cannot be loaded leaves the link's first letter in its tile: the picture keeps its
   room, unseen, and the letter lies over it, out of the flow, so nothing moves and the underline
   of a tile under the mouse stays off it */

.icon[data-letter] {
    position: relative;
}

.icon[data-letter] img {
    visibility: hidden;
}

.icon[data-letter]::after {
    content: attr(data-letter);
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    font-size: 18px;
    font-weight: 600;
    color: var(--fg);
}

.label {
    font-size: 15px;
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.sub {
    font-size: 12px;
    color: var(--muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

/* No link to show */

.empty {
    margin: 0;
    font-size: 14px;
    color: var(--muted);
}
```

---

## Appendix B: Reference design — `github` (launcher style)

The canonical launcher-style design. Default fallback in `src/desktop-electron/main.js`. Vanilla JS, no framework, no build step. Marks the current link that the runtime's Up / Down move; opens via `navplace.navigate(item)` to preserve the multi-open behavior. Has an explicit empty state. Use this as the direct template for launcher-style design briefs.

### `designs/github/index.html`

```html
<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>GitHub Theme | NavPlace</title>
    <script src="/lib/theme_switch.js"></script>
    <link rel="stylesheet" href="theme.css">
</head>
<body>

<div class="app">
    <div class="topbar">
        <div class="search">
            <input id="q" type="search" autocomplete="off" spellcheck="false"
                   placeholder="Search… (Enter to open first match)" />
            <span data-theme-switch></span>
        </div>
        <div class="hint">
            <span class="kbd">↑</span>/<span class="kbd">↓</span> to move, <span class="kbd">Enter</span> to open,
            <span class="kbd">Esc</span> to clear.
        </div>
    </div>

    <div class="table" role="region" aria-label="Quick launch links">
        <table>
            <thead>
            <tr>
                <th class="col-icon">Icon</th>
                <th>Label</th>
                <th>Href</th>
            </tr>
            </thead>
            <tbody id="rows"></tbody>
        </table>
        <div id="empty" class="empty">No matches.</div>
    </div>
</div>

<script src="/lib/navplace.js"></script>
<script>
    // The runtime keeps the current link (↑ ↓ Enter); this design draws it as .np-current
    let current_index = 0;

    const matches = [];

    main();

    function main()
    {
        navplace({
            input: 'input[type=search]',
            update: function (items, {current} = {}) {
                matches.splice(0, matches.length, ...items);
                current_index = current ?? 0;
                refresh();
            },
        });

        const search_input = document.getElementById('q');
        document.addEventListener('keydown', function (event) {
            if (event.key === 'Escape') {
                event.preventDefault();
                search_input.value = '';
                search_input.dispatchEvent(new Event('input', {bubbles: true}));
            }
        });
        refresh();
    }

    function html_escape(s)
    {
        let escaped = String(s);
        escaped = escaped.replace(/&/g, '&amp;');
        escaped = escaped.replace(/</g, '&lt;');
        escaped = escaped.replace(/>/g, '&gt;');
        escaped = escaped.replace(/"/g, '&quot;');
        escaped = escaped.replace(/'/g, '&#039;');
        return escaped;
    }

    function refresh_rows(items, current)
    {
        const tbody = document.getElementById('rows');
        const empty = document.getElementById('empty');
        tbody.innerHTML = '';
        if (!items.length) {
            empty.style.display = 'block';
            return;
        }
        empty.style.display = 'none';

        for (const [i, item] of items.entries()) {
            const tr = document.createElement('tr');
            tr.setAttribute('data-index', String(i));
            if (i === current) {
                tr.classList.add('np-current');
            }

            const td_icon = document.createElement('td');
            td_icon.className = 'col-icon';
            td_icon.innerHTML = `<span class="icon"><img alt="" src="${html_escape(item.icon_url || '')}"></span>`;
            // An icon that cannot be loaded: the link's first letter stands in its tile (.icon[data-letter] in theme.css)
            td_icon.querySelector('img').addEventListener('error', function (event) {
                event.target.parentElement.dataset.letter = letter_from_label(item.label);
            });

            const td_label = document.createElement('td');
            td_label.className = 'label';
            // A name too long for its cell is cut with an ellipsis: its full text is in the title
            td_label.title = item.label || '';
            // The row's link: the label is its text and it lies over the whole row (.rowlink in
            // theme.css), so a click, a middle click or a menu anywhere on the row is the link's
            const link = document.createElement('a');
            link.className = 'rowlink';
            link.href = item.href;
            link.textContent = item.label || '';
            link.addEventListener('click', function (event) {
                item_open(item, event);
            });
            td_label.appendChild(link);

            const td_href = document.createElement('td');
            td_href.className = 'href';
            td_href.textContent = item.href || '';

            tr.appendChild(td_icon);
            tr.appendChild(td_label);
            tr.appendChild(td_href);

            tbody.appendChild(tr);
        }
    }

    // The first letter or digit of a link's name, in capitals; ? for a name that has none
    function letter_from_label(label)
    {
        return (String(label).match(/[\p{L}\p{N}]/u)?.[0] ?? '?').toUpperCase();
    }

    // Through the runtime: every selected link, this one in place of the last. Ctrl, Shift and the
    // middle button on the link are left to the browser
    function item_open(item, event)
    {
        navplace.navigate(item, event);
    }

    function refresh()
    {
        refresh_rows(matches, current_index);
    }
</script>
</body>
</html>
```

### `designs/github/theme.css`

```css

/* Light on :root, dark on :root[data-theme="dark"]: /lib/theme_switch.js sets it and shows the switch */
:root {
    --bg: #f6f8fa;          /* main background */
    --panel: #ffffff;       /* inputs */
    --text: #1f2328;        /* primary text */
    --muted: #59636e;       /* secondary text */
    --line: rgba(31,35,40,.12);
    --hover: rgba(31,35,40,.04);
    --focus: rgba(9,105,218,.45);
    --focus-glow: rgba(9,105,218,.12);
    --surface: #ffffff;     /* the table */
    --head-bg: #f6f8fa;
    --icon-bg: rgba(31,35,40,.04);
    --icon-border: rgba(31,35,40,.10);
    --kbd-bg: rgba(31,35,40,.04);
    --row-outline: rgba(9,105,218,.35);
    --selected: rgba(9,105,218,.08);
    --current-bar: #0969da;
    --np-scrollbar-thumb: rgba(31,35,40,.28);
    --np-scrollbar-track: var(--bg);
    --np-switch-bg: var(--panel);
    --np-switch-fg: var(--muted);
    --np-switch-border: var(--line);

    --radius: 12px;
    --gap: 10px;
    --w: 920px;
    --rowh: 44px;

    --font: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto,
    Helvetica, Arial, "Apple Color Emoji","Segoe UI Emoji";
}

:root[data-theme="dark"] {
    --bg: #1a1d23;          /* main background (dark gray, not black) */
    --panel: #20242c;       /* inputs */
    --text: #e5e7eb;
    --muted: #9aa3b2;
    --line: rgba(255,255,255,.08);
    --hover: rgba(255,255,255,.05);
    --focus: rgba(255,255,255,.16);
    --focus-glow: rgba(255,255,255,.05);
    --surface: rgba(255,255,255,.02);
    --head-bg: rgba(255,255,255,.02);
    --icon-bg: rgba(255,255,255,.06);
    --icon-border: rgba(255,255,255,.08);
    --kbd-bg: rgba(255,255,255,.04);
    --row-outline: rgba(255,255,255,.10);
    --selected: rgba(255,255,255,.07);
    --current-bar: #6cb6ff;
    --np-scrollbar-thumb: rgba(255,255,255,.22);
}

* { box-sizing: border-box; }

html,
body { height: 100%; }

body {
    margin: 0;
    background: var(--bg);
    color: var(--text);
    font-family: var(--font);
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
}

.app {
    max-width: var(--w);
    margin: 0 auto;
    padding: 18px 14px 28px;
}

.topbar {
    position: sticky;
    top: 0;
    background: linear-gradient(
            to bottom,
            color-mix(in srgb, var(--bg) 92%, transparent),
            color-mix(in srgb, var(--bg) 78%, transparent)
    );
    backdrop-filter: blur(10px);
    padding: 10px 0 12px;
    border-bottom: 1px solid var(--line);
    z-index: 2;
}

.search {
    display: flex;
    gap: 10px;
    align-items: center;
}

.search input {
    width: 100%;
    height: 42px;
    border-radius: var(--radius);
    border: 1px solid var(--line);
    background: var(--panel);
    color: var(--text);
    padding: 0 12px;
    outline: none;
    font-size: 14px;
}

.search input::placeholder { color: var(--muted); }

.search input:focus {
    border-color: var(--focus);
    box-shadow: 0 0 0 4px var(--focus-glow);
}

.hint {
    margin-top: 8px;
    font-size: 12px;
    color: var(--muted);
    line-height: 1.3;
    user-select: none;
}

.table {
    margin-top: 14px;
    border: 1px solid var(--line);
    border-radius: var(--radius);
    overflow: hidden;
    background: var(--surface);
}

table {
    width: 100%;
    border-collapse: collapse;
}

thead th {
    text-align: left;
    font-weight: 600;
    font-size: 12px;
    color: var(--muted);
    letter-spacing: .02em;
    padding: 10px 12px;
    border-bottom: 1px solid var(--line);
    background: var(--head-bg);
}

tbody td {
    padding: 0 12px;
    height: var(--rowh);
    border-top: 1px solid var(--line);
    vertical-align: middle;
    font-size: 14px;
}

tbody tr:first-child td { border-top: none; }

/* ↑ stops a row below the stuck .topbar, not under it: the bar's padding (10px), the search box
   (42px), the hint (8px above it and a line of 12px text, as tall as the font makes it: taken as
   18px), the padding under it (12px) and the border */
tbody tr {
    position: relative;
    cursor: pointer;
    scroll-margin-top: calc(10px + 42px + 8px + 18px + 12px + 1px);
}

tbody tr:hover { background: var(--hover); }

/* The link ↑ ↓ moved to: Enter opens it */
tbody tr.np-current { background: var(--selected); outline: none; }

tbody tr.np-current td:first-child { box-shadow: inset 3px 0 0 var(--current-bar); }

tbody tr:focus-within { outline: 2px solid var(--row-outline); outline-offset: -2px; }

.col-icon { width: 44px; }

.icon {
    width: 22px;
    height: 22px;
    border-radius: 6px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: var(--icon-bg);
    border: 1px solid var(--icon-border);
    overflow: hidden;
}

.icon img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
}

/* An icon that cannot be loaded leaves the link's first letter in its tile: the picture keeps its
   room, unseen, and the letter lies over it, so nothing moves */
.icon[data-letter] { position: relative; }

.icon[data-letter] img { visibility: hidden; }

.icon[data-letter]::after {
    content: attr(data-letter);
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text);
    font-size: 12px;
    font-weight: 600;
}

.label {
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 1px; /* helps ellipsis in table cells */
}

.href {
    color: var(--muted);
    font-size: 13px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 1px; /* helps ellipsis in table cells */
}

/* The row's link: the label is its text, and its ::after lies over the whole row, so the row is
   one link to the mouse while the table keeps its cells */
.rowlink {
    color: inherit;
    text-decoration: none;
}

.rowlink::after {
    content: "";
    position: absolute;
    inset: 0;
}

/* Tab on a link rings its row */
.rowlink:focus-visible { outline: none; }

.rowlink:focus-visible::after {
    outline: 2px solid var(--current-bar);
    outline-offset: -2px;
}

.empty {
    padding: 16px 12px;
    color: var(--muted);
    font-size: 13px;
    display: none;
}

.kbd {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
    font-size: 12px;
    border: 1px solid var(--line);
    background: var(--kbd-bg);
    border-radius: 8px;
    padding: 2px 6px;
    color: var(--text);
}
```

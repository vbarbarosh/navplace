# NavPlace reference

Every rule and every edge case of NavPlace, in full: the format, the desktop app, the designs, the embed widget, the Playground and the code. The short guide for people is the site's docs page, https://navplace.com/docs.html; this file carries what that page said in full before, and is kept up from here on.

## Goals

- **Primary:** navigate to the right place in a couple of keystrokes, dozens of times a day.
- **Secondary:** render the same file as widgets and web pages.

NavPlace is a starting point, not a destination. Every option starts on screen; a few letters narrow them; Enter opens the one left on top.

### Approaches

- **Plain text is the source.** A name and a url per line. No JSON, no YAML, no editor needed.
- **One parser.** `lib/parse.js` reads the text in the desktop app and in every design, so a collection behaves the same everywhere.
- **A design is a folder.** `designs/<name>/index.html`, switched by one line: `% design: <name>`.
- **The window never waits.** In the desktop app, the hotkey shows the window first and reloads the links behind it.
- **No build step.** Designs and `lib/` are plain files, served as they are.

## One source, three surfaces

| Surface | Links come from | For |
|---|---|---|
| Desktop app | `~/.navplace/README.md` | Daily navigation: hotkey, a few letters, Enter. |
| Embed widget | The `data-links` attribute of its script tag | A page, or a part of one, on any site. |
| Playground | Its text, kept in this browser | Trying the format and the designs, then copying the embed code or opening it in CodePen. |

The [Playground](https://navplace.com/playground.html) is the quickest way to try it: pick a design, edit the links, see the preview, then copy the embed code or open it in CodePen. A link to `playground.html?design=cards` opens it with that design picked. It has three tabs over the same work: **Basic** is the text and the preview; **Advanced** colours the links and shows the JSON of the line the cursor is on, or under **File** of the whole file, editable both ways; **Design code** edits the design's own files beside the preview. Under Advanced and Design code, an errors panel names the line each error came from, and in orange each line that was skipped with a warning, which is underlined in the text with why after it. Ctrl+V with a picture on the clipboard, a screenshot or a copied image file, adds `% picture image1: data:…` on a new last line, its name selected to rename; on a link's line, the link takes `@image1` too, in place of the picture it had. A copied file gives its own name, and a name already taken gets 2, 3, 4. Renaming a picture, on its `% picture` line or in a link's `@name`, renames it everywhere, and one Ctrl+Z takes back both; a link given another picture's name shows that picture instead. A failed load stays in the errors panel only while the text still has that picture. A pasted picture is first made again as WebP, AVIF, JPEG and PNG, away from the page in a worker; a panel under the text shows each format's size as it comes, the smallest goes in, and a click on another puts that one in its place. The formats are drawn at most 400 px on their longest side, twice a 200 px tile, so a 2× screen shows them sharp. Presets (Tile 2×, Wide tile 2×, Icon 2×, Large 2×) and the **Quality** and **Longest side** sliders make them again from the picture as it was pasted, a bar showing how far it has got, and the text takes the new one of the same format. When none fits 100 KB as a data url, the smallest is drawn smaller until it does. **Shrink pictures** does the same for every `data:` picture already in the text but SVG, and takes a smaller format where it saves 5% or more, in one edit that one Ctrl+Z takes back. Drag the lines between the panes to resize them; each tab keeps its sizes.

## Desktop app

An Electron app that hosts one design full-window and feeds it your links. Its own interface is one settings window; the rest of what you see is the design. It is built as a Linux AppImage only.

### Install

Download the AppImage from [releases/latest](https://github.com/vbarbarosh/navplace/releases/latest).

```sh
chmod +x NavPlace-*.AppImage
./NavPlace-*.AppImage
```

### First run

- The app reads `~/.navplace/README.md`. When the file is missing it writes a starter one: `% design: github` and eight links (ChatGPT, GitHub, Gmail, Google Calendar, Google Drive, MDN, Node.js, Electron).
- `% design:` picks the folder under `designs/`. Absent, or not one of them: `github`. It is read again at every press of the hotkey.
- The window is 1200 × 1000, centred. It starts always on top and zoomed to 125%; the settings change both. Its title is the design's title and the app's version.
- It hides when it loses focus, unless the settings say otherwise, and stays running, so the hotkey brings it back at once. Closing it quits the app.
- Links open in your default browser. Besides `http://` and `https://` ones the app opens a plain `mailto:` address, in the mail program, and a `file://` link of your own file; any other kind of address is skipped.
- The gear beside the design's theme switch opens the settings: the links file in an editor, the design, the GNOME setup, the hotkey, start at login, zoom, always on top, hiding on lost focus, and a check for updates.
- A start that fails says why in an error box.

### Global hotkey on GNOME

```sh
./NavPlace-*.AppImage --configure-gnome
```

Run it once, from the AppImage itself (it needs the `APPIMAGE` variable the AppImage runtime sets) with `node` on `PATH`. The settings window runs the same setup from its **GNOME setup** row, which also says what is set up now: the keys that open NavPlace and whether it starts at login. It:

1. copies the launcher to `${XDG_CONFIG_HOME:-~/.config}/navplace/launcher.js`;
2. binds **Ctrl+Shift+Alt+N** to it through `dconf`: the command is `node`'s absolute path and the launcher;
3. writes `${XDG_DATA_HOME:-~/.local/share}/applications/navplace.desktop`, which starts the AppImage;
4. writes `${XDG_CONFIG_HOME:-~/.config}/autostart/navplace.desktop`, which starts the AppImage at login with `--background`: its window stays hidden until the hotkey;
5. notes its version and the AppImage's path in `${XDG_CONFIG_HOME:-~/.config}/navplace/setup.json`;
6. prints the launcher path, the AppImage path, the `node` it found and the login entry.

Both entries hold the AppImage's path in quotes. When an AppImage at another path starts, a newer one after an update, it points both at itself. Started from another folder than the version it replaces, a download run where it landed, it first asks whether to move there: **Move it there** puts the file beside the old one, under its own name and never over a file that is there; **Leave it here** keeps it where it is. Either way the old file stays, the entries follow the new one, and the next start asks nothing. Nothing is asked at a start with `--background`, or when that folder cannot be written to. The settings window changes the keys and switches the start at login off and on.

The rest of the setup follows a new version by itself, once, at its first start: the launcher copy is written again when it is not the new version's, and a hotkey command from a setup of 1.4.2 or older, the launcher alone, becomes `node`'s absolute path and the launcher. Your keys stay as they are, a shortcut you removed is not made again, and a login entry you switched off stays off. A piece that cannot be done, `node` missing from the app's `PATH` for one, is a line in the log and is tried again at the next start.

Only GNOME is wired up. The launcher is plain Node, so any hotkey tool can run it, but its cold start calls `gtk-launch navplace`, which needs that desktop entry. A build from source has its own script for the AppImage in `src/desktop-electron/build/`: `src/desktop-electron/bin/configure-gnome`.

### Instant launch

1. The hotkey runs `launcher.js`: Node built-ins only, no Electron, no AppImage to mount.
2. It connects to `${XDG_CONFIG_HOME:-~/.config}/navplace/navplace.sock`.
3. The running app shows its window, focuses it and clears the search box.
4. No socket: `gtk-launch navplace` starts the app once. From then on the hotkey only pings the socket.

A second start of the same AppImage shows the running window instead of opening another one. A start of another AppImage file, or of another version, takes the running one's place: the running one quits and the new one starts, so a downloaded update only has to be run.

**The window never waits.** Each press of the hotkey reloads the links in the background: the window shows what it already has and the design redraws when the new links arrive. At startup the app reads the file once before the window opens, because its `% design:` decides what to load. A design named since is loaded at the next press. `% include:` urls always come after the window is up. Measured with an include url delayed by 3 seconds, under Xvfb: window up in 569 ms, the hotkey answered in 4 ms, the pulled links in 3597 ms. Details: [docs/instant-launch.md](https://github.com/vbarbarosh/navplace/blob/master/docs/instant-launch.md).

### Chrome on Wayland

With several workspaces, Chrome on Wayland can open a link in a window on another workspace. When Google Chrome handles http and https links, the app first focuses a Chrome window on the current workspace (else the most recently raised one), then opens the link. It needs the optional GNOME extension [Window Calls](https://extensions.gnome.org/extension/4724/window-calls/); without it, or outside a Wayland session, links open as Chrome decides. Details: [docs/wayland-chrome-window.md](https://github.com/vbarbarosh/navplace/blob/master/docs/wayland-chrome-window.md).

<a id="network-gate"></a>
### What a design can reach

The window cancels every request except these: `app://favicon/`, `blob:`, `chrome://`, `chrome-devtools://`, `data:`, `devtools://`, `file://`, `navplace://app/`, `private://`, and `app://picture/`. Remote fonts, scripts and images do not load in the desktop app. A page is refused every permission but writing to the clipboard, and the window never leaves its page: a link that would load in it opens in the browser.

- `app://favicon/<host>?letter=<L>`: the app finds the icon once, as navplace.com's `/icon/` does (`lib/icon_find.js`: navplace's own in `lib/icons/`, then the page's icon links, `/apple-touch-icon.png`, `/favicon.ico`, then Google's), and keeps it in its user data folder; for a site with none, a tile of the link's first letter on a colour of that site.
- `app://picture/<key>`: a picture a `% picture` line names by a web url, the app's kept copy of it ([below](#name-images)). The key is a hash of the url; a page cannot ask for an address of its own.
- `private://<path>`: a file under `~/.navplace/`, nothing outside it. `.svg` is sent as `image/svg+xml`, anything else as `image/png`.
- `navplace://app/…`: the app's own `designs/`, `lib/` and settings page, nothing outside them. A design's `/lib/…` is the app's copy there.

## Format

A NavPlace document is plain text. One line is one thing; the first character of a line decides what. Leading spaces are ignored.

### Legend

| Part of a line | What it is |
|---|---|
| `% design: showcase` | a directive for the whole document, own line |
| `# GitHub` | a section for the links below, own line |
| `\| Work` | `\|` one more name, also in `% ns:` |
| `Gmail` | the label |
| `#mail` | a tag, searchable |
| `#padding=1` | a value for the design |
| `@img/gm.png` | a picture, `~/.navplace/img/gm.png` |
| `https://mail.google.com/` | the url, ends the line |

Anything else is skipped without a message.

### Example

```text
% design: showcase
% title: Vladimir Barbarosh

# GitHub | Work
node-helpers                                     https://vbarbarosh.github.io/node-helpers
vue-modal          #frontend                     https://vbarbarosh.github.io/vue-modal
Gmail              #mail #padding=1 @img/gm.png  https://mail.google.com/
                                                 https://www.linkedin.com/in/vbarbarosh/
```

- `% design:` picks the design. `% title:` hands it free text.
- `# GitHub | Work` puts the four links below it in two sections.
- `#frontend` and `#mail` are tags. `#padding=1` reaches the design as `meta.padding`.
- `@img/gm.png` shows `~/.navplace/img/gm.png` next to Gmail.
- The last link has no label. It becomes `www.linkedin.com/in/vbarbarosh/`.

### `% key: value` — directives

| Directive | Effect |
|---|---|
| `% design: x` | A folder name under `designs/`. When absent: `github` in the desktop app, `basic` in the embed widget. |
| `% title: x` | Text for the design's title element. |
| `% subtitle: x` | Text for the design's subtitle element. |
| `% email: x` | Text for the design's email element; when that element is a link, a plain mail address becomes its `mailto:` address and anything else is shown as text with no link. |
| `% ns: a \| b` | Keeps only the links that sit under a section named `a` or `b`. |
| `% picture name: u` | Names a picture for `@name`: `u` is an `https://`, `http://` or `data:image/` url. Repeatable, one name per line. |
| `% include: u` | Desktop app only. Pulls the document at url `u` and appends its links. |
| `% other: x` | Free. A design can map any key to an element of its own. |

- A directive is valid anywhere in the file, not only at the top.
- The value is required. `% oops` is skipped with a warning; the rest of the file still parses.
- The same key twice: the last one wins (`% include:` adds up instead).
- Keys keep their case. `% Design:` and `% design:` are two keys.
- `% title:`, `% subtitle:` and `% email:` reach the design on the web and in the desktop app. Without one, the design keeps its own text and link there; taking one out of the file puts them back.

### `% include:` — pulling other documents

Desktop app only. The embed widget and the designs on the web read the directive and do nothing with it.

```text
% include: https://example.com/links.md #work #prefix=ACME
```

The url first, then optional decorations for every pulled link:

| Option | Effect |
|---|---|
| `#tag` | Adds a tag. Repeatable. |
| `#prefix=x` | Puts `x` and a space in front of every pulled label. |
| `#suffix=x` | Puts a space and `x` after every pulled label. |

- Values hold no spaces. Unknown options are ignored.
- Repeatable: every line adds one source, in file order; pulled links land after the local ones.
- The url must return the document as plain text over `http://` or `https://`; any other url is skipped.
- A pulled document gives links and sections only. Its own directives are dropped, so it cannot switch the design, set the title, apply `% ns:` or pull a third document.
- Its `% picture` lines stay, and they are its own: `@logo` in a pulled document is the picture that document names, whatever your file or another pulled one calls `logo`. An `@name` it names no picture for shows none: the files under `~/.navplace/` are for your own links.
- The `% ns:` of the pulling document filters local and pulled links alike.
- The prefix and the suffix are part of the label, so typing the prefix finds the pulled links.
- The request carries no access token.
- The urls are pulled side by side. Each gets 5 seconds and 2 MB of text.
- A url that fails is logged, and its last good text, kept by the app, stands in for it; with none kept it is skipped. The rest still loads.
- No pull runs in front of the window: it opens on the local links and redraws when the pulled ones arrive.

### `# Section` — sections

A section applies to every link line below it, until the next section. A blank line does not end it. Sections are metadata: `% ns:` filters on them, and a design can read `item.namespaces`. In this repo `cards` shows them as categories, and `basic` and `first` start a new row at each.

```text
# Work | Internal
```

One line, two names. Two heading lines in a row join into one, with a space between them: `# Work` then `# Fun` gives one section named `Work Fun`. To start a new section, put a link line or a blank line between them.

### `label  url` — links

The url ends the line. `http://`, `https://` and `file://` are recognised. Spaces between the label and the url are free: align the columns as you like.

A `file://` link opens in the desktop app, and only when it is a link of your own file, not of a pulled one: a folder or a plain file in the system's program for it, a program (an executable file, a `.desktop`, `.sh`, `.AppImage` and the like) shown in its folder, not run. A browser refuses such a link from a web page.

The label is optional. Without one, the link is named by its url as you wrote it, in its own letters: without the `https://`, without what follows a `?` or a `#`, and without the `/` that stands alone after the host. `https://github.com/` is `github.com`, and `https://пример.рф/путь?стр=2` is `пример.рф/путь`. An escape such as `%D0%BF` is shown as the letter it stands for, `п`.

### `#tag` and `#key=value`

Both live inside a link line, before or after the label, and both drop out of the label. Tags join the label in the search text. `#key=value` pairs do not; they reach the design as `item.meta.key`. Designs in this repo read `padding`, `domain`, `description` and `category` this way.

Names accept `a..z`, `A..Z`, `0..9`, `_` and `-`. Both start a word: a `#` inside a word, as in `F#minor`, stays in the label. A value runs to the next space, so it can hold a `#`, as in `#color=#fff`; `#key=` is a key with an empty value.

<a id="name-images"></a>
### `@name` — images

`@name` must stand right before the url, after a space, or open a line with no label. When the file names it with `% picture name:`, the link gets that url; anywhere in the file will do, the end too. Otherwise it points at a file under `~/.navplace/`: the parser turns it into `private://name`, which only the desktop app serves. In the Playground, Ctrl+V with a picture on the clipboard writes the `% picture` line for you. Designs that show artwork use `item.image_url` and fall back to `item.icon_url`.

```text
Kimi    @kimi   https://kimi.com/
Grafana @board  https://grafana.com/

% picture kimi: data:image/png;base64,iVBORw0KGgo…
% picture board: https://example.com/img/board.jpg
```

- The desktop app fetches a picture from the web once and keeps it: the design shows the kept copy, with no network too. It asks over `https`, a public host only, and keeps a picture of 5 MB at most (PNG, JPEG, GIF, WebP, AVIF, ICO, or an SVG with no script). Anything else leaves the link without its picture; the log says why. A picture that failed is asked again at a later press of the hotkey, a minute apart at least. To fetch a kept one again, change its url.
- `% picture background:` is the picture behind the links. The designs with a photo of their own, `basic` and `first`, show yours in its place, and keep their own when yours does not load; the others have no picture behind their links and stay as they are. A link written `@background` gets the same picture on its tile. In a file pulled by `% include:`, it is a picture for that file's own `@background` links only.
- The same name twice: the last one wins. A line with no name before the colon, or with a value that is not one of the three kinds of url, is skipped with a warning, and `@name` stays a file under `~/.navplace/`.

<a id="what-a-link-becomes"></a>
### What a link becomes

The `%` lines go into one `meta` object for the whole document; each link line becomes an object of `items`. A line that does not parse is skipped and named in `warnings`, `{line, text, message}`, which is there only when there are any. Below, what `lib/parse.js` makes of this text, run in Node, as the desktop app runs it; on navplace.com `icon_url` is `/icon/gmail.com`:

`links.txt`:

```text
% design: showcase
% title: Jane Doe
% email: jane@example.com

# Work | Mail
Gmail #mail #padding=1 @gm.png https://gmail.com/
Почта #mail https://ya.ru/
```

`parse(text)`:

```json
{
  "meta": {
    "design": "showcase",
    "title": "Jane Doe",
    "email": "jane@example.com"
  },
  "items": [
    {
      "label": "Gmail",
      "href": "https://gmail.com/",
      "icon_url": "app://favicon/gmail.com?letter=G",
      "image_url": "private://gm.png",
      "tags": ["mail"],
      "meta": {"padding": "1"},
      "search1": "gmail mail",
      "search2": "https://gmail.com/",
      "namespaces": ["Work", "Mail"]
    },
    {
      "label": "Почта",
      "href": "https://ya.ru/",
      "icon_url": "app://favicon/ya.ru?letter=%D0%9F",
      "image_url": null,
      "tags": ["mail"],
      "meta": {},
      "search1": "pochta mail",
      "search2": "https://ya.ru/",
      "namespaces": ["Work", "Mail"]
    }
  ]
}
```

| Field | From |
|---|---|
| `label` | What is left of the line after the url, tags and image are removed. |
| `href` | The url. |
| `icon_url` | `app://favicon/<host>?letter=<L>` in the desktop app, `/icon/<host>` on navplace.com (its own icons, for its own pages only), `https://icon.horse/icon/<host>` elsewhere. A host that is not public (an address, a port, `localhost`, a private name such as `wiki.corp.internal`) is never named to another site: the desktop app asks that host itself for its icon, navplace.com answers a tile, and elsewhere it gets a letter tile, a `data:` url. |
| `image_url` | From `@name`: the url of `% picture name:` when the file has one, else `private://<name>`; `null` without `@name`. In the desktop app a web url comes as `app://picture/<key>`, the app's kept copy. |
| `tags` | Every `#tag` on the line. |
| `meta` | Every `#key=value` on the line. |
| `search1` | Label and tags, lower case, Cyrillic transliterated to Latin. |
| `search2` | The url, same treatment. |
| `namespaces` | The names of the section above the line. |

### Gotchas

- The url must end the line. Text after it drops the whole line.
- A line that starts with `#` is a section, never a link. Put tags after the label.
- `@name` needs a space in front of it, or the start of the line. In `Kimi@kimi https://…` it stays in the label.
- Tag names are ASCII. `#дев` stays in the label as plain text.
- A line with no url is skipped in silence. A broken `%` line is skipped with a warning.
- There is no comment syntax: `%` starts a directive.

## Filtering

Type a few letters and press Enter: the top match opens.

- The list shows the links that match what you typed: matches in the label and tags (`search1`) first, then matches in the url (`search2`).
- Capital letters do not matter: `Git` and `git` find the same links.
- Cyrillic letters are read as Latin ones, in the links and in what you type: `git` and `гит` both find an item labelled `Гитхаб`.

### Several links at once

Separate words with spaces. Each word is an expression of its own and picks its top match; Enter opens all of them. `gh mail cal` opens three links. The list shows the matches of the last word. A click on a link opens it together with the top matches of the words before the last. On the web the last link takes the page's place and the others open in new tabs; when the browser blocks pop-ups only the first of those tabs opens, until pop-ups are allowed for the site.

### Search expressions

| Input | Matches |
|---|---|
| `git` | Contains `git`. |
| `^git` | Starts with `git`. |
| `git$` | Ends with `git`. |
| `!git` | Does not contain `git`. |
| `git/api` | Contains both `git` and `api`. |
| `gh mail` | Two expressions. Enter opens the top match for each. |

The operators combine inside one expression: `^git/!api` starts with `git` and does not contain `api`.

Each part looks at the label, at each tag and at the url. A plain part may be found in any of them, and the parts of one expression in different ones: `git/api` finds a link labelled `Git` with `api` in its url. `^` and `$` mean the start and the end of the label, of a tag or of the url, so `hub$` finds `GitHub #dev`. `!git` leaves out every link with `git` in any of them.

## Designs

A design is a folder under `designs/` with its own `index.html`; the parser gives it the links and the design decides how to draw them. Most folders also carry a `links.txt`, the sample the Playground loads and the home page shows the design with; a few a `theme.css`.

| Kind | Designs |
|---|---|
| Launchers: a search box on top, a dense list below; best in the desktop app | `github` (the desktop default), `palette` (a command palette for the hotkey), `basic` (the embed default), `first` (the very first page, from a CodePen, with its own links), `google-chrome`, `basic-for-internal2`, `basic-for-internal3-with-groups` |
| Presentation: themed pages, content first | `showcase`, `cards` (sections as categories), `basic-for-portfolio`, `basic-for-kids`, `basic-for-kids2`, `basic-for-recipes` |

### Writing a design

```html
<script src="/lib/navplace.js"></script>
<script>
    navplace({
        input: 'input[type=search]',
        update: function (items, {current}) {
            // draw items: the filtered list, best match first;
            // the element of items[current] gets the class np-current
        },
        meta: {title: '.title', email: 'a.email'},
    });
</script>
```

- `input`: the search box, a selector or an element. Typing anywhere on the page focuses it.
- `update(items, {current})`: called with the filtered list whenever it or the current link changes. Each item has the fields in [What a link becomes](#what-a-link-becomes).
- `items[current]` is the current link: ↑ and ↓ move it, Enter opens it, and the design gives its element the class `np-current`. With no links `current` is −1.
- `navplace.order_set(shown)`: for a design that shows other links than it was given, or in another order (a section picked, links grouped); ↑ ↓ and Enter then walk `shown`. `navplace.current_set(index)` makes the link at that place the current one, a row under the mouse for one.
- `meta`: maps directive keys to elements; the runtime writes the value into each element's text. A key the file does not have leaves the element as the design wrote it.
- `navigate(item)`: optional; called for each link Enter opens, in place of opening it. No design in this repo passes it.
- Clicks call `navplace.navigate(item, event)`, so a click opens the selection of several words too. A click on a link with Ctrl, Cmd, Shift or the middle button stays the browser's.
- `/lib/theme_switch.js`, loaded in `<head>`, gives the design its light and dark theme: `data-theme` on `<html>` and the switch.
- Fonts, scripts and images ship inside the folder or inline: the desktop app [blocks remote requests](#network-gate).
- `bin/build` fails for a design without `/lib/theme_switch.js` or `np-current`, with a script that does not parse, or naming a file that is not there.

The same file runs in the desktop app (links from `window.ElectronApp`), inside the embed widget and in the Playground (links by `postMessage`). The full guide for writing one: [docs/DESIGN.ai.md](https://github.com/vbarbarosh/navplace/blob/master/docs/DESIGN.ai.md).

To work on one, open the Playground's **Design code** tab: the `% design:` line opens the design's folder there, a tab per file, and every edit redraws the preview. The edits stay in the browser until **Load** brings a design's files back; copy them into `designs/<name>/` to keep them.

<a id="embed"></a>
## Embed widget

One script tag puts a collection on any page.

```html
<div style="position: fixed; inset: 0;">
    <script src="https://navplace.com/lib/embed.js" data-links="
% design: showcase
% title: My links

# Work
GitHub  https://github.com/
Gmail   https://mail.google.com/
"></script>
</div>
```

The script puts an iframe right after itself, 100% wide and tall: give its parent the size the widget should have.

| Attribute | Effect |
|---|---|
| `data-links` | The collection's text; its lines may be indented. An empty one shows no links; with no `data-links` at all the design shows its three sample links. |
| `data-design` | Overrides `% design:`. Default `basic`. |
| `data-src` | A url to load in the iframe instead of the design's page. |
| `src` | The design is found next to it: `<folder of embed.js>/../designs/<design>/index.html`. |

### How it talks to the design

| Message | Direction | When |
|---|---|---|
| `{type: 'navplace:ready'}` | design → page | The design's runtime has loaded. |
| `{type: 'navplace:items-text', text}` | page → design | The answer to ready: the `data-links` text. |
| `{type: 'navplace:focus', key}` | page → design | A character typed on the host page while nothing there has the focus: the design focuses its search box and types the character. A field, a button or a link of the host page keeps its keys; so do Space and the shortcuts with Ctrl, Alt or Cmd. |

The links text goes to the design's own origin only, and the design hears only the page around it. Links open in the top window. The widget shows only its own `data-links`: `% include:` does nothing here.

<a id="libraries"></a>
## Libraries

The shared code in `lib/`: plain files with no build step, loaded by the desktop app, the designs and the site.

| File | Role |
|---|---|
| `parse.js` | The parser: text in, `{meta, items}` out. A Node module and a browser global. Its options `{prefix, suffix, tags, ns}` serve `% include:`; `{spans: true}` adds each link's line and where its parts sit in it, for the Playground. |
| `filter1_from_spec.js` | Compiles one search expression (`^`, `$`, `!`, `/`) into a test; a copy from [node-helpers](https://github.com/vbarbarosh/node-helpers). |
| `items_search.js` | What the search box's text finds among the links: the list to show and the top link of each word. A Node module and a browser global, with tests in `items_search.test.js`. |
| `plural.js` | The phrase for a count, `plural(n, '# link', '# links')`; a copy from [node-helpers](https://github.com/vbarbarosh/node-helpers), loaded by the playground and the designs that count. |
| `icons/`, `icon_find.js`, `icon_library_file.js`, `is_public_domain.js` | A link's icon, for navplace.com's `/icon/` and the desktop app: navplace's own icons first (`icons/`, 120 sites, an SVG or a picture of 96 px and more, `icons/index.json` by domain; a subdomain takes its parent's), then the site's own, then Google's. A host that is not public (`is_public_domain.js`: an address, a port, one label or a private ending such as `.local`) is asked itself only, over https, and only by the desktop app: navplace's icons, Google and any other host never hear its name, and `/icon/` looks nothing up for it. |
| `navplace.js` | The runtime every design loads: the search box, filtering, the selection, ↑ ↓, Enter and clicks, the embed messages, and the items from `window.ElectronApp` in the desktop app. It loads `filter1_from_spec.js`, `parse.js` and `items_search.js` from its own folder. |
| `embed.js` | The [embed widget](#embed). |
| `theme_switch.js` | The light and dark theme of every design, loaded in its `<head>`: `data-theme` on `<html>`, the switch, thin scrollbars, and in the desktop app the gear that opens the settings. |
| `colours.js` | The coloured layers of the Playground and of the desktop app's settings; this page and the home page colour their examples with it. |
| `line_from_item.js` | Writes an edited link back into its line, part by part, for the Playground's JSON; what did not change keeps its place. Tests in `line_from_item.test.js`. |
| `vendor/` | Vue and smcss for the designs that use them, and the AVIF encoder of the Playground's pictures; a folder per major version. |
| `parse.test.js` | The parser's tests (mocha, `npm test`). |
| `parse.cli.js` | Parses a sample and prints the result. |

In the desktop app, `window.ElectronApp` (from `src/desktop-electron/renderer.js`) gives a design `api_items_all()`, the collection now, and `api_items_changed(callback)`, called with each new one; it returns a function that stops the calls. `api_file_open(href)` asks the app to open a `file://` link, which a page cannot do itself: `navplace.navigate` calls it, and the app opens the link when your own links file lists it. `api_ping()` answers `pong <time>`. `settings_open()` opens the app's settings: `/lib/theme_switch.js` calls it from the gear it puts beside the theme switch, in the app only.

## How it's built

| Folder | Holds |
|---|---|
| `lib/` | The shared code: [Libraries](#libraries). |
| `designs/` | One folder per design. |
| `src/desktop-electron/` | The desktop app. |
| `src/cloudflare/` | The Worker on navplace.com: the site's files from `build/www/` and `/icon/`; anything else is a 404. |
| `src/www/` | The site: the home page, the Playground, these docs. |
| `docs/` | The documentation in markdown: the product brief, the guide for writing designs, the desktop app, instant launch, Chrome on Wayland. |
| `notes/` | Working notes: the prompts for new designs, similar projects, findings. |
| `demos/` | Standalone pages that embed a design. |
| `bin/` | Scripts: `configure`, `build`, `self-check`, `deploy-www`, `test`. |

### The desktop app

- `main.js`: the window, loading `~/.navplace/README.md` and its includes, the socket the launcher pings, the single-instance lock, the `private://`, `app://` and `navplace://` protocols, the network gate, the settings window.
- `launcher.js`: the hotkey side; Node built-ins only.
- `renderer.js`: the preload that gives designs `window.ElectronApp`.
- `settings/`, `settings_preload.js`: the settings window's page and its preload.
- `helpers/`: `collection_resolve_includes` and `include_spec_from_text` for `% include:`, `make_picture_store` and `picture_pull` for the pictures from the web, `gnome_configure`, `chrome_window_focus`, `make_socket_server`.

### The site

- `bin/build` puts the site together in `build/www/`: `src/www/`, `lib/` without the tests, the CLI and `is_public_domain.js`, `designs/`, and `designs/index.json`, the Playground's list of designs with the files of each. It ends with `bin/self-check`: every built script must parse, and every file a page names must be there.
- The picture a chat shows for a link, `cover-1200x630.jpg`, is the home page photographed: `bin/cover` takes it again from the live site.

## Development

```sh
# after every git pull: the packages, and the desktop app's sandbox
bin/configure

# the tests of lib/ and the Worker
bin/test

# the static site, into build/www/, then its self-check
bin/build

# the picture of a shared link, taken again from the live home page
bin/cover

# the desktop app from source
src/desktop-electron/bin/run      # run it
src/desktop-electron/bin/test     # the helpers' tests
src/desktop-electron/bin/build    # the AppImage, into src/desktop-electron/build/
```

## FAQ

### Which platforms does the desktop app run on?

Linux, as an AppImage. The global hotkey is set up for GNOME only.

### Where are my links?

Desktop app: `~/.navplace/README.md`. Embed widget: in its `data-links`. Playground: in this browser. There is no server: `% include:` pulls links into the desktop app from any url.

### Can the desktop app show several collections?

It reads one source. `% include:` pulls other documents into it.

### Why does my design look different in the desktop app?

The desktop app blocks remote fonts, scripts and images. Ship them inside the design's folder or inline them.

### Does the embed widget follow changes to my links?

No. It shows the text in its `data-links`.

### Is it open source?

Yes, MIT: [LICENSE](https://github.com/vbarbarosh/navplace/blob/master/LICENSE).

## Status and contributing

- Known issues: [notes/chrome-external-links.md](https://github.com/vbarbarosh/navplace/blob/master/notes/chrome-external-links.md).
- Issues and pull requests: [github.com/vbarbarosh/navplace](https://github.com/vbarbarosh/navplace).

# NavPlace format legend

A NavPlace document is plain text. One line is one thing. The first character
of a line decides what that thing is.

The same parser (`lib/parse.js`) reads the file for every surface: the Electron
app (`~/.navplace/README.md`), the web app (a stored collection), and the embed
widget (`data-links`).

## Legend

| Symbol         | Where                         | Means                                   |
|----------------|-------------------------------|-----------------------------------------|
| `% key: value` | own line                      | A directive for the whole document.     |
| `# Section`    | own line                      | A section for every link line below it. |
| `\|`           | in `# Section`, in `% ns:`    | Separates names.                        |
| `label  url`   | own line                      | One link. The url ends the line.        |
| `#tag`         | inside a link line            | A tag. Searchable.                      |
| `#key=value`   | inside a link line            | A value for the design. Not searchable. |
| `@name`        | before the url, after a label | An image at `~/.navplace/name`.         |

Anything else is skipped without a message.

## Example

```
% design: showcase
% title: Vladimir Barbarosh

# GitHub | Work
node-helpers                                     https://vbarbarosh.github.io/node-helpers
vue-modal          #frontend                     https://vbarbarosh.github.io/vue-modal
Gmail              #mail #padding=1 @img/gm.png  https://mail.google.com/
                                                 https://www.linkedin.com/in/vbarbarosh/
```

Line by line:

- `% design:` picks the design. `% title:` hands it free text.
- `# GitHub | Work` puts the four links below it in two sections.
- `#frontend` and `#mail` are tags. `#padding=1` reaches the design as `meta.padding`.
- `@img/gm.png` shows `~/.navplace/img/gm.png` next to Gmail.
- The last link has no label. It becomes `www.linkedin.com/in/vbarbarosh/`.

## `% key: value` — directives

| Directive      | Effect                                                                      |
|----------------|-----------------------------------------------------------------------------|
| `% design: x`  | A folder name under `designs/`. The embed widget uses `basic` when absent.  |
| `% title: x`   | Text for the design's title element.                                        |
| `% email: x`   | Text for the design's email element. `showcase` also copies it into `href`. |
| `% ns: a \| b` | Keeps only the links that sit under a section named `a` or `b`.             |
| `% include: u` | Desktop app only. Pulls the document at url `u` and appends its links.      |
| `% other: x`   | Free. The design reads it as `meta.other`.                                  |

Rules:

- A directive is valid anywhere in the file, not only at the top.
- The value is required. `% oops` stops the parse with an error.
- The same key twice: the last one wins.
- Keys keep their case. `% Design:` and `% design:` are two keys.

## `% include:` — pulling other documents

Desktop app only. The web app and the embed widget read the directive and do
nothing with it.

```
% include: https://example.com/links.md #work #prefix=ACME
```

The url comes first, then optional decorations for every pulled link:

| Option      | Effect                                               |
|-------------|------------------------------------------------------|
| `#tag`      | Adds a tag. Repeatable.                              |
| `#prefix=x` | Puts `x` and a space in front of every pulled label. |
| `#suffix=x` | Puts a space and `x` after every pulled label.       |

Values hold no spaces — the rule item lines already follow. The separating space
is added for you. Unknown options are ignored.

Rules:

- The directive is repeatable. Every line adds one source, in file order, and
  pulled links land after the local ones.
- The url must return the document as plain text over `http://` or `https://`.
- A pulled document contributes links and sections only. Its own directives are
  dropped, so it cannot switch the design, apply `% ns:`, or pull a third document.
- The pull happens first and `% ns:` runs after it. The filter of the pulling
  document gates local and pulled links alike.
- The prefix and the suffix reach the search text: typing the prefix finds the
  pulled links.
- The request carries no access token, unlike `collection_url` in
  `~/.navplace/settings.yaml`. An include url is a stranger.
- A url that fails is logged and skipped, and the rest of the collection still
  loads. Each url gets 5 seconds before it is abandoned.
- No pull ever runs in front of the window. It opens on the local links and
  redraws when the pulled ones arrive — see [The window never waits](instant-launch.md).

## `# Section` — sections

A section applies to every link line below it, until the next section. A blank
line does not end it. Sections are metadata: no design in this repo draws them.
`% ns:` filters on them, and a design can read `item.namespaces`.

```
# Work | Internal
```

One line, two names.

Two heading lines in a row join into one block, with a space between them:
`# Work` followed by `# Fun` gives a single section named `Work Fun`. To start
a new section, put a link line or a blank line between them.

## `label  url` — links

The url ends the line. `http://`, `https://` and `file://` are recognized.
Whitespace between the label and the url is free — align the columns however
you like.

The label is optional. Without one, NavPlace builds it from the url: the host,
plus the path when the path is not `/`.

## `#tag` and `#key=value`

Both live inside a link line, before or after the label, and both drop out of
the label. Tags join the label in the search text. `#key=value` pairs do not;
they reach the design as `item.meta.key`. Designs in this repo read
`padding`, `domain`, `description` and `category` this way.

Names accept `a..z`, `A..Z`, `0..9`, `_` and `-`. A value runs to the next
space or `#`.

## `@name` — images

`@name` points at a file under `~/.navplace/`. The parser turns it into
`private://name`, which the Electron app serves. Designs that show artwork use
`item.image_url` and fall back to `item.icon_url`.

## What a link becomes

| Field        | From                                                                             |
|--------------|----------------------------------------------------------------------------------|
| `label`      | What is left of the line after the url, tags and image are removed.              |
| `href`       | The url.                                                                         |
| `icon_url`   | `app://favicon/<host>` in Electron, `/icon/<host>` on navplace.com, `https://icon.horse/icon/<host>` elsewhere. |
| `image_url`  | `private://<name>` from `@name`, else `null`.                                    |
| `tags`       | Every `#tag` on the line.                                                        |
| `meta`       | Every `#key=value` on the line.                                                  |
| `search1`    | Label and tags, lower case, Cyrillic transliterated to Latin.                    |
| `search2`    | The url, same treatment.                                                         |
| `namespaces` | The names of the section above the line.                                         |

## Search expressions

What you type in the box is a second, smaller language. It runs against
`search1` first, then `search2`.

| Input     | Matches                                              |
|-----------|------------------------------------------------------|
| `git`     | Contains `git`.                                      |
| `^git`    | Starts with `git`.                                   |
| `git$`    | Ends with `git`.                                     |
| `!git`    | Does not contain `git`.                              |
| `git/api` | Contains both `git` and `api`.                       |
| `gh mail` | Two expressions. Enter opens the top match for each. |

Transliteration works one way: `git` finds an item labeled `Гитхаб`.

## Gotchas

- The url must end the line. Text after it drops the whole line.
- A line that starts with `#` is a section, never a link. Put tags after the label.
- `@name` needs a space in front of it. `@img.png https://…` becomes the label.
- Tag names are ASCII. `#дев` stays in the label as plain text.
- A line with no url is skipped in silence. A broken `%` line throws.
- `% include:` is inert outside the desktop app.

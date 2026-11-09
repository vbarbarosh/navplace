I am building a design theme for NavPlace.

The contract for a design is `docs/DESIGN.ai.md`, given with this prompt: follow it.

NavPlace provides a runtime function:

    navplace({ input, update })

- `input` is either a selector, or an instance of INPUT element. By default, `input[type=search]` is used.
- `update` is a function `(items, {current}) => ...`, which will be called each time when a set of links or the current link changes. The element of `items[current]` gets the class `np-current`.

The design must be a pure renderer:
- It must not implement its own search or filtering logic.
- It must only render the items passed to update(items).
- It must bind navplace to an existing search input.
- It must work in a browser and inside an Electron app.
- It must not fetch data, define example items, or hardcode links.

Each item has:
- label
- href
- icon_url (favicon)
- image_url (optional)

Please create a single `index.html` for `designs/<name>/`, with inline CSS and JS, that renders the items visually. It loads `/lib/theme_switch.js` in its `<head>` and `/lib/navplace.js` before its own script, and nothing from another site.
Do not explain the code. Output only the HTML.

Design should support responsiveness, and a light and a dark theme by the contract: `/lib/theme_switch.js` sets the theme and shows the switch, so the design has no switch of its own.

---

Create a NavPlace design theme for internal operational links.

Visual style:
- functional
- compact
- information-dense

Interaction:
- grouped lists
- quick scanning
- minimal animation

Mood:
- serious
- efficient
- distraction-free

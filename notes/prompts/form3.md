I am building a design theme for NavPlace.

NavPlace provides a runtime function:

    navplace({ input, update })

- `input` is either a selector, or an instance of INPUT element. By default, `input[type=search]` is used.
- `update` is a function `(items) => ...`, which will be called each time when a set of links changes.

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

Please create a single self-contained HTML file with inline CSS and JS that renders the items visually.
Do not explain the code. Output only the HTML.

Design should support responsiveness and a local light/dark/system theme switch (no external dependencies).

---

Create a NavPlace design theme for a public professional portfolio.

Visual style:
- minimalist
- neutral colors
- confident typography
- modern layout

Interaction:
- grid of links
- subtle hover states
- suitable for embedding on a website

Mood:
- calm
- intentional
- professional

# The window never waits

## Requirement

The app opens immediately. Nothing that loads links may run in front of the
window: not the local file, not a `% include:` url.
The window comes up on a keystroke, so it must feel like one.

Links are always a redraw behind, never a delay in front.

## Rules

- Every summon calls `window_show()`. It starts a reload and does not await it.
- `refresh_collection_in_background()` is the only collection call a show path
  makes. Its name says what it does: the work runs behind the window, and
  nothing awaits it.
- `collection_load()` reads the local source alone. `% include:` urls belong to
  `refresh_collection()`, which runs after the window is up.
- Startup awaits `collection_load()` once, because `% design:` decides which
  design to load. That is a local file read.
- Every reload reads `% design:` again. A design named since the last reload is
  loaded before the includes are pulled; the same one leaves the page as it is.
- The urls are pulled side by side. Each gets 5 seconds, counted from the
  request to the last byte of its answer, and 2 MB of text; past either it is
  abandoned: its last good text, kept in the app's folder, stands in for it.
  The window never learns about it; the log does.
- Reloads may overlap, a summon coming while an older pull is still out. Links
  that come back after a newer reload's are dropped.
- New links reach the window through `api_items_changed`. The design redraws
  itself, so a slow source costs a redraw, never a stalled window.

## Measurements

An include url delayed by 3 seconds, the app driven under Xvfb:

| What                                | Time    |
|-------------------------------------|---------|
| window up, showing the local links  | 569 ms  |
| hotkey: socket ping → input cleared | 4 ms    |
| pulled links arrive in the window   | 3597 ms |

The hotkey is answered in 4 ms while a 3-second pull is in flight. That is the number
to keep.

## Measuring again

Start the app under `Xvfb` with `--remote-debugging-port=9222`, point an
`% include:` line at a url that answers slowly, then drive it over the devtools
protocol: write a marker into the search input, ping `navplace.sock` the way
`launcher.js` does, and time how long the marker takes to clear.

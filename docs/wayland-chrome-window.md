# Wrong Chrome window opens external links on Wayland

## Issue

Several workspaces, several Chrome windows. A URL opened from the app lands in
a Chrome window on another workspace, not in the Chrome window on the current
one.

Chrome routes an external URL to the window it last saw active. On Wayland
this choice often disagrees with the current workspace. Upstream report:
https://issues.chromium.org/issues/491801534

`xdg-open` cannot target a window. No Chrome flag or setting selects one.

## Fix

Focus the wanted Chrome window first, then open the URL. Chrome then opens the
new tab in the focused window. This step only runs when Google Chrome is the
configured handler for the link's HTTP or HTTPS scheme through one of its
official Linux desktop entries. Window selection:

1. The top Chrome window on the current workspace.
2. Else the most recently raised Chrome window on any workspace.
3. Else no focus step; the URL opens as before.

Implemented in `url_open_external` (`src/desktop-electron/main.js`), which calls
`src/desktop-electron/helpers/chrome_window_focus.js` before
`shell.openExternal`. Only `http(s)` URLs get the focus step, on Linux in a
Wayland session; a `mailto:` address opens without it.

## Mechanism

GNOME Shell on Wayland exposes no window control by default. The "Window
Calls" extension adds it on D-Bus:

- https://extensions.gnome.org/extension/4724/window-calls/
- Bus name `org.gnome.Shell`, object path `/org/gnome/Shell/Extensions/Windows`.
- `List` returns all windows as JSON, in stacking order from bottom to top,
  with `wm_class_instance`, `in_current_workspace`, `focus`, `id`.
- `Activate <id>` focuses a window. The call is synchronous: when it returns,
  the window has focus. No sleep is needed before the open.

Chrome windows use a channel-specific `wm_class_instance`: `google-chrome` for
stable, `google-chrome-beta` for beta, and `google-chrome-unstable` for dev.
The scheme handler's desktop entry determines which class NavPlace targets.
Installed web apps report `crx_<id>` and cannot host tabs; the fix skips them.

## Without the extension

The extension is optional. Without it the first `gdbus` call fails,
`url_open_external` ignores the error, and the URL opens with Chrome's own window
choice — the old behavior. The same happens when a supported Chrome desktop
entry does not handle the URL scheme, outside Wayland sessions, on any
non-GNOME Linux, on macOS, and on Windows.

## Manual test

1. Put one Chrome window on the current workspace and one on another
   workspace.
2. Click the other-workspace Chrome, return, and open a link from the app.
3. The new tab must open in the current-workspace Chrome.

# The desktop app

The AppImage, its GNOME hotkey, and how it opens links in Chrome on Wayland.

## The AppImage

Grab the AppImage that fits your use:

| Build                       | Built on            | Download                                                                                                                      |
|-----------------------------|---------------------|-------------------------------------------------------------------------------------------------------------------------------|
| Stable release              | tagged releases     | [releases/latest](https://github.com/vbarbarosh/navplace/releases/latest)                                                     |
| Electron                    | every `master` push | [appimage-electron.yml](https://github.com/vbarbarosh/navplace/actions/workflows/appimage-electron.yml?query=branch%3Amaster) |

For a `master` build, open the latest successful run and download its artifact
(named like `NavPlace-Electron-master-20260704_223730-abc1234-AppImage`),
then make it executable:

```bash
chmod +x NavPlace-*.AppImage
./NavPlace-*.AppImage
```

A start that fails says why in an error box. Closing the window quits the app.
One NavPlace runs at a time: a second start of the same AppImage shows the
running window, and a start of another AppImage file or of another version
takes the running one's place, so a downloaded update only has to be run.
The gear beside a design's theme switch opens the settings: the links file in
an editor, the design, the hotkey, start at login, zoom, on top of other
windows, hiding when the window loses focus, and a check for updates.

## The GNOME hotkey

The Electron AppImage supports a one-time GNOME setup flag:

```bash
./NavPlace-*.AppImage --configure-gnome
```

Run this from the built AppImage, not from `npm start`. The setup requires the
AppImage runtime's `APPIMAGE` environment variable so it can write the cold-start
desktop entry back to the exact AppImage path.

The setup registers **Ctrl+Shift+Alt+N** through `dconf`, extracts the
dependency-free launcher to `${XDG_CONFIG_HOME:-~/.config}/navplace/launcher.js`,
and writes `~/.local/share/applications/navplace.desktop`. The launcher pings the
running NavPlace socket, so the window shows at once; if NavPlace is not already
running, it falls back to `gtk-launch navplace`, which starts the AppImage.

The setup also writes a login entry, `~/.config/autostart/navplace.desktop`. It
starts the AppImage with `--background` at login: the window stays hidden until
the hotkey, so the first press is not a cold start. Both entries hold the
AppImage's path in quotes. When an AppImage at another path starts, a newer one
after an update, it points both entries at itself. Started from another folder
than the version it replaces, a download run where it landed, it first asks
whether to move there: **Move it there** puts the file beside the old one, under
its own name and never over a file that is there; **Leave it here** keeps it
where it is. Either way the old file stays, the entries follow the new one, and
the next start asks nothing. Nothing is asked at a start with `--background`, or
when that folder cannot be written to. The settings window changes the hotkey
and switches the start at login off and on.

The rest of the setup follows a new version by itself, once, at its first start:
the launcher copy is written again when it is not the new version's, and a
hotkey command from a setup of 1.4.2 or older, the launcher alone, becomes
`node`'s absolute path and the launcher. Your keys stay as they are, a shortcut
you removed is not made again, and a login entry you switched off stays off. The
setup notes its version and the AppImage's path in
`${XDG_CONFIG_HOME:-~/.config}/navplace/setup.json`, which is how a start knows
there is something to carry over. A piece that cannot be done, `node` missing
from the app's `PATH` for one, is a line in the log and is tried again at the
next start.

`node` must be on the `PATH` of the terminal where the setup runs. The setup
resolves its absolute path there and writes it into the hotkey's command, so the
hotkey does not depend on the `PATH` of the session, where a node installed by
nvm or fnm is not found. If that node moves or is removed, run the setup again.
On success, the command prints the launcher path, the AppImage path used for
cold start, the resolved node executable, and the login entry.

## Chrome links on Wayland

On GNOME Wayland, Chrome can open external links in a window on another
workspace. Install the optional [Window Calls](https://extensions.gnome.org/extension/4724/window-calls/)
extension to let NavPlace focus a Chrome window on the current workspace first.
This behavior only applies when an official Google Chrome Linux package handles
the link's HTTP or HTTPS scheme. See
[Chrome window selection on Wayland](wayland-chrome-window.md) for details
and a manual test.

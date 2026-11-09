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
after an update, it points both entries at itself. The settings window changes
the hotkey and switches the start at login off and on.

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

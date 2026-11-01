![NavPlace — one file, many faces](img/cover.png)

Pick a design, paste your links, you're done!

NavPlace is a tool for organizing, navigating, and presenting your links from a single text-based source.

Primary goal:
- Navigate to the right place in a couple of keystrokes, dozens of times a day.

Secondary goal:
- Render the same behavior as widgets and web pages from the same file.

## Desktop AppImage

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

## Desktop settings

The Electron app uses `~/.navplace/settings.yaml` for user settings and secrets.
Copy the template at `src/desktop-electron/config/settings.example.yaml` to that path to
get started:

```yaml
personal_access_token: ""
collection_url: ""
events_url: ""
```

Leave these values empty to keep the current local behavior: the app reads
`~/.navplace/README.md`. Fill `collection_url` with the full collection API URL
to load that collection remotely. Fill `events_url` with the full events API
URL to refresh the desktop app after collection updates.

## GNOME hotkey setup

The Electron AppImage supports a one-time GNOME setup flag:

```bash
./NavPlace.AppImage --configure-gnome
```

Run this from the built AppImage, not from `npm start`. The setup requires the
AppImage runtime's `APPIMAGE` environment variable so it can write the cold-start
desktop entry back to the exact AppImage path.

The setup registers **Ctrl+Shift+Alt+N** through `dconf`, extracts the
dependency-free launcher to `${XDG_CONFIG_HOME:-~/.config}/navplace/launcher.js`,
and writes `~/.local/share/applications/navplace.desktop`. The launcher pings the
running NavPlace socket, so the window shows at once; if NavPlace is not already
running, it falls back to `gtk-launch navplace`, which starts the AppImage.

`node` must be available on `PATH`, because the extracted launcher uses its
`/usr/bin/env node` shebang. On success, the command prints the launcher path,
the AppImage path used for cold start, and the resolved node executable.

### Chrome links on Wayland

On GNOME Wayland, Chrome can open external links in a window on another
workspace. Install the optional [Window Calls](https://extensions.gnome.org/extension/4724/window-calls/)
extension to let NavPlace focus a Chrome window on the current workspace first.
This behavior only applies when an official Google Chrome Linux package handles
the link's HTTP or HTTPS scheme. See
[Chrome window selection on Wayland](docs/wayland-chrome-window.md) for details
and a manual test.

## Similar

- https://multy.me/
- https://linkcollect.io/
- https://chromewebstore.google.com/detail/linkcollect-save-share-bo/knekpacpcgkieomkhhngenjeeokddkif?hl=en

## Related

- https://www.youtube.com/shorts/dGFpXRBGzkc

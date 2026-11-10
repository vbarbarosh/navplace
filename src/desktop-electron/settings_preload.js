const electron = require('electron');

main();

// The settings window's way to the main process: each call one ipcMain handler of main.js
function main()
{
    electron.contextBridge.exposeInMainWorld('NavplaceSettings', {
        state: () => electron.ipcRenderer.invoke('settings_state'),
        links_write: v => electron.ipcRenderer.invoke('settings_links_write', v),
        design_set: (design, text) => electron.ipcRenderer.invoke('settings_design_set', design, text),
        set: v => electron.ipcRenderer.invoke('settings_set', v),
        gnome_setup: () => electron.ipcRenderer.invoke('settings_gnome_setup'),
        updates_check: () => electron.ipcRenderer.invoke('settings_updates_check'),
        url_open: v => electron.ipcRenderer.invoke('settings_url_open', v),
        back: () => electron.ipcRenderer.invoke('settings_back'),
    });
}

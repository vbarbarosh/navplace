const electron = require('electron');

main();

// The settings window's way to the main process: each call one ipcMain handler of main.js
function main()
{
    electron.contextBridge.exposeInMainWorld('NavplaceSettings', {
        state: () => electron.ipcRenderer.invoke('settings_state'),
        links_write: text => electron.ipcRenderer.invoke('settings_links_write', text),
        design_set: (design, text) => electron.ipcRenderer.invoke('settings_design_set', design, text),
        set: patch => electron.ipcRenderer.invoke('settings_set', patch),
        links_open: () => electron.ipcRenderer.invoke('settings_links_open'),
        updates_check: () => electron.ipcRenderer.invoke('settings_updates_check'),
        url_open: url => electron.ipcRenderer.invoke('settings_url_open', url),
    });
}

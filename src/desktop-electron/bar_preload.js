const electron = require('electron');

main();

// The bar's way to the main process: each call one ipcMain handler of main.js
function main()
{
    electron.contextBridge.exposeInMainWorld('NavplaceBar', {
        state: () => electron.ipcRenderer.invoke('bar_state'),
        close: () => electron.ipcRenderer.invoke('bar_close'),
        setup: () => electron.ipcRenderer.invoke('bar_setup'),
        changed: function (callback) {
            electron.ipcRenderer.on('bar_changed', (event, value) => callback(value));
        },
    });
}

const electron = require('electron');

main();

function main()
{
    electron.contextBridge.exposeInMainWorld('ElectronApp', {
        api_ping: function () {
            return electron.ipcRenderer.invoke('api_ping');
        },
        api_items_all: async function () {
            return electron.ipcRenderer.invoke('api_items_all');
        },
        api_items_changed: function (callback) {
            function listener(event, value) {
                callback(value);
            }
            electron.ipcRenderer.on('api_items_changed', listener);
            return function () {
                electron.ipcRenderer.removeListener('api_items_changed', listener);
            };
        },
    });
}

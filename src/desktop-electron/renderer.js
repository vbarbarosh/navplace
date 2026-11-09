const electron = require('electron');

main();

function main()
{
    electron.contextBridge.exposeInMainWorld('ElectronApp', {
        api_ping: function () {
            return electron.ipcRenderer.invoke('api_ping');
        },
        // The gear the designs show beside the theme switch, in the app only
        settings_open: function () {
            return electron.ipcRenderer.invoke('settings_open');
        },
        api_items_all: async function () {
            return electron.ipcRenderer.invoke('api_items_all');
        },
        // A `file:` link, which a page may not open itself: the app opens it when the user's own
        // links file lists it
        api_file_open: function (href) {
            return electron.ipcRenderer.invoke('api_file_open', href);
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

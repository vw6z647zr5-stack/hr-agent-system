const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('hrDesktop', {
  getRuntime: () => ipcRenderer.invoke('desktop:get-runtime'),
});

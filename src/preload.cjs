const { contextBridge, ipcRenderer } = require('electron');

const buildRemoveListener = (channel, listener) => () => {
  ipcRenderer.removeListener(channel, listener);
};

contextBridge.exposeInMainWorld('electronAPI', {
  selectRepository: () => ipcRenderer.invoke('repo:select'),
  getRepositoryInfo: () => ipcRenderer.invoke('repo:info'),
  listBranches: () => ipcRenderer.invoke('repo:list-branches'),
  listStashes: () => ipcRenderer.invoke('repo:list-stash'),
  startSync: (payload) => ipcRenderer.invoke('sync:start', payload),
  cancelSync: () => ipcRenderer.invoke('sync:cancel'),
  onSyncLog: (callback) => {
    const listener = (_event, data) => {
      callback?.(data);
    };
    ipcRenderer.on('sync:log', listener);
    return buildRemoveListener('sync:log', listener);
  },
  onSyncStatus: (callback) => {
    const listener = (_event, data) => {
      callback?.(data);
    };
    ipcRenderer.on('sync:status', listener);
    return buildRemoveListener('sync:status', listener);
  }
});

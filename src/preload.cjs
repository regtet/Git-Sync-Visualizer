const { contextBridge, ipcRenderer } = require('electron');

const buildRemoveListener = (channel, listener) => () => {
  ipcRenderer.removeListener(channel, listener);
};

contextBridge.exposeInMainWorld('electronAPI', {
  selectRepository: () => ipcRenderer.invoke('repo:select'),
  getRepositoryInfo: () => ipcRenderer.invoke('repo:info'),
  listBranches: () => ipcRenderer.invoke('repo:list-branches'),
  checkRemoteBranches: (branchNames) => ipcRenderer.invoke('repo:check-remote-branches', branchNames),
  listStashes: () => ipcRenderer.invoke('repo:list-stash'),
  selectPatchFile: () => ipcRenderer.invoke('patch:select'),
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

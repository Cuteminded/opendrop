import { contextBridge, ipcRenderer, webUtils } from 'electron';
import type { AppState, OpenDropApi } from '../shared/types';

const invoke = (method: string, ...args: unknown[]) =>
  ipcRenderer.invoke(`opendrop:${method}`, ...args);
const api: OpenDropApi = {
  state: () => invoke('state'),
  subscribe: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, state: AppState) => callback(state);
    ipcRenderer.on('opendrop:state', listener);
    return () => ipcRenderer.removeListener('opendrop:state', listener);
  },
  mode: (mode) => invoke('mode', mode),
  discover: () => invoke('discover'),
  connect: (host, port, pair) => invoke('connect', host, port, pair),
  disconnect: () => invoke('disconnect'),
  pick: (folder) => invoke('pick', folder),
  inspect: (path) => invoke('inspect', path),
  filePath: (file) => webUtils.getPathForFile(file),
  demoBuild: () => invoke('demoBuild'),
  download: (url) => invoke('download', url),
  install: (request) => invoke('install', request),
  cancel: (id) => invoke('cancel', id),
  launch: (id) => invoke('launch', id),
  discard: (id) => invoke('discard', id),
};
contextBridge.exposeInMainWorld('opendrop', api);

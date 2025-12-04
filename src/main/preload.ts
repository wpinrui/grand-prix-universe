/**
 * Preload Script
 *
 * Exposes a typed API to the renderer process via contextBridge.
 * This is the ONLY way the renderer can communicate with the main process.
 */

import { contextBridge, ipcRenderer } from 'electron';
import type { IpcInvokeMap } from '../shared/ipc';

/**
 * Expose a typed invoke function to the renderer.
 * All IPC calls from the renderer must go through this API.
 */
contextBridge.exposeInMainWorld('electronAPI', {
  invoke: <K extends keyof IpcInvokeMap>(
    channel: K,
    ...args: IpcInvokeMap[K]['args']
  ): Promise<IpcInvokeMap[K]['result']> => {
    return ipcRenderer.invoke(channel, ...args);
  },
});

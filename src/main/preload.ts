/**
 * Preload Script
 *
 * Exposes a typed API to the renderer process via contextBridge.
 * This is the ONLY way the renderer can communicate with the main process.
 */

import { contextBridge, ipcRenderer } from 'electron';
import type { IpcChannel, IpcInvokeMap } from '../shared/ipc';

/**
 * Expose a typed invoke function to the renderer.
 * All IPC calls from the renderer must go through this API.
 */
contextBridge.exposeInMainWorld('electronAPI', {
  invoke: <K extends IpcChannel>(
    channel: K,
    ...args: K extends keyof IpcInvokeMap ? IpcInvokeMap[K]['args'] : never[]
  ): Promise<K extends keyof IpcInvokeMap ? IpcInvokeMap[K]['result'] : unknown> => {
    return ipcRenderer.invoke(channel, ...args);
  },
});

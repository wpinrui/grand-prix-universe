/**
 * Preload Script
 *
 * Exposes a typed API to the renderer process via contextBridge.
 * This is the ONLY way the renderer can communicate with the main process.
 */

import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';
import type { IpcInvokeMap, IpcEventPayloads } from '../shared/ipc';

/**
 * Expose a typed API to the renderer.
 * - invoke: renderer -> main (request/response)
 * - on: main -> renderer (events)
 */
contextBridge.exposeInMainWorld('electronAPI', {
  invoke: <K extends keyof IpcInvokeMap>(
    channel: K,
    ...args: IpcInvokeMap[K]['args']
  ): Promise<IpcInvokeMap[K]['result']> => {
    return ipcRenderer.invoke(channel, ...args);
  },
  on: <K extends keyof IpcEventPayloads>(
    channel: K,
    callback: (payload: IpcEventPayloads[K]) => void
  ): (() => void) => {
    const handler = (_event: IpcRendererEvent, payload: IpcEventPayloads[K]) => callback(payload);
    ipcRenderer.on(channel, handler);
    return () => ipcRenderer.removeListener(channel, handler);
  },
});

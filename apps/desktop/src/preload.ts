import { contextBridge, ipcRenderer } from 'electron'

/** API mínima para el panel cuando corre dentro de la app de escritorio. */
contextBridge.exposeInMainWorld('livearena', {
  desktop: true,
  pickFolder: (title?: string) => ipcRenderer.invoke('pick-folder', title) as Promise<string | null>,
  pickFile: (opts?: { title?: string; extensions?: string[] }) => ipcRenderer.invoke('pick-file', opts) as Promise<string | null>,
  openPath: (p: string) => ipcRenderer.invoke('open-path', p) as Promise<string>,
  // actualizaciones automáticas
  updateGet: () => ipcRenderer.invoke('update-get'),
  updateCheck: () => ipcRenderer.invoke('update-check'),
  updateInstall: () => ipcRenderer.invoke('update-install') as Promise<boolean>,
  onUpdate: (cb: (s: unknown) => void) => {
    const h = (_e: unknown, s: unknown) => cb(s)
    ipcRenderer.on('update-state', h)
    return () => ipcRenderer.removeListener('update-state', h)
  },
})

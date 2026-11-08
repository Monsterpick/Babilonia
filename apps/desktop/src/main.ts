/**
 * Proceso principal de Electron: arranca el servidor de LiveArena dentro de la app
 * y muestra el panel en una ventana. Al cerrar, apaga todo (y el servidor de Minecraft si así se configuró).
 */
import { app, BrowserWindow, dialog, ipcMain, shell, Menu } from 'electron'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const PORT = Number(process.env.PORT ?? 7420)
let win: BrowserWindow | null = null
let server: { url: string; close: () => Promise<void> } | null = null

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (win) {
      if (win.isMinimized()) win.restore()
      win.focus()
    }
  })
  void boot()
}

async function boot(): Promise<void> {
  await app.whenReady()
  Menu.setApplicationMenu(null)
  process.env.LIVEARENA_RESOURCES = app.isPackaged ? path.join(process.resourcesPath, 'res') : path.join(__dirname, 'res')
  process.env.LIVEARENA_DATA ??= path.join(app.getPath('userData'), 'datos')

  // En Windows, tras un diálogo nativo la página puede quedarse sin foco de teclado: lo devolvemos.
  const refocus = () => {
    if (!win || win.isDestroyed()) return
    win.blur()
    win.focus()
    win.webContents.focus()
  }
  ipcMain.handle('pick-folder', async (_e, title: string) => {
    const r = await dialog.showOpenDialog(win!, { title: title || 'Elegir carpeta', properties: ['openDirectory', 'createDirectory'] })
    refocus()
    return r.canceled ? null : r.filePaths[0]
  })
  ipcMain.handle('pick-file', async (_e, opts: { title?: string; extensions?: string[] }) => {
    const r = await dialog.showOpenDialog(win!, { title: opts?.title, properties: ['openFile'], filters: opts?.extensions ? [{ name: 'Archivos', extensions: opts.extensions }] : [] })
    refocus()
    return r.canceled ? null : r.filePaths[0]
  })
  ipcMain.handle('open-path', (_e, p: string) => shell.openPath(p))

  try {
    // El servidor va empaquetado aparte (ESM) y se carga después de fijar las rutas.
    const mod = (await import(pathToFileURL(path.join(__dirname, 'server.mjs')).href)) as typeof import('../../server/src/start.js')
    server = await mod.startServer({ port: PORT })
  } catch (err) {
    dialog.showErrorBox('LiveArena no pudo arrancar', (err as Error).message)
    app.quit()
    return
  }

  win = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1100,
    minHeight: 700,
    backgroundColor: '#0c0e12',
    title: 'LiveArena',
    icon: path.join(process.env.LIVEARENA_RESOURCES, 'icon.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, sandbox: true },
  })
  // Enlaces externos (EULA, descargas, overlays) en el navegador del sistema.
  win.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url)
    return { action: 'deny' }
  })
  win.on("focus", () => win?.webContents.focus())
  await win.loadURL(server.url)
}

let quitting = false
app.on('before-quit', (e) => {
  if (quitting || !server) return
  e.preventDefault()
  quitting = true
  void server.close().finally(() => app.quit())
})
app.on('window-all-closed', () => app.quit())

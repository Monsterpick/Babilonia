/**
 * Proceso principal de Electron: arranca el servidor de LiveArena dentro de la app
 * y muestra el panel en una ventana. Al cerrar, apaga todo (y el servidor de Minecraft si así se configuró).
 */
import { app, BrowserWindow, dialog, ipcMain, shell, Menu } from 'electron'
import { autoUpdater } from 'electron-updater'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const PORT = Number(process.env.PORT ?? 7420)
let win: BrowserWindow | null = null
let server: { url: string; close: () => Promise<void> } | null = null
let quitting = false

if (!app.requestSingleInstanceLock()) {
  // Ya hay otro LiveArena en marcha (o cerrándose / instalando una actualización): avisamos en vez de no hacer nada.
  void app.whenReady().then(() => {
    dialog.showMessageBoxSync({
      type: 'info',
      title: 'LiveArena',
      message: 'LiveArena ya está abierto o se está cerrando para actualizarse.',
      detail: 'Espera unos segundos y vuelve a abrirlo. Si sigue sin abrir, cierra «LiveArena» en el Administrador de tareas.',
    })
    app.quit()
  })
} else {
  app.on('second-instance', () => {
    // si esta copia se está cerrando (p. ej. apagando el servidor de Minecraft), se termina ya para dejar paso a la nueva
    if (quitting) {
      app.exit(0)
      return
    }
    if (win && !win.isDestroyed()) {
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
  process.env.LIVEARENA_VERSION = app.getVersion()

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
  setupUpdates()
}

/**
 * Actualizaciones automáticas desde las releases de GitHub (el repositorio es público: no hace falta ninguna clave).
 * Versión instalada: se descarga sola y el panel ofrece «Reiniciar y actualizar».
 * Versión portable: no se puede reemplazar a sí misma; el panel avisa y ofrece descargarla.
 */
type UpdateState =
  | { state: 'checking' | 'none' }
  | { state: 'available'; version: string; portable: boolean; url: string }
  | { state: 'downloading'; version: string; percent: number }
  | { state: 'ready'; version: string }
  | { state: 'error'; message: string }

let updateState: UpdateState = { state: 'none' }
const RELEASES = 'https://github.com/Monsterpick/Babilonia/releases/latest'

function sendUpdate(s: UpdateState): void {
  updateState = s
  if (win && !win.isDestroyed()) win.webContents.send('update-state', s)
}

function setupUpdates(): void {
  ipcMain.handle('update-get', () => ({ ...updateState, current: app.getVersion() }))
  ipcMain.handle('update-check', () => check())
  ipcMain.handle('update-install', () => {
    if (updateState.state !== 'ready') return false
    // instalación silenciosa y la app vuelve a abrirse sola (los datos del usuario no se tocan)
    setImmediate(() => autoUpdater.quitAndInstall(true, true))
    return true
  })
  if (!app.isPackaged) return
  const portable = Boolean(process.env.PORTABLE_EXECUTABLE_DIR)
  autoUpdater.autoDownload = !portable
  autoUpdater.autoInstallOnAppQuit = !portable
  autoUpdater.on('update-available', (i) => sendUpdate(portable ? { state: 'available', version: i.version, portable: true, url: RELEASES } : { state: 'downloading', version: i.version, percent: 0 }))
  autoUpdater.on('download-progress', (p) => updateState.state === 'downloading' && sendUpdate({ ...updateState, percent: Math.round(p.percent) }))
  autoUpdater.on('update-downloaded', (i) => sendUpdate({ state: 'ready', version: i.version }))
  autoUpdater.on('update-not-available', () => sendUpdate({ state: 'none' }))
  autoUpdater.on('error', (e) => sendUpdate({ state: 'error', message: String(e?.message ?? e).slice(0, 200) }))
  // primera comprobación al poco de abrir y luego cada 30 minutos
  setTimeout(() => void check(), 8_000)
  setInterval(() => void check(), 30 * 60_000)
}

async function check(): Promise<UpdateState> {
  if (!app.isPackaged) return { state: 'none' }
  if (updateState.state === 'downloading' || updateState.state === 'ready') return updateState
  try {
    await autoUpdater.checkForUpdates()
  } catch (e) {
    sendUpdate({ state: 'error', message: String((e as Error).message).slice(0, 200) })
  }
  return updateState
}

app.on('before-quit', (e) => {
  if (quitting || !server) return
  e.preventDefault()
  quitting = true
  // el cierre ordenado (servidor, Minecraft) nunca puede dejar la app colgada en segundo plano: como mucho 12 s
  const force = setTimeout(() => app.exit(0), 12_000)
  void server.close().finally(() => {
    clearTimeout(force)
    app.quit()
  })
})
app.on('window-all-closed', () => {
  // con una actualización ya descargada: se instala en silencio y la app vuelve a abrirse sola
  // (antes se instalaba al salir sin reabrirse y, si la abrías mientras tanto, parecía que no arrancaba)
  if (updateState.state === 'ready' && app.isPackaged && !process.env.PORTABLE_EXECUTABLE_DIR) {
    const done = () => autoUpdater.quitAndInstall(true, true)
    if (server && !quitting) {
      quitting = true
      const force = setTimeout(done, 12_000)
      void server.close().finally(() => {
        clearTimeout(force)
        done()
      })
    } else done()
    return
  }
  app.quit()
})

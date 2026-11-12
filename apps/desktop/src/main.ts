/**
 * Proceso principal de Electron: arranca el servidor de LiveArena dentro de la app
 * y muestra el panel en una ventana. Al cerrar, apaga todo (y el servidor de Minecraft si así se configuró).
 */
import { app, BrowserWindow, dialog, ipcMain, shell, Menu } from 'electron'
import { autoUpdater } from 'electron-updater'
import path from 'node:path'
import fs from 'node:fs'
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

  // al abrir: si hay una versión nueva, ventana de actualización (descarga, instala y vuelve a abrirse sola)
  if (await startupUpdate()) return

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
  // la ventana de actualización se cierra antes de que exista el panel: eso no es salir de la app
  if (!win) return
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


// ─────────────────────── ventana de actualización al abrir ───────────────────────

function splashHtml(icon: string): string {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>LiveArena</title><style>
  *{box-sizing:border-box}body{margin:0;height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;
  background:radial-gradient(circle at 50% 22%,#2a1640 0,#0c0e12 62%);color:#e9e6f5;font:15px "Segoe UI",system-ui,sans-serif;padding:28px;user-select:none}
  img{width:118px;height:118px;border-radius:50%;box-shadow:0 0 40px #8b5cf655}h1{margin:16px 0 2px;font-size:26px}
  .sub{color:#a59fbf;font-size:13px;margin-bottom:22px}.box{width:100%;border-radius:14px;padding:14px 16px;margin-bottom:12px;font-size:13.5px;line-height:1.45}
  #st{background:#2a2112;border:1px solid #6b5420;color:#f5b84a}#info{background:#13221a;border:1px solid #2e5a3a}
  .bar{height:6px;border-radius:3px;background:#ffffff14;margin-top:8px;overflow:hidden}.bar i{display:block;height:100%;width:0;background:linear-gradient(90deg,#8b5cf6,#ff5a7a);transition:width .3s}
  button{width:100%;border:0;border-radius:14px;padding:14px;font-size:15px;font-weight:700;color:#fff;cursor:pointer;
  background:linear-gradient(90deg,#8b5cf6,#ff4f7a)}button:disabled{opacity:.6;cursor:default}
  .skip{background:none;color:#8d88a6;font-weight:500;font-size:12.5px;padding:8px;margin-top:4px}.hide{display:none}
  </style></head><body><img src="${icon}"><h1>LiveArena</h1><div class="sub" id="sub">Buscando actualizaciones…</div>
  <div class="box hide" id="st"></div><div class="box hide" id="info"></div>
  <button id="go" class="hide" onclick="window.__eleccion='instalar'">Actualizar ahora</button>
  <button id="skip" class="skip hide" onclick="window.__eleccion='saltar'">Ahora no</button></body></html>`
}

/**
 * Comprueba si hay una versión nueva antes de abrir el panel. Si la hay, muestra la ventana de actualización:
 * «Actualizar ahora» descarga (con porcentaje), instala en silencio y la app se vuelve a abrir.
 * Devuelve true si la app se va a cerrar para instalar (no hay que seguir arrancando).
 * Sin conexión, en la versión portable o en desarrollo, sigue de largo enseguida.
 */
async function startupUpdate(): Promise<boolean> {
  if (!app.isPackaged || process.env.PORTABLE_EXECUTABLE_DIR) return false
  let icon = ''
  try {
    icon = 'data:image/png;base64,' + fs.readFileSync(path.join(process.env.LIVEARENA_RESOURCES ?? '', 'icon.png')).toString('base64')
  } catch {
    /* sin icono */
  }
  const splash = new BrowserWindow({
    width: 440, height: 600, resizable: false, maximizable: false, minimizable: true, backgroundColor: '#0c0e12', title: 'LiveArena',
    icon: path.join(process.env.LIVEARENA_RESOURCES ?? '', 'icon.png'), show: false, autoHideMenuBar: true,
    webPreferences: { sandbox: true, contextIsolation: true, javascript: true },
  })
  await splash.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(splashHtml(icon)))
  splash.show()
  const js = (code: string) => (splash.isDestroyed() ? Promise.resolve() : splash.webContents.executeJavaScript(code).then(() => undefined, () => undefined))
  const set = (id: string, html: string, show = true) =>
    js(`(()=>{const e=document.getElementById(${JSON.stringify(id)});e.innerHTML=${JSON.stringify(html)};e.classList.toggle('hide',${!show})})()`)

  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = false
  let version: string | null = null
  try {
    const r = await Promise.race([autoUpdater.checkForUpdates(), new Promise<null>((ok) => setTimeout(() => ok(null), 8000))])
    const v = r?.updateInfo?.version
    if (v && r?.isUpdateAvailable !== false && v !== app.getVersion()) version = v
  } catch {
    version = null
  }
  if (!version) {
    if (!splash.isDestroyed()) splash.close()
    autoUpdater.autoDownload = true
    autoUpdater.autoInstallOnAppQuit = true
    return false
  }

  await set('sub', 'Actualización disponible')
  await set('info', `Hay una versión nueva de LiveArena (<b>${version}</b>). Se descarga, se instala sola y la app se vuelve a abrir. No pierdes tus perfiles, overlays ni ajustes.`)
  await js(`document.getElementById('go').classList.remove('hide');document.getElementById('skip').classList.remove('hide')`)

  return new Promise<boolean>((resolve) => {
    let started = false
    const cont = () => {
      autoUpdater.autoDownload = true
      autoUpdater.autoInstallOnAppQuit = true
      if (!splash.isDestroyed()) splash.close()
      resolve(false)
    }
    const install = async () => {
      if (started) return
      started = true
      await js(`document.getElementById('go').disabled=true;document.getElementById('go').textContent='Actualizando…';document.getElementById('skip').classList.add('hide')`)
      await set('st', `Descargando la versión ${version}… 0 %<div class="bar"><i id="pb"></i></div>`)
      autoUpdater.on('download-progress', (p) => {
        const pc = Math.round(p.percent)
        void js(`(()=>{const s=document.getElementById('st');s.firstChild.textContent='Descargando la versión ${version}… ${pc} %';document.getElementById('pb').style.width='${pc}%'})()`)
      })
      autoUpdater.once('update-downloaded', () => {
        void set('st', 'Instalando… la app se volverá a abrir en unos segundos.')
        setTimeout(() => {
          resolve(true)
          autoUpdater.quitAndInstall(true, true)
        }, 900)
      })
      try {
        await autoUpdater.downloadUpdate()
      } catch (e) {
        started = false
        await set('st', `No se pudo descargar la actualización: ${String((e as Error)?.message ?? e).slice(0, 140)}`)
        await js(`(()=>{const b=document.getElementById('go');b.disabled=false;b.textContent='Reintentar';document.getElementById('skip').classList.remove('hide');document.getElementById('skip').textContent='Continuar sin actualizar'})()`)
      }
    }
    // los botones dejan la elección en la página y aquí se lee (los cambios de #hash en una página data: no avisan)
    const poll = setInterval(() => {
      if (splash.isDestroyed()) return clearInterval(poll)
      splash.webContents
        .executeJavaScript(`(()=>{const c=window.__eleccion||'';window.__eleccion='';return c})()`)
        .then((c: string) => {
          if (c === 'instalar') void install()
          else if (c === 'saltar' && !started) cont()
        }, () => undefined)
    }, 200)
    // cerrar la ventana sin actualizar = seguir con la versión actual (mientras no se esté instalando)
    splash.on('closed', () => {
      clearInterval(poll)
      if (!started) resolve(false)
    })
  })
}

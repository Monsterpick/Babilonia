import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/outfit'
import '@fontsource-variable/jetbrains-mono'
import './index.css'
import { initLive } from './lib/live'

// enlaces fijos /<overlay>.html (los que acepta TikTok LIVE Studio) = /overlay/<overlay>; /escena-<id>.html = escena ?s=<id>
const htmlName = /^\/([a-z0-9][a-z0-9_-]*)\.html$/i.exec(location.pathname)?.[1]
const fixedOverlay = htmlName && htmlName.toLowerCase() !== 'index' ? htmlName : null
if (fixedOverlay?.startsWith('escena-') && !new URLSearchParams(location.search).get('s')) {
  const q = new URLSearchParams(location.search)
  q.set('s', fixedOverlay.slice(7))
  history.replaceState(null, '', `${location.pathname}?${q}`)
}
const isOverlay = location.pathname.startsWith('/overlay/') || (fixedOverlay !== null && !fixedOverlay.startsWith('juego-'))
/** Juegos propios que corren en el navegador (fuera de Minecraft): /juego/<nombre> */
const isGame = location.pathname.startsWith('/juego/') || !!fixedOverlay?.startsWith('juego-')
document.body.classList.add(isGame ? 'game' : isOverlay ? 'overlay' : 'dashboard')

async function boot() {
  const root = createRoot(document.getElementById('root')!)
  if (isGame) {
    // recibe los eventos del directo igual que un overlay
    initLive('overlay')
    const { LastHouse } = await import('./game/lasthouse/LastHouse')
    root.render(<LastHouse />)
  } else if (isOverlay) {
    initLive('overlay')
    const { OverlayRouter } = await import('./overlays/OverlayRouter')
    const name = fixedOverlay ? (fixedOverlay.startsWith('escena-') ? 'escena' : fixedOverlay) : location.pathname.replace('/overlay/', '').replace(/\/$/, '')
    root.render(<OverlayRouter name={name} />)
  } else {
    initLive('dashboard')
    const { App } = await import('./App')
    root.render(
      <StrictMode>
        <App />
      </StrictMode>,
    )
  }
}
void boot()

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/outfit'
import '@fontsource-variable/jetbrains-mono'
import './index.css'
import { initLive } from './lib/live'

const isOverlay = location.pathname.startsWith('/overlay/')
/** Juegos propios que corren en el navegador (fuera de Minecraft): /juego/<nombre> */
const isGame = location.pathname.startsWith('/juego/')
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
    root.render(<OverlayRouter name={location.pathname.replace('/overlay/', '').replace(/\/$/, '')} />)
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

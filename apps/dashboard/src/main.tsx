import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/outfit'
import '@fontsource-variable/jetbrains-mono'
import './index.css'
import { initLive } from './lib/live'

const isOverlay = location.pathname.startsWith('/overlay/')
document.body.classList.add(isOverlay ? 'overlay' : 'dashboard')

async function boot() {
  const root = createRoot(document.getElementById('root')!)
  if (isOverlay) {
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

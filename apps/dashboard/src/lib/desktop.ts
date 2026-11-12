/** Funciones de la app de escritorio (Electron). En el navegador no existen y se usa texto. */
interface DesktopApi {
  desktop: true
  pickFolder: (title?: string) => Promise<string | null>
  pickFile: (opts?: { title?: string; extensions?: string[] }) => Promise<string | null>
  openPath: (p: string) => Promise<string>
  /** actualizaciones automáticas (versiones de la app que ya las traen) */
  updateGet?: () => Promise<unknown>
  updateCheck?: () => Promise<unknown>
  updateInstall?: () => Promise<boolean>
  onUpdate?: (cb: (s: unknown) => void) => () => void
}

export const desktop: DesktopApi | undefined = (window as unknown as { livearena?: DesktopApi }).livearena

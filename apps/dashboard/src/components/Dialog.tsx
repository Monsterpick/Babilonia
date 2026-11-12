import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

/** Diálogos propios (sustituyen a confirm/prompt del navegador, que en Electron bloquean el teclado). */
interface Req {
  kind: 'confirm' | 'text'
  message: string
  value: string
  danger?: boolean
  resolve: (v: string | null) => void
}
let open: (r: Req) => void = () => undefined

export function askConfirm(message: string, opts: { danger?: boolean } = {}): Promise<boolean> {
  return new Promise((res) => open({ kind: 'confirm', message, value: '', danger: opts.danger, resolve: (v) => res(v !== null) }))
}
export function askText(message: string, value = ''): Promise<string | null> {
  return new Promise((res) => open({ kind: 'text', message, value, resolve: res }))
}

export function Dialogs() {
  const [req, setReq] = useState<Req | null>(null)
  const [val, setVal] = useState('')
  const input = useRef<HTMLInputElement>(null)
  const okBtn = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    open = (r) => {
      setVal(r.value)
      setReq(r)
    }
  }, [])
  useEffect(() => {
    if (!req) return
    setTimeout(() => (req.kind === 'text' ? input.current?.select() : okBtn.current?.focus()), 0)
  }, [req])
  if (!req) return null
  const done = (v: string | null) => {
    req.resolve(v)
    setReq(null)
  }
  return createPortal(
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 backdrop-blur-sm" onMouseDown={() => done(null)}>
      <div
        className="fx-in card w-full max-w-md space-y-4 p-5"
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Escape') done(null)
          if (e.key === 'Enter') done(req.kind === 'text' ? val : '')
        }}
      >
        <p className="text-sm whitespace-pre-line">{req.message}</p>
        {req.kind === 'text' && <input ref={input} className="input" value={val} onChange={(e) => setVal(e.target.value)} />}
        <div className="flex justify-end gap-2">
          <button className="btn" onClick={() => done(null)}>
            Cancelar
          </button>
          <button ref={okBtn} className={req.danger ? 'btn bg-bad text-white' : 'btn-accent'} onClick={() => done(req.kind === 'text' ? val : '')}>
            Aceptar
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

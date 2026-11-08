import { useEffect, useState } from 'react'

type Kind = 'ok' | 'error' | 'info'
interface T {
  id: number
  msg: string
  kind: Kind
}
let push: (t: T) => void = () => undefined
let n = 0
export function toast(msg: string, kind: Kind = 'ok'): void {
  push({ id: ++n, msg, kind })
}

export function Toasts() {
  const [list, setList] = useState<T[]>([])
  useEffect(() => {
    push = (t) => {
      setList((l) => [...l.slice(-4), t])
      setTimeout(() => setList((l) => l.filter((x) => x.id !== t.id)), t.kind === 'error' ? 6000 : 3000)
    }
  }, [])
  return (
    <div className="pointer-events-none fixed right-5 bottom-5 z-50 flex flex-col gap-2">
      {list.map((t) => (
        <div
          key={t.id}
          className={`fx-in pointer-events-auto max-w-sm rounded-lg border px-4 py-2.5 text-sm shadow-xl ${
            t.kind === 'error' ? 'border-bad/50 bg-[#2a1414]' : t.kind === 'info' ? 'border-line bg-panel-2' : 'border-ok/40 bg-[#10241a]'
          }`}
        >
          {t.msg}
        </div>
      ))}
    </div>
  )
}

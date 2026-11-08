import { useEffect, useMemo, useState } from 'react'
import { Infinity as InfinityIcon, Search } from 'lucide-react'
import type { Kit, KitItem } from '@livearena/shared'
import { useApp } from '../App'
import { api } from '../lib/api'
import { Check, Field, Modal, PageHeader } from '../components/ui'
import { toast } from '../components/Toast'

type Slot = { area: 'armor'; key: 'head' | 'chest' | 'legs' | 'feet' | 'offhand' } | { area: 'hotbar' | 'inventory'; index: number }

const ARMOR: { key: 'head' | 'chest' | 'legs' | 'feet' | 'offhand'; label: string }[] = [
  { key: 'head', label: 'Casco' },
  { key: 'chest', label: 'Pechera' },
  { key: 'legs', label: 'Pantalones' },
  { key: 'feet', label: 'Botas' },
  { key: 'offhand', label: 'Mano secundaria' },
]

const pretty = (id: string) => id.replace(/^minecraft:/, '').replace(/_/g, ' ')

export function KitPage() {
  const { profile } = useApp()
  const [kit, setKit] = useState<Kit | null>(null)
  const [slot, setSlot] = useState<Slot | null>(null)
  useEffect(() => {
    if (profile && !kit) setKit(structuredClone(profile.kit))
  }, [profile, kit])
  if (!kit) return null

  const get = (s: Slot): KitItem | null | undefined => (s.area === 'armor' ? kit.armor[s.key] : kit[s.area][s.index])
  const put = (s: Slot, it: KitItem | null) => {
    const k = structuredClone(kit)
    if (s.area === 'armor') {
      if (it) k.armor[s.key] = it
      else delete k.armor[s.key]
    } else {
      const size = s.area === 'hotbar' ? 9 : 27
      const arr = Array.from({ length: size }, (_, i) => k[s.area][i] ?? null)
      arr[s.index] = it
      while (arr.length && arr[arr.length - 1] === null) arr.pop()
      k[s.area] = arr
    }
    setKit(k)
  }

  const save = async () => {
    try {
      await api('PUT', '/api/profile/kit', kit)
      toast('Kit guardado')
    } catch (e) {
      toast((e as Error).message, 'error')
    }
  }

  const SlotBox = ({ s, label }: { s: Slot; label?: string }) => {
    const it = get(s)
    return (
      <button
        onClick={() => setSlot(s)}
        title={it ? `${pretty(it.item)} ×${it.count}` : label}
        className={`relative grid h-16 w-16 place-items-center rounded-lg border text-center transition hover:border-accent ${
          it && (Object.keys(it.enchantments).length || it.unbreakable) ? 'border-violet-500/50 bg-gradient-to-br from-violet-900/50 to-bg' : 'border-line bg-bg'
        }`}
      >
        {it ? (
          <>
            <span className="line-clamp-2 px-1 text-[10px] leading-tight capitalize">{pretty(it.item)}</span>
            {it.count > 1 && <span className="absolute right-1 bottom-0.5 text-[11px] font-bold">{it.count}</span>}
            {it.unbreakable && <InfinityIcon size={11} className="absolute top-1 left-1 text-warn" />}
          </>
        ) : (
          <span className="text-[10px] text-muted/50">{label ?? ''}</span>
        )}
      </button>
    )
  }

  return (
    <div className="pb-10">
      <PageHeader title="Kit inicial" subtitle="Lo que recibe tu jugador al empezar y cada vez que reaparece.">
        <button className="btn" onClick={() => setKit({ ...kit, armor: {}, hotbar: [], inventory: [] })}>
          Vaciar kit
        </button>
        <button className="btn" onClick={save}>
          Guardar
        </button>
        <button
          className="btn-accent"
          onClick={async () => {
            await save()
            try {
              const r = await api<{ commands: number }>('POST', '/api/minecraft/kit/give')
              toast(`Kit enviado (${r.commands} comandos)`)
            } catch (e) {
              toast((e as Error).message, 'error')
            }
          }}
        >
          Dar kit ahora
        </button>
      </PageHeader>
      <div className="space-y-4 px-6">
        <div className="card flex flex-wrap gap-x-8 gap-y-2 p-4">
          <Check on={kit.enabled} onChange={(v) => setKit({ ...kit, enabled: v })}>
            <b>Kit activado</b>
          </Check>
          <Check on={kit.giveOnRespawn} onChange={(v) => setKit({ ...kit, giveOnRespawn: v })}>
            Equipar y dar el kit cada vez que reaparezca
          </Check>
          <Check on={kit.clearBefore} onChange={(v) => setKit({ ...kit, clearBefore: v })}>
            Vaciar el inventario antes de dar el kit
          </Check>
          <Check on={kit.allPlayers} onChange={(v) => setKit({ ...kit, allPlayers: v })}>
            Para todos los jugadores (si no, solo tu nick)
          </Check>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="card p-4">
            <span className="label text-sky-400">Visión</span>
            <Check on={kit.nightVision} onChange={(v) => setKit({ ...kit, nightVision: v })}>
              Visión nocturna permanente
            </Check>
            <p className="mt-1 text-xs text-muted">Se vuelve a poner al reaparecer o si bebe leche y se le quita al darle el kit.</p>
          </div>
          <div className="card p-4">
            <span className="label text-emerald-400">Salto</span>
            <select className="input" value={kit.jumpBoost} onChange={(e) => setKit({ ...kit, jumpBoost: Number(e.target.value) })}>
              <option value={0}>Normal (1,25 bloques)</option>
              <option value={1}>Mejorado I</option>
              <option value={2}>Mejorado II</option>
              <option value={3}>Mejorado III</option>
              <option value={5}>Súper salto</option>
            </select>
            <div className="mt-2">
              <Check on={kit.noFallDamage} onChange={(v) => setKit({ ...kit, noFallDamage: v })}>
                Sin daño por caída (gamerule)
              </Check>
            </div>
          </div>
          <div className="card p-4">
            <span className="label text-amber-400">Tótems</span>
            <p className="text-xs text-muted">
              Vanilla solo permite 1 tótem por hueco. Para tótems apilados y contador en pantalla usa tu plugin de tótems; aquí puedes poner tótems en la mano secundaria y la mochila.
            </p>
          </div>
        </div>
        <div className="card flex flex-wrap gap-8 p-5">
          <div>
            <span className="label">Equipado</span>
            <div className="space-y-2">
              {ARMOR.map((a) => (
                <div key={a.key} className="flex items-center gap-3">
                  <SlotBox s={{ area: 'armor', key: a.key }} />
                  <span className="text-sm text-muted">{a.label}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <span className="label">Mochila</span>
            <div className="grid grid-cols-9 gap-1.5">
              {Array.from({ length: 27 }, (_, i) => (
                <SlotBox key={i} s={{ area: 'inventory', index: i }} />
              ))}
            </div>
            <span className="label mt-4">Barra rápida</span>
            <div className="grid grid-cols-9 gap-1.5">
              {Array.from({ length: 9 }, (_, i) => (
                <SlotBox key={i} s={{ area: 'hotbar', index: i }} label={String(i + 1)} />
              ))}
            </div>
          </div>
        </div>
      </div>
      {slot && <ItemModal item={get(slot) ?? null} onClose={() => setSlot(null)} onSave={(it) => (put(slot, it), setSlot(null))} />}
    </div>
  )
}

let itemsCache: { id: string; max: number }[] | null = null

function ItemModal({ item, onClose, onSave }: { item: KitItem | null; onClose: () => void; onSave: (it: KitItem | null) => void }) {
  const [items, setItems] = useState(itemsCache ?? [])
  const [q, setQ] = useState(item ? pretty(item.item) : '')
  const [it, setIt] = useState<KitItem>(item ?? { item: '', count: 1, enchantments: {}, unbreakable: false })
  const [ench, setEnch] = useState(Object.entries(it.enchantments).map(([k, v]) => `${k}:${v}`).join(', '))
  useEffect(() => {
    if (!itemsCache) api('GET', '/api/items').then((x) => setItems((itemsCache = x)))
  }, [])
  const list = useMemo(() => {
    const s = q.toLowerCase().replace(/ /g, '_')
    return items.filter((x) => x.id.includes(s)).slice(0, 60)
  }, [items, q])
  const parseEnch = (txt: string): Record<string, number> =>
    Object.fromEntries(
      txt
        .split(',')
        .map((p) => p.trim().split(':'))
        .filter(([k, v]) => k && Number(v) > 0)
        .map(([k, v]) => [k!.trim().toLowerCase(), Math.min(255, Number(v))]),
    )
  return (
    <Modal open onClose={onClose} title="Elegir objeto">
      <div className="relative mb-2">
        <Search size={15} className="absolute top-2.5 left-3 text-muted" />
        <input className="input pl-9" autoFocus placeholder="Buscar item (diamond_sword, totem…)" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="mb-4 flex max-h-48 flex-wrap gap-1.5 overflow-y-auto">
        {list.map((x) => (
          <button key={x.id} onClick={() => setIt({ ...it, item: x.id, count: Math.min(it.count, x.max) })} className={`rounded-md border px-2 py-1 text-xs capitalize ${it.item === x.id ? 'border-accent bg-accent/15' : 'border-line hover:border-white/30'}`}>
            {pretty(x.id)}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Item">
          <input className="input" value={it.item} onChange={(e) => setIt({ ...it, item: e.target.value })} />
        </Field>
        <Field label="Cantidad">
          <input type="number" min={1} max={127} className="input" value={it.count} onChange={(e) => setIt({ ...it, count: Math.max(1, Math.min(127, Number(e.target.value))) })} />
        </Field>
        <div className="col-span-2">
          <Field label="Encantamientos" hint="Ej: sharpness:5, unbreaking:3, mending:1">
            <input className="input" value={ench} onChange={(e) => setEnch(e.target.value)} />
          </Field>
        </div>
        <Check on={it.unbreakable} onChange={(v) => setIt({ ...it, unbreakable: v })}>
          Irrompible
        </Check>
      </div>
      <div className="mt-5 flex justify-between">
        <button className="btn text-bad" onClick={() => onSave(null)}>
          Vaciar hueco
        </button>
        <button className="btn-accent" disabled={!it.item} onClick={() => onSave({ ...it, enchantments: parseEnch(ench) })}>
          Poner
        </button>
      </div>
    </Modal>
  )
}

/**
 * Simulador por consola (con la app encendida):
 *   pnpm sim gift Rose 10 [usuario]
 *   pnpm sim like 50 [usuario]
 *   pnpm sim chat "!rojo" [usuario]
 *   pnpm sim follow | share | subscribe [usuario]
 *   pnpm sim burst 300 3        (300 eventos en 3 s)
 */
const [cmd, a, b, c] = process.argv.slice(2)
const port = process.env.PORT ?? '7420'
const bodies: Record<string, () => object> = {
  gift: () => ({ type: 'gift', name: a ?? 'Rose', count: Number(b ?? 1), user: c }),
  like: () => ({ type: 'like', count: Number(a ?? 10), user: b }),
  chat: () => ({ type: 'chat', text: a ?? 'hola', user: b }),
  follow: () => ({ type: 'follow', user: a }),
  share: () => ({ type: 'share', user: a }),
  subscribe: () => ({ type: 'subscribe', user: a }),
  burst: () => ({ type: 'burst', events: Number(a ?? 200), seconds: Number(b ?? 2) }),
}
const make = cmd ? bodies[cmd] : undefined
if (!make) {
  console.log('Uso: pnpm sim <gift|like|chat|follow|share|subscribe|burst> [...]')
  process.exit(1)
}
const r = await fetch(`http://127.0.0.1:${port}/api/simulate`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(make()) }).catch(() => null)
if (!r) console.error(`No hay app escuchando en el puerto ${port}. Arráncala con "pnpm start".`)
else console.log(r.ok ? 'Enviado ✔' : `Error: ${await r.text()}`)
export {}

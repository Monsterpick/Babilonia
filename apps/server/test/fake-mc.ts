// Servidor RCON falso para probar el panel sin Minecraft: npx tsx apps/server/test/fake-mc.ts
import { FakeRcon } from '../../../packages/minecraft/test/fake-rcon.js'
const f = new FakeRcon(process.env.PW ?? 'demo-password')
// @ts-expect-error puerto fijo
f.server.listen(Number(process.env.PORT ?? 25575), '127.0.0.1', () => console.log('RCON falso escuchando'))
setInterval(() => console.log(`comandos recibidos: ${f.commands.length}  último: ${f.commands.at(-1) ?? '-'}`), 3000)

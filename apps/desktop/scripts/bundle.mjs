// Empaqueta servidor + main + preload con esbuild y copia recursos (panel, regalos, items, icono).
import { build } from 'esbuild'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')
const repo = path.resolve(root, '..', '..')
const out = path.join(root, 'build')
fs.rmSync(out, { recursive: true, force: true })
fs.mkdirSync(out, { recursive: true })

const banner = [
  "import { createRequire as __cr } from 'node:module';",
  "import { fileURLToPath as __fu } from 'node:url';",
  "import { dirname as __dn } from 'node:path';",
  'const require = __cr(import.meta.url);',
  'const __filename = __fu(import.meta.url);',
  'const __dirname = __dn(__filename);',
].join('\n')

await build({
  entryPoints: [path.join(repo, 'apps/server/src/start.ts')],
  outfile: path.join(out, 'server.mjs'),
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  banner: { js: banner },
  external: ['bufferutil', 'utf-8-validate', 'pino-pretty'],
  logLevel: 'warning',
})
for (const [entry, file] of [['main.ts', 'main.cjs'], ['preload.ts', 'preload.cjs']]) {
  await build({ entryPoints: [path.join(root, 'src', entry)], outfile: path.join(out, file), bundle: true, platform: 'node', format: 'cjs', target: 'node22', external: ['electron'], logLevel: 'warning' })
}

const res = path.join(out, 'res')
const dash = path.join(repo, 'apps/dashboard/dist')
if (!fs.existsSync(dash)) throw new Error('Falta apps/dashboard/dist: ejecuta "pnpm build" antes.')
fs.cpSync(dash, path.join(res, 'dashboard'), { recursive: true })
fs.cpSync(path.join(repo, 'apps/server/assets'), path.join(res, 'assets'), { recursive: true })
fs.copyFileSync(path.join(repo, 'packages/minecraft/data/items-1.20.1.json'), path.join(res, 'items-1.20.1.json'))
fs.copyFileSync(path.join(root, 'build-res/icon.png'), path.join(res, 'icon.png'))
console.log('Bundle listo en', out)

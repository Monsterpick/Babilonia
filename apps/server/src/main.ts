import fs from 'node:fs'
import { startServer } from './start.js'

if (fs.existsSync('.env')) process.loadEnvFile('.env')
else if (fs.existsSync('../../.env')) process.loadEnvFile('../../.env')

try {
  const srv = await startServer()
  const shutdown = async () => {
    await srv.close()
    process.exit(0)
  }
  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
} catch (err) {
  console.error((err as Error).message)
  process.exit(1)
}

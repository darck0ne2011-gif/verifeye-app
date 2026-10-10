import { config } from './config.js'
import { initDb, closeDb } from './db/index.js'
import { createApp } from './app.js'
import { setJobHandler, startWorker, stopWorker, recoverInterruptedJobs } from './lib/jobs.js'
import { processScanJob } from './services/scanner.js'
import { cleanupStaleUploads } from './lib/storage.js'

async function main() {
  await initDb()
  await recoverInterruptedJobs()
  await cleanupStaleUploads()

  setJobHandler(processScanJob)
  startWorker({ concurrency: config.workerConcurrency })

  const app = createApp()
  const server = app.listen(config.port, () => {
    console.log(`VerifEye API running at http://localhost:${config.port} (${config.env})`)
    if (!config.sightengine.configured) console.warn('WARNING: Sightengine credentials not set; scans will fail.')
    if (!config.deepseekApiKey) console.warn('DeepSeek API key not set; scans will not include an AI summary.')
  })

  const shutdown = async (signal) => {
    console.log(`${signal} received, shutting down`)
    stopWorker()
    server.close(async () => {
      await closeDb()
      process.exit(0)
    })
    setTimeout(() => process.exit(1), 10000).unref()
  }
  process.on('SIGTERM', () => shutdown('SIGTERM'))
  process.on('SIGINT', () => shutdown('SIGINT'))
}

main().catch((err) => {
  console.error('Failed to start server:', err)
  process.exit(1)
})

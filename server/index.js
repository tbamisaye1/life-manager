import { app, ensureInit } from './app.js'

const PORT = process.env.LM_API_PORT || process.env.PORT || 4000

// Local dev server. (On Vercel, api/index.js imports the app instead.)
ensureInit().then((label) => {
  app.listen(PORT, () => {
    console.log(`\n  🌱 Life Manager API running at http://localhost:${PORT}`)
    console.log(`  Database: ${label}${process.env.DATABASE_URL ? '' : ' (local, zero-setup)'}\n`)
  })
}).catch((err) => {
  console.error('Failed to start:', err)
  process.exit(1)
})

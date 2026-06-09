// Vercel serverless entry — all /api/* requests route here and are handled by
// the same Express app used locally. DB init happens lazily on first request.
import app from '../server/app.js'

export default function handler(req, res) {
  return app(req, res)
}

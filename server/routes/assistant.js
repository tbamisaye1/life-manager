import { Router } from 'express'
import { runAssistant, assistantConfigured } from '../lib/assistant.js'
import { httpError } from '../lib/http.js'

const router = Router()

router.get('/status', (req, res) => {
  res.json({ configured: assistantConfigured() })
})

// POST /api/assistant/chat { messages: [{role:'user'|'assistant', content}] }
router.post('/chat', async (req, res) => {
  const { messages } = req.body
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json(httpError('messages array is required', 'VALIDATION'))
  }
  // Only pass through user/assistant turns to the model.
  const history = messages
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => ({ role: m.role, content: String(m.content || '') }))
  const result = await runAssistant(history)
  res.json(result)
})

export default router

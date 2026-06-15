import { Router } from 'express'
import multer from 'multer'
import OpenAI, { toFile } from 'openai'
import { db } from '../db/index.js'
import { newId, now } from '../lib/helpers.js'
import { runAssistant, assistantConfigured } from '../lib/assistant/index.js'
import { httpError } from '../lib/http.js'

const router = Router()
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } })

router.get('/status', (req, res) => {
  res.json({ configured: assistantConfigured() })
})

// POST /api/assistant/transcribe — multipart "audio" file → text (OpenAI Whisper).
router.post('/transcribe', upload.single('audio'), async (req, res) => {
  if (!assistantConfigured()) return res.status(400).json(httpError('Transcription needs an OpenAI key.', 'NOT_CONFIGURED'))
  if (!req.file?.buffer?.length) return res.status(400).json(httpError('No audio uploaded.', 'VALIDATION'))
  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    const file = await toFile(req.file.buffer, req.file.originalname || 'audio.m4a', { type: req.file.mimetype || 'audio/m4a' })
    const result = await openai.audio.transcriptions.create({
      file,
      model: process.env.OPENAI_TRANSCRIBE_MODEL || 'whisper-1',
    })
    res.json({ text: (result.text || '').trim() })
  } catch (err) {
    res.status(502).json(httpError(`Transcription failed: ${err.message}`, 'TRANSCRIBE_ERROR'))
  }
})

// ---- Conversation history (ChatGPT-style) ----
router.get('/conversations', async (req, res) => {
  const rows = await db.prepare('SELECT id, title, updated_at FROM chat_conversations ORDER BY updated_at DESC').all()
  res.json(rows)
})

router.get('/conversations/:id', async (req, res) => {
  const conversation = await db.prepare('SELECT * FROM chat_conversations WHERE id = ?').get(req.params.id)
  if (!conversation) return res.status(404).json(httpError('Conversation not found', 'NOT_FOUND'))
  const rows = await db.prepare('SELECT id, role, content, actions, created_at FROM chat_messages WHERE conversation_id = ? ORDER BY created_at').all(req.params.id)
  const messages = rows.map((m) => ({ ...m, actions: m.actions ? JSON.parse(m.actions) : [] }))
  res.json({ conversation, messages })
})

router.post('/conversations', async (req, res) => {
  const ts = now(); const id = newId()
  await db.prepare('INSERT INTO chat_conversations (id,title,created_at,updated_at) VALUES (?,?,?,?)')
    .run(id, req.body.title?.trim() || 'New chat', ts, ts)
  res.status(201).json(await db.prepare('SELECT id, title, updated_at FROM chat_conversations WHERE id = ?').get(id))
})

router.patch('/conversations/:id', async (req, res) => {
  if (req.body.title?.trim()) {
    await db.prepare('UPDATE chat_conversations SET title = ?, updated_at = ? WHERE id = ?')
      .run(req.body.title.trim(), now(), req.params.id)
  }
  res.json(await db.prepare('SELECT id, title, updated_at FROM chat_conversations WHERE id = ?').get(req.params.id))
})

router.delete('/conversations/:id', async (req, res) => {
  await db.prepare('DELETE FROM chat_conversations WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

async function loadPriorMessages(convId) {
  return db.prepare('SELECT role, content FROM chat_messages WHERE conversation_id = ? ORDER BY created_at').all(convId)
}

async function truncateFromMessage(convId, messageId) {
  const target = await db
    .prepare('SELECT id, role, created_at FROM chat_messages WHERE id = ? AND conversation_id = ?')
    .get(messageId, convId)
  if (!target) return { ok: false, message: 'Message not found in this conversation.' }
  if (target.role !== 'user') return { ok: false, message: 'Only user messages can be edited and resent.' }
  await db
    .prepare('DELETE FROM chat_messages WHERE conversation_id = ? AND created_at >= ?')
    .run(convId, target.created_at)
  return { ok: true }
}

// Cancel an in-flight request — removes the latest user message if the assistant
// has not replied yet (the user hit Stop before the turn finished).
router.post('/chat/cancel', async (req, res) => {
  const { conversationId } = req.body
  if (!conversationId) return res.status(400).json(httpError('conversationId is required.', 'VALIDATION'))

  const last = await db
    .prepare('SELECT id, role FROM chat_messages WHERE conversation_id = ? ORDER BY created_at DESC LIMIT 1')
    .get(conversationId)
  if (!last || last.role !== 'user') {
    return res.json({ ok: true, cancelled: false, message: 'Nothing in progress to cancel.' })
  }

  await db.prepare('DELETE FROM chat_messages WHERE id = ?').run(last.id)
  await db.prepare('UPDATE chat_conversations SET updated_at = ? WHERE id = ?').run(now(), conversationId)
  res.json({ ok: true, cancelled: true, removedMessageId: last.id })
})

// ---- Chat ----
// Persisted mode: { conversationId?, message, editFromMessageId? }
// Stateless mode: { messages: [...] }
router.post('/chat', async (req, res) => {
  const { conversationId, message, messages, editFromMessageId } = req.body

  if (typeof message === 'string' && message.trim()) {
    const trimmed = message.trim()
    const ts = now()
    let convId = conversationId

    if (editFromMessageId) {
      if (!convId) return res.status(400).json(httpError('conversationId is required when editing a message.', 'VALIDATION'))
      const truncated = await truncateFromMessage(convId, editFromMessageId)
      if (!truncated.ok) return res.status(400).json(httpError(truncated.message, 'VALIDATION'))
    }

    if (!convId) {
      convId = newId()
      const title = trimmed.slice(0, 48)
      await db.prepare('INSERT INTO chat_conversations (id,title,created_at,updated_at) VALUES (?,?,?,?)').run(convId, title, ts, ts)
    }

    const prior = await loadPriorMessages(convId)
    const userMessageId = newId()
    await db.prepare('INSERT INTO chat_messages (id,conversation_id,role,content,actions,created_at) VALUES (?,?,?,?,?,?)')
      .run(userMessageId, convId, 'user', trimmed, null, now())

    const result = await runAssistant([...prior, { role: 'user', content: trimmed }])

    const assistantMessageId = newId()
    await db.prepare('INSERT INTO chat_messages (id,conversation_id,role,content,actions,created_at) VALUES (?,?,?,?,?,?)')
      .run(assistantMessageId, convId, 'assistant', result.reply, JSON.stringify(result.actions || []), now())
    await db.prepare('UPDATE chat_conversations SET updated_at = ? WHERE id = ?').run(now(), convId)

    return res.json({
      conversationId: convId,
      userMessageId,
      assistantMessageId,
      reply: result.reply,
      actions: result.actions,
      configured: result.configured,
    })
  }

  if (Array.isArray(messages) && messages.length) {
    const history = messages
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => ({ role: m.role, content: String(m.content || '') }))
    return res.json(await runAssistant(history))
  }

  return res.status(400).json(httpError('Provide `message` (with optional conversationId) or `messages`.', 'VALIDATION'))
})

export default router

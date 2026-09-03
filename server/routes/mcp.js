/**
 * Express mount for the Life Manager MCP endpoint (Streamable HTTP).
 *
 * Claude custom connectors POST JSON-RPC to /api/mcp.
 * Stateless mode: new transport + server per request (Vercel-safe).
 */
import { Router } from 'express'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { createLifeManagerMcpServer } from '../mcp/createServer.js'

const router = Router()

async function handleMcp(req, res) {
  const server = createLifeManagerMcpServer()
  try {
    const transport = new StreamableHTTPServerTransport({
      // undefined = stateless. No Mcp-Session-Id sticky map (won't work on serverless).
      sessionIdGenerator: undefined,
    })
    await server.connect(transport)
    await transport.handleRequest(req, res, req.body)
    res.on('close', () => {
      transport.close().catch(() => {})
      server.close().catch(() => {})
    })
  } catch (err) {
    console.error('[mcp]', err)
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: '2.0',
        error: { code: -32603, message: 'Internal MCP server error' },
        id: null,
      })
    }
  }
}

// Streamable HTTP: clients POST. GET/DELETE are for sessionful SSE streams;
// we reject them in stateless mode.
router.post('/', handleMcp)
router.get('/', (_req, res) => {
  res.status(405).json({
    jsonrpc: '2.0',
    error: { code: -32000, message: 'Method not allowed. Use POST (stateless Streamable HTTP).' },
    id: null,
  })
})
router.delete('/', (_req, res) => {
  res.status(405).json({
    jsonrpc: '2.0',
    error: { code: -32000, message: 'Method not allowed. Stateless mode has no sessions to delete.' },
    id: null,
  })
})

export default router

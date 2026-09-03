# Life Manager MCP server (interview + setup)

Remote MCP endpoint (deployed with the app on Vercel):

```text
https://life-manager-eight-zeta.vercel.app/api/mcp
```

Local:

```text
http://localhost:4000/api/mcp
```

Claude web → Settings → Connectors → **Add custom connector** → Name `Life Manager` → paste that HTTPS URL.

Auth (when `APP_PIN` is set on Vercel): send either

- `Authorization: Bearer <APP_PIN>` or `Bearer <MCP_TOKEN>`
- or `X-Life-Manager-Pin: <APP_PIN>`

In Claude Advanced settings, add the Authorization header if the UI offers custom headers. Optionally set a dedicated `MCP_TOKEN` in Vercel env so you do not reuse the PIN as a bearer.

---

## What MCP is (say this in an interview)

**MCP (Model Context Protocol)** is an open protocol that lets an LLM host (Claude, Cursor, etc.) discover and call **tools** and **resources** on an external server with a stable JSON-RPC contract.

Think of it as **USB-C for AI tools**: one standard plug, many devices.

| Piece | Role |
|--------|------|
| **Host** | The app the user talks to (claude.ai, Cursor). Decides when to call tools. |
| **Client** | Protocol client inside the host. Speaks MCP to servers. |
| **Server** | Your process. Registers tools (`list_tasks`, `create_task`, …) and runs them. |

Without MCP, every product invents its own plugins. With MCP, you build **one server** and many hosts can use it.

---

## Transports (how bytes move)

1. **STDIO** — host spawns your process and talks over stdin/stdout. Local only (Claude Desktop `claude_desktop_config.json`, Cursor). Not usable from claude.ai.
2. **Streamable HTTP** (what we use) — host POSTs JSON-RPC to an HTTPS URL. Works from Anthropic’s cloud → your Vercel URL. Required for **custom connectors** on Claude web.
3. **SSE (legacy)** — older remote transport. New builds should prefer Streamable HTTP.

Claude’s connector dialog asks for a **public HTTPS** URL because the connection is opened **from Anthropic’s servers**, not from your laptop. Localhost will not work there.

---

## What goes into an MCP server

Minimum:

1. **Server metadata** — `name`, `version` (`McpServer` constructor).
2. **Tools** — each has a `name`, human `description`, **JSON Schema / Zod** input shape, and a handler that returns `content` (usually text/JSON the model reads).
3. **Transport** — wire that speaks MCP over STDIO or HTTP.
4. **Auth** (remote) — PIN / bearer / OAuth so strangers cannot write your tasks.

Optional: **resources** (read-only documents by URI), **prompts** (reusable prompt templates).

Life Manager registers tools in `server/mcp/createServer.js` and mounts HTTP in `server/routes/mcp.js`.

---

## How a tool call works (end-to-end)

```text
You: "What's my homework tonight?"
        │
        ▼
Claude (host) plans → tools/list (already cached) → tools/call
        │  name: get_today or list_tasks
        │  arguments: { filter: "homework_tonight" }
        ▼
POST https://…/api/mcp
  Authorization: Bearer …
  body: JSON-RPC { method: "tools/call", params: { … } }
        │
        ▼
Express requirePin → StreamableHTTPServerTransport
        │
        ▼
createLifeManagerMcpServer() handler
  → SQL / Neon
  → { content: [{ type: "text", text: "{ ...json... }" }] }
        │
        ▼
Claude reads the JSON and answers you in chat
```

Important details:

- **Stateless mode** (`sessionIdGenerator: undefined`): every request builds a fresh server + transport. Needed on **Vercel serverless** where you cannot keep a session map in memory across instances.
- Tools return **model-readable content**, not UI widgets. We stringify JSON so Claude can reason over structured data.
- Descriptions matter: the model chooses tools from descriptions + schemas the way a human picks an API from docs.

---

## Code map (this repo)

| File | Job |
|------|-----|
| `server/mcp/createServer.js` | Build `McpServer`, `registerTool(...)` for tasks / today / schedule / search |
| `server/routes/mcp.js` | Express `POST /api/mcp` → Streamable HTTP transport |
| `server/app.js` | Mounts `/api/mcp` behind the same PIN gate as the REST API |
| `server/lib/pinAuth.js` | Cookie unlock, `X-Life-Manager-Pin`, `Authorization: Bearer` |

REST API stays the source of truth for the web/mobile apps. MCP is a **second interface** over the same database — same data Claude uses when you chat in-app via LangGraph tools, but reachable from Claude web.

---

## MCP vs “just expose OpenAPI”

| | OpenAPI / REST | MCP |
|--|----------------|-----|
| Consumer | Your code, Postman, codegen | LLM hosts that know MCP |
| Discovery | Spec file / Swagger | `tools/list` at runtime |
| Calling | You write HTTP | Host emits `tools/call` |
| Auth story | Whatever you invent | Bearer / OAuth patterns hosts already support |

You can have both: REST for the app, MCP for agents. Life Manager does that.

---

## Interview soundbites

- “MCP standardizes how models call tools. I built a Streamable HTTP server so Claude.ai can hit my Life Manager over HTTPS.”
- “Tools are named functions with Zod schemas; the host discovers them and the model picks which to call.”
- “On Vercel I run **stateless** Streamable HTTP — no sticky sessions — because serverless instances don’t share memory.”
- “Auth reuses our app PIN via Bearer so the connector isn’t an open write surface on the public internet.”

---

## Deploy checklist

1. Deploy Life Manager to Vercel (existing pipeline).
2. Confirm `APP_PIN` (and optional `MCP_TOKEN`) in project env.
3. Smoke test:

```bash
curl -sS -X POST "https://life-manager-eight-zeta.vercel.app/api/mcp" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $APP_PIN" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"curl","version":"0"}}}'
```

4. In Claude: add custom connector → URL above → enable tools when prompted.

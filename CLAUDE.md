# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Yarn Workspaces monorepo** — multi-agent chatbot UI that communicates with external AI agents via three transports: **HTTP REST** (Nevermined API Key auth), **MCP** (OAuth 2.1 with PKCE), and **n8n** (async callbacks via SSE). Integrates Nevermined's blockchain-based payment system for credit management.

## Common Commands

```bash
yarn install
yarn dev              # All apps: / (demo), /simple-agent/ (HTTP), /mcp-agent/ (MCP), /n8n-agent/ (n8n)
yarn serve:app:http   # HTTP agent app only
yarn serve:app:mcp    # MCP agent app only
yarn serve:app:n8n    # n8n agent app only
yarn build            # Build all (packages then apps, order matters)
yarn typecheck        # TypeScript validation
yarn lint
yarn clean
yarn start            # Production (requires build first)
```

Server runs on port 3000. Dev mode creates 4 Vite middleware instances (HMR ports 24677-24680).

### Per-Package Commands

```bash
yarn --cwd packages/server-api build
yarn --cwd apps/demo-app dev
yarn --cwd packages/server-core typecheck
```

## Architecture

### Monorepo Structure

```
apps/
  demo-app/           # Landing page (React + Vite, serves at /)
  agent-http-app/     # HTTP agent chat UI (serves at /simple-agent/)
  agent-mcp-app/      # MCP agent chat UI (serves at /mcp-agent/)
  agent-n8n-app/      # n8n agent chat UI (serves at /n8n-agent/)
  landing-app/        # Alternative landing

packages/
  domain/             # Core interfaces: AgentClient, PaymentsClient, PromptProvider
  config/             # Runtime config from env vars + window.__RUNTIME_CONFIG__
  prompts/            # LLM prompt templates
  server-core/        # Express orchestrator + Vite dev middleware
  server-api/         # API routes (agent proxy, credits, MCP tools, n8n SSE, LLM router)
  transport-http/     # HttpAgentClient implements AgentClient
  transport-mcp/      # McpAgentClient implements AgentClient
  transport-n8n/      # N8nAgentClient implements AgentClient (async callbacks via SSE)
  payments-client/    # Nevermined Payments SDK integration
  agent-client/       # React AgentProvider context
  ui-core/            # Shared components, hooks, chat state, auth state
  utilities/          # Shared utilities
```

### Build Order (dependency chain)

```
domain → config → prompts
                → transport-http, transport-mcp, transport-n8n, payments-client
                → server-api → server-core
                → agent-client, ui-core → apps/*
```

### Agent Transport Pattern

All three transports implement `AgentClient` from `@app/domain`:

```typescript
interface AgentClient {
  createTask(input: string): Promise<{ output: string }>
  getTask?(taskId: string): Promise<any>
  listTools?(): Promise<any[]>
  callTool?(tool: string, args: Record<string, any>): Promise<{ output: string; content?: any }>
  getCapabilities(): { tools: boolean; tasks: boolean }
}
```

- **HTTP** (`transport-http`): `POST /api/agent` with `X-Agent-Mode: http`, `Authorization: Bearer ${apiKey}`, `X-Plan-Id: ${planId}`
- **MCP** (`transport-mcp`): `GET /api/mcp/tools` + `POST /api/mcp/tool` with `X-Agent-Mode: mcp`, `Authorization: Bearer ${oauthToken}`. Backend uses `@modelcontextprotocol/sdk` StreamableHTTPClientTransport.
- **n8n** (`transport-n8n`): `POST /api/n8n/trigger` → triggers external n8n workflow, returns `sessionId`. Events stream back via `GET /api/n8n/events/:sessionId` (SSE). The n8n workflow sends intermediate callbacks to `POST /api/n8n/callback`. No credit/payment flow on the user side.

### Authentication Flows

**HTTP (Nevermined)**: User pastes API Key → stored in localStorage (`nvmApiKey`) → sent as Bearer token → backend uses `@nevermined-io/payments` to get access token for external agent.

**MCP (OAuth 2.1 + PKCE)**: App discovers OAuth endpoints via `.well-known/oauth-protected-resource` → PKCE authorization flow → access token in memory → backend decodes via `payments.decodeAccessToken()` to extract planId.

### Server Architecture

`server-core` creates an Express server:
- **Dev**: Mounts 4 Vite apps in middleware mode with HMR
- **Prod**: Serves pre-built static files from `apps/*/dist/`
- Mounts API routes from `server-api` via `registerRoutes(app)`
- Injects `/config.js` endpoint that sets `window.__RUNTIME_CONFIG__` based on `Referer` header

### Config System

Server serves `/config.js` → sets `window.__RUNTIME_CONFIG__` (transport, agentId, agentEndpoint, environment). Client reads via `packages/ui-core/src/lib/config.ts` with fallback to `VITE_*` env vars.

## API Routes

All defined in `packages/server-api/src/index.ts`:

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/agent` | POST | Main agent call (HTTP or MCP based on `X-Agent-Mode` header) |
| `/api/llm-router` | POST | Determines routing (forward/no_credit/no_action) |
| `/api/intent/synthesize` | POST | Synthesize user intent via LLM |
| `/api/credit` | GET | Get current credits |
| `/api/order-plan` | POST | Purchase plan credits |
| `/api/burn-credits` | POST | Redeem/burn credits |
| `/api/plan/cost` | GET | Get plan pricing |
| `/api/task` | GET | Get task status (HTTP agents) |
| `/api/mcp/tools` | GET | List MCP tools |
| `/api/mcp/tool` | POST | Call specific MCP tool |
| `/api/latest-block` | GET | Current blockchain block |
| `/api/find-burn-tx` | GET | Find burn transaction on-chain |
| `/api/n8n/trigger` | POST | Trigger n8n workflow, returns `{ sessionId }` |
| `/api/n8n/callback` | POST | Receive n8n workflow callback events `{ sessionId, step, data }` |
| `/api/n8n/events/:sessionId` | GET | SSE stream of n8n workflow events for a session |
| `/api/title/summarize` | POST | Summarize chat title |
| `/api/dev/reload-prompt` | POST | Dev: reload prompts |

## State Management

**UserStateContext** (`packages/ui-core/src/lib/user-state-context.tsx`): Auth for both transports — API key + planId (HTTP), OAuth client + access token (MCP), credits.

**ChatContext** (`packages/ui-core/src/lib/chat-context.tsx`): Message history with content-hash deduplication, localStorage persistence scoped by transport (`chat_http_*`, `chat_mcp_*`), hydration pattern to avoid duplicates on refresh.

### Message Types

```typescript
type MessageType = "answer" | "final-answer" | "transaction" | "error" | "warning" | "thinking" | "n8n-step"

interface FullMessage {
  id: number; conversationId: string; timestamp: Date | null
  isUser: boolean; type: MessageType; content: string
  txHash?: string; artifacts?: { mimeType: string; parts: string[] }
  credits?: number; planId?: string
}
```

### localStorage Keys

- `nvmApiKey` — Nevermined API Key (with TTL)
- `nvmPlanId_http` / `nvmPlanId_mcp` — Plan IDs scoped by transport
- `chat_http_messages` / `chat_mcp_messages` / `chat_n8n_messages` — Message history
- `chat_http_conversations` / `chat_mcp_conversations` / `chat_n8n_conversations` — Conversation list

## Key Files

| File | Purpose |
|------|---------|
| `packages/domain/src/index.ts` | Core interfaces (AgentClient, PaymentsClient) |
| `packages/config/src/agents.ts` | Agent config loader with defaults |
| `packages/server-core/src/index.ts` | Express + Vite middleware orchestrator |
| `packages/server-api/src/index.ts` | All API route definitions |
| `packages/transport-http/src/index.ts` | HTTP agent client implementation |
| `packages/transport-mcp/src/index.ts` | MCP agent client implementation |
| `packages/transport-n8n/src/index.ts` | n8n agent client implementation |
| `packages/ui-core/src/hooks/use-n8n-events.ts` | n8n SSE event-to-message mapper |
| `packages/ui-core/src/lib/chat-context.tsx` | Chat message state management |
| `packages/ui-core/src/lib/user-state-context.tsx` | Auth state (HTTP + MCP) |
| `packages/ui-core/src/lib/mcp-oauth-client.ts` | OAuth 2.1 + PKCE implementation |
| `packages/ui-core/src/components/chat/ChatContainer.tsx` | Main chat UI component |
| `apps/agent-http-app/src/main.tsx` | HTTP app bootstrap with HttpAgentClient |
| `apps/agent-mcp-app/src/main.tsx` | MCP app bootstrap with McpAgentClient |
| `apps/agent-n8n-app/src/main.tsx` | n8n app bootstrap with N8nAgentClient |

## Environment Variables

Create `.env` in project root:

```bash
# Required
OPENAI_API_KEY=sk-...

# HTTP Agent
HTTP_AGENT_ID=<did>
HTTP_AGENT_ENDPOINT=http://localhost:3001/ask

# MCP Agent
MCP_AGENT_ID=<did>
MCP_AGENT_ENDPOINT=http://localhost:3002/mcp

# n8n Agent
N8N_WEBHOOK_URL=http://localhost:4003

# Blockchain
RPC_URL=https://base-sepolia.gateway.tenderly.co

# Environment
NVM_ENVIRONMENT=staging_sandbox
```

Vite build-time vars use `VITE_` prefix (e.g., `VITE_HTTP_AGENT_ID`). Runtime override via `window.__RUNTIME_CONFIG__`.

## Tech Stack

- **Frontend**: React 19, TypeScript 5.9, Vite 7, Tailwind CSS 3.4
- **Backend**: Express 4.21, Node.js
- **UI**: Radix UI primitives + shadcn patterns, Lucide icons, Framer Motion, CVA
- **Payments**: `@nevermined-io/payments`, ethers 5.7
- **MCP**: `@modelcontextprotocol/sdk` (StreamableHTTPClientTransport)
- **AI**: OpenAI API v4 (LLM router / intent synthesis)
- **Validation**: Zod
- **Build**: Yarn v4 workspaces, Vite, tsx/tsc
- **Docker**: Multi-stage build, port 3000, healthcheck

## TypeScript Configuration

- `"module": "esnext"` / `"moduleResolution": "bundler"`
- `"strict": true` with `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`
- `"verbatimModuleSyntax": true`, `"isolatedModules": true`
- All packages use ES modules (`"type": "module"`)
- Path aliases: `@` → `ui-core/src`, `@app/*` → `packages/*/src`

## Modifying

- **Add new transport**: Implement `AgentClient` in a new `transport-*` package, add app in `apps/`, register in `server-core`
- **Add API route**: Add to `packages/server-api/src/index.ts`
- **Add UI component**: Add to `packages/ui-core/src/components/`
- **Change agent config**: Edit `.env` or override via `window.__RUNTIME_CONFIG__`
- **Add prompt**: Add to `packages/prompts/src/`

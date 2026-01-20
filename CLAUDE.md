# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **Yarn Workspaces monorepo** demonstrating multi-agent communication with external AI agents via HTTP REST and MCP (Model Context Protocol). It integrates with Nevermined's blockchain-based payment system for credit management.

## Common Commands

```bash
# Install dependencies
yarn install

# Development (serves demo-app at /, HTTP agent at /simple-agent/, MCP agent at /mcp-agent/)
yarn dev

# Development with specific app
yarn serve:app:http    # HTTP agent app
yarn serve:app:mcp     # MCP agent app

# Build all packages and apps (order matters for dependencies)
yarn build

# Build packages first (in dependency order), then apps
yarn build:packages && yarn build:apps

# Type checking
yarn typecheck

# Lint
yarn lint

# Clean build outputs
yarn clean

# Production start (requires build first)
yarn start
```

### Per-Package Commands

```bash
# Build a specific package
yarn --cwd packages/server-api build

# Run an app's dev server directly
yarn --cwd apps/demo-app dev

# Type check a specific package
yarn --cwd packages/server-core typecheck
```

## Architecture

### Monorepo Structure

```
apps/
├── demo-app/          # Landing page and navigation (React + Vite)
├── agent-http-app/    # HTTP agent chat interface (React + Vite)
└── agent-mcp-app/     # MCP agent chat interface (React + Vite)

packages/
├── domain/            # Shared TypeScript interfaces (AgentClient, PaymentsClient)
├── config/            # Runtime configuration loading from env vars + window globals
├── prompts/           # LLM prompt templates
├── server-core/       # Express server orchestrator (Vite middleware, static serving)
├── server-api/        # API routes and business logic (payments, LLM, agent communication)
├── transport-http/    # HTTP REST agent client implementation
├── transport-mcp/     # MCP SDK agent client implementation
├── payments-client/   # Nevermined Payments SDK integration
└── ui-core/           # Shared React components, hooks, and utilities
```

### Package Dependencies Flow

```
domain (types) ← config ← prompts
                       ← transport-http
                       ← transport-mcp
                       ← payments-client
                       ← server-api ← server-core
                       ← ui-core ← apps/*
```

### Server Architecture

`server-core` creates an Express server that:
- Serves multiple Vite apps in development with middleware mode
- Serves static built apps in production
- Mounts API routes from `server-api` via `registerRoutes(app)`
- Injects runtime config via `/config.js` endpoint (sets `window.__RUNTIME_CONFIG__`)

### Key API Endpoints (packages/server-api/src/index.ts)

- `POST /api/agent` - Main agent communication endpoint (requires `x-agent-mode: http|mcp`)
- `GET /api/credit` - Get user credits
- `POST /api/llm-router` - Route messages through OpenAI
- `POST /api/intent/synthesize` - LLM intent synthesis for agent calls
- `GET /api/mcp/tools` - List MCP agent tools
- `POST /api/mcp/tool` - Call specific MCP tool

### Authentication Flow

HTTP mode uses Nevermined API keys (`Bearer` token + `X-Plan-Id` header).
MCP mode uses OAuth access tokens decoded via `@nevermined-io/payments.decodeAccessToken()`.

## Environment Variables

Create `.env` in the project root:

```bash
OPENAI_API_KEY=your_openai_api_key
RPC_URL=https://base-sepolia.gateway.tenderly.co
NVM_ENVIRONMENT=sandbox

HTTP_AGENT_ID=did:nv:...
HTTP_AGENT_ENDPOINT=http://localhost:3001/ask

MCP_AGENT_ID=did:nv:...
MCP_AGENT_ENDPOINT=http://localhost:3002/mcp
```

## Tech Stack

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS
- **Backend**: Node.js, Express, TypeScript
- **Agent Protocols**: HTTP REST, MCP (Model Context Protocol via `@modelcontextprotocol/sdk`)
- **AI**: OpenAI GPT-4 for intent synthesis
- **Payments**: `@nevermined-io/payments` SDK, ethers.js for blockchain
- **Build**: Yarn Workspaces, tsx for dev, tsc for production builds

## TypeScript Configuration

Root `tsconfig.json` uses:
- `"module": "esnext"` / `"moduleResolution": "bundler"`
- `"strict": true` with `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`
- All packages use ES modules (`"type": "module"` in package.json)

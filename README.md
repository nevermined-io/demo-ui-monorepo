[![banner](https://raw.githubusercontent.com/nevermined-io/assets/main/images/logo/banner_logo.png)](https://nevermined.ai)

# Nevermined Demo UI Monorepo

A comprehensive demonstration platform showcasing communication with external AI agents through multiple transport protocols, built with React, TypeScript, and Express.

## Table of Contents

- [Overview](#overview)
- [Technical Architecture](#technical-architecture)
- [Installation Guide](#installation-guide)
- [Project Modules](#project-modules)
- [Agent Communication](#agent-communication)
- [External Resources](#external-resources)

## Overview

### What it does

This project demonstrates a **multi-agent communication platform** that enables users to interact with external AI agents through different transport protocols. It serves as a comprehensive example of how to integrate Nevermined's payment system with various AI agent architectures.

### How it works

The platform acts as a **proxy and orchestration layer** between frontend applications and external AI agents, handling:

- **Authentication and authorization** using Nevermined's payment system
- **Credit management** with blockchain-based transactions
- **Agent communication** via HTTP REST and MCP (Model Context Protocol)
- **Intent synthesis** using OpenAI's LLM services
- **Response processing** and user experience optimization

### Purpose and Use Cases

- **Demonstration**: Showcase Nevermined's agent ecosystem capabilities
- **Integration Reference**: Provide implementation patterns for agent communication
- **Development Platform**: Enable rapid prototyping of agent-based applications
- **Payment Integration**: Demonstrate blockchain-based credit systems for AI services

## Technical Architecture

### Core Technologies

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS
- **Backend**: Node.js, Express, TypeScript
- **Monorepo**: Yarn Workspaces
- **Agent Protocols**: HTTP REST, MCP (Model Context Protocol)
- **AI Services**: OpenAI GPT-4
- **Payment System**: [Nevermined Payments SDK](https://docs.nevermined.app/)

### Architecture Overview

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend        │    │  External       │
│   (React)       │◄──►│   (Express)      │◄──►│  Agents         │
│                 │    │                  │    │                 │
│ • HTTP Client   │    │ • API Routes     │    │ • HTTP Agent    │
│ • MCP Client    │    │ • Auth Service   │    │ • MCP Agent     │
│ • UI Components │    │ • Payment Logic  │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌──────────────────┐
                       │   External       │
                       │   Services       │
                       │                  │
                       │ • OpenAI API     │
                       │ • Nevermined     │
                       │ • Blockchain     │
                       └──────────────────┘
```

## Installation Guide

### Prerequisites

- **Node.js**: Version 20 or higher
- **Yarn**: Version 1.22.22 (auto-configured via Corepack)

### Step-by-Step Installation

#### 1. Clone the Repository

```bash
git clone <repository-url>
cd demo-ui-monorepo
```

#### 2. Install Dependencies

```bash
# Install all workspace dependencies
yarn install
```

#### 3. Environment Configuration

Create a `.env` file in the project root:

```bash
OPENAI_API_KEY=your_openai_api_key_here
RPC_URL=https://base-sepolia.gateway.tenderly.co

NVM_ENVIRONMENT=sandbox

HTTP_AGENT_ID=did:nv:f82254a93e8486e102031b6567c2d734f21a71ca793358b1a07d03eb409a546a
HTTP_AGENT_ENDPOINT=http://localhost:3001/ask

MCP_AGENT_ID=did:nv:3fe43029c257aad4694ad037e4ceae5360d7f2061c7982117bf8da9c20614000
MCP_AGENT_ENDPOINT=http://localhost:3002/mcp
```

#### 4. Build the Project

```bash
# Build all packages and applications
yarn build
```

#### 5. Start Development Server

```bash
# Start with default demo app
yarn dev

# Start with HTTP agent app
yarn serve:app:http

# Start with MCP agent app
yarn serve:app:mcp
```

#### 6. Access the Application

- **Main Application**: http://localhost:3000
- **HTTP Agent App**: http://localhost:3000/simple-agent/
- **MCP Agent App**: http://localhost:3000/mcp-agent/

### Production Deployment

```bash
# Build for production
yarn build

# Start production server
yarn start
```

### Docker Deployment

```bash
# Build Docker image
docker build -t demo-ui-monorepo .

# Run container
docker run -p 3000:3000 \
  -e OPENAI_API_KEY=your_key \
  -e RPC_URL=your_rpc_url \
  ... \
  demo-ui-monorepo
```

## Project Modules

### Frontend Applications (`apps/`)

#### `apps/demo-app/`
- **Purpose**: Landing page and application selector
- **Technology**: React + Vite
- **Features**: Navigation between different agent types

#### `apps/agent-http-app/`
- **Purpose**: HTTP agent communication interface
- **Technology**: React + TypeScript
- **Features**: Financial advisor chat interface

#### `apps/agent-mcp-app/`
- **Purpose**: MCP agent communication interface
- **Technology**: React + TypeScript
- **Features**: Weather agent with tool-based interactions

### Backend Services (`packages/`)

#### `packages/server-core/`
- **Purpose**: Main Express server and application orchestrator
- **Technology**: Node.js + Express + TypeScript
- **Features**: Static file serving, Vite middleware, route management

#### `packages/server-api/`
- **Purpose**: API endpoints and business logic
- **Technology**: Express + TypeScript
- **Features**: Agent communication, payment processing, LLM services

#### `packages/transport-http/`
- **Purpose**: HTTP agent client implementation
- **Technology**: TypeScript
- **Features**: HTTP REST communication with external agents

#### `packages/transport-mcp/`
- **Purpose**: MCP agent client implementation
- **Technology**: TypeScript + MCP SDK
- **Features**: Model Context Protocol communication

#### `packages/ui-core/`
- **Purpose**: Shared UI components and utilities
- **Technology**: React + TypeScript + Tailwind
- **Features**: Reusable components, state management, API clients

#### `packages/config/`
- **Purpose**: Configuration management
- **Technology**: TypeScript
- **Features**: Environment variables, agent configurations

#### `packages/domain/`
- **Purpose**: Type definitions and interfaces
- **Technology**: TypeScript
- **Features**: Shared types across the application

#### `packages/payments-client/`
- **Purpose**: Nevermined payments integration
- **Technology**: TypeScript + Nevermined SDK
- **Features**: Credit management, payment processing

## Agent Communication

### Communication Architecture

The platform implements a **multi-layered communication architecture** that abstracts different agent protocols behind a unified interface.

### Actors Involved

1. **Frontend Applications**: User interface and interaction layer
2. **Backend Express Server**: Orchestration and proxy layer
3. **External Agents**: AI services running on different protocols
4. **Nevermined Payment System**: Blockchain-based credit management
5. **OpenAI Services**: LLM for intent synthesis and routing

### Communication Types

#### 1. HTTP Agent Communication

**Protocol**: HTTP REST API
**Agent Type**: Financial Advisor
**Capabilities**: Conversational tasks, financial analysis

**Flow**:
```
User Input → Frontend → Backend → OpenAI (Intent Synthesis) → HTTP Agent → Response
```

**Implementation**:
- Uses standard HTTP POST requests
- Bearer token authentication
- JSON payload with `input_query` field
- Direct response from agent

#### 2. MCP Agent Communication

**Protocol**: Model Context Protocol
**Agent Type**: Weather Agent
**Capabilities**: Tool-based interactions, structured responses

**Flow**:
```
User Input → Frontend → Backend → OpenAI (Tool Selection) → MCP Client → MCP Agent → Response
```

**Implementation**:
- Uses MCP SDK for protocol communication
- Tool discovery and execution
- Structured response parsing
- Connection management

### Detailed Communication Flow

#### 1. User Authentication and Checkout Flow

```typescript
// Frontend stores user credentials
const apiKey = localStorage.getItem("nvmApiKey");
const planId = localStorage.getItem("nvmPlanId_http"); // or _mcp

// If no credentials, redirect to Stripe checkout
if (!apiKey || !planId) {
  const checkoutUrl = buildNeverminedCheckoutUrl(agentId, {
    returnApiKey: true,
    returnUrl: window.location.href
  });
  window.location.href = checkoutUrl;
}
```

#### 2. Post-Checkout Credential Processing

```typescript
// After Stripe checkout, extract credentials from URL
useEffect(() => {
  const parsedKey = extractApiKeyFromUrl(true);
  if (parsedKey) {
    setWithTTL("nvmApiKey", parsedKey);
    setApiKey(parsedKey);
    console.log("🔑 Extracted API Key from URL:", parsedKey);
  }
  
  const parsedPlan = extractPlanIdFromUrl(true);
  if (parsedPlan) {
    setStoredPlanId(parsedPlan);
    setPlanId(parsedPlan);
  }
}, []);
```

#### 3. Request Processing

```typescript
// Frontend sends request to backend
const response = await fetch("/api/agent", {
  method: "POST",
  headers: {
    "Authorization": `Bearer ${apiKey}`,
    "X-Plan-Id": planId,
    "X-Agent-Mode": transport // "http" or "mcp"
  },
  body: JSON.stringify({ input_query: userMessage })
});
```

#### 4. Backend Processing

```typescript
// Backend validates credentials and determines agent type
const nvmApiKey = req.headers.authorization.replace("Bearer ", "");
const planId = req.headers["x-plan-id"];
const mode = req.headers["x-agent-mode"]; // "http" or "mcp"

// Load agent configuration
const agentConfig = loadAgentConfig(mode);
```

#### 5. Intent Synthesis (OpenAI)

```typescript
// For HTTP agents: Synthesize user intent into clear instruction
const intent = await llmIntentSynthesizer(
  history,
  agentPrompt, // Agent-specific prompt
  undefined   // No tools for HTTP
);

// For MCP agents: Select appropriate tool and arguments
const toolCall = await llmIntentSynthesizer(
  history,
  agentPrompt,
  toolsCatalog // Available MCP tools
);
// Returns: { tool: "weather.today", args: { city: "Madrid" } }
```

#### 6. Agent Access Token Generation

```typescript
// Get agent-specific access token from Nevermined
const { accessToken } = await getAgentAccessToken(
  nvmApiKey,
  planId,
  agentId,
  environment
);
```

#### 7. Agent Communication

**HTTP Agent**:
```typescript
const response = await fetch(agentEndpoint, {
  method: "POST",
  headers: {
    "Authorization": `Bearer ${accessToken}`,
    "Content-Type": "application/json"
  },
  body: JSON.stringify({ input_query: intent })
});
```

**MCP Agent**:
```typescript
const transport = new StreamableHTTPClientTransport(new URL(endpoint), {
  requestInit: { headers: { Authorization: `Bearer ${accessToken}` } }
});

const client = new McpClient({ name: "weather-mcp-client", version: "0.1.0" });
await client.connect(transport);

const result = await client.callTool({
  name: toolCall.tool,
  arguments: toolCall.args
});
```

### Nevermined Payments Integration

#### Credit Management System

The platform integrates deeply with Nevermined's payment system for **blockchain-based credit management** with **Stripe checkout integration**:

#### 1. Credit Verification and Checkout Flow

```typescript
// Check user credits before processing requests
const credits = await getUserCredits(nvmApiKey, planId);
const needsApiKey = !apiKey;
const insufficientCredits = credits !== null && credits <= 0;

if (needsApiKey || insufficientCredits) {
  // Redirect to Stripe checkout via Nevermined
  const checkoutUrl = buildNeverminedCheckoutUrl(agentId, {
    returnApiKey: needsApiKey,
    returnUrl: window.location.href
  });
  window.location.href = checkoutUrl;
}
```

#### 2. Stripe Checkout Integration

The platform uses **Nevermined's Stripe-powered checkout** for seamless credit purchases:

**Checkout URL Structure:**
```
https://nevermined.app/checkout/{agentId}?export=nvm-api-key&returnUrl={returnUrl}
```

**Parameters:**
- `agentId`: The Nevermined agent identifier
- `export=nvm-api-key`: Requests API key to be returned after purchase
- `returnUrl`: Where to redirect after successful payment

**Test Card for Development:**
- **Card Number**: `4242 4242 4242 4242`
- **Expiry**: Any future date
- **CVC**: Any 3-digit number

#### 3. Post-Checkout Credential Extraction

After successful Stripe payment, users are redirected back with credentials in URL parameters:

```typescript
// Extract API key from URL after checkout return
const parsedKey = extractApiKeyFromUrl(true);
if (parsedKey) {
  setWithTTL("nvmApiKey", parsedKey);
  setApiKey(parsedKey);
  console.log("🔑 Extracted API Key from URL:", parsedKey);
}

// Extract Plan ID from URL after checkout return
const parsedPlan = extractPlanIdFromUrl(true);
if (parsedPlan) {
  setStoredPlanId(parsedPlan);
  setPlanId(parsedPlan);
}
```

#### 4. Access Token Generation

```typescript
// Generate agent-specific access tokens using purchased credentials
const payments = initializePayments(nvmApiKey, environment);
const agentAccessParams = await payments.agents.getAgentAccessToken(
  planId,
  agentId
);
```

#### 5. Credit Consumption and Redemption

```typescript
// Credits are automatically consumed when agents respond
// The response includes redemption information
{
  "output": "Agent response...",
  "redemptionResult": {
    "txHash": "0x123...",
    "creditsRedeemed": 1
  }
}
```

#### 6. Blockchain Integration

```typescript
// Monitor blockchain events for credit transactions
const mintEvent = await findMintEvent(
  contractAddress,
  walletAddress,
  tokenId,
  fromBlock
);
```

#### 7. Complete Purchase Flow

**Step-by-Step Process:**

1. **User Interaction**: User sends message requiring agent service
2. **Credit Check**: System verifies if user has API key and sufficient credits
3. **Checkout Redirect**: If missing, redirect to Nevermined Stripe checkout
4. **Stripe Payment**: User completes payment with credit card
5. **Credential Return**: Nevermined redirects back with API key and plan ID in URL
6. **Credential Storage**: System extracts and stores credentials in localStorage
7. **Service Provision**: Agent service is provided using purchased credits
8. **Credit Consumption**: Credits are automatically deducted per usage

### Security and Authentication

#### Multi-Layer Security

1. **User Authentication**: Nevermined API keys
2. **Agent Authentication**: Agent-specific access tokens
3. **Credit Verification**: Blockchain-based validation
4. **Request Validation**: Input sanitization and type checking

#### Token Management

- **User API Keys**: Stored in localStorage with TTL
- **Agent Access Tokens**: Generated per request, not stored
- **Plan IDs**: Transport-specific namespacing
- **Environment Isolation**: Sandbox vs Production

### Error Handling and Resilience

#### Graceful Degradation

- **Agent Unavailable**: Fallback to error messages
- **Credit Insufficient**: Prompt for credit purchase
- **Network Issues**: Retry mechanisms and timeouts
- **Invalid Responses**: Default error handling

#### Monitoring and Logging

- **Request Tracking**: Full request/response logging
- **Error Reporting**: Detailed error information
- **Performance Metrics**: Response time monitoring
- **Credit Usage**: Transaction tracking

## External Resources

### Documentation Links

- [Nevermined Documentation](https://docs.nevermined.app/)
- [Model Context Protocol (MCP) Documentation](https://modelcontextprotocol.io/)
- [OpenAI API Documentation](https://platform.openai.com/docs)

### Agent Repositories

- [HTTP Agent Repository](https://github.com/nevermined-io/tutorials/tree/main/financial-agent) - Financial Advisor Agent
- [MCP Agent Repository](https://github.com/nevermined-io/tutorials/tree/main/mcp-examples/weather-mcp) - Weather Agent

### Related Projects

- [Nevermined Payments SDK](https://github.com/nevermined-io/payments)
- [MCP SDK](https://github.com/modelcontextprotocol/sdk)

### Community and Support

- [GitHub Issues](https://github.com/nevermined-io/demo-ui-monorepo/issues)

---


## License

```
Apache License 2.0

(C) 2025 Nevermined AG

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at:

   http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions
and limitations under the License. 

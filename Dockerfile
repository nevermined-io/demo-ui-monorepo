# syntax=docker/dockerfile:1.7

# --- Builder stage: install deps and build client + server ---
    FROM --platform=linux/amd64 node:20-alpine AS builder
    WORKDIR /app

    # Install dependencies needed for native modules
    RUN apk add --no-cache python3 make g++

    # Enable Corepack for Yarn 4
    RUN corepack enable

    # Copy Yarn 4 configuration and manifests
    COPY .yarnrc.yml package.json yarn.lock ./

    # Install all deps (including dev) for build
    RUN yarn install --immutable
    
    # Copy the rest of the project
    COPY . .
    
    # Fix Rollup native dependencies issue
    RUN rm -rf node_modules/@rollup/rollup-* && yarn install --immutable
    
    # Build-time variables for the client (Vite picks them up)
    # Common variables
    # HTTP Agent variables
    ARG HTTP_AGENT_ID=""
    ENV HTTP_AGENT_ID=${HTTP_AGENT_ID}
    
    ARG HTTP_AGENT_ENDPOINT=""
    ENV HTTP_AGENT_ENDPOINT=${HTTP_AGENT_ENDPOINT}
    
    # MCP Agent variables
    ARG MCP_AGENT_ID=""
    ENV MCP_AGENT_ID=${MCP_AGENT_ID}
    
    ARG MCP_AGENT_ENDPOINT=""
    ENV MCP_AGENT_ENDPOINT=${MCP_AGENT_ENDPOINT}
    
    # Server environment variables
    ARG NVM_ENVIRONMENT="sandbox"
    ENV NVM_ENVIRONMENT=${NVM_ENVIRONMENT}
    
    # API Keys and external services
    ARG OPENAI_API_KEY=""
    ENV OPENAI_API_KEY=${OPENAI_API_KEY}
    
    ARG RPC_URL=""
    ENV RPC_URL=${RPC_URL}
    
    # Build: Vite creates dist/public and esbuild bundles server to dist/index.js
    # Build packages first, then apps to ensure proper dependency order
    RUN yarn build:packages && yarn build:apps
    
    # --- Runtime stage: run the production server ---
    FROM --platform=linux/amd64 node:20-alpine AS runner
    WORKDIR /app
    ENV NODE_ENV=production

    # Copy built artifacts and dependencies from builder
    COPY --from=builder /app/packages ./packages
    COPY --from=builder /app/apps ./apps
    COPY --from=builder /app/node_modules ./node_modules
    COPY --from=builder /app/package.json ./package.json
    
    # The app listens on 3000
    EXPOSE 3000
    
    # Healthcheck using Node's http module
    HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
      CMD node -e "require('http').request({host:'127.0.0.1',port:3000,path:'/'},r=>process.exit(r.statusCode>=200&&r.statusCode<500?0:1)).on('error',()=>process.exit(1)).end()"
    
    # Run the server
    CMD ["node", "packages/server-core/dist/index.js"]
    
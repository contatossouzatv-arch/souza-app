FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY src ./src
COPY scripts ./scripts

RUN mkdir -p uploads private_uploads

ENV NODE_ENV=production

# Health check: Cloud Run usa isso para saber se a instância está pronta
# Sem isso, requests chegam antes do pool do banco conectar → erro imediato
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:${PORT:-3011}/api/health || exit 1

CMD ["node", "--max-old-space-size=384", "src/server.js"]

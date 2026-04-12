FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY src ./src
COPY scripts ./scripts

RUN mkdir -p uploads private_uploads

ENV NODE_ENV=production

# Health check: Cloud Run usa isso para saber se a instância está pronta.
# O servidor escuta na porta ${PORT} (padrão 8080 no Cloud Run).
# O endpoint /health retorna 503 enquanto o DB não estiver acessível.
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=5 \
  CMD wget -qO- http://localhost:${PORT:-8080}/health || exit 1

CMD ["node", "--max-old-space-size=384", "src/server.js"]

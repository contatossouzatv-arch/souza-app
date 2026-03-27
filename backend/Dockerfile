FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY src ./src
COPY scripts ./scripts

RUN mkdir -p uploads private_uploads

ENV NODE_ENV=production

CMD ["npm", "run", "start:prod"]

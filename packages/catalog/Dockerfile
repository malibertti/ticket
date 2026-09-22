FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=4000 COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable && corepack prepare pnpm@10 --activate && apk add --no-cache dumb-init

COPY dist .
RUN pnpm install --prod --frozen-lockfile

USER node
EXPOSE 4000
CMD ["dumb-init", "node", "main.js"]
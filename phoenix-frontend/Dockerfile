FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json tsconfig.json next.config.mjs ./
RUN npm ci

COPY src ./src
COPY public ./public
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV NEXT_TELEMETRY_DISABLED=1

COPY package*.json next.config.mjs ./
RUN npm ci --omit=dev

COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public

EXPOSE 3000

USER node
CMD ["npm", "start"]


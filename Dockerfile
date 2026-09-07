# StealthRDP v2 — zero-dependency static+proxy server
FROM node:22-bookworm-slim

ENV NODE_ENV=production PORT=8080
WORKDIR /app

COPY . .

# Keep deployment deterministic and dependency-free.
# The exact Win11 React experience is proxied at runtime through the existing
# Node server, avoiding a second git/npm build inside Coolify.
RUN node scripts/patch-win11-runtime-proxy.mjs \
  && node scripts/apply-visual-reframe.mjs

EXPOSE 8080
CMD ["node", "server.js"]

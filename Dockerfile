# StealthRDP v2 — zero-dependency static+proxy server
# Base image matches the proven fleet pattern (FinancialControl uses
# node:22-bookworm-slim on this host).
FROM node:22-bookworm-slim

ENV NODE_ENV=production PORT=8080

WORKDIR /app

# No runtime dependencies — server.js is zero-dependency Node.
COPY . .

EXPOSE 8080

CMD ["node", "server.js"]

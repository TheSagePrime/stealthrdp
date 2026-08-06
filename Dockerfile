FROM node:20-alpine

WORKDIR /app

# No runtime dependencies — server.js is zero-dependency Node.
COPY . .

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/healthz || exit 1

CMD ["node", "server.js"]

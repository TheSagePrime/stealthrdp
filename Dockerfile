# Build the exact CC0 yyqyu/win11 React demo at a pinned upstream commit.
FROM node:16-bullseye AS win11-builder

ENV CI=false PUBLIC_URL=/win11-demo
WORKDIR /win11

RUN apt-get update \
  && apt-get install -y --no-install-recommends git python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

RUN git clone https://github.com/yyqyu/win11.git . \
  && git checkout 7994499f4f27e71553f3e9e83fba65bd6da20678

COPY scripts/patch-win11-source.mjs /tmp/patch-win11-source.mjs
RUN node /tmp/patch-win11-source.mjs /win11
RUN npm ci --legacy-peer-deps
RUN npm run build

# StealthRDP production runtime remains dependency-free.
FROM node:22-bookworm-slim

ENV NODE_ENV=production PORT=8080
WORKDIR /app

COPY . .

# Real Win11React build. CRA bundle lives below /win11-demo while the original
# app's hard-coded /img/* assets are served from the root /img namespace.
COPY --from=win11-builder /win11/build ./win11-demo
COPY --from=win11-builder /win11/public/img ./img

RUN node scripts/apply-visual-reframe.mjs

EXPOSE 8080
CMD ["node", "server.js"]

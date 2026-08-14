FROM node:22-bookworm-slim
ENV NODE_ENV=production PORT=8080
WORKDIR /app
COPY . .
EXPOSE 8080
CMD ["node", "server.js"]

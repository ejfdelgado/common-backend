# Stage 1: Build
FROM node:20 AS builder
WORKDIR /app
COPY package*.json tsconfig.json ./
RUN npm install
COPY src ./src
RUN npm run build

# Stage 2: Runtime
FROM node:20-slim
WORKDIR /app
COPY --from=builder /app/package*.json ./
RUN npm install --only=production
COPY --from=builder /app/dist ./dist

# Expose port 8080 (Cloud Run expects this)
EXPOSE 8080
CMD ["node", "dist/server.js"]

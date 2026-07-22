# Dockerfile — portable deploy for Railway, Fly.io, Cloud Run, a VPS, etc.
FROM node:20-alpine

WORKDIR /app

# Install deps first for better layer caching.
COPY package*.json ./
RUN npm install --omit=dev

# Copy the rest of the app.
COPY . .

# The host sets PORT; server.js falls back to 3000 locally.
ENV PORT=3000
EXPOSE 3000

CMD ["npm", "start"]

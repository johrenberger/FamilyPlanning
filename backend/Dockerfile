FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY db/ ./db/
COPY dal/ ./dal/
COPY services/ ./services/
COPY routes/ ./routes/
COPY server.js ./

EXPOSE 3001

# Run migrations on start, then serve API
CMD ["sh", "-c", "node db/migrate.js && node server.js"]
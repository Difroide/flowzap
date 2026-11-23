FROM node:20-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ .
RUN npm run build

FROM node:20-alpine
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci --omit=dev
COPY backend/ .
COPY --from=frontend-build /app/frontend/dist /app/frontend/dist
RUN mkdir -p /app/backend/media
ENV PORT=4300
EXPOSE 4300
CMD ["node", "src/index.js"]

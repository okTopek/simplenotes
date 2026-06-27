# ---- Build stage: compile the Vite app ----
FROM node:20-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# VITE_API_URL must be present at build time (Vite inlines it into the bundle).
# Railway injects service variables as build args for Dockerfile builds.
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

# ---- Run stage: serve the static dist/ on $PORT ----
FROM node:20-alpine AS run

WORKDIR /app
RUN npm install -g serve@14

COPY --from=build /app/dist ./dist

ENV PORT=8080
EXPOSE 8080

CMD ["sh", "-c", "serve -s dist -l ${PORT:-8080}"]

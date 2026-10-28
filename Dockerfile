FROM node:22-bookworm-slim AS builder

RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

RUN npm install -g bare-runtime

COPY . .
RUN npm run generate:assets
RUN npx bare-build --standalone --name lotura --out build src/main.ts

FROM debian:bookworm-slim AS runtime

RUN apt-get update && apt-get install -y ca-certificates && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=builder /app/build/lotura /usr/local/bin/lotura

RUN mkdir -p /data && chmod 700 /data

EXPOSE 7575

ENV BOOKMARKNET_BIND=0.0.0.0
ENV BOOKMARKNET_DATA_DIR=/data
ENV BOOKMARKNET_PORT=7575
ENV BOOKMARKNET_OPEN_BROWSER_ON_START=false

VOLUME ["/data"]

ENTRYPOINT ["/usr/local/bin/lotura"]

FROM oven/bun:1

WORKDIR /app

RUN bun add jszip

COPY server.ts .
COPY index.html .
COPY styles.css .
COPY favicon.png .
COPY favicon.svg .
COPY logos/ logos/

EXPOSE 8080

CMD ["bun", "run", "server.ts"]

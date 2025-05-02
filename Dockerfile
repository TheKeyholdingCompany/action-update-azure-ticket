FROM oven/bun:latest
COPY package.json /app/
COPY index.ts /app/

# run the app
ENTRYPOINT [ "bun", "run", "/app/index.ts" ]

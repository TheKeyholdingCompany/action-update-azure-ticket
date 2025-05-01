FROM oven/bun:latest AS base
WORKDIR /app

# copy production dependencies and source code into final image
FROM base AS release
COPY package.json /app/
COPY index.ts /app/

# run the app
ENTRYPOINT [ "bun", "run", "/app/index.ts" ]

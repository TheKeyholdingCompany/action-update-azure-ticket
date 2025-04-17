FROM oven/bun:latest AS base
WORKDIR /app

FROM base AS install
RUN mkdir -p /temp/prod
COPY package.json bun.lock /temp/prod/
RUN cd /temp/prod && bun install --frozen-lockfile --production

# copy production dependencies and source code into final image
FROM base AS release
COPY --from=install /temp/prod/node_modules /app/
COPY --from=install /temp/prod/package.json /app/
COPY index.ts /app/

# run the app
USER bun
ENTRYPOINT [ "bun", "run", "index.ts" ]

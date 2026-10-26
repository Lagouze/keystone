# Keystone keeper (Fastify + SSE) for a Node host such as Railway. The web app is built and served by Vercel.
FROM node:24-slim
WORKDIR /app

# Manifests first: the dependency layer is reused until a package.json or the lockfile changes.
COPY package.json package-lock.json ./
COPY app/package.json app/
COPY keeper/package.json keeper/
COPY packages/shared/package.json packages/shared/
COPY packages/vault-client/package.json packages/vault-client/
COPY scripts/package.json scripts/
RUN npm ci --workspace=@keystone/keeper --workspace=vault-client --workspace=@keystone/shared --include-workspace-root

COPY packages packages
COPY keeper keeper
COPY deployments deployments
# The generated contract bindings are not versioned: compile them into packages/vault-client/dist.
RUN npm run build -w vault-client

# Hosted defaults; the host sets PORT, KEEPER_SECRET, KEEPER_ACCESS_TOKENS and the origins (see README).
ENV NODE_ENV=production \
    KEEPER_HOST=0.0.0.0 \
    KEEPER_BACKEND=testnet \
    SIGNER=freighter \
    KEEPER_DATA_DIR=/data
EXPOSE 8787
CMD ["node_modules/.bin/tsx", "keeper/src/index.ts"]

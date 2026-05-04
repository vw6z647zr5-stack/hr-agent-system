FROM node:20-alpine AS base
WORKDIR /app

COPY package.json tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json

RUN npm install

FROM base AS build
COPY apps/api apps/api
RUN npm --workspace @hr-agent-system/api run build

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY package.json tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN npm install --registry=https://registry.npmmirror.com --omit=dev --registry=https://registry.npmmirror.com

COPY --from=build /app/apps/api/dist apps/api/dist
COPY apps/api/src apps/api/src
COPY docs docs
RUN mkdir -p uploads docs/company/managed docs/policies/managed

EXPOSE 3000
CMD ["node", "apps/api/dist/main.js"]

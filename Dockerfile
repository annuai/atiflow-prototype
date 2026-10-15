# Ati Flow front end: build once, serve static files with nginx. Environment settings are NOT baked in: they are written to /config.json when the container starts (see deploy/README in docs/deploy.md).
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json .nvmrc ./
RUN npm ci
COPY . .
ARG RELEASE=dev
ENV VITE_RELEASE=$RELEASE
RUN npx vite build

FROM nginx:1.27-alpine
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY deploy/40-config.sh /docker-entrypoint.d/40-config.sh
RUN chmod +x /docker-entrypoint.d/40-config.sh
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080

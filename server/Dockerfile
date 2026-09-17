FROM node:22-alpine
WORKDIR /srv
COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY server/package.json server/
RUN npm ci --omit=dev -w server -w shared
COPY shared shared
COPY server server
ENV PORT=2567 DATA_FILE=/data/db.json NODE_ENV=production
VOLUME ["/data"]
EXPOSE 2567
CMD ["npm", "run", "start", "-w", "server"]

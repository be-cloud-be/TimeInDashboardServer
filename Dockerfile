FROM node:10

WORKDIR /usr/app

COPY package.json package-lock.json ./
RUN npm install --quiet

COPY . .

EXPOSE 4201/tcp

CMD ["node","server.js"]

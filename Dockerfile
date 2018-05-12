FROM node:10

WORKDIR /usr/app

COPY package.json package-lock.json ./
RUN npm install --quiet

COPY . .

CMD node server.js

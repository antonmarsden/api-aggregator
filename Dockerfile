FROM node:alpine

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm install --only=production

COPY . .

EXPOSE 3080

CMD [ "npm", "start" ]

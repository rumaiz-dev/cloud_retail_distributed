FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --only=production
COPY shared ./shared
COPY . .
EXPOSE 3001
CMD ["node", "src/server.js"]

FROM node:26-alpine

WORKDIR /app

COPY . .

CMD ["sh", "-c", "node --test tests/*.test.js"]

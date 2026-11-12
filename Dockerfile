FROM node:20-alpine

WORKDIR /app

COPY . .

CMD ["sh", "-c", "node --test tests/*.test.js"]

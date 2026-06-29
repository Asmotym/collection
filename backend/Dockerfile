FROM node:22-alpine AS deps
WORKDIR /app
COPY backend/package*.json ./backend/
RUN npm install --prefix backend

FROM deps AS build
COPY backend ./backend
COPY shared ./shared
RUN npm run build --prefix backend

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/backend/node_modules ./backend/node_modules
COPY --from=build /app/backend/dist ./backend/dist
COPY backend/package.json ./backend/package.json
WORKDIR /app/backend
EXPOSE 3000
CMD ["npm", "run", "start"]

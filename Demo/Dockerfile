# 中文註解：第一階段使用 Node 建置前端靜態檔。
FROM node:24-bookworm-slim AS build

WORKDIR /app

# 中文註解：建置時可覆寫 API 位址，讓同一份映像可對接不同後端。
ARG VITE_API_BASE_URL=https://ilink-website.onrender.com/api/v1
ARG VITE_SITE_URL=https://usckh.com
ARG VITE_R2_PUBLIC_BASE_URL=https://pub-7a1b6685560e457bad83e2c14242ce38.r2.dev
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_SITE_URL=$VITE_SITE_URL
ENV VITE_R2_PUBLIC_BASE_URL=$VITE_R2_PUBLIC_BASE_URL

COPY package*.json ./
RUN npm ci --no-audit --no-fund

COPY . .
RUN npm run build

# 中文註解：第二階段只保留 nginx 與 dist 產物，縮小執行映像。
FROM nginx:1.27-alpine AS runtime

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]

# 1단계: 빌드 스테이지
FROM node:lts-alpine as build-stage
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# 2단계: 실행 스테이지 (Nginx)
FROM nginx:stable-alpine as production-stage
# 빌드 스테이지에서 생성된 정적 파일들을 Nginx 실행 경로로 복사
COPY --from=build-stage /app/dist /usr/share/nginx/html
COPY default.conf /etc/nginx/conf.d/default.conf
# Nginx 기본 포트 노출
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]

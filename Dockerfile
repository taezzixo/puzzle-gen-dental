# PuzzleGen Dental 사용성 평가 서버
# 빌드:  docker build -t puzzlegen-survey .
# 실행:  docker run -d -p 8080:8080 -e SURVEY_ADMIN_PIN=비밀번호 -v $(pwd)/data:/app/data puzzlegen-survey

FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build

# 실행 이미지: 서버는 Node 기본 모듈만 쓰므로 node_modules가 필요 없음
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=8080 SURVEY_DATA_DIR=/app/data
COPY package.json ./
COPY server ./server
COPY --from=build /app/dist ./dist
RUN mkdir -p /app/data && chown -R node:node /app
USER node
VOLUME ["/app/data"]
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD wget -qO- http://127.0.0.1:8080/healthz || exit 1
CMD ["node", "server/index.mjs"]

// PM2로 실행할 때 (Docker 없이 서버에 직접 설치하는 경우)
//   npm ci && npm run build
//   pm2 start ecosystem.config.cjs && pm2 save
// 관리자 비밀번호는 .env 파일의 SURVEY_ADMIN_PIN 을 사용합니다.
module.exports = {
  apps: [{
    name: "puzzlegen-survey",
    script: "server/index.mjs",
    instances: 1, // 응답을 파일로 저장하므로 반드시 1개만 실행
    autorestart: true,
    max_memory_restart: "300M",
    env: { NODE_ENV: "production", TZ: "Asia/Seoul" },
  }],
};

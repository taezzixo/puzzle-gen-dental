// 운영용 서버: 빌드된 화면(dist) + 설문 저장 API를 함께 제공합니다.
//   npm run build && npm start
// 환경변수: PORT(기본 8080), SURVEY_ADMIN_PIN(관리자 비밀번호), SURVEY_DATA_DIR(저장 폴더, 기본 ./data)
import http from "node:http";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createSurveyApi } from "./surveyApi.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const distDir = path.join(root, "dist");
const PORT = Number(process.env.PORT || 8080);
const ADMIN_PIN = process.env.SURVEY_ADMIN_PIN || "1234";
if (!process.env.SURVEY_ADMIN_PIN) console.warn("[경고] SURVEY_ADMIN_PIN 이 설정되지 않아 기본 관리자 비밀번호(1234)를 사용합니다.");

const api = createSurveyApi({ dataDir: process.env.SURVEY_DATA_DIR || path.join(root, "data"), adminPin: ADMIN_PIN });

const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".ico": "image/x-icon", ".json": "application/json", ".woff2": "font/woff2" };

http.createServer(async (req, res) => {
  const { pathname } = new URL(req.url, "http://local");
  if (pathname === "/api/survey") return api(req, res);
  let file = path.join(distDir, decodeURIComponent(pathname));
  if (!file.startsWith(distDir)) { res.statusCode = 403; return res.end(); }
  try {
    if ((await fs.stat(file)).isDirectory()) file = path.join(file, "index.html");
  } catch { file = path.join(distDir, "index.html"); }
  try {
    const data = await fs.readFile(file);
    res.setHeader("Content-Type", TYPES[path.extname(file)] || "application/octet-stream");
    res.end(data);
  } catch { res.statusCode = 404; res.end("Not found — 먼저 npm run build 를 실행하세요."); }
}).listen(PORT, () => console.log(`PuzzleGen Dental 서버: http://localhost:${PORT}  (설문 #/survey · 관리자 #/admin)`));

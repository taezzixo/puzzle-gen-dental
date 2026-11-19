// 운영용 Node 서버: 빌드된 화면(dist) + 설문 저장 API
//   npm run build && SURVEY_ADMIN_PIN=비밀번호 npm start
// 환경변수
//   SURVEY_ADMIN_PIN  관리자 비밀번호 (필수)
//   PORT              포트 (기본 8080)
//   HOST              바인딩 주소 (기본 0.0.0.0)
//   SURVEY_DATA_DIR   응답 저장 폴더 (기본 ./data)
// 외부 패키지 없이 Node 기본 모듈만 사용합니다 (Node 18 이상).
import http from "node:http";
import { promises as fs, readFileSync, existsSync } from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";
import { createSurveyApi } from "./surveyApi.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// .env 파일이 있으면 읽기 (이미 설정된 환경변수가 우선)
const envFile = path.join(root, ".env");
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, "$2");
  }
}

const distDir = path.join(root, "dist");
const PORT = Number(process.env.PORT || 8080);
const HOST = process.env.HOST || "0.0.0.0";
const ADMIN_PIN = (process.env.SURVEY_ADMIN_PIN || "").trim();
const DATA_DIR = path.resolve(process.env.SURVEY_DATA_DIR || path.join(root, "data"));

if (!ADMIN_PIN || ADMIN_PIN === "1234") {
  console.error("[오류] 관리자 비밀번호를 설정해 주세요. 예) SURVEY_ADMIN_PIN=원하는비밀번호 npm start  (또는 .env 파일에 SURVEY_ADMIN_PIN=...)");
  process.exit(1);
}
if (!existsSync(path.join(distDir, "index.html"))) {
  console.error("[오류] 빌드된 화면이 없습니다. 먼저 npm run build 를 실행해 주세요.");
  process.exit(1);
}
await fs.mkdir(DATA_DIR, { recursive: true });

const api = createSurveyApi({ dataDir: DATA_DIR, adminPin: ADMIN_PIN });

// ── 관리자 비밀번호 무차별 대입 방지: IP당 15분에 10회 실패 시 차단 ──
const fails = new Map();
const WINDOW = 15 * 60 * 1000, MAX_FAILS = 10;
// Cloudflare를 거친 요청은 CF-Connecting-IP에 실제 접속자 IP가 담김
const clientIp = (req) => String(req.headers["cf-connecting-ip"] || req.headers["x-forwarded-for"] || "").split(",")[0].trim() || req.socket.remoteAddress || "";
function pinGuard(req, res) {
  const url = new URL(req.url, "http://local");
  if (url.searchParams.get("action") !== "list") return false;
  const ip = clientIp(req), now = Date.now();
  const rec = fails.get(ip);
  if (rec && now - rec.first > WINDOW) fails.delete(ip);
  const cur = fails.get(ip);
  if (cur && cur.n >= MAX_FAILS) {
    res.statusCode = 429; res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify({ ok: false, code: "LOCKED", error: "비밀번호를 여러 번 틀려 잠시 차단되었습니다. 15분 후 다시 시도해 주세요." }));
    return true;
  }
  if (url.searchParams.get("pin") !== ADMIN_PIN) {
    const r = fails.get(ip) || { n: 0, first: now };
    r.n += 1; fails.set(ip, r);
  } else fails.delete(ip);
  return false;
}

// ── 정적 파일 (메모리 캐시 + gzip) ──
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".ico": "image/x-icon", ".json": "application/json", ".woff2": "font/woff2", ".txt": "text/plain; charset=utf-8" };
const COMPRESSIBLE = /^(text\/|application\/json|image\/svg)/;
const cache = new Map();
async function loadStatic(file) {
  if (cache.has(file)) return cache.get(file);
  const raw = await fs.readFile(file);
  const type = TYPES[path.extname(file)] || "application/octet-stream";
  const entry = { raw, type, gz: COMPRESSIBLE.test(type) && raw.length > 1024 ? zlib.gzipSync(raw, { level: 9 }) : null };
  cache.set(file, entry);
  return entry;
}

function securityHeaders(res) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "same-origin");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
}

const server = http.createServer(async (req, res) => {
  securityHeaders(res);
  const { pathname } = new URL(req.url, "http://local");
  if (pathname === "/healthz") { res.setHeader("Content-Type", "text/plain"); return res.end("ok"); }
  if (pathname === "/api/survey") {
    res.setHeader("Cache-Control", "no-store");
    if (pinGuard(req, res)) return;
    return api(req, res);
  }
  if (req.method !== "GET" && req.method !== "HEAD") { res.statusCode = 405; return res.end(); }

  let file = path.join(distDir, decodeURIComponent(pathname));
  if (!file.startsWith(distDir)) { res.statusCode = 403; return res.end(); }
  try {
    if ((await fs.stat(file)).isDirectory()) file = path.join(file, "index.html");
  } catch {
    file = path.join(distDir, "index.html"); // 해시 라우팅이라 모든 경로는 index.html
  }
  try {
    const { raw, type, gz } = await loadStatic(file);
    res.setHeader("Content-Type", type);
    // 파일명에 해시가 붙은 빌드 산출물은 오래 캐시, index.html은 매번 확인
    res.setHeader("Cache-Control", file.includes(`${path.sep}assets${path.sep}`) ? "public, max-age=31536000, immutable" : "no-cache");
    res.setHeader("Vary", "Accept-Encoding");
    const useGz = gz && /\bgzip\b/.test(req.headers["accept-encoding"] || "");
    if (useGz) res.setHeader("Content-Encoding", "gzip");
    const body = useGz ? gz : raw;
    res.setHeader("Content-Length", body.length);
    res.end(req.method === "HEAD" ? undefined : body);
  } catch {
    res.statusCode = 404; res.end("Not found");
  }
});

server.listen(PORT, HOST, () => {
  console.log(`PuzzleGen Dental 사용성 평가 서버 실행 중 — http://localhost:${PORT}`);
  console.log(`  평가자 설문 : http://localhost:${PORT}/#/survey`);
  console.log(`  관리자 모드 : http://localhost:${PORT}/#/admin`);
  console.log(`  응답 저장   : ${DATA_DIR}`);
});

const stop = () => { server.close(() => process.exit(0)); setTimeout(() => process.exit(0), 3000).unref(); };
process.on("SIGTERM", stop);
process.on("SIGINT", stop);

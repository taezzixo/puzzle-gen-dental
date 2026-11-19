// Cloudflare Worker "pgd": 설문 화면(빌드 파일 내장) + 저장 API(D1 데이터베이스)
// 배포: npm run cf:deploy  (SURVEY_README.md 참고)
import { handleSurvey, byCreated } from "../server/surveyCore.mjs";
import FILES from "./assets.gen.js";

// 응답은 성명(공백 제거) 기준으로 저장
const SCHEMA = [
  "CREATE TABLE IF NOT EXISTS survey_responses (name_key TEXT PRIMARY KEY, json TEXT NOT NULL, updated_at TEXT)",
  "CREATE TABLE IF NOT EXISTS survey_history (id INTEGER PRIMARY KEY AUTOINCREMENT, name_key TEXT NOT NULL, saved_at TEXT NOT NULL, json TEXT NOT NULL)",
  "CREATE TABLE IF NOT EXISTS pin_fails (ip TEXT PRIMARY KEY, n INTEGER NOT NULL, first INTEGER NOT NULL)",
];
let ready = null;
const ensureSchema = (db) => (ready ??= db.batch(SCHEMA.map((q) => db.prepare(q))).catch((e) => { ready = null; throw e; }));

function d1Store(db) {
  const parse = (row) => (row ? JSON.parse(row.json) : null);
  return {
    get: async (key) => parse(await db.prepare("SELECT json FROM survey_responses WHERE name_key = ?").bind(key).first()),
    all: async () => (await db.prepare("SELECT json FROM survey_responses").all()).results.map(parse).sort(byCreated),
    put: async (rec) => {
      const json = JSON.stringify(rec);
      await db.batch([
        db.prepare("INSERT INTO survey_responses (name_key, json, updated_at) VALUES (?1, ?2, ?3) ON CONFLICT(name_key) DO UPDATE SET json = ?2, updated_at = ?3").bind(rec.key, json, rec.savedAt),
        db.prepare("INSERT INTO survey_history (name_key, saved_at, json) VALUES (?, ?, ?)").bind(rec.key, rec.savedAt, json),
      ]);
    },
    remove: async (key) => { await db.prepare("DELETE FROM survey_responses WHERE name_key = ?").bind(key).run(); },
    getFails: async (ip) => await db.prepare("SELECT n, first FROM pin_fails WHERE ip = ?").bind(ip).first(),
    setFails: async (ip, v) => {
      if (v) await db.prepare("INSERT INTO pin_fails (ip, n, first) VALUES (?1, ?2, ?3) ON CONFLICT(ip) DO UPDATE SET n = ?2, first = ?3").bind(ip, v.n, v.first).run();
      else await db.prepare("DELETE FROM pin_fails WHERE ip = ?").bind(ip).run();
    },
  };
}

const json = (status, body) => new Response(body === null ? null : JSON.stringify(body), {
  status,
  headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
});

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/healthz") return new Response("ok");
    if (url.pathname === "/api/survey") {
      if (!env.DB) return json(500, { ok: false, error: "D1 데이터베이스(DB)가 연결되지 않았습니다" });
      await ensureSchema(env.DB);
      const r = await handleSurvey(
        { method: request.method, params: url.searchParams, bodyText: request.method === "POST" ? await request.text() : "", ip: request.headers.get("cf-connecting-ip") || "" },
        { store: d1Store(env.DB), adminPin: env.SURVEY_ADMIN_PIN },
      );
      return json(r.status, r.body);
    }
    // 그 외는 빌드된 화면(dist). 해시 라우팅이라 없는 경로는 index.html
    if (request.method !== "GET" && request.method !== "HEAD") return new Response(null, { status: 405 });
    const file = FILES[url.pathname] || FILES[url.pathname + "/index.html"] || FILES["/index.html"];
    const body = file.text ?? Uint8Array.from(atob(file.b64), (c) => c.charCodeAt(0));
    return new Response(request.method === "HEAD" ? null : body, {
      headers: {
        "Content-Type": file.type,
        // 파일명에 해시가 붙은 빌드 산출물은 오래 캐시, index.html은 매번 확인
        "Cache-Control": file.immutable ? "public, max-age=31536000, immutable" : "no-cache",
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "same-origin",
        "X-Frame-Options": "SAMEORIGIN",
      },
    });
  },
};

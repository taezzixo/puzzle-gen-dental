// Cloudflare Worker "pgd": 설문 화면(정적 파일) + 저장 API(D1 데이터베이스)
// 배포: npm run cf:deploy  (SURVEY_README.md 참고)
import { handleSurvey } from "../server/surveyCore.mjs";

const SCHEMA = [
  "CREATE TABLE IF NOT EXISTS responses (evaluator_id INTEGER PRIMARY KEY, json TEXT NOT NULL, updated_at TEXT)",
  "CREATE TABLE IF NOT EXISTS history (id INTEGER PRIMARY KEY AUTOINCREMENT, evaluator_id INTEGER NOT NULL, saved_at TEXT NOT NULL, json TEXT NOT NULL)",
  "CREATE TABLE IF NOT EXISTS pin_fails (ip TEXT PRIMARY KEY, n INTEGER NOT NULL, first INTEGER NOT NULL)",
];
let ready = null;
const ensureSchema = (db) => (ready ??= db.batch(SCHEMA.map((q) => db.prepare(q))).catch((e) => { ready = null; throw e; }));

function d1Store(db) {
  const parse = (row) => (row ? JSON.parse(row.json) : null);
  return {
    get: async (id) => parse(await db.prepare("SELECT json FROM responses WHERE evaluator_id = ?").bind(id).first()),
    all: async () => (await db.prepare("SELECT json FROM responses ORDER BY evaluator_id").all()).results.map(parse),
    put: async (rec) => {
      const json = JSON.stringify(rec);
      await db.batch([
        db.prepare("INSERT INTO responses (evaluator_id, json, updated_at) VALUES (?1, ?2, ?3) ON CONFLICT(evaluator_id) DO UPDATE SET json = ?2, updated_at = ?3").bind(rec.evaluatorId, json, rec.savedAt),
        db.prepare("INSERT INTO history (evaluator_id, saved_at, json) VALUES (?, ?, ?)").bind(rec.evaluatorId, rec.savedAt, json),
      ]);
    },
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
    return env.ASSETS.fetch(request);
  },
};

// 사용성 평가 응답 저장 API (Node 기본 모듈만 사용)
//   GET  /api/survey?action=get&id=3          → 평가자 본인 응답
//   GET  /api/survey?action=summary           → 평가자 선택 화면용 요약(이름 마스킹)
//   GET  /api/survey?action=list&pin=XXXX     → 관리자: 전체 응답
//   POST /api/survey  {action:"save", record} → 저장 (이전 버전은 history 폴더에 보관)
import { promises as fs } from "node:fs";
import path from "node:path";

const MAX_EVALUATORS = 50;
const MAX_BODY = 2 * 1024 * 1024;

const send = (res, status, obj) => {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(obj));
};

const validId = (v) => { const n = Number(v); return Number.isInteger(n) && n >= 1 && n <= MAX_EVALUATORS ? n : null; };
const maskName = (name) => {
  const s = String(name || "").trim();
  if (!s) return "";
  if (s.length <= 1) return s;
  if (s.length === 2) return s[0] + "*";
  return s[0] + "*".repeat(s.length - 2) + s[s.length - 1];
};

async function readJson(file) {
  try { return JSON.parse(await fs.readFile(file, "utf8")); } catch { return null; }
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on("data", (c) => { size += c.length; if (size > MAX_BODY) { reject(new Error("too large")); req.destroy(); } else chunks.push(c); });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

export function createSurveyApi({ dataDir, adminPin }) {
  const respDir = path.join(dataDir, "responses");
  const histDir = path.join(dataDir, "history");
  const fileOf = (id) => path.join(respDir, `evaluator-${id}.json`);

  async function allRecords() {
    await fs.mkdir(respDir, { recursive: true });
    const files = (await fs.readdir(respDir)).filter((f) => /^evaluator-\d+\.json$/.test(f));
    const recs = (await Promise.all(files.map((f) => readJson(path.join(respDir, f))))).filter(Boolean);
    return recs.sort((a, b) => a.evaluatorId - b.evaluatorId);
  }

  return async function handle(req, res) {
    try {
      const url = new URL(req.url, "http://local");
      if (req.method === "GET") {
        const action = url.searchParams.get("action");
        if (action === "get") {
          const id = validId(url.searchParams.get("id"));
          if (!id) return send(res, 400, { ok: false, error: "잘못된 평가자 번호" });
          return send(res, 200, { ok: true, record: await readJson(fileOf(id)) });
        }
        if (action === "summary") {
          const recs = await allRecords();
          return send(res, 200, { ok: true, summary: recs.map((r) => ({ evaluatorId: r.evaluatorId, name: maskName(r.answers?.consent?.name), status: r.status, progress: r.progress ?? null, updatedAt: r.updatedAt })) });
        }
        if (action === "list") {
          if (String(url.searchParams.get("pin") || "") !== String(adminPin)) return send(res, 403, { ok: false, code: "BAD_PIN", error: "관리자 비밀번호가 올바르지 않습니다" });
          return send(res, 200, { ok: true, records: await allRecords() });
        }
        return send(res, 400, { ok: false, error: "알 수 없는 요청" });
      }
      if (req.method === "POST") {
        const body = JSON.parse(await readBody(req));
        if (body.action !== "save" || !body.record) return send(res, 400, { ok: false, error: "알 수 없는 요청" });
        const rec = body.record;
        const id = validId(rec.evaluatorId);
        if (!id || typeof rec.answers !== "object") return send(res, 400, { ok: false, error: "잘못된 응답 데이터" });
        const prev = await readJson(fileOf(id));
        // 제출 완료된 응답은 관리자 외에는 다시 '작성 중'으로 되돌리지 않음
        if (prev?.status === "submitted" && rec.status !== "submitted") rec.status = "submitted";
        const savedAt = new Date().toISOString();
        const out = { ...rec, evaluatorId: id, savedAt, createdAt: prev?.createdAt || rec.createdAt || savedAt, saveCount: (prev?.saveCount || 0) + 1 };
        await fs.mkdir(respDir, { recursive: true });
        await fs.mkdir(histDir, { recursive: true });
        const tmp = `${fileOf(id)}.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`;
        await fs.writeFile(tmp, JSON.stringify(out, null, 2), "utf8");
        await fs.rename(tmp, fileOf(id));
        await fs.writeFile(path.join(histDir, `evaluator-${id}-${savedAt.replace(/[:.]/g, "-")}.json`), JSON.stringify(out), "utf8");
        return send(res, 200, { ok: true, savedAt });
      }
      if (req.method === "OPTIONS") { res.statusCode = 204; return res.end(); }
      send(res, 405, { ok: false, error: "허용되지 않는 요청" });
    } catch (e) {
      send(res, 500, { ok: false, error: "서버 오류: " + e.message });
    }
  };
}

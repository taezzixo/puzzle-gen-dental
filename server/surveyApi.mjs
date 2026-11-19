// Node용 저장 API 어댑터: 응답을 디스크의 JSON 파일로 저장 (npm start · npm run dev)
//   data/responses/evaluator-N.json  최신본
//   data/history/evaluator-N-<시각>.json  저장할 때마다 이력
import { promises as fs } from "node:fs";
import path from "node:path";
import { handleSurvey } from "./surveyCore.mjs";

async function readJson(file) {
  try { return JSON.parse(await fs.readFile(file, "utf8")); } catch { return null; }
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on("data", (c) => { size += c.length; if (size > 2 * 1024 * 1024) { reject(new Error("too large")); req.destroy(); } else chunks.push(c); });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

export function fileStore(dataDir) {
  const respDir = path.join(dataDir, "responses");
  const histDir = path.join(dataDir, "history");
  const fileOf = (id) => path.join(respDir, `evaluator-${id}.json`);
  const fails = new Map(); // 프로세스 메모리 (재시작 시 초기화)
  return {
    get: (id) => readJson(fileOf(id)),
    async all() {
      await fs.mkdir(respDir, { recursive: true });
      const files = (await fs.readdir(respDir)).filter((f) => /^evaluator-\d+\.json$/.test(f));
      const recs = (await Promise.all(files.map((f) => readJson(path.join(respDir, f))))).filter(Boolean);
      return recs.sort((a, b) => a.evaluatorId - b.evaluatorId);
    },
    async put(rec) {
      await fs.mkdir(respDir, { recursive: true });
      await fs.mkdir(histDir, { recursive: true });
      const tmp = `${fileOf(rec.evaluatorId)}.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`;
      await fs.writeFile(tmp, JSON.stringify(rec, null, 2), "utf8");
      await fs.rename(tmp, fileOf(rec.evaluatorId));
      await fs.writeFile(path.join(histDir, `evaluator-${rec.evaluatorId}-${rec.savedAt.replace(/[:.]/g, "-")}.json`), JSON.stringify(rec), "utf8");
    },
    getFails: async (ip) => fails.get(ip) || null,
    setFails: async (ip, v) => { if (v) fails.set(ip, v); else fails.delete(ip); },
  };
}

// Cloudflare 등 프록시를 거친 요청은 CF-Connecting-IP / X-Forwarded-For 에 실제 접속자 IP
export const clientIp = (req) => String(req.headers["cf-connecting-ip"] || req.headers["x-forwarded-for"] || "").split(",")[0].trim() || req.socket?.remoteAddress || "";

export function createSurveyApi({ dataDir, adminPin }) {
  const store = fileStore(dataDir);
  return async function handle(req, res) {
    let bodyText = "";
    if (req.method === "POST") {
      try { bodyText = await readBody(req); } catch { res.statusCode = 413; return res.end(); }
    }
    const { searchParams } = new URL(req.url, "http://local");
    const r = await handleSurvey({ method: req.method, params: searchParams, bodyText, ip: clientIp(req) }, { store, adminPin });
    res.statusCode = r.status;
    res.setHeader("Cache-Control", "no-store");
    if (r.body === null) return res.end();
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify(r.body));
  };
}

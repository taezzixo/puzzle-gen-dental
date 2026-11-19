// Node용 저장 API 어댑터: 응답을 디스크의 JSON 파일로 저장 (npm start · npm run dev)
//   data/responses/<성명>.json  최신본
//   data/history/<성명>-<시각>.json  저장할 때마다 이력
import { promises as fs } from "node:fs";
import path from "node:path";
import { handleSurvey, byCreated } from "./surveyCore.mjs";

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
  // 파일 이름에 쓸 수 없는 문자는 바꿔서 저장 (성명은 키에서 공백이 이미 제거됨)
  const safe = (key) => encodeURIComponent(key).replace(/%/g, "_");
  const fileOf = (key) => path.join(respDir, `${safe(key)}.json`);
  const fails = new Map(); // 프로세스 메모리 (재시작 시 초기화)
  return {
    get: (key) => readJson(fileOf(key)),
    async all() {
      await fs.mkdir(respDir, { recursive: true });
      const files = (await fs.readdir(respDir)).filter((f) => f.endsWith(".json"));
      const recs = (await Promise.all(files.map((f) => readJson(path.join(respDir, f))))).filter(Boolean);
      return recs.sort(byCreated);
    },
    async put(rec) {
      await fs.mkdir(respDir, { recursive: true });
      await fs.mkdir(histDir, { recursive: true });
      const tmp = `${fileOf(rec.key)}.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`;
      await fs.writeFile(tmp, JSON.stringify(rec, null, 2), "utf8");
      await fs.rename(tmp, fileOf(rec.key));
      await fs.writeFile(path.join(histDir, `${safe(rec.key)}-${rec.savedAt.replace(/[:.]/g, "-")}.json`), JSON.stringify(rec), "utf8");
    },
    remove: async (key) => { await fs.rm(fileOf(key), { force: true }); },
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

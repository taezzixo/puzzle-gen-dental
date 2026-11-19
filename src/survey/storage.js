// 응답 저장소: 서버 API(기본 /api/survey 또는 VITE_SURVEY_API_URL) 사용.
// 서버에 연결할 수 없으면 이 브라우저(localStorage)에 임시 저장하고 그 사실을 화면에 알립니다.
import { API_URL } from "./config.js";

const LOCAL_KEY = (id) => `pgd-survey-evaluator-${id}`;

const readLocal = (id) => {
  try { const v = localStorage.getItem(LOCAL_KEY(id)); return v ? JSON.parse(v) : null; } catch { return null; }
};
const writeLocal = (rec) => {
  try { localStorage.setItem(LOCAL_KEY(rec.evaluatorId), JSON.stringify(rec)); } catch { /* 저장 불가 환경 */ }
};

async function call(params, body) {
  const url = new URL(API_URL, window.location.href);
  Object.entries(params || {}).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString(), body
    // text/plain: Google Apps Script 등에서도 사전 요청(CORS preflight) 없이 동작
    ? { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(body), redirect: "follow" }
    : { method: "GET", redirect: "follow", cache: "no-store" });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { throw new Error("서버 응답 형식 오류"); }
  if (!res.ok || !data.ok) {
    const err = new Error(data?.error || `HTTP ${res.status}`);
    err.code = data?.code; throw err;
  }
  return data;
}

// 평가자 본인 응답 불러오기 → { record, source: "server" | "local" }
export async function loadRecord(evaluatorId) {
  const local = readLocal(evaluatorId);
  try {
    const { record } = await call({ action: "get", id: evaluatorId });
    // 서버보다 로컬이 더 최신(서버 저장 실패 후 남은 사본)이면 로컬을 사용
    if (local && (!record || (local.updatedAt || "") > (record.updatedAt || ""))) return { record: local, source: "local-newer" };
    return { record, source: "server" };
  } catch {
    return { record: local, source: "local" };
  }
}

// 저장 → { ok, where: "server" | "local", savedAt }
export async function saveRecord(record) {
  const rec = { ...record, updatedAt: new Date().toISOString() };
  writeLocal(rec);
  try {
    const r = await call(null, { action: "save", record: rec });
    return { ok: true, where: "server", savedAt: r.savedAt || rec.updatedAt, record: rec };
  } catch (e) {
    return { ok: false, where: "local", savedAt: rec.updatedAt, record: rec, error: e.message };
  }
}

// 평가자 선택 화면용 요약 (이름 · 상태 · 진행률만)
export async function listSummary() {
  try { const { summary } = await call({ action: "summary" }); return summary || []; } catch { return null; }
}

// 관리자: 전체 응답 (PIN 필요)
export async function listAll(pin) {
  try {
    const { records } = await call({ action: "list", pin });
    return { records: records || [], source: "server" };
  } catch (e) {
    if (e.code === "BAD_PIN") throw e;
    // 서버 미연결: 이 브라우저에 남아 있는 응답만 표시
    const recs = [];
    for (let i = 1; i <= 50; i++) { const r = readLocal(i); if (r) recs.push(r); }
    return { records: recs, source: "local", error: e.message };
  }
}

export async function checkPin(pin) {
  try { await call({ action: "list", pin }); return true; }
  catch (e) { if (e.code === "BAD_PIN") return false; return true; /* 서버 미연결 시 로컬 모드 허용 */ }
}

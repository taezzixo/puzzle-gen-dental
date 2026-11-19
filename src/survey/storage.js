// 응답 저장소: 서버의 /api/survey API 사용. 응답은 「성명」 기준으로 쌓입니다.
// 성명을 입력하기 전이나 서버에 연결할 수 없을 때는 이 브라우저(localStorage)에 임시 보관합니다.
import { API_URL } from "./config.js";

// 성명 → 저장 키 (서버와 같은 규칙: 유니코드 정규화 + 공백 제거)
export const nameKey = (name) => String(name || "").normalize("NFC").replace(/\s+/g, "").slice(0, 30);

const DRAFT_KEY = "pgd-survey-draft"; // 이 브라우저에서 작성 중인 응답 (성명 입력 전 포함)

export function readDraft() {
  try { const v = localStorage.getItem(DRAFT_KEY); return v ? JSON.parse(v) : null; } catch { return null; }
}
export function writeDraft(rec) {
  try { localStorage.setItem(DRAFT_KEY, JSON.stringify(rec)); } catch { /* 저장 불가 환경 */ }
}
export function clearDraft() {
  try { localStorage.removeItem(DRAFT_KEY); } catch { /* */ }
}

async function call(params, body) {
  const url = new URL(API_URL, window.location.href);
  Object.entries(params || {}).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString(), body
    ? { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(body) }
    : { method: "GET", cache: "no-store" });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { throw new Error("서버 응답 형식 오류"); }
  if (!res.ok || !data.ok) {
    const err = new Error(data?.error || `HTTP ${res.status}`);
    err.code = data?.code; throw err;
  }
  return data;
}

// 해당 성명으로 서버에 저장된 응답 → record | null (연결 실패 시 예외)
export async function fetchByName(name) {
  const { record } = await call({ action: "get", key: nameKey(name) });
  return record || null;
}

// 저장 → { where: "server" | "local", savedAt, record }
// 성명이 없으면 서버에 보내지 않고 이 브라우저에만 보관
export async function saveRecord(record, prevKey) {
  const rec = { ...record, updatedAt: new Date().toISOString() };
  writeDraft(rec);
  if (!nameKey(rec.answers?.consent?.name)) return { where: "local", reason: "no-name", savedAt: rec.updatedAt, record: rec };
  try {
    const r = await call(null, { action: "save", record: rec, prevKey: prevKey || undefined });
    const saved = { ...rec, key: r.key, savedAt: r.savedAt };
    writeDraft(saved);
    return { where: "server", savedAt: r.savedAt, record: saved };
  } catch (e) {
    return { where: "local", reason: "offline", savedAt: rec.updatedAt, record: rec, error: e.message };
  }
}

// 관리자: 전체 응답 (PIN 필요)
export async function listAll(pin) {
  try {
    const { records } = await call({ action: "list", pin });
    return { records: records || [], source: "server" };
  } catch (e) {
    if (e.code) throw e; // 비밀번호 오류 · 잠금
    const d = readDraft();
    return { records: d && nameKey(d.answers?.consent?.name) ? [d] : [], source: "local", error: e.message };
  }
}

// 관리자: 응답 삭제
export async function deleteRecord(key, pin) {
  await call(null, { action: "delete", key, pin });
}

// → { ok: true } 또는 { ok: false, error }
export async function checkPin(pin) {
  try { await call({ action: "list", pin }); return { ok: true }; }
  catch (e) { return e.code ? { ok: false, error: e.message } : { ok: true }; /* 서버 미연결 시 로컬 모드 허용 */ }
}

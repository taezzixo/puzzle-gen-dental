// 설문 저장 API 공통 로직 (Node 서버 · Cloudflare Worker 공용, 외부 의존성 없음)
// 응답은 응답자 「성명」 기준으로 쌓입니다 (공백 무시: "홍 길동" = "홍길동").
//   GET  ?action=get&key=홍길동            → 해당 성명의 응답
//   GET  ?action=list&pin=XXXX            → 관리자: 전체 응답
//   POST {action:"save", record, prevKey} → 저장 (이력 보관). 성명을 고친 경우 prevKey 응답은 새 성명으로 옮김
//   POST {action:"delete", key, pin}      → 관리자: 응답 삭제 (이력은 보존)
//
// store 인터페이스
//   get(key) → record|null, all() → record[], put(record) (최신본 + 이력), remove(key)
//   getFails(ip) → {n, first}|null, setFails(ip, {n, first}|null)

const LOCK_WINDOW = 15 * 60 * 1000, LOCK_MAX = 10;
const MAX_NAME = 30;

// 성명 → 저장 키 (유니코드 정규화 + 공백 제거)
export const nameKey = (name) => String(name || "").normalize("NFC").replace(/\s+/g, "").slice(0, MAX_NAME);
const out = (status, body) => ({ status, body });

async function checkAdmin(pin, ip, { store, adminPin }) {
  if (!adminPin) return out(500, { ok: false, code: "NO_PIN", error: "서버에 관리자 비밀번호(SURVEY_ADMIN_PIN)가 설정되지 않았습니다" });
  // 무차별 대입 방지: 접속 IP당 15분에 10회 실패 시 차단
  const now = Date.now();
  let f = ip ? await store.getFails(ip) : null;
  if (f && now - f.first > LOCK_WINDOW) { f = null; await store.setFails(ip, null); }
  if (f && f.n >= LOCK_MAX) return out(429, { ok: false, code: "LOCKED", error: "비밀번호를 여러 번 틀려 잠시 차단되었습니다. 15분 후 다시 시도해 주세요." });
  if (String(pin || "") !== String(adminPin)) {
    if (ip) await store.setFails(ip, { n: (f?.n || 0) + 1, first: f?.first || now });
    return out(403, { ok: false, code: "BAD_PIN", error: "관리자 비밀번호가 올바르지 않습니다" });
  }
  if (f && ip) await store.setFails(ip, null);
  return null;
}

export async function handleSurvey({ method, params, bodyText, ip }, ctx) {
  const { store } = ctx;
  try {
    if (method === "OPTIONS") return out(204, null);
    if (method === "GET") {
      const action = params.get("action");
      if (action === "get") {
        const key = nameKey(params.get("key"));
        if (!key) return out(400, { ok: false, error: "성명이 없습니다" });
        return out(200, { ok: true, record: await store.get(key) });
      }
      if (action === "list") {
        const denied = await checkAdmin(params.get("pin"), ip, ctx);
        if (denied) return denied;
        return out(200, { ok: true, records: await store.all() });
      }
      return out(400, { ok: false, error: "알 수 없는 요청" });
    }
    if (method === "POST") {
      if ((bodyText || "").length > 2 * 1024 * 1024) return out(413, { ok: false, error: "데이터가 너무 큽니다" });
      const body = JSON.parse(bodyText || "{}");
      if (body.action === "delete") {
        const denied = await checkAdmin(body.pin, ip, ctx);
        if (denied) return denied;
        const key = nameKey(body.key);
        if (!key) return out(400, { ok: false, error: "성명이 없습니다" });
        await store.remove(key);
        return out(200, { ok: true });
      }
      if (body.action !== "save" || !body.record) return out(400, { ok: false, error: "알 수 없는 요청" });
      const rec = body.record;
      if (typeof rec.answers !== "object" || rec.answers === null) return out(400, { ok: false, error: "잘못된 응답 데이터" });
      const name = String(rec.answers?.consent?.name || "").trim();
      const key = nameKey(name);
      if (!key) return out(400, { ok: false, code: "NO_NAME", error: "성명을 입력해야 저장할 수 있습니다" });
      const prevKey = nameKey(body.prevKey);
      let prev = await store.get(key);
      // 성명을 고친 경우: 이전 성명으로 저장된 응답의 생성 시각 등을 이어받고 이전 키는 삭제
      const moved = prevKey && prevKey !== key ? await store.get(prevKey) : null;
      if (!prev && moved) prev = moved;
      // 제출 완료된 응답은 '작성 중'으로 되돌리지 않음
      if (prev?.status === "submitted" && rec.status !== "submitted") rec.status = "submitted";
      if (rec.status !== "submitted") rec.status = "draft";
      const savedAt = new Date().toISOString();
      const saved = { ...rec, key, name, savedAt, createdAt: prev?.createdAt || rec.createdAt || savedAt, saveCount: (prev?.saveCount || 0) + 1 };
      delete saved.evaluatorId;
      await store.put(saved);
      if (moved) await store.remove(prevKey);
      return out(200, { ok: true, savedAt, key });
    }
    return out(405, { ok: false, error: "허용되지 않는 요청" });
  } catch (e) {
    return out(500, { ok: false, error: "서버 오류: " + (e?.message || e) });
  }
}

// 관리자 목록 정렬: 처음 작성한 순서
export const byCreated = (a, b) => String(a.createdAt || "").localeCompare(String(b.createdAt || ""));

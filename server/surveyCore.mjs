// 설문 저장 API 공통 로직 (Node 서버 · Cloudflare Worker 공용, 외부 의존성 없음)
//   GET  ?action=get&id=3          → 평가자 본인 응답
//   GET  ?action=summary           → 평가자 선택 화면용 요약(이름 마스킹)
//   GET  ?action=list&pin=XXXX     → 관리자: 전체 응답
//   POST {action:"save", record}   → 저장 (이력 보관)
//
// store 인터페이스
//   get(id) → record|null, all() → record[], put(record) (최신본 저장 + 이력 추가)
//   getFails(ip) → {n, first}|null, setFails(ip, {n, first}|null)

export const MAX_EVALUATORS = 50;
const LOCK_WINDOW = 15 * 60 * 1000, LOCK_MAX = 10;

const validId = (v) => { const n = Number(v); return Number.isInteger(n) && n >= 1 && n <= MAX_EVALUATORS ? n : null; };
export const maskName = (name) => {
  const s = String(name || "").trim();
  if (s.length <= 1) return s;
  if (s.length === 2) return s[0] + "*";
  return s[0] + "*".repeat(s.length - 2) + s[s.length - 1];
};
const out = (status, body) => ({ status, body });

export async function handleSurvey({ method, params, bodyText, ip }, { store, adminPin }) {
  try {
    if (method === "OPTIONS") return out(204, null);
    if (method === "GET") {
      const action = params.get("action");
      if (action === "get") {
        const id = validId(params.get("id"));
        if (!id) return out(400, { ok: false, error: "잘못된 평가자 번호" });
        return out(200, { ok: true, record: await store.get(id) });
      }
      if (action === "summary") {
        const recs = await store.all();
        return out(200, { ok: true, summary: recs.map((r) => ({ evaluatorId: r.evaluatorId, name: maskName(r.answers?.consent?.name), status: r.status, progress: r.progress ?? null, updatedAt: r.updatedAt })) });
      }
      if (action === "list") {
        if (!adminPin) return out(500, { ok: false, code: "NO_PIN", error: "서버에 관리자 비밀번호(SURVEY_ADMIN_PIN)가 설정되지 않았습니다" });
        // 무차별 대입 방지: 접속 IP당 15분에 10회 실패 시 차단
        const now = Date.now();
        let f = ip ? await store.getFails(ip) : null;
        if (f && now - f.first > LOCK_WINDOW) { f = null; await store.setFails(ip, null); }
        if (f && f.n >= LOCK_MAX) return out(429, { ok: false, code: "LOCKED", error: "비밀번호를 여러 번 틀려 잠시 차단되었습니다. 15분 후 다시 시도해 주세요." });
        if (String(params.get("pin") || "") !== String(adminPin)) {
          if (ip) await store.setFails(ip, { n: (f?.n || 0) + 1, first: f?.first || now });
          return out(403, { ok: false, code: "BAD_PIN", error: "관리자 비밀번호가 올바르지 않습니다" });
        }
        if (f && ip) await store.setFails(ip, null);
        return out(200, { ok: true, records: await store.all() });
      }
      return out(400, { ok: false, error: "알 수 없는 요청" });
    }
    if (method === "POST") {
      if ((bodyText || "").length > 2 * 1024 * 1024) return out(413, { ok: false, error: "데이터가 너무 큽니다" });
      const body = JSON.parse(bodyText || "{}");
      if (body.action !== "save" || !body.record) return out(400, { ok: false, error: "알 수 없는 요청" });
      const rec = body.record;
      const id = validId(rec.evaluatorId);
      if (!id || typeof rec.answers !== "object" || rec.answers === null) return out(400, { ok: false, error: "잘못된 응답 데이터" });
      const prev = await store.get(id);
      // 제출 완료된 응답은 '작성 중'으로 되돌리지 않음
      if (prev?.status === "submitted" && rec.status !== "submitted") rec.status = "submitted";
      if (rec.status !== "submitted") rec.status = "draft";
      const savedAt = new Date().toISOString();
      const saved = { ...rec, evaluatorId: id, savedAt, createdAt: prev?.createdAt || rec.createdAt || savedAt, saveCount: (prev?.saveCount || 0) + 1 };
      await store.put(saved);
      return out(200, { ok: true, savedAt });
    }
    return out(405, { ok: false, error: "허용되지 않는 요청" });
  } catch (e) {
    return out(500, { ok: false, error: "서버 오류: " + (e?.message || e) });
  }
}

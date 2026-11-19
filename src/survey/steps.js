// 설문 단계 정의 + 단계별 응답 완료 여부(미응답 수) 계산
import { BASIC, MAIN_PAIRS, SUB_PAIRS, ABS_ITEMS, QUANT, SATISFACTION, AGENT_Q, CATEGORIES } from "./questions.js";

const pairDone = (p) => p && (p.favor === "equal" || ((p.favor === "left" || p.favor === "right") && p.intensity));
const filled = (v) => v !== undefined && v !== null && v !== "" && !(Array.isArray(v) && v.length === 0);

export const STEPS = [
  { id: "intro", title: "조사 안내", short: "안내", missing: () => 0 },
  {
    id: "consent", title: "개인정보 수집 · 이용 동의", short: "동의",
    missing: (a) => ["c1", "c2", "c3"].filter((k) => !a.consent[k]).length + ["org", "dept", "name"].filter((k) => !filled(a.consent[k])).length + (a.consent.signed ? 0 : 1),
  },
  { id: "basic", title: "응답자 기본정보", short: "기본정보", missing: (a) => BASIC.filter((q) => !filled(a.basic[q.id])).length },
  { id: "ahpMain", title: "평가항목 중요도 비교 (대분류)", short: "중요도 ①", missing: (a) => MAIN_PAIRS.filter((p) => !pairDone(a.ahpMain[p.id])).length },
  { id: "mainReason", title: "가장 중요한 항목과 이유", short: "중요도 이유", missing: (a) => (filled(a.mainTop) ? 0 : 1) + (filled(a.mainReason) ? 0 : 1) },
  { id: "ahpSub", title: "세부 항목 중요도 비교 (중분류)", short: "중요도 ②", missing: (a) => SUB_PAIRS.filter((p) => !pairDone(a.ahpSub[p.id])).length },
  ...CATEGORIES.map((c) => ({
    id: "abs" + c.id, cat: c.id, title: `사용성 평가 — 「${c.name}」`, short: c.name,
    missing: (a) => ABS_ITEMS.filter((i) => i.cat === c.id && !a.abs[i.id]?.score).length,
  })),
  { id: "quant", title: "정량 성과 (예상)", short: "정량 성과", missing: (a) => QUANT.filter((q) => !(filled(a.quant[q.id]?.before) && filled(a.quant[q.id]?.after))).length },
  { id: "satisfaction", title: "현재 기능 만족도", short: "만족도", missing: (a) => SATISFACTION.filter((s) => !a.satisfaction[s.id]).length },
  { id: "agent", title: "향후 AGENT 기능 기대 수준", short: "AGENT", missing: (a) => AGENT_Q.filter((q) => !a.agent[q.id]).length },
  { id: "features", title: "추가 희망 기능", short: "희망 기능", missing: (a) => (a.features.selected?.length ? 0 : 1) + (filled(a.features.top) ? 0 : 1) },
  { id: "overall", title: "종합 평가", short: "종합 평가", missing: (a) => (filled(a.overall.factor) ? 0 : 1) },
  { id: "review", title: "확인 및 제출", short: "제출", missing: () => 0 },
];

export const totalMissing = (a) => STEPS.reduce((s, st) => s + st.missing(a), 0);

// 전체 문항 수 (진행률 계산용)
const EMPTY_TOTALS = 7 + BASIC.length + MAIN_PAIRS.length + 2 + SUB_PAIRS.length + ABS_ITEMS.length + QUANT.length + SATISFACTION.length + AGENT_Q.length + 2 + 1;
export const progressPct = (a) => {
  if (!a) return 0;
  const miss = totalMissing(a);
  return Math.max(0, Math.min(100, Math.round(((EMPTY_TOTALS - miss) / EMPTY_TOTALS) * 100)));
};

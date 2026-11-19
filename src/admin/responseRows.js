// 평가자 1명의 응답 → 문항/응답 표 (관리자 화면 · 개인 응답지 Word · CSV 공용)
import {
  CONSENT_ITEMS, BASIC, SUBITEMS, MAIN_PAIRS, SUB_PAIRS, ABS_ITEMS, SCALE5, QUANT, SATISFACTION, SAT_SCALE,
  AGENT_Q, catName, subName, pairText,
} from "../survey/questions.js";
import { progressPct } from "../survey/steps.js";

const v = (x) => (x === undefined || x === null || x === "" ? "" : String(x));
const scoreText = (n, scale) => (n ? `${n}점 (${scale[n - 1]})` : "");
const consentText = (x) => (x === "agree" ? "동의함" : x === "disagree" ? "동의하지 않음" : "");
export const fmtDT = (iso) => (iso ? new Date(iso).toLocaleString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }) : "");

export function responseSections(rec) {
  const a = rec.answers || {};
  const S = [];
  S.push({
    title: "응답 정보", rows: [
      ["성명", rec.name || rec.answers?.consent?.name || ""],
      ["상태", rec.status === "submitted" ? "제출 완료" : "작성 중"],
      ["진행률", `${rec.progress ?? progressPct(a)}%`],
      ["최초 작성", fmtDT(rec.createdAt)],
      ["마지막 저장", fmtDT(rec.savedAt || rec.updatedAt)],
      ["제출 시각", fmtDT(rec.submittedAt)],
      ["저장 횟수", v(rec.saveCount)],
    ],
  });
  const c = a.consent || {};
  S.push({
    title: "0. 개인정보 수집 · 이용 동의", rows: [
      ...CONSENT_ITEMS.map((it, i) => [`${i + 1}. ${it.text}`, consentText(c[it.id])]),
      ["소속기관", v(c.org)], ["진료과목", v(c.dept)], ["성명", v(c.name)],
      ["서명(동의 확인)", c.signed ? `확인 (${fmtDT(c.signedAt)})` : ""],
    ],
  });
  const b = a.basic || {};
  S.push({
    title: "1. 응답자 기본정보", rows: BASIC.map((q) => {
      const val = q.type === "multi" ? (b[q.id] || []).join(", ") : v(b[q.id]);
      const etc = b[q.id + "Etc"] ? ` (기타: ${b[q.id + "Etc"]})` : "";
      return [q.label, val + etc];
    }),
  });
  S.push({
    title: "2-가-1) 대분류 평가항목의 상대적 중요도", rows: [
      ...MAIN_PAIRS.map((p) => [`${p.no}. ${catName(p.left)}(${p.left}) vs ${catName(p.right)}(${p.right})`, pairText(a.ahpMain?.[p.id], catName(p.left), catName(p.right))]),
      ["가장 중요하다고 본 항목", a.mainTop ? `${catName(a.mainTop)}(${a.mainTop})` : ""],
      ["그렇게 평가한 이유", v(a.mainReason)],
    ],
  });
  S.push({
    title: "2-가-2) 중분류 평가항목의 상대적 중요도", rows: SUB_PAIRS.map((p) => {
      const [l, r] = SUBITEMS[p.id];
      return [`${p.no}. ${l.name}(${l.id}) vs ${r.name}(${r.id})`, pairText(a.ahpSub?.[p.id], l.name, r.name)];
    }),
  });
  S.push({
    title: "2-나-1) 전반적인 사용성 평가 (5점 척도)", rows: ABS_ITEMS.map((it) => [`${it.no} ${it.name}(${it.sub})`, scoreText(a.abs?.[it.id]?.score, SCALE5)]),
  });
  S.push({
    title: "2-나-2) 솔루션 적용으로 인한 정량 성과 (예상)", rows: QUANT.map((q, i) => {
      const x = a.quant?.[q.id] || {};
      const has = v(x.before) && v(x.after);
      const dir = has ? (Number(x.after) > Number(x.before) ? "증가" : Number(x.after) < Number(x.before) ? "감소" : "유지") : "";
      return [`Q${i + 1}. ${q.title}`, has ? `${x.before}${q.unit} → ${x.after}${q.unit} (${dir})` : ""];
    }),
  });
  S.push({ title: "3-가. 현재 기능(v1.0) 만족도", rows: SATISFACTION.map((s, i) => [`${"①②③④⑤"[i]} ${s.name}`, scoreText(a.satisfaction?.[s.id], SAT_SCALE)]) });
  S.push({ title: "3-나. 향후 AGENT 기능에 대한 기대 수준", rows: AGENT_Q.map((q) => [q.name, scoreText(a.agent?.[q.id], q.scale)]) });
  const f = a.features || {};
  S.push({
    title: "3-다. 추가 희망 기능", rows: [
      ["선택한 기능 (복수)", (f.selected || []).join(", ")],
      ["가장 필요한 기능 (1개)", v(f.top)],
      ["기타 기능", v(f.etc)],
    ],
  });
  const o = a.overall || {};
  S.push({
    title: "3-라. 종합 평가", rows: [
      ["도입 · 확산 결정 시 가장 중요한 요인", v(o.factor) + (o.factorEtc ? ` (기타: ${o.factorEtc})` : "")],
      ["기타 의견", v(o.comment)],
    ],
  });
  return S;
}

// CSV (엑셀 호환, UTF-8 BOM). 열 = 모든 문항, 행 = 평가자
export function toCsv(records) {
  if (!records.length) return "﻿평가자 번호\n";
  const flat = records.map((r) => responseSections(r).flatMap((s) => s.rows.map(([q, ans]) => [`[${s.title}] ${q}`, ans])));
  const header = flat[0].map(([q]) => q);
  const esc = (x) => `"${String(x ?? "").replace(/"/g, '""')}"`;
  return "﻿" + [header.map(esc).join(","), ...flat.map((row) => row.map(([, ans]) => esc(ans)).join(","))].join("\r\n");
}

export { subName };

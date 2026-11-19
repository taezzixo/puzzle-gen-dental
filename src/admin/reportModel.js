// 응답 → 통계 → 보고서 블록 (「PuzzleGEN_260618 사용성 평가 분석보고서」 구성 준용)
// 블록은 화면/PDF(ReportView)와 Word(exportDocx)가 함께 사용합니다.
import { SURVEY_CONFIG as CFG } from "../survey/config.js";
import {
  BASIC, CATEGORIES, SUBITEMS, ALL_SUBITEMS, ABS_ITEMS, SCALE5, QUANT, SATISFACTION, SAT_SCALE, AGENT_Q, FEATURES,
  FACTORS, catName, subName,
} from "../survey/questions.js";
import { computeAhp } from "./ahp.js";
import { barChart, pieChart, groupedBar, hBarChart } from "./charts.js";

// ── 유틸 ─────────────────────────────────────────
const isNum = (v) => v !== null && v !== undefined && v !== "" && !isNaN(Number(v));
const mean = (arr) => { const v = arr.filter(isNum).map(Number); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
export const f1 = (v) => (v == null || isNaN(v) ? "-" : Number(v).toFixed(1));
const pctOf = (n, d) => (d ? (n / d) * 100 : 0);
const pctS = (n, d) => `${pctOf(n, d).toFixed(1)}%`;
const hasBatchim = (w) => {
  const ch = String(w).trim().slice(-1);
  const code = ch.charCodeAt(0);
  if (code >= 0xac00 && code <= 0xd7a3) return (code - 0xac00) % 28 !== 0;
  if (/[0-9]/.test(ch)) return "013678".includes(ch);
  if (/[a-zA-Z]/.test(ch)) return "lmnLMN".includes(ch);
  return false;
};
const josa = (w, pair) => w + (hasBatchim(w) ? pair[0] : pair[1]); // pair: "은는", "이가", "을를", "과와"
const levelText = (m) => m == null ? "응답 없음" : m >= 4.5 ? "매우 높은 수준" : m >= 4 ? "높은 수준" : m >= 3.5 ? "높은 수준(4점)에 근접" : m >= 3 ? "보통(3점) 이상 수준" : m >= 2.5 ? "보통(3점)에 다소 못 미치는 수준" : "낮은 수준";
const LIKERT_Y = { 1: "1 : 매우 낮음", 2: "2 : 낮음", 3: "3 : 보통", 4: "4 : 높음", 5: "5 : 매우 높음" };
const countBy = (vals, options) => options.map((o) => ({ label: o, value: vals.filter((v) => v === o).length }));
const countMulti = (arrs, options) => options.map((o) => ({ label: o, value: arrs.filter((a) => (a || []).includes(o)).length }));
const fmtDate = (iso) => { if (!iso) return ""; const d = new Date(iso); return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`; };

// 점수 분포 (5 → 1)
function scoreDist(scores) {
  const n = scores.filter(isNum).length;
  const rows = [5, 4, 3, 2, 1].map((s) => { const c = scores.filter((x) => x === s).length; return { s, c, p: pctOf(c, n) }; });
  const pos = rows.filter((r) => r.s >= 4).reduce((a, r) => a + r.c, 0);
  return { n, rows, pos, posP: pctOf(pos, n), mean: mean(scores) };
}

// ── 통계 계산 ────────────────────────────────────
export function computeStats(records) {
  const R = records.map((r) => r.answers);
  const N = R.length;
  const basic = {};
  BASIC.forEach((q) => {
    basic[q.id] = q.type === "multi" ? countMulti(R.map((a) => a.basic?.[q.id]), q.options) : countBy(R.map((a) => a.basic?.[q.id]), q.options);
  });

  const abs = {};
  ABS_ITEMS.forEach((it) => {
    const scores = R.map((a) => a.abs?.[it.id]?.score).filter(isNum);
    abs[it.id] = scoreDist(scores);
  });
  const cat = {};
  CATEGORIES.forEach((c) => { cat[c.id] = mean(ABS_ITEMS.filter((i) => i.cat === c.id).map((i) => abs[i.id].mean)); });
  const overall = mean(Object.values(cat));

  const quant = {};
  QUANT.forEach((q) => {
    const pairs = R.map((a) => a.quant?.[q.id]).filter((v) => v && isNum(v.before) && isNum(v.after)).map((v) => ({ b: Number(v.before), a: Number(v.after) }));
    const grp = (fn) => { const g = pairs.filter(fn); const b = mean(g.map((x) => x.b)), a = mean(g.map((x) => x.a)); return { n: g.length, b, a, diff: g.length ? a - b : null, rate: g.length && b ? ((a - b) / b) * 100 : null }; };
    quant[q.id] = { n: pairs.length, inc: grp((x) => x.a > x.b), keep: grp((x) => x.a === x.b), dec: grp((x) => x.a < x.b), all: grp(() => true) };
  });

  const ahp = computeAhp(R);
  const top = countBy(R.map((a) => a.mainTop), CATEGORIES.map((c) => c.id)).map((x) => ({ ...x, label: catName(x.label) }));

  const sat = {}; SATISFACTION.forEach((s) => { sat[s.id] = scoreDist(R.map((a) => a.satisfaction?.[s.id]).filter(isNum)); });
  const agent = {}; AGENT_Q.forEach((q) => { agent[q.id] = scoreDist(R.map((a) => a.agent?.[q.id]).filter(isNum)); });
  const features = FEATURES.map((f) => ({ label: f, value: R.filter((a) => a.features?.selected?.includes(f)).length, top: R.filter((a) => a.features?.top === f).length }));
  const factors = countBy(R.map((a) => a.overall?.factor), FACTORS);

  const texts = {
    reasons: records.map((r, i) => ({ who: `응답자 ${i + 1}`, top: catName(r.answers.mainTop || ""), text: r.answers.mainReason })).filter((x) => x.text?.trim()),
    comments: records.map((r, i) => ({ who: `응답자 ${i + 1}`, text: r.answers.overall?.comment })).filter((x) => x.text?.trim()),
    etc: records.flatMap((r, i) => [r.answers.features?.etc && `추가 희망 기능(기타) : ${r.answers.features.etc}`, r.answers.overall?.factorEtc && `도입 결정 요인(기타) : ${r.answers.overall.factorEtc}`].filter(Boolean).map((t) => ({ who: `응답자 ${i + 1}`, text: t }))),
  };

  const dates = records.map((r) => r.submittedAt || r.savedAt || r.updatedAt).filter(Boolean).sort();
  return { N, basic, abs, cat, overall, quant, ahp, top, sat, agent, features, factors, texts, period: dates.length ? [dates[0], dates[dates.length - 1]] : null };
}

// ── 보고서 블록 생성 ─────────────────────────────
export function buildReport(records, opts = {}) {
  const S = computeStats(records);
  const N = S.N, T = CFG.evaluatorCount;
  const P = `${CFG.productName}`;
  const B = [];
  let fig = 0, tab = 0;
  const push = (...x) => B.push(...x);
  const chapter = (text) => push({ t: "pagebreak" }, { t: "chapter", text });
  const section = (text) => push({ t: "section", text });
  const sq = (text) => push({ t: "sq", text });
  const o = (text) => push({ t: "o", text });
  const dash = (text) => push({ t: "dash", text });
  const note = (text) => push({ t: "note", text });
  const chart = (svg, w, h, caption) => push({ t: "chart", svg, w, h, caption: `[그림 ${++fig}] ${caption}` });
  const charts = (items) => push({ t: "charts", items: items.map((it) => ({ ...it, caption: `[그림 ${++fig}] ${it.caption}` })) });
  const table = (caption, head, rows, o2 = {}) => push({ t: "table", caption: `<표 ${++tab}> ${caption}`, head, rows, ...o2 });

  // 표지 · 목차
  push({ t: "cover", kicker: CFG.solutionName, title: `${P}® 사용성 평가 분석보고서`, sub: `― 치과 외래 POC(개념검증) 체험 기반 ―`, date: CFG.reportDate, org: CFG.organization });
  push({ t: "pagebreak" }, {
    t: "toc", entries: [
      { level: 0, text: "1장. 개요" }, { level: 1, text: "1. 배경 및 목적" }, { level: 1, text: "2. 조사방법 및 내용" }, { level: 1, text: "3. 설문응답자" },
      { level: 0, text: `2장. ${P}® 사용성 평가` }, { level: 1, text: "1. 전반적인 사용성 평가" }, { level: 1, text: "2. 정량적 활용 성과" }, { level: 1, text: "3. 사용성 평가항목별 중요도" }, { level: 1, text: "4. 기능 만족도 및 개선 의견" },
      { level: 0, text: "3장. 시사점" },
    ],
  });

  // ── 1장 개요 ──
  chapter("1장. 개요");
  section("1. 배경 및 목적");
  sq("조사 배경");
  o(`퍼즐에이아이 ${P} ${CFG.productVersion} 개념검증(POC) 이후, 치과 외래 진료 현장의 체험 결과를 바탕으로 활용 성과를 객관적으로 평가하고 개선 방향을 마련할 필요`);
  sq("목적");
  o(`${P} POC 체험에 참여한 치과 의료진 대상 설문조사를 통해 ${P}의 업무 효율성 및 효과성 측면의 영향을 조사·분석하여 솔루션 개선방향 도출을 위한 기초자료 확보`);
  section("2. 조사방법 및 내용");
  sq("조사방법론");
  o("(방법) 구조화된 설문서를 활용한 온라인 조사");
  dash(`웹 기반 설문 화면(시험 링크)을 통해 응답을 수집하고, 응답자가 수시로 저장 · 제출하는 방식으로 진행`);
  o(`(대상) ${P} ${CFG.productVersion} POC(시험 데이터 · 시험 링크 기반 체험)에 참여한 치과 의료진`);
  o(`(기간) ${S.period ? `${fmtDate(S.period[0])} ~ ${fmtDate(S.period[1])}` : CFG.surveyPeriod}`);
  sq("조사내용");
  o(`${P}을 통한 업무효과성 및 효율성, 업무부담 경감성 개선 수준, 현장 통합성, 정량적 활용 성과 및 향후 개선 의견 등`);
  table("설문조사 항목의 구성 (1) 전반적 사용성 및 정량 성과 조사",
    [["구분", "조사항목(대)", "조사항목(중)", "비고"]],
    [
      ...CATEGORIES.map((c, i) => [i === 0 ? { text: "전반적\n사용성 평가", rowSpan: 4 } : null, c.name, SUBITEMS[c.id].map((s) => s.name).join(" / "), i === 0 ? { text: "리커트\n5점 척도", rowSpan: 4 } : null].filter((x) => x !== null)),
      ...QUANT.map((q, i) => [i === 0 ? { text: "솔루션 적용\n정량 성과", rowSpan: 3 } : null, q.title, `${P} 적용 전후 ${q.short}(${q.unit})`, "–"].filter((x) => x !== null)),
      [{ text: "개선 의견", rowSpan: 1 }, "현재 기능 만족도 · AGENT 기대 · 희망 기능 · 도입 결정 요인", "기능별 만족도, AGENT 기대 수준 · 도입 의향, 추가 희망 기능, 도입 결정 요인, 자유 의견", "–"],
    ], { widths: [16, 22, 46, 16] });
  sq("AHP(Analytic Hierarchy Process) 분석 개요");
  o("본 조사에서는 사용성 평가항목별 상대적 중요도를 파악하기 위해 AHP 기법을 활용");
  dash("AHP는 복수의 평가항목 중 응답자의 상대적 중요도 인식을 계량적으로 분석 가능");
  dash("업무효과성, 업무효율성, 업무부담 경감성, 현장 통합성의 4개 대분류와 각 대분류별 중분류 평가항목을 대상으로 적용");
  o("응답자는 평가항목 간 쌍대비교(1 · 3 · 5 · 7 · 9 척도)를 통해 상대적 중요도를 평가하였으며, 개인 판단을 기하평균으로 결합한 집단 판단행렬로 평가항목별 우선순위와 상대적 중요도를 분석");
  table("설문조사 항목의 구성 (2)",
    [["구분", "조사항목"]],
    [
      [{ text: "사용성 평가항목\n상대적 중요도", rowSpan: 2 }, "▪ 대분류 평가항목간 상대적 중요도\n– 업무효과성, 업무효율성, 업무부담 경감성, 현장 통합성"],
      ["▪ 대분류별 중분류 평가항목간 상대적 중요도\n" + CATEGORIES.map((c) => `– (${c.name}) ${SUBITEMS[c.id].map((s) => s.name).join(", ")}`).join("\n")],
    ], { widths: [22, 78], alignLeft: [1] });

  section("3. 설문응답자");
  sq("설문회수율");
  o(`설문조사 대상 ${T}명 중, ${N}명의 설문서를 회수하여 회수율은 ${pctS(N, T)}${opts.includeDrafts ? " (작성 중 응답 포함)" : ""}`);
  sq("응답자 기초통계");
  const describe = (label, counts, unitWord = "명") => {
    const nz = counts.filter((c) => c.value > 0).sort((a, b) => b.value - a.value);
    if (!nz.length) return `(${label}) 응답 없음`;
    const parts = nz.map((c) => `${c.label} ${c.value}${unitWord}`).join(", ");
    return `(${label}) 설문응답자 ${N}명을 ${label.endsWith("별") ? label : label + "별"}로 구분하면 ${parts}으로 ${josa(nz[0].label, "이가")} 가장 큰 비중(${pctS(nz[0].value, N)})을 차지`;
  };
  const pies = [["gender", "성별"], ["age", "연령대"], ["specialty", "전문 진료과목"], ["career", "임상경력"], ["patients", "1일 평균 외래 환자 수"]];
  pies.forEach(([id, label]) => {
    o(describe(label, S.basic[id]));
    chart(pieChart({ items: S.basic[id] }), 340, 230, `${label}별 응답자 비중`);
  });
  [["duty", "주 담당 업무"], ["careTypes", "주요 진료 유형"]].forEach(([id, label]) => {
    const nz = S.basic[id].filter((c) => c.value > 0).sort((a, b) => b.value - a.value);
    o(`(${label}, 복수 선택) ${nz.length ? nz.map((c) => `${c.label} ${c.value}명`).join(", ") : "응답 없음"}`);
    chart(hBarChart({ items: S.basic[id].map((c) => ({ ...c, extra: N ? `(${pctS(c.value, N)})` : "" })), max: Math.max(N, 1) }), 640, S.basic[id].length * 30 + 20, `${label}별 응답자 수 (복수 선택)`);
  });

  // ── 2장 사용성 평가 ──
  chapter(`2장. ${P}® 사용성 평가`);
  section("1. 전반적인 사용성 평가");
  sq("총괄");
  const catSorted = CATEGORIES.map((c) => ({ ...c, m: S.cat[c.id] })).filter((c) => c.m != null).sort((a, b) => b.m - a.m);
  o(`${P}의 전반적 사용성은 ${f1(S.overall)}점(5점 척도)으로 ${levelText(S.overall)}`);
  if (catSorted.length) dash(`${catSorted[0].name} 부분에 대한 기여도가 가장 큰 것으로 평가(${f1(catSorted[0].m)}점)되며 ${catSorted.slice(1).map((c) => c.name).join(", ")} 순으로 우수한 것으로 평가`);
  chart(barChart({ items: CATEGORIES.map((c) => ({ label: c.name, value: S.cat[c.id] })), yLabels: LIKERT_Y, avg: S.overall }), 640, 300, `${P} 사용성`);
  table(`${P} 사용성 평가 결과 요약`, [["대분류", "중분류", "평균(점)", "긍정 응답(높음 · 매우 높음)", "응답자 수"]],
    ABS_ITEMS.map((it, i) => [i % 2 === 0 ? { text: catName(it.cat), rowSpan: 2 } : null, `${it.no} ${it.name}`, f1(S.abs[it.id].mean), `${pctS(S.abs[it.id].pos, S.abs[it.id].n)} (${S.abs[it.id].pos}명)`, `${S.abs[it.id].n}명`].filter((x) => x !== null)),
    { widths: [18, 34, 14, 22, 12] });

  sq("분야별 우수성");
  CATEGORIES.forEach((c) => {
    const [i1, i2] = ABS_ITEMS.filter((i) => i.cat === c.id);
    const a1 = S.abs[i1.id], a2 = S.abs[i2.id];
    const better = a1.mean != null && a2.mean != null && a1.mean !== a2.mean ? (a1.mean > a2.mean ? i1 : i2) : null;
    o(`(${c.name}) ${i1.name} ${f1(a1.mean)}점, ${i2.name} ${f1(a2.mean)}점으로 ${levelText(mean([a1.mean, a2.mean]))}${better ? `이며, ${josa(better.name, "이가")} 상대적으로 우수한 것으로 나타남` : ""}`);
    dash(`응답 분포를 살펴볼 경우, ${i1.name}에 대해 응답자의 ${a1.posP.toFixed(1)}%(${a1.pos}명), ${i2.name}에 대해 응답자의 ${a2.posP.toFixed(1)}%(${a2.pos}명)가 긍정적(높음 또는 매우 높음)으로 응답`);
    chart(barChart({ items: [i1, i2].map((it) => ({ label: it.name, value: S.abs[it.id].mean })), yLabels: LIKERT_Y, width: 520, height: 270 }), 520, 270, `${c.name} 측면의 우수성`);
    charts([i1, i2].map((it) => ({ svg: pieChart({ items: [5, 4, 3, 2, 1].map((s) => ({ label: `${s}: ${SCALE5[s - 1]}`, value: S.abs[it.id].rows.find((r) => r.s === s).c })), highlight: S.abs[it.id].n ? S.abs[it.id].posP : null }), w: 340, h: 230, caption: `${it.name} 측면의 우수성` })));
    table(`${c.name} 기여에 대한 응답 결과`,
      [[{ text: "구분", rowSpan: 2 }, { text: i1.name, colSpan: 2 }, { text: i2.name, colSpan: 2 }], ["응답자 수(명)", "비중(%)", "응답자 수(명)", "비중(%)"]],
      [
        ...[5, 4, 3, 2, 1].map((s) => { const r1 = a1.rows.find((r) => r.s === s), r2 = a2.rows.find((r) => r.s === s); return [`${s}: ${SCALE5[s - 1]}`, r1.c || "–", `${r1.p.toFixed(1)}%`, r2.c || "–", `${r2.p.toFixed(1)}%`]; }),
        ["합계", a1.n, a1.n ? "100%" : "0%", a2.n, a2.n ? "100%" : "0%"],
        ["평균(점)", { text: f1(a1.mean), colSpan: 2 }, { text: f1(a2.mean), colSpan: 2 }],
      ], { widths: [24, 19, 19, 19, 19], alignRight: true });
  });

  section("2. 정량적 활용 성과");
  sq(`${P} 적용 시 진료기록 업무 변화 (예상)`);
  QUANT.forEach((q) => {
    const d = S.quant[q.id];
    const verb = q.id === "Q2" ? "증가" : "감소";
    const main = q.id === "Q2" ? d.inc : d.dec;
    o(`(${q.title}) ${P} 적용 시 ${q.short}${q.id === "Q2" ? "가 증가" : "가 감소"}할 것으로 응답한 응답자는 ${main.n}명, 유지 ${d.keep.n}명, ${q.id === "Q2" ? "감소" : "증가"} ${(q.id === "Q2" ? d.dec : d.inc).n}명`);
    if (main.n) dash(`${verb}를 예상한 경우, ${q.short}는 평균 ${f1(main.b)}${q.unit}에서 ${f1(main.a)}${q.unit}으로 ${f1(Math.abs(main.diff))}${q.unit}(${main.rate > 0 ? "+" : ""}${f1(main.rate)}%) ${verb}`);
    const other = q.id === "Q2" ? d.dec : d.inc;
    if (other.n) dash(`반대로 ${q.id === "Q2" ? "감소" : "증가"}를 예상한 경우 평균 ${f1(other.b)}${q.unit}에서 ${f1(other.a)}${q.unit}으로 ${f1(Math.abs(other.diff))}${q.unit}(${other.rate > 0 ? "+" : ""}${f1(other.rate)}%) 변화`);
    if (d.all.n) note(`전체 응답자(${d.all.n}명) 평균 : ${f1(d.all.b)}${q.unit} → ${f1(d.all.a)}${q.unit} (${d.all.rate > 0 ? "+" : ""}${f1(d.all.rate)}%)`);
    chart(groupedBar({
      series: ["도입 전", "도입 후(예상)"],
      groups: [["증가 응답", d.inc], ["유지 응답", d.keep], ["감소 응답", d.dec]].map(([l, g]) => ({ label: `${l}(N=${g.n})`, values: g.n ? [g.b, g.a] : [null, null], g })),
      annotate: (gr) => (gr.g.n && gr.g.diff ? `${gr.g.diff > 0 ? "+" : ""}${f1(gr.g.diff)} (${gr.g.rate > 0 ? "+" : ""}${f1(gr.g.rate)}%)` : ""),
    }), 640, 300, `${q.title}`);
  });

  section("3. 사용성 평가항목별 중요도");
  sq("사용성 평가 항목별 중요도 (AHP)");
  const A = S.ahp;
  const mainRank = CATEGORIES.map((c) => ({ id: c.id, name: c.name, w: A.mainW[c.id] })).filter((x) => x.w != null).sort((a, b) => b.w - a.w);
  if (mainRank.length) {
    o(`(대분류) ${P} 사용자는 ${mainRank[0].name}(${f1(mainRank[0].w * 100)}%)과 ${mainRank[1].name}(${f1(mainRank[1].w * 100)}%)을 가장 중요하게 고려하는 것으로 분석`);
    dash(`상위 2개 항목의 중요도 합계는 ${f1((mainRank[0].w + mainRank[1].w) * 100)}%이며, ${mainRank[2].name}(${f1(mainRank[2].w * 100)}%), ${mainRank[3].name}(${f1(mainRank[3].w * 100)}%) 순`);
    chart(barChart({ items: mainRank.map((x) => ({ label: x.name, value: x.w * 100 })), yMin: 0, yMax: Math.max(40, Math.ceil((mainRank[0].w * 100 + 5) / 10) * 10), ticks: undefined }), 640, 290, "대분류 평가기준 간 상대적 중요도(%)");
    table("대분류 평가기준별 중요도 및 순위", [["평가기준", "중요도(%)", "순위"]], mainRank.map((x, i) => [x.name, f1(x.w * 100), i + 1]), { widths: [40, 30, 30] });
  } else o("(대분류) 쌍대비교 6문항을 모두 응답한 응답자가 없어 분석 불가");
  if (Object.keys(A.local).length) {
    o("(지역가중치) 각 대분류 내에서 하위 평가항목 간 쌍대비교를 실시한 결과");
    CATEGORIES.forEach((c) => {
      const [s1, s2] = SUBITEMS[c.id];
      if (A.local[s1.id] == null) return;
      const [hi, lo] = A.local[s1.id] >= A.local[s2.id] ? [s1, s2] : [s2, s1];
      dash(`${c.name}에서는 ${hi.name} ${f1(A.local[hi.id] * 100)}%, ${lo.name} ${f1(A.local[lo.id] * 100)}%로 평가(응답 ${A.subN[c.id]}명)`);
    });
    chart(hBarChart({ items: CATEGORIES.flatMap((c) => SUBITEMS[c.id].map((s, k) => ({ label: `${c.name} │ ${s.name}`, value: A.local[s.id] != null ? A.local[s.id] * 100 : 0, color: k ? "#8a9eae" : "#16607f" }))), unit: "%", decimals: 1, max: 100, labelW: 290 }), 640, 8 * 30 + 20, "대분류 세부항목 지역가중치(%)");
  }
  const globalRank = ALL_SUBITEMS.map((s) => ({ id: s.id, name: s.name, w: A.global[s.id] })).filter((x) => x.w != null).sort((a, b) => b.w - a.w);
  if (globalRank.length) {
    o(`(전역가중치) 중분류 항목간 비교에서는 ${josa(globalRank[0].name, "이가")} ${f1(globalRank[0].w * 100)}%로 전체 항목 중 가장 중요하게 평가되었으며, ${globalRank.slice(1, 3).map((x) => `${x.name} ${f1(x.w * 100)}%`).join(", ")} 순으로 응답`);
    chart(hBarChart({ items: globalRank.map((x) => ({ label: x.name, value: x.w * 100 })), unit: "%", decimals: 1, labelW: 200 }), 640, globalRank.length * 30 + 20, "대분류 세부항목 전역가중치(%)");
    table("대분류 세부항목 전역가중치 및 순위", [["평가기준", "대분류", "전역가중치(%)", "순위"]], globalRank.map((x, i) => [x.name, catName(x.id[0]), f1(x.w * 100), i + 1]), { widths: [36, 24, 22, 18] });
  }
  if (A.CR != null) o(`본 조사에서는 집단 판단행렬의 일관성 비율(CR)이 ${A.CR.toFixed(3)}로 나타나 ${A.CR <= 0.1 ? "분석 결과의 일관성을 확보(기준 0.1 이하)" : "일관성 기준(0.1)을 초과하여 해석에 유의 필요"}`);
  if (A.individualCR.length) note(`개인별 일관성 비율(CR) : ${A.individualCR.map((c, i) => `응답자${i + 1} ${c.toFixed(3)}`).join(", ")} — 0.1 이하 ${A.individualCR.filter((c) => c <= 0.1).length}명`);
  sq("가장 중요하다고 본 항목 (직접 선택)");
  const topNz = S.top.filter((t) => t.value).sort((a, b) => b.value - a.value);
  o(topNz.length ? `응답자가 직접 선택한 가장 중요한 항목은 ${topNz.map((t) => `${t.label} ${t.value}명`).join(", ")}` : "응답 없음");
  if (S.texts.reasons.length) push({ t: "quotes", title: "그렇게 평가한 이유 (주관식)", items: S.texts.reasons.map((r) => ({ who: `${r.who} · ${r.top || "미선택"}`, text: r.text })) });

  section("4. 기능 만족도 및 개선 의견");
  sq("현재 기능(v1.0) 만족도");
  const satSorted = SATISFACTION.map((s) => ({ ...s, m: S.sat[s.id].mean })).filter((x) => x.m != null).sort((a, b) => b.m - a.m);
  if (satSorted.length) o(`기능별 만족도는 ${satSorted[0].name} ${f1(satSorted[0].m)}점이 가장 높고, ${satSorted[satSorted.length - 1].name} ${f1(satSorted[satSorted.length - 1].m)}점이 가장 낮게 나타남`);
  chart(barChart({ items: SATISFACTION.map((s) => ({ label: s.name.replace(/\(.*\)/, ""), value: S.sat[s.id].mean })), yLabels: { 1: "1 : 매우 불만", 2: "2 : 불만", 3: "3 : 보통", 4: "4 : 만족", 5: "5 : 매우 만족" }, avg: mean(SATISFACTION.map((s) => S.sat[s.id].mean)) }), 640, 300, "현재 기능별 만족도");
  table("현재 기능별 만족도 응답 결과", [["평가 항목", "매우 만족", "만족", "보통", "불만", "매우 불만", "평균(점)"]],
    SATISFACTION.map((s) => [s.name, ...[5, 4, 3, 2, 1].map((v) => S.sat[s.id].rows.find((r) => r.s === v).c || "–"), f1(S.sat[s.id].mean)]), { widths: [40, 10, 10, 10, 10, 10, 10] });
  sq("향후 AGENT 기능 기대 수준 (가정)");
  AGENT_Q.forEach((q) => {
    const d = S.agent[q.id];
    o(`(${q.name}) 평균 ${f1(d.mean)}점이며, 응답자의 ${d.posP.toFixed(1)}%(${d.pos}명)가 「${q.scale[3]}」 이상으로 응답`);
  });
  charts(AGENT_Q.map((q) => ({ svg: pieChart({ items: [5, 4, 3, 2, 1].map((v) => ({ label: q.scale[v - 1], value: S.agent[q.id].rows.find((r) => r.s === v).c })), highlight: S.agent[q.id].n ? S.agent[q.id].posP : null }), w: 340, h: 230, caption: q.name })));
  sq("추가 희망 기능");
  const featSorted = [...S.features].sort((a, b) => b.value - a.value || b.top - a.top);
  const featNz = featSorted.filter((x) => x.value);
  o(featNz.length ? `추가 희망 기능은 ${featNz.slice(0, 3).map((x) => `${x.label}(${x.value}명)`).join(", ")} 순으로 많이 선택` : "응답 없음");
  const topFeat = [...S.features].sort((a, b) => b.top - a.top).filter((x) => x.top);
  if (topFeat.length) dash(`가장 필요한 기능 1개로는 ${topFeat.map((x) => `${x.label} ${x.top}명`).join(", ")}`);
  chart(hBarChart({ items: featSorted.map((x) => ({ label: x.label, value: x.value, extra: x.top ? `(최우선 ${x.top})` : "" })), max: Math.max(N, 1), labelW: 300 }), 640, featSorted.length * 30 + 20, "추가 희망 기능 선택 현황 (복수 선택)");
  sq("도입 · 확산 결정 요인");
  const facNz = S.factors.filter((x) => x.value).sort((a, b) => b.value - a.value);
  o(facNz.length ? `도입 · 확산 결정 시 가장 중요한 요인은 ${facNz.map((x) => `${x.label} ${x.value}명`).join(", ")}` : "도입 · 확산 결정 요인 응답 없음");
  chart(hBarChart({ items: S.factors.map((x) => ({ ...x, extra: N ? `(${pctS(x.value, N)})` : "" })), max: Math.max(N, 1), labelW: 200 }), 640, S.factors.length * 30 + 20, "도입 · 확산 결정 시 가장 중요한 요인");
  const allQuotes = [
    ...S.texts.etc,
    ...S.texts.comments.map((x) => ({ who: `${x.who} · 기타 의견`, text: x.text })),
  ];
  if (allQuotes.length) { sq("주관식 응답"); push({ t: "quotes", items: allQuotes }); }

  // ── 3장 시사점 (자동 생성 초안) ──
  chapter("3장. 시사점");
  o(`${P}의 진료기록 자동생성 기능은 치과 의료진의 기록작성 부담을 완화하고 진료기록 업무의 효율화에 기여할 가능성을 확인`);
  dash(`POC 체험 사용자 대상 전반적인 사용성 평가에서 5점 만점 기준 ${f1(S.overall)}점을 얻어 ${levelText(S.overall)}으로 평가`);
  if (catSorted.length) dash(`분야별로는 ${catSorted[0].name}(${f1(catSorted[0].m)}점)이 가장 높고, ${catSorted[catSorted.length - 1].name}(${f1(catSorted[catSorted.length - 1].m)}점)이 상대적으로 낮게 평가`);
  const q1 = S.quant.Q1, q2 = S.quant.Q2, q3 = S.quant.Q3;
  if (q1.dec.n) note(`진료기록 1건 작성 시간이 평균 ${f1(q1.dec.b)}분에서 ${f1(q1.dec.a)}분으로 ${f1(Math.abs(q1.dec.rate))}% 단축될 것으로 예상(감소 응답 ${q1.dec.n}명)`);
  if (q2.inc.n) note(`시간당 기록 처리 건수가 평균 ${f1(q2.inc.b)}건에서 ${f1(q2.inc.a)}건으로 ${f1(q2.inc.rate)}% 증가할 것으로 예상(증가 응답 ${q2.inc.n}명)`);
  if (mainRank.length) {
    o(`의료진은 ${P}의 사용성 판단 시 ${mainRank[0].name}과 ${mainRank[1].name}을 가장 중요한 평가기준으로 인식`);
    dash(`AHP 분석 결과 ${mainRank[0].name}(${f1(mainRank[0].w * 100)}%), ${mainRank[1].name}(${f1(mainRank[1].w * 100)}%) 순이며, 세부 항목 중에서는 ${globalRank[0]?.name || "-"}의 중요도가 가장 높음`);
    const gap = mainRank.map((x) => ({ ...x, s: S.cat[x.id] })).filter((x) => x.s != null).find((x) => x.s < S.overall);
    if (gap) note(`중요도가 높은 ${josa(gap.name, "은는")} 만족도(${f1(gap.s)}점)가 전체 평균(${f1(S.overall)}점)보다 낮아 우선 개선 대상으로 검토 필요`);
  }
  const lowItems = ABS_ITEMS.map((it) => ({ ...it, m: S.abs[it.id].mean })).filter((x) => x.m != null).sort((a, b) => a.m - b.m).slice(0, 2);
  if (lowItems.length) {
    o(`다만, ${lowItems.map((x) => `${x.name}(${f1(x.m)}점)`).join(", ")} 항목은 상대적으로 낮게 평가되어 개선이 필요`);
    if (q3.inc.n) dash(`기록 오류 · 누락이 증가할 것으로 응답한 응답자가 ${q3.inc.n}명(평균 ${f1(q3.inc.b)}건 → ${f1(q3.inc.a)}건)으로, 오류 유형별 원인 분석 및 개선체계 마련 필요`);
    dash("치과 용어 · 치아번호(FDI) 인식, 기록 유형별 필수 항목 구성, 수정 명령 처리 등 오류 사례를 지속적으로 축적 · 분류하여 모델 및 템플릿 개선에 환류 필요");
  }
  if (satSorted.length) o(`현재 기능 중 ${satSorted[satSorted.length - 1].name} 만족도가 가장 낮아(${f1(satSorted[satSorted.length - 1].m)}점) 차기 개발 시 우선 보완 검토`);
  if (featNz.length) o(`향후 고도화 방향으로 ${featNz.slice(0, 3).map((x) => x.label).join(", ")} 기능에 대한 요구가 높게 나타나며, AGENT 기능 제공 시 업무 성과 기대 수준은 ${f1(S.agent.expect.mean)}점, 도입 · 사용 의향은 ${f1(S.agent.intent.mean)}점`);
  o("조사결과의 객관성과 일반화 가능성 제고를 위한 실사용 데이터 기반의 후속 검증 필요");
  dash(`본 조사는 POC 체험에 참여한 치과 의료진 ${N}명의 응답을 기반으로 하고 있어 실제 사용자가 체감한 효과와 개선방향을 파악하는 자료로서 의미가 있으나, 일반화할 때에는 표본규모와 응답자 구성의 한계 존재`);
  dash("향후에는 실제 EMR 연동 환경에서 시스템 로그와 실측자료(기록 소요시간, 수정 횟수, 필수항목 누락률 등)를 수집하여 보다 정밀한 분석 실시 필요");

  return { blocks: B, stats: S };
}

// AHP(Analytic Hierarchy Process) 계산
// - 개인 판단을 기하평균으로 결합(AIJ)한 집단 판단행렬 → 고유벡터 가중치 → 일관성 비율(CR)
import { CATEGORIES, SUBITEMS, MAIN_PAIRS, SUB_PAIRS } from "../survey/questions.js";

const RI = { 1: 0, 2: 0, 3: 0.58, 4: 0.9, 5: 1.12, 6: 1.24, 7: 1.32, 8: 1.41, 9: 1.45 };

// 쌍대비교 응답 → a_ij (왼쪽 기준 비율)
export const pairRatio = (p) => {
  if (!p || !p.favor) return null;
  if (p.favor === "equal") return 1;
  if (!p.intensity) return null;
  return p.favor === "left" ? p.intensity : 1 / p.intensity;
};

function eigen(M) {
  const n = M.length;
  let w = Array(n).fill(1 / n);
  for (let it = 0; it < 200; it++) {
    const nw = M.map((row) => row.reduce((s, v, j) => s + v * w[j], 0));
    const sum = nw.reduce((a, b) => a + b, 0);
    const norm = nw.map((v) => v / sum);
    const diff = norm.reduce((s, v, i) => s + Math.abs(v - w[i]), 0);
    w = norm;
    if (diff < 1e-12) break;
  }
  const Aw = M.map((row) => row.reduce((s, v, j) => s + v * w[j], 0));
  const lambda = Aw.reduce((s, v, i) => s + v / w[i], 0) / n;
  const CI = n > 2 ? (lambda - n) / (n - 1) : 0;
  const CR = n > 2 ? CI / RI[n] : 0;
  return { w, lambda, CI, CR };
}

// 쌍대비교 집합 → 행렬 (응답 여러 명이면 기하평균)
function buildMatrix(ids, pairs, getPair, respondents) {
  const n = ids.length;
  const M = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : null)));
  let complete = true;
  pairs.forEach(({ key, left, right }) => {
    const vals = respondents.map((r) => pairRatio(getPair(r, key))).filter((v) => v != null);
    if (!vals.length) { complete = false; return; }
    const g = Math.exp(vals.reduce((s, v) => s + Math.log(v), 0) / vals.length);
    const i = ids.indexOf(left), j = ids.indexOf(right);
    M[i][j] = g; M[j][i] = 1 / g;
  });
  if (!complete) return null;
  return M;
}

const mainIds = CATEGORIES.map((c) => c.id);
const mainPairs = MAIN_PAIRS.map((p) => ({ key: p.id, left: p.left, right: p.right }));

// 한 명 또는 여러 명의 응답(answers 배열)으로 AHP 계산
export function computeAhp(answersList) {
  const usableMain = answersList.filter((a) => MAIN_PAIRS.every((p) => pairRatio(a.ahpMain?.[p.id]) != null));
  const mainM = buildMatrix(mainIds, mainPairs, (a, k) => a.ahpMain?.[k], usableMain);
  const main = mainM ? eigen(mainM) : null;

  const local = {}; // A: {A1: w, A2: w}
  const subN = {};
  SUB_PAIRS.forEach((p) => {
    const ids = SUBITEMS[p.id].map((s) => s.id);
    const resp = answersList.filter((a) => pairRatio(a.ahpSub?.[p.id]) != null);
    subN[p.id] = resp.length;
    const M = buildMatrix(ids, [{ key: p.id, left: ids[0], right: ids[1] }], (a, k) => a.ahpSub?.[k], resp);
    if (M) { const e = eigen(M); ids.forEach((id, i) => { local[id] = e.w[i]; }); }
  });

  const mainW = {};
  if (main) mainIds.forEach((id, i) => { mainW[id] = main.w[i]; });
  const global = {};
  Object.entries(SUBITEMS).forEach(([cat, subs]) => subs.forEach((s) => {
    if (mainW[cat] != null && local[s.id] != null) global[s.id] = mainW[cat] * local[s.id];
  }));

  // 개인별 CR (대분류)
  const individualCR = usableMain.map((a) => {
    const M = buildMatrix(mainIds, mainPairs, (x, k) => x.ahpMain?.[k], [a]);
    return eigen(M).CR;
  });

  return {
    nMain: usableMain.length, subN,
    mainW, local, global,
    CR: main?.CR ?? null, lambda: main?.lambda ?? null,
    individualCR,
  };
}

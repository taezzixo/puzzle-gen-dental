// PuzzleGen Dental POC 사용성 평가 설문 (v6) 정의
// 화면(설문), 보고서, 원자료 내보내기가 모두 이 정의를 공유합니다.

export const CONSENT_ITEMS = [
  { id: "c1", text: "개인정보 수집 · 이용에 동의합니다.", required: true },
  { id: "c2", text: "선택 항목(성별, 연령대, 주 담당 업무, 총 임상경력, 1일 평균 외래 환자 수, 주요 진료 유형)의 수집 · 이용에 동의합니다." },
  { id: "c3", text: "설문 응답 결과(익명 처리)를 솔루션 개선 및 성과 공유 자료(보고서 · 학술 발표 등)에 활용하는 것에 동의합니다." },
];

export const CONSENT_INFO = [
  ["수집 · 이용 목적", "① AI 의무기록 자동생성 솔루션(PuzzleGen Dental 1.0) POC 사용성 평가 및 통계 분석  ② 솔루션 고도화 · 개선 과제 도출을 위한 기초자료 작성"],
  ["수집 항목", "[필수] 성명, 소속기관, 전문 진료과목  [선택] 성별, 연령대, 주 담당 업무, 총 임상경력, 1일 평균 외래 환자 수, 주요 진료 유형"],
  ["보유 · 이용 기간", "조사 종료 및 결과 보고서 작성 완료 후 즉시 파기 (최대 수집일로부터 1년). 개인 식별이 불가능한 통계 처리 결과는 기간 제한 없이 활용될 수 있습니다."],
  ["제3자 제공", "수집된 개인정보는 조사 주관사인 ㈜퍼즐에이아이가 직접 수집 · 이용하며, 제3자에게 제공하지 않습니다. 다만, 법령에 의한 경우에 한하여 예외로 합니다."],
  ["동의 거부 권리", "동의를 거부할 권리가 있습니다. 필수 항목 동의를 거부하실 경우 조사 참여가 제한되며, 선택 항목은 동의하지 않아도 불이익이 없습니다."],
];

// ── 1. 응답자 기본정보 ─────────────────────────────
export const BASIC = [
  { id: "gender", label: "성별", type: "single", options: ["남", "여"] },
  { id: "age", label: "연령", type: "single", options: ["20대", "30대", "40대", "50대", "60대 이상"] },
  { id: "duty", label: "주 담당 업무", hint: "여러 개 선택할 수 있습니다", type: "multi", options: ["외래 초진 기록", "외래 재진 기록", "외래 경과기록", "기타"], etc: "기타" },
  { id: "specialty", label: "전문 진료과목", type: "single", options: ["구강악안면외과", "치과보철과", "치과교정과", "통합치의학과", "치과보존과", "기타"], etc: "기타" },
  { id: "career", label: "총 임상경력", type: "single", options: ["5년 미만", "5~10년 미만", "10~15년 미만", "15년 이상"] },
  { id: "patients", label: "1일 평균 외래 환자 수", type: "single", options: ["20명 미만", "20~40명 미만", "40~60명 미만", "60명 이상"] },
  { id: "careTypes", label: "주요 진료 유형", hint: "여러 개 선택할 수 있습니다", type: "multi", options: ["검진 · 예방 · 스케일링", "보존(레진 · 근관치료)", "보철(크라운 · 틀니)", "구강외과(발치 · 임플란트)", "교정", "치주치료", "소아", "기타"], etc: "기타" },
];

// ── 2-가. AHP 상대적 중요도 ─────────────────────────
export const CATEGORIES = [
  { id: "A", name: "업무효과성", def: "기록의 정확성 · 완결성 · 품질 수준" },
  { id: "B", name: "업무효율성", def: "수행 속도 증가 및 입력 노력 감소 정도" },
  { id: "C", name: "업무부담 경감성", def: "인지 · 신체 · 정신적 부담 감소 정도" },
  { id: "D", name: "현장 통합성", def: "치과 외래 EMR 및 진료흐름(초진 · 재진 · 경과기록)과의 적합성, 지속 사용 · 확산 가능성" },
];

export const SUBITEMS = {
  A: [
    { id: "A1", name: "진료기록 정확성", def: "솔루션이 생성한 진료기록 및 X선 판독 결과가 입력된 음성 · 영상의 실제 내용(치아번호 FDI 2자리, 소견, 진단 및 치료계획 등)을 사실과 다름없이 반영하는 정도" },
    { id: "A2", name: "진료기록 완결성", def: "기록 유형(초진 · 재진 · 경과기록)별 필수 기재 항목(주호소, 현병력, S&O, A, P 등)이 누락 없이 기록 초안에 포함되는 정도" },
  ],
  B: [
    { id: "B1", name: "기록 완료 시간 단축", def: "음성 입력 후 진료기록 초안 작성 · 확정까지 소요되는 시간이 기존 EMR 수기 입력 대비 감소하는 정도" },
    { id: "B2", name: "재입력 · 추가입력 감소", def: "생성된 초안을 고치기 위한 재입력, 항목 수정, 누락 보완 등 추가적 기록 작업이 줄어드는 정도 (수정 없이 그대로 확정하는 수준)" },
  ],
  C: [
    { id: "C1", name: "진료 중 인지부하 감소", def: "진료 중 기록할 내용을 기억 · 정리 · 입력해야 하는 정신적 부담이 감소되는 수준" },
    { id: "C2", name: "신체 피로 · 번아웃 감소", def: "반복적인 키보드 입력, 마우스 조작 등으로 발생하는 신체적 피로, 기록 업무로 인한 스트레스, 진료 종료 후 잔여 차팅 · 추가 문서업무, 소진감이 줄어드는 정도" },
  ],
  D: [
    { id: "D1", name: "기존 진료흐름 적합성", def: "기존 치과 진료 프로세스(초진 · 재진 · 경과기록 작성 흐름)를 크게 변경하지 않고 자연스럽게 적용 가능한 정도" },
    { id: "D2", name: "현장 통합 예측성", def: "POC에서 체험한 기능(음성 입력 · 수정 명령 · X선 판독 · 기록 요약 · 타임라인 조회)의 업무 적용 범위를 근거로, 실제 EMR 적용 시 지속적으로 사용되고 확산될 것으로 예측되는 정도" },
  ],
};

export const ALL_SUBITEMS = Object.values(SUBITEMS).flat();
export const catName = (id) => CATEGORIES.find((c) => c.id === id)?.name || id;
export const subName = (id) => ALL_SUBITEMS.find((s) => s.id === id)?.name || id;

// 대분류 쌍대비교 6문항 (번호 1~6)
export const MAIN_PAIRS = [
  ["A", "B"], ["A", "C"], ["A", "D"], ["B", "C"], ["B", "D"], ["C", "D"],
].map(([l, r], i) => ({ id: l + r, no: String(i + 1), left: l, right: r }));

// 중분류 쌍대비교 (A-1, B-1, C-1, D-1)
export const SUB_PAIRS = CATEGORIES.map((c) => ({ id: c.id, no: `${c.id}-1`, left: SUBITEMS[c.id][0].id, right: SUBITEMS[c.id][1].id }));

export const INTENSITY = [
  { v: 3, label: "약간 더 중요" },
  { v: 5, label: "더 중요" },
  { v: 7, label: "매우 더 중요" },
  { v: 9, label: "절대적으로 중요" },
];

// ── 2-나-1). 절대평가 L-1 ~ L-8 ─────────────────────
const pct = (n, d) => (d > 0 ? (n / d) * 100 : null);
const reduction = (b, a) => (b > 0 ? ((b - a) / b) * 100 : null);
const num = (v) => (v === "" || v == null || isNaN(Number(v)) ? null : Number(v));
const bandUp = (v, cuts) => { // cuts: [2점 하한, 3점 하한, 4점 하한, 5점 하한], 경계값은 상위 점수
  if (v == null) return null;
  let s = 1; cuts.forEach((c, i) => { if (v >= c) s = i + 2; }); return s;
};

export const SCALE5 = ["매우 낮음", "낮음", "보통", "높음", "매우 높음"];

export const ABS_ITEMS = [
  {
    id: "L1", no: "L-1", cat: "A", sub: "A1", name: "진료기록 정확성",
    question: "생성된 진료기록과 X선 판독 결과가 실제 내용과 얼마나 정확했습니까?",
    metric: "사실 오류율(%) = 오류가 1개 이상 포함된 기록 건수 ÷ 체험한 시험 시나리오 건수(9건) × 100",
    metricNote: "사실 오류 : 치아번호(FDI 2자리) · 부위 오기, 진단명 · 술식 오기, 입력 음성 · 영상에 없는 내용 삽입, X선 판독 결과와 영상의 불일치",
    method: "체험한 시험 시나리오 9건의 입력 음성 · 파노라마 X선과 솔루션이 생성한 기록 · 판독 결과를 비교하여, 사실과 다른 내용이 1개 이상 있는 건수를 집계",
    criteria: ["오류율 45% 초과 (5건 이상)", "25% 초과 ~ 45% 이하 (3~4건)", "15% 초과 ~ 25% 이하 (2건)", "0% 초과 ~ 15% 이하 (1건)", "오류율 0% (0건)"],
    features: ["치아번호 FDI 2자리 표기 인식 · 반영", "파노라마 X선 판독(치아번호 · 결손치 · 임플란트 · 매복치 식별) 결과 제시", "판독 결과 시각 표시(히트맵 오버레이)"],
    inputs: [{ id: "errors", label: "오류가 있었던 기록 건수", unit: "건 (9건 중)" }],
    calc: (m) => { const e = num(m.errors); if (e == null) return null; const r = pct(e, 9); return { value: r, text: `오류율 ${r.toFixed(1)}%`, score: r === 0 ? 5 : r <= 15 ? 4 : r <= 25 ? 3 : r <= 45 ? 2 : 1 }; },
    measureLabel: "사실 오류율(%)",
  },
  {
    id: "L2", no: "L-2", cat: "A", sub: "A2", name: "진료기록 완결성",
    question: "기록 유형별 필수 항목이 빠짐없이 초안에 들어 있었습니까?",
    metric: "입력 항목 충족률(%) = 기록에 누락 없이 포함된 필수 항목 수 ÷ 필수 항목 수 × 100 (체험 시나리오 평균)",
    metricNote: "필수 항목 : 초진 8개(주호소, 현병력, 과거력, 통증, 계통문진, 신체검진, 추정진단, 계획) · 재진 4개(통증, S&O, A, P) · 경과기록 4개(S&O, A, P, 환자 및 보호자 교육)",
    method: "체험한 시나리오마다 필수 항목의 포함 여부를 기록 화면에서 확인하여 평균 충족률 산출",
    criteria: ["충족률 30% 미만", "30% 이상 ~ 50% 미만", "50% 이상 ~ 70% 미만", "70% 이상 ~ 90% 미만", "충족률 90% 이상"],
    features: ["초진 · 재진 · 경과기록 유형별 항목 구조에 맞춘 자동 분류 · 기록 초안 생성", "서술형 · SOAP 형식 기록 초안 제공", "표준 기호 · 용어 변환(치식 · 치과 용어)", "음성 수정 · 추가 명령으로 누락 항목 보완"],
    inputs: [{ id: "rate", label: "평균 충족률", unit: "%" }],
    calc: (m) => { const r = num(m.rate); if (r == null) return null; return { value: r, text: `충족률 ${r}%`, score: bandUp(r, [30, 50, 70, 90]) }; },
    measureLabel: "입력 항목 충족률(%)",
  },
  {
    id: "L3", no: "L-3", cat: "B", sub: "B1", name: "기록 완료 시간 단축",
    question: "평소보다 기록 작성 시간이 얼마나 줄었습니까?",
    metric: "기록 작성 시간 단축률(%) = (Before 평균 작성시간 − After 평균 작성시간) ÷ Before × 100",
    metricNote: "Before : 평소 EMR 수기 입력으로 동일 유형 기록을 작성하는 데 걸리는 시간(경험 기준) / After : 음성 입력 ~ 기록 확정까지 소요시간(POC 체험 실측)",
    method: "체험 시나리오 기록 1건당 After 시간을 직접 측정하고, 동일 유형 기록의 평소 작성시간(Before)과 비교하여 평균 단축률 산출",
    criteria: ["단축률 10% 미만 (또는 증가)", "10% 이상 ~ 30% 미만", "30% 이상 ~ 50% 미만", "50% 이상 ~ 70% 미만", "단축률 70% 이상"],
    features: ["음성 인식 결과 실시간 표시 및 기록 초안 자동 생성", "기록 초안 미리보기 · 원클릭 확정", "변경 이력(수정 전 · 후) 기록"],
    inputs: [{ id: "before", label: "평소 기록 1건 작성 시간", unit: "분" }, { id: "after", label: "PuzzleGen 체험 시 작성 시간", unit: "분" }],
    calc: (m) => { const b = num(m.before), a = num(m.after); if (b == null || a == null || b <= 0) return null; const r = reduction(b, a); return { value: r, text: `단축률 ${r.toFixed(1)}%`, score: bandUp(r, [10, 30, 50, 70]) }; },
    measureLabel: "기록 작성 시간 단축률(%)",
  },
  {
    id: "L4", no: "L-4", cat: "B", sub: "B2", name: "재입력 · 추가입력 감소",
    question: "생성된 초안을 고치지 않고 그대로 확정한 경우가 얼마나 됩니까?",
    metric: "무수정 확정률(%) = 수정 없이 그대로 확정한 기록 건수 ÷ 체험한 시험 시나리오 건수(9건) × 100",
    method: "체험한 시나리오마다 생성된 기록 초안을 수정(음성 수정 명령, 직접 입력, 항목 보완) 없이 확정했는지 확인하여 건수 집계",
    criteria: ["확정률 30% 미만 (0~2건)", "30% 이상 ~ 50% 미만 (3~4건)", "50% 이상 ~ 70% 미만 (5~6건)", "70% 이상 ~ 90% 미만 (7~8건)", "확정률 90% 이상 (9건)"],
    features: ["음성 명령으로 수정 · 삭제 · 추가 · 확정(의도 분류)", "수정 내용 차트 즉시 반영 및 변경 이력 기록"],
    inputs: [{ id: "count", label: "수정 없이 확정한 기록 건수", unit: "건 (9건 중)" }],
    calc: (m) => { const c = num(m.count); if (c == null) return null; const r = pct(c, 9); return { value: r, text: `무수정 확정률 ${r.toFixed(1)}%`, score: bandUp(r, [30, 50, 70, 90]) }; },
    measureLabel: "무수정 확정률(%)",
  },
  {
    id: "L5", no: "L-5", cat: "C", sub: "C1", name: "진료 중 인지부하 감소",
    question: "진료 중 기록 때문에 환자 응대를 멈추는 일이 얼마나 줄 것 같습니까?",
    metric: "기록 전환 횟수 감소율(%, 예측) = (Before 기록 전환 횟수 − 예상 After 기록 전환 횟수) ÷ Before × 100",
    metricNote: "기록 전환 : 환자 1명 진료 중 기록할 내용을 기억 · 정리하기 위해 환자 응대를 멈추고 화면 확인 · 메모 · 입력으로 주의를 옮기는 행위",
    method: "평소 환자 1명 진료 중 기록 전환 횟수(Before)와, 체험 결과를 근거로 실제 EMR 적용 시 예상되는 횟수(After)를 각각 기재하여 감소율 산출",
    criteria: ["감소율 10% 미만 (또는 증가)", "10% 이상 ~ 30% 미만", "30% 이상 ~ 50% 미만", "50% 이상 ~ 70% 미만", "감소율 70% 이상 (기록 전환 거의 없음)"],
    features: ["기록 초안 자동 생성(빈 화면에서 시작하지 않음)", "음성 명령으로 수정 · 확정", "발화 중 실시간 인식 결과 표시"],
    inputs: [{ id: "before", label: "평소 환자 1명당 기록 전환 횟수", unit: "회" }, { id: "after", label: "적용 시 예상 횟수", unit: "회" }],
    calc: (m) => { const b = num(m.before), a = num(m.after); if (b == null || a == null || b <= 0) return null; const r = reduction(b, a); return { value: r, text: `감소율 ${r.toFixed(1)}%`, score: bandUp(r, [10, 30, 50, 70]) }; },
    measureLabel: "기록 전환 횟수 감소율(%)",
  },
  {
    id: "L6", no: "L-6", cat: "C", sub: "C2", name: "신체 피로 · 번아웃 감소",
    question: "진료가 끝난 뒤 남는 기록 정리 시간이 얼마나 줄 것 같습니까?",
    metric: "잔여 차팅 시간 감소율(%, 예측) = (Before 잔여 차팅 시간 − 예상 After 잔여 차팅 시간) ÷ Before × 100",
    method: "평소 1일 진료 종료 후 기록 정리에 소요되는 시간(Before)과, 체험 결과를 근거로 실제 EMR 적용 시 예상되는 시간(After)을 각각 기재하여 감소율 산출",
    criteria: ["감소율 10% 미만 (또는 증가)", "10% 이상 ~ 30% 미만", "30% 이상 ~ 50% 미만", "50% 이상 ~ 70% 미만", "감소율 70% 이상 (또는 잔여 차팅 10분 이내)"],
    features: ["음성 입력으로 기록 초안 일괄 생성", "기록 초안 미리보기 후 일괄 확정(원클릭 확정)"],
    inputs: [{ id: "before", label: "평소 하루 진료 후 기록 정리 시간", unit: "분" }, { id: "after", label: "적용 시 예상 시간", unit: "분" }],
    calc: (m) => { const b = num(m.before), a = num(m.after); if (b == null || a == null || b <= 0) return null; const r = reduction(b, a); const s = a <= 10 ? 5 : bandUp(r, [10, 30, 50, 70]); return { value: r, text: `감소율 ${r.toFixed(1)}%${a <= 10 ? " · 잔여 10분 이내" : ""}`, score: s }; },
    measureLabel: "잔여 차팅 시간 감소율(%)",
  },
  {
    id: "L7", no: "L-7", cat: "D", sub: "D1", name: "기존 진료흐름 적합성",
    question: "기록 1건을 마치기까지 조작이 간단했고, 기존 진료 흐름에 잘 맞았습니까?",
    metric: "기록 1건 작성을 위해 사용자가 수행하는 조작 단계 수 및 기존 진료흐름 변경 필요 여부",
    metricNote: "조작 단계 : 음성 입력(STT) → 인식 결과 확인 → (필요 시 음성 수정) → 기록 확정까지 사용자가 수행하는 단계 수",
    method: "체험 시나리오 기록 1건당 조작 단계 수를 세어 평균 산출하고, 기존 초진 · 재진 · 경과기록 작성 흐름의 변경 필요 여부 확인",
    criteria: ["9단계 초과 또는 기존 진료흐름 변경 필요", "7단계 초과 ~ 9단계 이하", "5단계 초과 ~ 7단계 이하", "3단계 초과 ~ 5단계 이하", "3단계 이하 (흐름 변경 없음)"],
    features: ["초진 · 재진 · 경과기록 3종 기록 유형 지원", "서술형 · SOAP 등 기존 기록 형식에 맞춘 초안 제공", "파노라마 X선 업로드 · 판독 결과를 기록과 함께 확인", "치아 선택 시 과거 이력(타임라인) 조회"],
    inputs: [{ id: "steps", label: "기록 1건당 평균 조작 단계 수", unit: "단계" }, { id: "flowChange", label: "기존 진료흐름 변경이 필요합니까?", type: "yesno" }],
    calc: (m) => { const s = num(m.steps); if (s == null) return null; const change = m.flowChange === "yes"; const score = change || s > 9 ? 1 : s > 7 ? 2 : s > 5 ? 3 : s > 3 ? 4 : 5; return { value: s, text: `${s}단계${change ? " · 흐름 변경 필요" : ""}`, score }; },
    measureLabel: "조작 단계 수(단계)",
  },
  {
    id: "L8", no: "L-8", cat: "D", sub: "D2", name: "현장 통합 예측성",
    question: "실제 EMR에 적용하면 하루 기록 중 얼마나 PuzzleGen으로 작성할 수 있겠습니까?",
    metric: "업무 적용 가능 비율(%, 예측) = PuzzleGen Dental로 작성 · 확정 가능하다고 판단되는 1일 기록 건수 ÷ 평소 1일 전체 기록 건수 × 100",
    method: "평소 1일 작성하는 진료기록 건수를 기준으로, 체험 결과에 비추어 PuzzleGen Dental로 작성 · 확정할 수 있다고 판단되는 건수를 기재하여 비율 산출",
    criteria: ["적용 비율 20% 미만 (일부 업무에 제한적 적용)", "20% 이상 ~ 40% 미만", "40% 이상 ~ 60% 미만", "60% 이상 ~ 80% 미만", "적용 비율 80% 이상 (대부분의 기록 업무)"],
    features: ["초진 · 재진 · 경과기록 3종 기록 유형 지원", "음성 입력 기반 기록 초안 자동 생성 · 확정", "파노라마 X선 판독(치아번호 · 결손치 · 임플란트 · 매복치) 결과 제공", "웹 브라우저 기반 접속(시험 링크)"],
    inputs: [{ id: "total", label: "평소 하루 전체 기록 건수", unit: "건" }, { id: "applicable", label: "PuzzleGen으로 작성 가능한 건수", unit: "건" }],
    calc: (m) => { const t = num(m.total), a = num(m.applicable); if (t == null || a == null || t <= 0) return null; const r = pct(a, t); return { value: r, text: `적용 비율 ${r.toFixed(1)}%`, score: bandUp(r, [20, 40, 60, 80]) }; },
    measureLabel: "업무 적용 가능 비율(%)",
  },
];

export const absByCat = (cat) => ABS_ITEMS.filter((i) => i.cat === cat);

// ── 2-나-2). 정량 성과 Q1 ~ Q3 ──────────────────────
export const QUANT = [
  { id: "Q1", title: "진료당 기록 시간 변화", lead: "환자 1명의 진료기록(초진 · 재진 · 경과기록)을 작성하는 시간이", unit: "분", short: "기록 1건 작성 시간" },
  { id: "Q2", title: "기록 처리 생산성 변화", lead: "1시간당 처리 가능한 기록 건수가", unit: "건", short: "시간당 기록 처리 건수" },
  { id: "Q3", title: "기록 오류 · 누락 발생 빈도", lead: "진료기록 10건당 수정이 필요한 오류 · 누락(치아번호 · 부위 오기, 진단명 · 증상 오기, 필수 항목 누락 등)이 발생하는 건수가", unit: "건", short: "기록 10건당 오류 · 누락 건수" },
];

// ── 3. 개선 의견 ───────────────────────────────────
export const SATISFACTION = [
  { id: "s1", name: "음성 입력(STT) 인식 정확도" },
  { id: "s2", name: "파노라마 X선 판독 결과(치아번호 · 결손치 · 임플란트 · 매복치)" },
  { id: "s3", name: "진료기록 요약 품질(서술형 · SOAP)" },
  { id: "s4", name: "음성 수정 · 확정 명령 편의성" },
  { id: "s5", name: "치아별 과거 이력 조회(타임라인)" },
];
export const SAT_SCALE = ["매우 불만", "불만", "보통", "만족", "매우 만족"];

export const AGENT_Q = [
  { id: "expect", name: "AGENT 제공 시 EMR 업무 성과 기대 수준", scale: ["전혀 기대되지 않음", "기대되지 않음", "보통", "기대됨", "매우 기대됨"] },
  { id: "intent", name: "AGENT 제공 시 EMR 도입 · 사용 의향", scale: ["전혀 없음", "없음", "보통", "있음", "매우 있음"] },
];

export const FEATURES = [
  "우식 · 치주염 · 치근단 병소 자동 탐지",
  "보철 색상(셰이드) 추천",
  "여러 화자(의사 · 위생사 · 환자) 대화 인식 · 상시 대기 음성 입력",
  "복합 음성 명령(한 번에 여러 항목 수정)",
  "EMR 양방향 연동(보험청구 EDI · FHIR 포함)",
  "환자 설명용 리포트 자동 생성",
  "기공 의뢰서(Lab Sheet) 자동 작성",
  "다국어 지원(외국인 환자)",
  "AGENT(음성 명령으로 EMR 서식 자동 입력)",
  "사용자별 용어 · 템플릿 설정",
  "기타",
  "현재 기능만으로 충분",
];

export const INTENT_SCALE = ["전혀 없음", "없음", "보통", "있음", "매우 있음"];
export const FACTORS = ["인식 · 판독 정확도", "시간 절감 효과", "EMR 연동", "비용", "보안 · 책임", "스탭 · 환자 수용성", "교육 · 지원", "기타"];

// 빈 응답 구조
export const emptyAnswers = () => ({
  consent: { c1: "", c2: "", c3: "", org: "", dept: "", name: "", signed: false },
  basic: { duty: [], careTypes: [] },
  ahpMain: {},
  mainTop: "",
  mainReason: "",
  ahpSub: {},
  abs: {},
  absNote: {},
  quant: {},
  satisfaction: {},
  agent: {},
  features: { selected: [], top: "", etc: "" },
  overall: { intent: null, factor: "", factorEtc: "", comment: "" },
});

// 쌍대비교 응답 → 표기 문자열 (예: "업무효과성 쪽 5 (더 중요)")
export const pairText = (p, leftName, rightName) => {
  if (!p || !p.favor) return "미응답";
  if (p.favor === "equal") return "동등 (1)";
  const side = p.favor === "left" ? leftName : rightName;
  if (!p.intensity) return `${side} 쪽 (정도 미선택)`;
  const lab = INTENSITY.find((i) => i.v === p.intensity)?.label;
  return `${side} 쪽 ${p.intensity} (${lab})`;
};

// 일부 항목이 빠진 응답(이전 버전 · 작성 초기)도 안전하게 다루도록 빈 구조와 합침
export const normalizeAnswers = (a) => {
  const base = emptyAnswers();
  const src = a && typeof a === "object" ? a : {};
  const outA = { ...base, ...src };
  for (const k of Object.keys(base)) {
    const bv = base[k];
    if (bv && typeof bv === "object" && !Array.isArray(bv)) outA[k] = { ...bv, ...(src[k] && typeof src[k] === "object" ? src[k] : {}) };
  }
  if (!Array.isArray(outA.features.selected)) outA.features.selected = [];
  if (!Array.isArray(outA.basic.duty)) outA.basic.duty = [];
  if (!Array.isArray(outA.basic.careTypes)) outA.basic.careTypes = [];
  return outA;
};
export const normalizeRecord = (r) => ({ ...r, answers: normalizeAnswers(r?.answers) });

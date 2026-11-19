// 사용성 평가 운영 설정 — 필요 시 이 파일만 수정하면 됩니다.
export const SURVEY_CONFIG = {
  // 평가자 수 (평가자 번호 1 ~ N)
  evaluatorCount: 5,
  // 보고서 표지·본문에 들어가는 정보
  productName: "PuzzleGen Dental",
  productVersion: "1.0",
  solutionName: "AI 의무기록 자동생성 솔루션",
  organization: "㈜퍼즐에이아이",
  reportDate: "2026. 11",
  surveyPeriod: "2026. 11",
  pocUrl: "dental.rook.puzzle-ai.com",
  // 시험 시나리오 건수 (L-1, L-4 비율 계산 기준)
  scenarioCount: 9,
};

// 저장 API 주소 (Node 서버의 /api/survey)
export const API_URL = "/api/survey";

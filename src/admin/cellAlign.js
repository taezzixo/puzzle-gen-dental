// 표 셀 정렬 규칙 (화면 · Word 공용): 긴 서술형 텍스트는 왼쪽, 숫자 표(alignRight)는 오른쪽, 그 외 가운데
export function cellAlign(b, c, ci) {
  const text = String(c && typeof c === "object" ? c.text : c ?? "");
  if (c && typeof c === "object" && c.colSpan) return "center";
  if (b.alignRight && ci > 0) return "right";
  if (b.alignLeft?.includes(ci) || text.length > 28 || text.includes("▪")) return "left";
  return "center";
}

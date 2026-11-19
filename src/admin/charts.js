// 보고서용 SVG 차트 (화면 · PDF · Word 공용). 문자열로 생성합니다.
export const FONT = "'Malgun Gothic','Apple SD Gothic Neo','Noto Sans KR','Pretendard',sans-serif";
export const C = { main: "#16607f", dark: "#0d3d57", mid: "#4f86a3", light: "#8fb0c4", pale: "#c4d4de", grid: "#d4d9de", text: "#1f2937", sub: "#4b5563", red: "#d62828", after: "#8a9eae" };
const PIE_COLORS = ["#0d3d57", "#16607f", "#2f7a99", "#5d8fa8", "#8aa8ba", "#b3c4cf", "#d5dee4", "#e8eef1"];

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const fmt = (v, d = 1) => (v == null || isNaN(v) ? "-" : Number(v).toFixed(d));

// 한글 기준 대략 글자 수로 줄바꿈
export function wrap(text, max) {
  const words = String(text).split(" ");
  const lines = []; let cur = "";
  words.forEach((w) => {
    if ((cur + " " + w).trim().length > max && cur) { lines.push(cur); cur = w; } else cur = (cur + " " + w).trim();
  });
  if (cur) lines.push(cur);
  return lines.flatMap((l) => (l.length > max + 3 ? l.match(new RegExp(`.{1,${max}}`, "g")) : [l]));
}
const tspans = (lines, x, lh) => lines.map((l, i) => `<tspan x="${x}" dy="${i === 0 ? 0 : lh}">${esc(l)}</tspan>`).join("");

const svg = (w, h, body) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" font-family="${FONT}"><rect width="${w}" height="${h}" fill="#fff"/>${body}</svg>`;

// 세로 막대 (리커트 1~5 또는 0~max)
export function barChart({ items, yMin = 1, yMax = 5, yLabels, avg, width = 640, height = 300, decimals = 1, ticks }) {
  const left = yLabels ? 92 : 48, right = 20, top = 24, bottom = 54;
  const pw = width - left - right, ph = height - top - bottom;
  const y = (v) => top + ph - ((v - yMin) / (yMax - yMin)) * ph;
  const tickVals = ticks || (yLabels ? Object.keys(yLabels).map(Number) : Array.from({ length: 5 }, (_, i) => yMin + ((yMax - yMin) * i) / 4));
  let b = "";
  tickVals.forEach((t) => {
    b += `<line x1="${left}" x2="${left + pw}" y1="${y(t)}" y2="${y(t)}" stroke="${C.grid}" stroke-dasharray="4 4"/>`;
    b += `<text x="${left - 8}" y="${y(t) + 4}" text-anchor="end" font-size="12" fill="${C.sub}">${esc(yLabels ? yLabels[t] : fmt(t, Number.isInteger(t) ? 0 : 1))}</text>`;
  });
  b += `<line x1="${left}" x2="${left}" y1="${top}" y2="${top + ph}" stroke="#9ca3af"/><line x1="${left}" x2="${left + pw}" y1="${top + ph}" y2="${top + ph}" stroke="#9ca3af"/>`;
  const n = items.length, slot = pw / Math.max(n, 1), bw = Math.min(64, slot * 0.5);
  items.forEach((it, i) => {
    const cx = left + slot * (i + 0.5);
    if (it.value != null && !isNaN(it.value)) {
      const v = Math.max(yMin, Math.min(yMax, it.value));
      b += `<rect x="${cx - bw / 2}" y="${y(v)}" width="${bw}" height="${top + ph - y(v)}" fill="${it.color || C.main}"/>`;
      b += `<text x="${cx}" y="${y(v) - 6}" text-anchor="middle" font-size="13" font-weight="700" fill="${C.text}">${fmt(it.value, decimals)}</text>`;
    } else {
      b += `<text x="${cx}" y="${top + ph - 8}" text-anchor="middle" font-size="11" fill="${C.sub}">응답 없음</text>`;
    }
    const lines = wrap(it.label, Math.max(6, Math.floor(slot / 13)));
    b += `<text x="${cx}" y="${top + ph + 18}" text-anchor="middle" font-size="12" fill="${C.text}">${tspans(lines.slice(0, 2), cx, 14)}</text>`;
  });
  if (avg != null && !isNaN(avg)) {
    b += `<line x1="${left}" x2="${left + pw}" y1="${y(avg)}" y2="${y(avg)}" stroke="${C.red}" stroke-width="1.6" stroke-dasharray="7 5"/>`;
    b += `<text x="${left + pw - 4}" y="${y(avg) - 6}" text-anchor="end" font-size="12" font-style="italic" fill="${C.red}">Avg. ${fmt(avg, decimals)}</text>`;
  }
  return svg(width, height, b);
}

// 원형 (범례 오른쪽)
export function pieChart({ items, width = 340, height = 230, showLegend = true, highlight }) {
  const total = items.reduce((s, i) => s + (i.value || 0), 0);
  const cx = showLegend ? 115 : width / 2, cy = height / 2, r = Math.min(95, height / 2 - 14);
  let b = "";
  if (!total) {
    b += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#eef1f3"/><text x="${cx}" y="${cy + 5}" text-anchor="middle" font-size="13" fill="${C.sub}">응답 없음</text>`;
  } else {
    let a0 = -Math.PI / 2;
    items.forEach((it, i) => {
      const v = it.value || 0; if (!v) return;
      const frac = v / total, a1 = a0 + frac * Math.PI * 2;
      const col = it.color || PIE_COLORS[i % PIE_COLORS.length];
      if (frac >= 0.9999) b += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${col}" stroke="#fff" stroke-width="1.5"/>`;
      else {
        const large = a1 - a0 > Math.PI ? 1 : 0;
        b += `<path d="M${cx},${cy} L${cx + r * Math.cos(a0)},${cy + r * Math.sin(a0)} A${r},${r} 0 ${large} 1 ${cx + r * Math.cos(a1)},${cy + r * Math.sin(a1)} Z" fill="${col}" stroke="#fff" stroke-width="1.5"/>`;
      }
      const am = (a0 + a1) / 2, lr = r * 0.62;
      const light = i >= 5;
      if (frac >= 0.04) b += `<text x="${cx + lr * Math.cos(am)}" y="${cy + lr * Math.sin(am) + 4}" text-anchor="middle" font-size="11.5" font-weight="700" fill="${light ? C.text : "#fff"}">${(frac * 100).toFixed(1)}%</text>`;
      a0 = a1;
    });
  }
  if (highlight != null && total) b += `<text x="${cx}" y="${height - 2}" text-anchor="middle" font-size="12.5" font-weight="700" fill="${C.red}">긍정 ${highlight.toFixed(1)}%</text>`;
  if (showLegend) {
    const lx = cx + r + 22; let ly = cy - (items.length * 18) / 2 + 9;
    items.forEach((it, i) => {
      b += `<rect x="${lx}" y="${ly - 9}" width="10" height="10" fill="${it.color || PIE_COLORS[i % PIE_COLORS.length]}"/>`;
      b += `<text x="${lx + 15}" y="${ly}" font-size="11.5" fill="${C.text}">${esc(it.label)} (${it.value || 0})</text>`;
      ly += 18;
    });
  }
  return svg(width, height, b);
}

// 묶은 세로 막대 (도입 전/후, 지역가중치 등)
export function groupedBar({ groups, series, colors = [C.main, C.after], width = 640, height = 300, yMax, decimals = 1, annotate, unit = "" }) {
  const left = 48, right = 20, top = series.length > 1 ? 40 : 20, bottom = 46;
  const pw = width - left - right, ph = height - top - bottom;
  const maxV = yMax || Math.max(1, ...groups.flatMap((g) => g.values.filter((v) => v != null))) * 1.25;
  const y = (v) => top + ph - (v / maxV) * ph;
  let b = "";
  for (let i = 0; i <= 5; i++) {
    const t = (maxV * i) / 5;
    b += `<line x1="${left}" x2="${left + pw}" y1="${y(t)}" y2="${y(t)}" stroke="${C.grid}" stroke-dasharray="4 4"/>`;
    b += `<text x="${left - 6}" y="${y(t) + 4}" text-anchor="end" font-size="11" fill="${C.sub}">${i === 0 ? "–" : fmt(t, maxV < 10 ? 1 : 0)}</text>`;
  }
  if (series.length > 1) series.forEach((s, i) => {
    b += `<rect x="${left + 10 + i * 82}" y="10" width="11" height="11" fill="${colors[i]}"/><text x="${left + 26 + i * 82}" y="20" font-size="12" fill="${C.text}">${esc(s)}</text>`;
  });
  const slot = pw / Math.max(groups.length, 1), bw = Math.min(40, (slot * 0.62) / series.length);
  groups.forEach((g, gi) => {
    const gx = left + slot * gi + slot / 2 - (bw * series.length) / 2;
    g.values.forEach((v, si) => {
      if (v == null || isNaN(v)) return;
      const x = gx + si * bw;
      b += `<rect x="${x + 2}" y="${y(v)}" width="${bw - 4}" height="${top + ph - y(v)}" fill="${colors[si]}"/>`;
      b += `<text x="${x + bw / 2}" y="${y(v) - 5}" text-anchor="middle" font-size="11.5" font-weight="700" fill="${C.text}">${fmt(v, decimals)}${unit}</text>`;
    });
    if (annotate) { const a = annotate(g); if (a) b += `<text x="${left + slot * gi + slot / 2}" y="${top + 12}" text-anchor="middle" font-size="12" font-style="italic" font-weight="700" fill="#1d4ed8">${esc(a)}</text>`; }
    const lines = wrap(g.label, Math.max(6, Math.floor(slot / 12)));
    b += `<text x="${left + slot * gi + slot / 2}" y="${top + ph + 17}" text-anchor="middle" font-size="12" fill="${C.text}">${tspans(lines.slice(0, 2), left + slot * gi + slot / 2, 14)}</text>`;
  });
  b += `<line x1="${left}" x2="${left + pw}" y1="${top + ph}" y2="${top + ph}" stroke="#9ca3af"/>`;
  return svg(width, height, b);
}

// 가로 막대 (응답 수 · 비중)
export function hBarChart({ items, width = 640, rowH = 30, labelW = 250, max, unit = "명", decimals = 0 }) {
  const height = items.length * rowH + 20;
  const pw = width - labelW - 120;
  const m = max || Math.max(1, ...items.map((i) => i.value || 0));
  let b = "";
  items.forEach((it, i) => {
    const yy = 10 + i * rowH;
    const lines = wrap(it.label, Math.floor(labelW / 12.5));
    b += `<text x="${labelW - 8}" y="${yy + rowH / 2 + 4 - (lines.length > 1 ? 7 : 0)}" text-anchor="end" font-size="12" fill="${C.text}">${tspans(lines.slice(0, 2), labelW - 8, 14)}</text>`;
    const w = ((it.value || 0) / m) * pw;
    b += `<rect x="${labelW}" y="${yy + 5}" width="${Math.max(0, w)}" height="${rowH - 10}" fill="${it.color || C.main}"/>`;
    b += `<text x="${labelW + w + 6}" y="${yy + rowH / 2 + 4}" font-size="12" font-weight="700" fill="${C.text}">${fmt(it.value || 0, decimals)}${unit}${it.extra ? " " + esc(it.extra) : ""}</text>`;
  });
  return svg(width, height, b);
}

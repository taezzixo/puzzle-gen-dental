// Word(.docx) 내보내기 — 보고서 · 개인별 응답지
import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType, ImageRun, HeadingLevel,
  BorderStyle, ShadingType, Footer, PageNumber, VerticalAlign, PageBreak,
} from "docx";
import { responseSections } from "./responseRows.js";
import { cellAlign } from "./cellAlign.js";

const FONT = "Malgun Gothic";
const CONTENT_PX = 600; // A4 본문 폭(여백 제외) 기준 이미지 최대 폭

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

async function svgToPng(svgStr, w, h, scale = 2) {
  const img = new Image();
  await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svgStr); });
  const c = document.createElement("canvas");
  c.width = w * scale; c.height = h * scale;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(img, 0, 0, c.width, c.height);
  const blob = await new Promise((r) => c.toBlob(r, "image/png"));
  return new Uint8Array(await blob.arrayBuffer());
}

const run = (text, o = {}) => new TextRun({ text: String(text ?? ""), font: FONT, ...o });
const multiline = (text, o = {}) => String(text ?? "").split("\n").map((l, i) => run(l, { ...o, break: i > 0 ? 1 : undefined }));
const thin = { style: BorderStyle.SINGLE, size: 4, color: "444444" };
const cellBorders = { top: thin, bottom: thin, left: thin, right: thin };
const noBorders = { top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, insideHorizontal: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, insideVertical: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" } };

const pageFooter = () => new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [run("- ", { size: 18 }), new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 18 }), run(" -", { size: 18 })] })] });

function docTable(b) {
  const nCols = b.widths?.length || Math.max(...b.head.map((r) => r.reduce((s, c) => s + (c?.colSpan || 1), 0)));
  const widths = b.widths || Array(nCols).fill(100 / nCols);
  const mk = (c, header, ci) => new TableCell({
    columnSpan: c?.colSpan, rowSpan: c?.rowSpan, borders: cellBorders, verticalAlign: VerticalAlign.CENTER,
    shading: header ? { type: ShadingType.CLEAR, color: "auto", fill: "EFEFEF" } : undefined,
    margins: { top: 40, bottom: 40, left: 80, right: 80 },
    children: [new Paragraph({ alignment: header ? AlignmentType.CENTER : { left: AlignmentType.LEFT, right: AlignmentType.RIGHT, center: AlignmentType.CENTER }[cellAlign(b, c, ci)], children: multiline(c && typeof c === "object" ? c.text : c, { size: 18, bold: header }) })],
  });
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    columnWidths: widths.map((w) => Math.round(w * 90)),
    rows: [
      ...b.head.map((r) => new TableRow({ tableHeader: true, children: r.map((c, ci) => mk(c, true, ci)) })),
      ...b.rows.map((r) => new TableRow({ cantSplit: true, children: r.map((c, ci) => mk(c, false, ci)) })),
    ],
  });
}

async function imagePara(svg, w, h, maxW = CONTENT_PX) {
  const data = await svgToPng(svg, w, h);
  const scale = Math.min(1, maxW / w);
  return new Paragraph({ alignment: AlignmentType.CENTER, keepNext: true, children: [new ImageRun({ type: "png", data, transformation: { width: Math.round(w * scale), height: Math.round(h * scale) } })] });
}
const caption = (text) => new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 240 }, children: [run(text, { bold: true, size: 19 })] });

// ── 보고서 ───────────────────────────────────────
export async function exportReportDocx(blocks, filename) {
  const front = []; // 표지 · 목차 (쪽 번호 없음)
  let children = front;
  let body = null;
  let pendingBreak = false;
  const add = (p) => {
    if (pendingBreak) { children.push(new Paragraph({ children: [new PageBreak()] })); pendingBreak = false; }
    children.push(p);
  };
  for (const b of blocks) {
    switch (b.t) {
      case "cover":
        add(new Paragraph({ spacing: { before: 3600, after: 300 }, alignment: AlignmentType.CENTER, children: [run(b.kicker, { size: 30, color: "1F3D7A" })] }));
        add(new Paragraph({ alignment: AlignmentType.CENTER, children: [run(b.title, { size: 44, bold: true, color: "1F3D7A" })] }));
        add(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 200 }, children: [run(b.sub, { size: 22, color: "4B5563" })] }));
        add(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 5200, after: 600 }, children: [run(b.date, { size: 26 })] }));
        add(new Paragraph({ alignment: AlignmentType.CENTER, children: [run(b.org, { size: 32, bold: true })] }));
        break;
      case "toc":
        add(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 600, after: 600 }, children: [run("목      차", { size: 36, bold: true })] }));
        b.entries.forEach((e) => add(new Paragraph({ spacing: { before: e.level === 0 ? 360 : 80, after: 60 }, indent: { left: e.level ? 360 : 0 }, border: { bottom: { style: BorderStyle.DOTTED, size: 4, color: "9CA3AF", space: 1 } }, children: [run(e.text, { size: e.level ? 22 : 26, bold: !e.level })] })));
        break;
      case "pagebreak": pendingBreak = true; break;
      case "chapter":
        if (!body) { body = []; children = body; pendingBreak = false; } // 본문은 새 구역(1쪽부터)
        add(new Paragraph({
          heading: HeadingLevel.HEADING_1, spacing: { after: 300 },
          shading: { type: ShadingType.CLEAR, color: "auto", fill: "D9F1FA" },
          border: { top: { style: BorderStyle.SINGLE, size: 24, color: "8C8C8C", space: 4 }, bottom: { style: BorderStyle.SINGLE, size: 24, color: "8C8C8C", space: 4 } },
          children: [run(b.text, { size: 32, bold: true, color: "000000" })],
        }));
        break;
      case "section":
        add(new Paragraph({
          heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 160 }, indent: { right: 3600 },
          shading: { type: ShadingType.CLEAR, color: "auto", fill: "E3EFD6" },
          border: { top: { style: BorderStyle.SINGLE, size: 18, color: "9AA58A", space: 3 }, bottom: { style: BorderStyle.SINGLE, size: 18, color: "9AA58A", space: 3 } },
          children: [run(b.text, { size: 28, bold: true, color: "000000" })],
        }));
        break;
      case "sq": add(new Paragraph({ spacing: { before: 220, after: 80 }, keepNext: true, children: [run("❑ " + b.text, { size: 25 })] })); break;
      case "o": add(new Paragraph({ spacing: { after: 60, line: 360 }, indent: { left: 500, hanging: 300 }, alignment: AlignmentType.JUSTIFIED, children: [run("❍ " + b.text, { size: 21 })] })); break;
      case "dash": add(new Paragraph({ spacing: { after: 60, line: 360 }, indent: { left: 760, hanging: 220 }, alignment: AlignmentType.JUSTIFIED, children: [run("– " + b.text, { size: 21 })] })); break;
      case "note": add(new Paragraph({ spacing: { after: 60, line: 340 }, indent: { left: 900, hanging: 260 }, children: [run("※ " + b.text, { size: 19 })] })); break;
      case "chart":
        add(await imagePara(b.svg, b.w, b.h));
        add(caption(b.caption));
        break;
      case "charts": {
        const cells = [];
        for (const it of b.items) {
          cells.push(new TableCell({ borders: noBorders, width: { size: 50, type: WidthType.PERCENTAGE }, children: [await imagePara(it.svg, it.w, it.h, 295), caption(it.caption)] }));
        }
        add(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, borders: noBorders, rows: [new TableRow({ cantSplit: true, children: cells })] }));
        break;
      }
      case "table":
        add(new Paragraph({ alignment: AlignmentType.CENTER, keepNext: true, spacing: { before: 200, after: 80 }, children: [run(b.caption, { bold: true, size: 19 })] }));
        add(docTable(b));
        add(new Paragraph({ spacing: { after: 160 }, children: [] }));
        break;
      case "quotes":
        if (b.title) add(new Paragraph({ indent: { left: 760 }, spacing: { before: 80 }, children: [run(b.title, { bold: true, size: 19 })] }));
        b.items.forEach((q) => {
          add(new Paragraph({ indent: { left: 760 }, spacing: { before: 80 }, border: { left: { style: BorderStyle.SINGLE, size: 18, color: "9FB6C6", space: 6 } }, children: [run(q.who, { bold: true, size: 17, color: "4B5563" })] }));
          add(new Paragraph({ indent: { left: 760 }, spacing: { after: 60 }, border: { left: { style: BorderStyle.SINGLE, size: 18, color: "9FB6C6", space: 6 } }, children: multiline(q.text, { size: 19 }) }));
        });
        break;
      default: break;
    }
  }
  const doc = new Document({
    creator: "PuzzleGen Dental 사용성 평가",
    styles: { default: { document: { run: { font: FONT, size: 21 } } } },
    sections: [
      { properties: { page: { margin: REPORT_MARGIN } }, children: front },
      ...(body ? [{ properties: { page: { margin: REPORT_MARGIN, pageNumbers: { start: 1 } } }, footers: { default: pageFooter() }, children: body }] : []),
    ],
  });
  downloadBlob(await Packer.toBlob(doc), filename);
}
const REPORT_MARGIN = { top: 1300, bottom: 1200, left: 1250, right: 1250 };

// ── 평가자 개인 응답지 (원본) ────────────────────
export async function exportResponseDocx(rec, filename, { title } = {}) {
  const children = [
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 120 }, children: [run(title || "PuzzleGen Dental 사용성 평가 응답지", { size: 34, bold: true, color: "1F3D7A" })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 360 }, children: [run(`평가자 ${rec.evaluatorId}번 · ${rec.answers?.consent?.name || "(성명 미기재)"}`, { size: 24 })] }),
  ];
  for (const s of responseSections(rec)) {
    children.push(new Paragraph({ spacing: { before: 280, after: 100 }, keepNext: true, shading: { type: ShadingType.CLEAR, color: "auto", fill: "E3EFD6" }, children: [run(s.title, { bold: true, size: 23 })] }));
    children.push(new Table({
      width: { size: 100, type: WidthType.PERCENTAGE }, columnWidths: [4300, 4700],
      rows: s.rows.map(([q, a]) => new TableRow({
        cantSplit: true, children: [
          new TableCell({ borders: cellBorders, width: { size: 46, type: WidthType.PERCENTAGE }, shading: { type: ShadingType.CLEAR, color: "auto", fill: "F5F5F5" }, margins: { top: 40, bottom: 40, left: 80, right: 80 }, children: [new Paragraph({ children: multiline(q, { size: 18 }) })] }),
          new TableCell({ borders: cellBorders, width: { size: 54, type: WidthType.PERCENTAGE }, margins: { top: 40, bottom: 40, left: 80, right: 80 }, children: [new Paragraph({ children: multiline(a || "(미응답)", { size: 19, bold: !!a, color: a ? "000000" : "9CA3AF" }) })] }),
        ],
      })),
    }));
  }
  const doc = new Document({
    styles: { default: { document: { run: { font: FONT, size: 20 } } } },
    sections: [{ properties: { page: { margin: { top: 1100, bottom: 1100, left: 1100, right: 1100 } } }, footers: { default: pageFooter() }, children }],
  });
  downloadBlob(await Packer.toBlob(doc), filename);
}

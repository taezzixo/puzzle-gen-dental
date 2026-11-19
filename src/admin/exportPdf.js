// PDF 내보내기: 보고서 블록을 A4 페이지로 나눈 뒤 페이지마다 이미지로 캡처하여 PDF로 저장
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import { ReportView, REPORT_CSS } from "./ReportView.jsx";
import { downloadBlob } from "./exportDocx.js";

const PAGE_W = 794, PAGE_H = 1123, PAD_X = 62, PAD_Y = 64;

const PDF_CSS = `
.pdf-page{width:${PAGE_W}px;height:${PAGE_H}px;background:#fff;box-sizing:border-box;padding:${PAD_Y}px ${PAD_X}px;overflow:hidden;position:relative}
.pdf-page .rp-doc{padding:0;max-width:none}
.pdf-page .rp-cover{min-height:${PAGE_H - PAD_Y * 2}px;height:${PAGE_H - PAD_Y * 2}px;padding-top:200px}
.pdf-page .rp-pagebreak{display:none}
.pdf-num{position:absolute;bottom:26px;left:0;right:0;text-align:center;font-size:12px;color:#333;font-family:'Malgun Gothic',sans-serif}
`;

export async function exportReportPdf(blocks, filename, onProgress) {
  const host = document.createElement("div");
  host.style.cssText = `position:fixed;left:-20000px;top:0;width:${PAGE_W}px;z-index:-1`;
  host.innerHTML = `<style>${REPORT_CSS}${PDF_CSS}</style>`;
  document.body.appendChild(host);
  try {
    // 블록을 정적 HTML로 생성
    const src = document.createElement("div");
    src.innerHTML = renderToStaticMarkup(createElement(ReportView, { blocks }));
    const units = Array.from(src.firstChild.children);

    const pages = [];
    let content = null;
    const newPage = () => {
      const page = document.createElement("div");
      page.className = "pdf-page";
      content = document.createElement("div");
      content.className = "rp-doc";
      page.appendChild(content);
      host.appendChild(page);
      pages.push(page);
    };
    const maxH = PAGE_H - PAD_Y * 2;
    const place = (el) => {
      content.appendChild(el);
      if (content.scrollHeight > maxH && content.children.length > 1) {
        content.removeChild(el);
        newPage();
        content.appendChild(el);
      }
    };
    newPage();
    for (const u of units) {
      if (u.classList.contains("rp-pagebreak")) { if (content.children.length) newPage(); continue; }
      // 한 페이지보다 긴 주관식 묶음은 항목 단위로 나눔
      if (u.classList.contains("rp-quotes")) {
        content.appendChild(u);
        const tooTall = content.scrollHeight > maxH;
        content.removeChild(u);
        if (tooTall) {
          Array.from(u.children).forEach((child) => { const w = document.createElement("div"); w.className = "rp-quotes"; w.appendChild(child); place(w); });
          continue;
        }
      }
      place(u);
    }

    // 쪽 번호: 표지·목차 제외, 1장부터 1쪽
    const firstChapter = pages.findIndex((p) => p.querySelector(".rp-chapter"));
    pages.forEach((p, i) => {
      if (firstChapter >= 0 && i >= firstChapter) {
        const n = document.createElement("div"); n.className = "pdf-num"; n.textContent = `- ${i - firstChapter + 1} -`; p.appendChild(n);
      }
    });

    const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait", compress: true });
    for (let i = 0; i < pages.length; i++) {
      onProgress?.(i + 1, pages.length);
      const canvas = await html2canvas(pages[i], { scale: 2, backgroundColor: "#ffffff", useCORS: true, logging: false, windowWidth: PAGE_W });
      if (i > 0) pdf.addPage();
      pdf.addImage(canvas.toDataURL("image/jpeg", 0.92), "JPEG", 0, 0, 210, 297);
    }
    downloadBlob(pdf.output("blob"), filename);
  } finally {
    host.remove();
  }
}

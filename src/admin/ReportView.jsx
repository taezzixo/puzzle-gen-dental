// 보고서 블록 → 화면(HTML). PDF 내보내기도 이 화면을 그대로 캡처합니다.
import { forwardRef } from "react";
import { cellAlign } from "./cellAlign.js";

const cellText = (c) => (c && typeof c === "object" ? c.text : c);
const lines = (t) => String(t ?? "").split("\n").map((l, i, arr) => <span key={i}>{l}{i < arr.length - 1 && <br />}</span>);

export function Block({ b }) {
  switch (b.t) {
    case "cover":
      return (
        <div className="rp-cover">
          <div className="rp-cover-kicker">{b.kicker}</div>
          <div className="rp-cover-title">{b.title}</div>
          <div className="rp-cover-sub">{b.sub}</div>
          <div className="rp-cover-date">{b.date}</div>
          <div className="rp-cover-org">{b.org}</div>
        </div>
      );
    case "toc":
      return (
        <div className="rp-toc">
          <div className="rp-toc-title">목 &nbsp;&nbsp;&nbsp; 차</div>
          {b.entries.map((e, i) => <div key={i} className={e.level === 0 ? "rp-toc-l0" : "rp-toc-l1"}>{e.text}</div>)}
        </div>
      );
    case "pagebreak": return <div className="rp-pagebreak" />;
    case "chapter": return <h1 className="rp-chapter">{b.text}</h1>;
    case "section": return <h2 className="rp-section">{b.text}</h2>;
    case "sq": return <h3 className="rp-sq">❑ {b.text}</h3>;
    case "o": return <p className="rp-o"><span className="rp-mark">❍</span>{b.text}</p>;
    case "dash": return <p className="rp-dash"><span className="rp-mark">–</span>{b.text}</p>;
    case "note": return <p className="rp-note"><span className="rp-mark">※</span>{b.text}</p>;
    case "chart":
      return (
        <figure className="rp-fig avoid-break">
          <div className="rp-svg" style={{ maxWidth: b.w }} dangerouslySetInnerHTML={{ __html: b.svg }} />
          <figcaption>{b.caption}</figcaption>
        </figure>
      );
    case "charts":
      return (
        <div className="rp-figrow avoid-break">
          {b.items.map((it, i) => (
            <figure key={i} className="rp-fig">
              <div className="rp-svg" style={{ maxWidth: it.w }} dangerouslySetInnerHTML={{ __html: it.svg }} />
              <figcaption>{it.caption}</figcaption>
            </figure>
          ))}
        </div>
      );
    case "table":
      return (
        <div className="rp-table-wrap avoid-break">
          <div className="rp-caption">{b.caption}</div>
          <table className="rp-table">
            {b.widths && <colgroup>{b.widths.map((w, i) => <col key={i} style={{ width: w + "%" }} />)}</colgroup>}
            <thead>
              {b.head.map((row, ri) => <tr key={ri}>{row.map((c, ci) => <th key={ci} colSpan={c?.colSpan} rowSpan={c?.rowSpan}>{lines(cellText(c))}</th>)}</tr>)}
            </thead>
            <tbody>
              {b.rows.map((row, ri) => (
                <tr key={ri}>{row.map((c, ci) => <td key={ci} colSpan={c?.colSpan} rowSpan={c?.rowSpan} style={{ textAlign: cellAlign(b, c, ci) }}>{lines(cellText(c))}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case "quotes":
      return (
        <div className="rp-quotes">
          {b.title && <div className="rp-quotes-title">{b.title}</div>}
          {b.items.map((q, i) => <div key={i} className="rp-quote avoid-break"><div className="rp-quote-who">{q.who}</div><div>{lines(q.text)}</div></div>)}
        </div>
      );
    default: return null;
  }
}

export const ReportView = forwardRef(function ReportView({ blocks }, ref) {
  return (
    <div ref={ref} className="rp-doc">
      {blocks.map((b, i) => <Block key={i} b={b} />)}
    </div>
  );
});

// 보고서 스타일 (화면 · PDF 공용)
export const REPORT_CSS = `
.rp-doc{background:#fff;color:#111;width:100%;max-width:794px;margin:0 auto;padding:48px 56px;font-family:'Malgun Gothic','Apple SD Gothic Neo','Pretendard','Noto Sans KR',sans-serif;font-size:14.5px;line-height:1.75;box-sizing:border-box}
.rp-cover{min-height:1000px;display:flex;flex-direction:column;align-items:center;text-align:center;padding-top:180px}
.rp-cover-kicker{font-size:21px;color:#1f3d7a;margin-bottom:22px}
.rp-cover-title{font-size:30px;font-weight:700;color:#1f3d7a}
.rp-cover-sub{font-size:15px;color:#4b5563;margin-top:14px}
.rp-cover-date{margin-top:auto;font-size:18px;margin-bottom:46px}
.rp-cover-org{font-size:22px;font-weight:800;margin-bottom:60px}
.rp-toc{padding-top:30px}
.rp-toc-title{text-align:center;font-size:24px;font-weight:800;margin-bottom:36px}
.rp-toc-l0{font-size:17px;font-weight:800;margin:22px 0 6px;border-bottom:1px dotted #9ca3af;padding-bottom:2px}
.rp-toc-l1{font-size:14.5px;margin:4px 0 4px 18px;border-bottom:1px dotted #d1d5db}
.rp-pagebreak{page-break-before:always;break-before:page;height:0}
.rp-chapter{font-size:22px;font-weight:800;background:#d9f1fa;border-top:4px solid #8c8c8c;border-bottom:4px solid #8c8c8c;padding:8px 12px;margin:0 0 22px}
.rp-section{display:inline-block;min-width:52%;font-size:19px;font-weight:800;background:#e3efd6;border-top:3px solid #9aa58a;border-bottom:3px solid #9aa58a;padding:5px 12px;margin:22px 0 12px}
.rp-sq{font-size:16.5px;font-weight:500;margin:16px 0 6px}
.rp-o,.rp-dash,.rp-note{margin:4px 0;text-align:justify;display:flex}
.rp-o{padding-left:14px}.rp-dash{padding-left:30px}.rp-note{padding-left:36px;font-size:13.5px}
.rp-mark{flex:0 0 auto;margin-right:7px}
.rp-fig{margin:14px auto 18px;text-align:center}
.rp-svg{margin:0 auto}.rp-svg svg{width:100%;height:auto;display:block}
.rp-fig figcaption{font-weight:700;font-size:13.5px;margin-top:4px}
.rp-figrow{display:flex;gap:10px;justify-content:center;flex-wrap:wrap}
.rp-figrow .rp-fig{flex:1 1 300px;margin:10px 0}
.rp-table-wrap{margin:14px 0 18px}
.rp-caption{text-align:center;font-weight:700;font-size:13.5px;margin-bottom:5px}
.rp-table{width:100%;border-collapse:collapse;font-size:12.5px;line-height:1.45}
.rp-table th,.rp-table td{border:1px solid #444;padding:4px 7px;vertical-align:middle}
.rp-table th{background:#efefef;font-weight:700;text-align:center}
.rp-quotes{margin:8px 0 14px 30px}
.rp-quotes-title{font-weight:700;font-size:13.5px;margin-bottom:4px}
.rp-quote{border-left:3px solid #9fb6c6;background:#f6f8fa;padding:6px 10px;margin:6px 0;font-size:13px}
.rp-quote-who{font-size:11.5px;color:#4b5563;font-weight:700}
@media (max-width:700px){.rp-doc{padding:20px 16px}.rp-cover{min-height:600px;padding-top:80px}}
`;

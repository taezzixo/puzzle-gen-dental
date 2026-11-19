import { useEffect, useMemo, useState } from "react";
import { SURVEY_CONFIG as CFG, API_URL } from "../survey/config.js";
import { listAll, checkPin } from "../survey/storage.js";
import { progressPct } from "../survey/steps.js";
import { normalizeRecord } from "../survey/questions.js";
import { buildReport } from "./reportModel.js";
import { ReportView, REPORT_CSS } from "./ReportView.jsx";
import { responseSections, toCsv, fmtDT } from "./responseRows.js";

const PIN_KEY = "pgd-admin-pin";
const stamp = () => { const d = new Date(); const p = (n) => String(n).padStart(2, "0"); return `${String(d.getFullYear()).slice(2)}${p(d.getMonth() + 1)}${p(d.getDate())}`; };
const saveText = (text, filename, type) => import("./exportDocx.js").then(({ downloadBlob }) => downloadBlob(new Blob([text], { type }), filename));

function Btn({ children, onClick, kind = "outline", disabled, className = "" }) {
  const k = {
    primary: "bg-neutral-900 hover:bg-black text-white border-neutral-900",
    word: "bg-neutral-900 hover:bg-black text-white border-neutral-900",
    pdf: "bg-neutral-900 hover:bg-black text-white border-neutral-900",
    outline: "bg-white hover:border-neutral-900 text-neutral-900 border-neutral-300",
  }[kind];
  return <button type="button" onClick={onClick} disabled={disabled} className={`sv-btn border rounded-lg px-3.5 py-2 text-[13px] font-semibold disabled:opacity-30 ${k} ${className}`}>{children}</button>;
}

function PinGate({ onOk }) {
  const [pin, setPin] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const go = async () => {
    setBusy(true); setErr("");
    const r = await checkPin(pin);
    setBusy(false);
    if (r.ok) { try { sessionStorage.setItem(PIN_KEY, pin); } catch { /* */ } onOk(pin); } else setErr(r.error || "비밀번호가 올바르지 않습니다.");
  };
  return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-4" style={{ fontFamily: "'Pretendard','Malgun Gothic',system-ui,sans-serif" }}>
      <div className="bg-white rounded-2xl border border-neutral-200 p-7 w-full max-w-sm">
        <div className="text-xs text-neutral-500">{CFG.productName} 사용성 평가</div>
        <h1 className="text-2xl font-bold mb-5">관리자 모드</h1>
        <label className="block text-sm font-bold text-neutral-700 mb-1.5" htmlFor="pin">관리자 비밀번호</label>
        <input id="pin" type="password" value={pin} onChange={(e) => setPin(e.target.value)} onKeyDown={(e) => e.key === "Enter" && go()} autoFocus
          className="sv-input w-full text-[15px] border border-neutral-300 rounded-lg px-3 py-2.5 mb-3" />
        {err && <p className="text-sm text-neutral-900 font-semibold mb-2">{err}</p>}
        <Btn kind="primary" onClick={go} disabled={busy || !pin} className="w-full py-3 text-base">{busy ? "확인 중…" : "들어가기"}</Btn>
        <a href="#/survey" className="block text-center text-sm text-neutral-500 underline mt-4">평가자 화면으로</a>
      </div>
    </div>
  );
}

function ResponseModal({ rec, onClose, onWord }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center p-3 sm:p-8 overflow-auto" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-3xl shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-white rounded-t-2xl border-b px-5 py-3 flex items-center gap-2">
          <div className="flex-1">
            <div className="text-xs text-neutral-500">원본 응답</div>
            <div className="text-lg font-bold">평가자 {rec.evaluatorId}번 · {rec.answers?.consent?.name || "(성명 미기재)"}</div>
          </div>
          <Btn kind="word" onClick={onWord}>Word 응답지</Btn>
          <Btn onClick={onClose}>닫기</Btn>
        </div>
        <div className="p-5 space-y-5">
          {responseSections(rec).map((s) => (
            <section key={s.title}>
              <h3 className="font-bold text-neutral-800 bg-neutral-100 px-2 py-1 rounded mb-1.5">{s.title}</h3>
              <table className="w-full text-sm border-collapse">
                <tbody>
                  {s.rows.map(([q, a], i) => (
                    <tr key={i} className="border-b border-neutral-100 align-top">
                      <td className="py-1.5 pr-3 text-neutral-600 w-[46%]">{q}</td>
                      <td className={`py-1.5 whitespace-pre-wrap ${a ? "font-semibold text-neutral-900" : "text-neutral-300"}`}>{a || "미응답"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function AdminApp() {
  const [pin, setPin] = useState(() => { try { return sessionStorage.getItem(PIN_KEY) || ""; } catch { return ""; } });
  const [authed, setAuthed] = useState(false);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [includeDrafts, setIncludeDrafts] = useState(false);
  const [view, setView] = useState(null);
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");

  const load = async (p = pin) => {
    setLoading(true); setErr("");
    try { setData(await listAll(p)); setAuthed(true); }
    catch (e) { if (e.code) { setAuthed(false); try { sessionStorage.removeItem(PIN_KEY); } catch { /* */ } } else setErr(e.message); }
    setLoading(false);
  };
  useEffect(() => { if (pin) load(pin); /* eslint-disable-next-line */ }, []);

  const records = useMemo(() => (data?.records || []).filter((r) => r && r.evaluatorId).map(normalizeRecord), [data]);
  const reportRecs = useMemo(() => records.filter((r) => includeDrafts || r.status === "submitted"), [records, includeDrafts]);
  const report = useMemo(() => buildReport(reportRecs, { includeDrafts }), [reportRecs, includeDrafts]);
  const reportName = `[사용성평가 보고서] PuzzleGEN_${stamp()}`;

  if (!authed) {
    if (pin && loading) return <div className="min-h-screen flex items-center justify-center text-neutral-500">불러오는 중…</div>;
    return <PinGate onOk={(p) => { setPin(p); load(p); }} />;
  }

  const run = async (label, fn) => {
    setBusy(label); setErr("");
    try { await fn(); } catch (e) { console.error(e); setErr(`${label} 실패: ${e.message}`); }
    setBusy("");
  };
  const wordReport = () => run("Word 보고서", async () => { const { exportReportDocx } = await import("./exportDocx.js"); await exportReportDocx(report.blocks, `${reportName}.docx`); });
  const pdfReport = () => run("PDF 보고서", async () => { const { exportReportPdf } = await import("./exportPdf.js"); await exportReportPdf(report.blocks, `${reportName}.pdf`, (i, n) => setBusy(`PDF 보고서 (${i}/${n}쪽)`)); });
  const wordResp = (rec) => run("응답지", async () => { const { exportResponseDocx } = await import("./exportDocx.js"); await exportResponseDocx(rec, `[응답지] 평가자${rec.evaluatorId}_${rec.answers?.consent?.name || "미기재"}_${stamp()}.docx`); });
  const jsonResp = (rec) => saveText(JSON.stringify(rec, null, 2), `[원본] 평가자${rec.evaluatorId}_${stamp()}.json`, "application/json");
  const allCsv = () => saveText(toCsv(records), `[원자료] PuzzleGEN_사용성평가_전체_${stamp()}.csv`, "text/csv;charset=utf-8");
  const allJson = () => saveText(JSON.stringify(records, null, 2), `[원본] PuzzleGEN_사용성평가_전체_${stamp()}.json`, "application/json");

  const ids = Array.from({ length: CFG.evaluatorCount }, (_, i) => i + 1);
  const extra = records.filter((r) => r.evaluatorId > CFG.evaluatorCount).map((r) => r.evaluatorId);
  const submitted = records.filter((r) => r.status === "submitted").length;

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900" style={{ fontFamily: "'Pretendard','Malgun Gothic',system-ui,sans-serif" }}>
      <style>{REPORT_CSS}</style>
      <header className="bg-neutral-900 text-white">
        <div className="max-w-6xl mx-auto px-4 py-3 flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-[200px]">
            <div className="text-[11px] text-neutral-400">{CFG.solutionName}</div>
            <div className="font-bold">{CFG.productName} 사용성 평가 · 관리자</div>
          </div>
          <Btn onClick={() => load()} disabled={loading}>{loading ? "불러오는 중…" : "새로고침"}</Btn>
          <Btn onClick={() => { try { sessionStorage.removeItem(PIN_KEY); } catch { /* */ } setAuthed(false); setPin(""); }}>로그아웃</Btn>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-5 space-y-5">
        {data?.source === "local" && (
          <div className="rounded-lg border border-neutral-900 bg-white text-neutral-900 text-sm px-4 py-3">
            저장 서버({API_URL})에 연결하지 못했습니다. 지금은 <b>이 브라우저에 남아 있는 응답만</b> 표시됩니다. 배포 설정(SURVEY_README.md)을 확인해 주세요.
          </div>
        )}
        {err && <div className="rounded-lg bg-neutral-900 text-white text-sm px-4 py-3">{err}</div>}

        {/* 평가자 현황 */}
        <section className="bg-white rounded-xl border border-neutral-200 p-5">
          <div className="flex flex-wrap items-end gap-3 mb-4">
            <div className="flex-1">
              <h2 className="text-lg font-bold">평가자 응답 현황</h2>
              <p className="text-sm text-neutral-500">제출 완료 {submitted}명 · 작성 중 {records.length - submitted}명 · 미시작 {Math.max(0, CFG.evaluatorCount - records.filter((r) => r.evaluatorId <= CFG.evaluatorCount).length)}명</p>
            </div>
            <Btn onClick={allCsv} disabled={!records.length}>전체 원자료 (엑셀 CSV)</Btn>
            <Btn onClick={allJson} disabled={!records.length}>전체 원본 (JSON)</Btn>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[...ids, ...extra].map((id) => {
              const r = records.find((x) => x.evaluatorId === id);
              const pct = r ? r.progress ?? progressPct(r.answers) : 0;
              return (
                <div key={id} className="rounded-xl border border-neutral-200 p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="w-10 h-10 rounded-lg bg-neutral-900 text-white font-semibold flex items-center justify-center">{id}</span>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold truncate">{r?.answers?.consent?.name || `평가자 ${id}번`}</div>
                      <div className="text-xs text-neutral-500 truncate">{r?.answers?.consent?.org || ""}</div>
                    </div>
                    <span className={`text-xs font-bold px-2 py-1 rounded-full ${!r ? "bg-neutral-50 text-neutral-500" : r.status === "submitted" ? "bg-neutral-900 text-white" : "border border-neutral-900 text-neutral-900"}`}>
                      {!r ? "미시작" : r.status === "submitted" ? "제출 완료" : "작성 중"}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-neutral-50 overflow-hidden mb-1.5"><div className="h-full bg-neutral-900" style={{ width: `${pct}%` }} /></div>
                  <div className="text-xs text-neutral-500 mb-3">진행률 {pct}%{r ? ` · 마지막 저장 ${fmtDT(r.savedAt || r.updatedAt)}` : ""}</div>
                  <div className="flex flex-wrap gap-1.5">
                    <Btn onClick={() => setView(r)} disabled={!r}>응답 보기</Btn>
                    <Btn kind="word" onClick={() => wordResp(r)} disabled={!r || !!busy}>응답지 Word</Btn>
                    <Btn onClick={() => jsonResp(r)} disabled={!r}>JSON</Btn>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* 보고서 */}
        <section className="bg-white rounded-xl border border-neutral-200">
          <div className="sticky top-0 z-20 bg-white rounded-t-2xl border-b px-5 py-3 flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-[220px]">
              <h2 className="text-lg font-bold">[사용성평가 보고서] 미리보기</h2>
              <label className="text-sm text-neutral-600 flex items-center gap-2 mt-0.5 cursor-pointer">
                <input type="checkbox" checked={includeDrafts} onChange={(e) => setIncludeDrafts(e.target.checked)} className="w-4 h-4" />
                작성 중 응답도 포함 (현재 {reportRecs.length}명 반영)
              </label>
            </div>
            <Btn kind="word" onClick={wordReport} disabled={!!busy} className="px-5 py-2.5 text-base">Word 보고서 ↓</Btn>
            <Btn kind="pdf" onClick={pdfReport} disabled={!!busy} className="px-5 py-2.5 text-base">PDF 보고서 ↓</Btn>
          </div>
          {busy && <div className="px-5 py-2 bg-neutral-100 text-neutral-900 text-sm font-bold">{busy} 만드는 중… 잠시만 기다려 주세요.</div>}
          <div className="bg-neutral-100 p-2 sm:p-6 overflow-x-auto">
            <div className="shadow-lg mx-auto" style={{ maxWidth: 794 }}>
              <ReportView blocks={report.blocks} />
            </div>
          </div>
          <p className="text-xs text-neutral-500 px-5 py-3">※ 「3장. 시사점」은 응답 통계를 바탕으로 자동 작성된 초안입니다. Word 파일로 내려받아 필요 시 문구를 다듬어 주세요.</p>
        </section>
      </main>

      {view && <ResponseModal rec={view} onClose={() => setView(null)} onWord={() => wordResp(view)} />}
    </div>
  );
}

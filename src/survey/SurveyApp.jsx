import { useEffect, useRef, useState } from "react";
import { SURVEY_CONFIG as CFG } from "./config.js";
import {
  CONSENT_ITEMS, CONSENT_INFO, BASIC, CATEGORIES, SUBITEMS, MAIN_PAIRS, SUB_PAIRS, ABS_ITEMS, SCALE5, QUANT,
  SATISFACTION, SAT_SCALE, AGENT_Q, FEATURES, INTENT_SCALE, FACTORS, emptyAnswers,
} from "./questions.js";
import { STEPS, progressPct, totalMissing } from "./steps.js";
import { loadRecord, saveRecord, listSummary } from "./storage.js";
import { Choice, ChoiceGrid, Scale5, PairCompare, NumField, TextField, TextArea, Note, More, QCard, cx } from "./ui.jsx";

const fmtTime = (iso) => (iso ? new Date(iso).toLocaleString("ko-KR", { month: "long", day: "numeric", hour: "numeric", minute: "2-digit" }) : "");
const FONT_SIZES = [18, 21, 24];

export function SurveyShell({ children, fontIdx, setFontIdx, right }) {
  useEffect(() => {
    document.documentElement.style.fontSize = FONT_SIZES[fontIdx] + "px";
    try { localStorage.setItem("pgd-font", String(fontIdx)); } catch { /* */ }
    return () => { document.documentElement.style.fontSize = ""; };
  }, [fontIdx]);
  return (
    <div className="sv-root min-h-screen bg-[#f4f2ec] text-slate-900" style={{ fontFamily: "'Pretendard', 'Malgun Gothic', system-ui, sans-serif" }}>
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-3xl mx-auto px-4 py-2.5 flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <div className="text-[0.75rem] text-slate-500 leading-tight">{CFG.solutionName}</div>
            <div className="text-lg font-extrabold leading-tight truncate">{CFG.productName} 사용성 평가</div>
          </div>
          {right}
          <div className="flex items-center gap-1" role="group" aria-label="글자 크기">
            <span className="text-[0.75rem] text-slate-500 hidden sm:inline mr-1">글자 크기</span>
            {FONT_SIZES.map((s, i) => (
              <button key={s} type="button" onClick={() => setFontIdx(i)} aria-pressed={fontIdx === i}
                className={cx("sv-btn rounded-lg border-2 font-black w-10 h-10 flex items-center justify-center",
                  fontIdx === i ? "bg-slate-900 border-slate-900 text-white" : "bg-white border-slate-400 text-slate-700")}
                style={{ fontSize: 13 + i * 4 }}>가</button>
            ))}
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}

const loadFontIdx = () => { try { const v = Number(localStorage.getItem("pgd-font")); return v >= 0 && v <= 2 ? v : 0; } catch { return 0; } };

// ── 평가자 선택 화면 ─────────────────────────────
function PickEvaluator({ onPick }) {
  const [summary, setSummary] = useState(undefined);
  useEffect(() => { listSummary().then(setSummary); }, []);
  const ids = Array.from({ length: CFG.evaluatorCount }, (_, i) => i + 1);
  const info = (id) => summary?.find((s) => s.evaluatorId === id);
  return (
    <main className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-extrabold mb-2">안녕하세요.</h1>
      <p className="text-xl text-slate-800 mb-1">아래에서 <b className="text-blue-800">본인의 평가자 번호</b>를 눌러 주세요.</p>
      <Note className="mb-6">평가자 번호는 안내받으신 번호입니다. 중간에 저장하시면 다음에 같은 번호를 눌러 이어서 작성하실 수 있습니다.</Note>
      <div className="grid gap-4">
        {ids.map((id) => {
          const s = info(id);
          return (
            <button key={id} type="button" onClick={() => onPick(id)}
              className="sv-btn w-full rounded-3xl border-[3px] border-blue-700 bg-white hover:bg-blue-50 shadow-sm px-5 py-5 flex items-center gap-4 text-left">
              <span className="w-16 h-16 rounded-2xl bg-blue-700 text-white text-3xl font-black flex items-center justify-center shrink-0">{id}</span>
              <span className="flex-1">
                <span className="block text-2xl font-extrabold text-blue-950">평가자 {id}번{s?.name ? ` · ${s.name} 님` : ""}</span>
                <span className="block text-[0.85rem] text-slate-500 mt-0.5">
                  {!s ? "아직 시작하지 않음" : s.status === "submitted" ? `제출 완료 · ${fmtTime(s.updatedAt)}` : `작성 중${s.progress != null ? ` (${s.progress}%)` : ""} · 마지막 저장 ${fmtTime(s.updatedAt)}`}
                </span>
              </span>
              <span aria-hidden className="text-3xl text-blue-700 font-black">›</span>
            </button>
          );
        })}
      </div>
      {summary === null && <Note className="mt-6 !bg-amber-50 !text-amber-800">저장 서버에 연결하지 못했습니다. 작성은 가능하지만 이 기기에만 저장될 수 있으니 관리자에게 알려 주세요.</Note>}
    </main>
  );
}

// ── 메인 ─────────────────────────────────────────
export default function SurveyApp({ initialId }) {
  const [fontIdx, setFontIdx] = useState(loadFontIdx);
  const [evaluatorId, setEvaluatorId] = useState(initialId || null);
  const [record, setRecord] = useState(null);
  const [loading, setLoading] = useState(false);
  const [confirmWho, setConfirmWho] = useState(null); // 기존 응답이 있을 때 본인 확인
  const [step, setStep] = useState(0);
  const [saveState, setSaveState] = useState(null); // {kind:'ok'|'warn'|'saving', text}
  const [missingPrompt, setMissingPrompt] = useState(null);
  const [submitAsk, setSubmitAsk] = useState(false);
  const [done, setDone] = useState(false);
  const dirty = useRef(false);
  const topRef = useRef(null);

  const pick = async (id) => {
    setLoading(true);
    const { record: rec, source } = await loadRecord(id);
    setLoading(false);
    window.location.hash = `#/survey/${id}`;
    if (rec) {
      const merged = { ...rec, answers: { ...emptyAnswers(), ...rec.answers } };
      setConfirmWho({ id, rec: merged, source });
    } else {
      setEvaluatorId(id);
      setRecord({ evaluatorId: id, status: "draft", createdAt: new Date().toISOString(), step: 0, answers: emptyAnswers() });
      setStep(0);
    }
  };

  useEffect(() => { if (initialId) pick(initialId); /* eslint-disable-next-line */ }, []);

  const A = record?.answers;
  const update = (fn) => {
    dirty.current = true;
    setRecord((r) => { const answers = structuredClone(r.answers); fn(answers); return { ...r, answers }; });
  };

  const doSave = async (opts = {}) => {
    if (!record) return;
    const rec = { ...record, step, progress: progressPct(record.answers), ...(opts.patch || {}) };
    if (!opts.silent) setSaveState({ kind: "saving", text: "저장하는 중입니다…" });
    const r = await saveRecord(rec);
    dirty.current = false;
    setRecord(r.record);
    if (r.where === "server") { if (!opts.silent) setSaveState({ kind: "ok", text: `저장되었습니다 · ${fmtTime(r.savedAt)}` }); else setSaveState(null); }
    else setSaveState({ kind: "warn", text: "서버에 저장하지 못해 이 기기에만 임시 저장했습니다. 잠시 후 [저장하기]를 다시 눌러 주세요." });
    return r;
  };

  // 창을 닫을 때 저장하지 않은 내용 경고
  useEffect(() => {
    const h = (e) => { if (dirty.current) { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, []);

  const goto = (i) => {
    setStep(i); setMissingPrompt(null);
    topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const next = async (force) => {
    const miss = STEPS[step].missing(A);
    if (miss > 0 && !force) { setMissingPrompt(miss); return; }
    if (dirty.current) doSave({ silent: true });
    goto(Math.min(step + 1, STEPS.length - 1));
  };
  const prev = () => { if (dirty.current) doSave({ silent: true }); goto(Math.max(step - 1, 0)); };

  const submit = async () => {
    setSubmitAsk(false);
    const r = await doSave({ patch: { status: "submitted", submittedAt: new Date().toISOString() } });
    if (r?.where === "server") setDone(true);
  };

  const shell = (content) => <SurveyShell fontIdx={fontIdx} setFontIdx={setFontIdx}>{content}</SurveyShell>;

  if (loading) return shell(<main className="max-w-3xl mx-auto px-4 py-16 text-center text-2xl font-bold">불러오는 중입니다…</main>);

  if (confirmWho) {
    const { id, rec } = confirmWho;
    const name = rec.answers.consent?.name;
    return shell(
      <main className="max-w-3xl mx-auto px-4 py-10">
        <h1 className="text-3xl font-extrabold mb-4">평가자 {id}번{name ? ` · ${name} 님` : ""}이 맞으십니까?</h1>
        <Note className="mb-6">{rec.status === "submitted" ? `이미 제출하신 응답이 있습니다 (${fmtTime(rec.submittedAt || rec.updatedAt)}). 내용을 확인하거나 고치실 수 있습니다.` : `작성 중인 응답이 있습니다 · 마지막 저장 ${fmtTime(rec.updatedAt)} · 진행률 ${progressPct(rec.answers)}%`}</Note>
        <div className="grid gap-4 sm:grid-cols-2">
          <button type="button" onClick={() => { setEvaluatorId(id); setRecord(rec); setStep(rec.status === "submitted" ? STEPS.length - 1 : Math.min(rec.step || 0, STEPS.length - 1)); setConfirmWho(null); }}
            className="sv-btn rounded-2xl bg-blue-700 hover:bg-blue-800 text-white text-2xl font-extrabold py-5 shadow-lg">네, 맞습니다 · 이어서 하기</button>
          <button type="button" onClick={() => { setConfirmWho(null); setEvaluatorId(null); window.location.hash = "#/survey"; }}
            className="sv-btn rounded-2xl border-[3px] border-slate-500 bg-white text-slate-800 text-2xl font-extrabold py-5">아니요 · 번호 다시 고르기</button>
        </div>
      </main>
    );
  }

  if (!evaluatorId || !record) return shell(<PickEvaluator onPick={pick} />);

  if (done) return shell(
    <main className="max-w-3xl mx-auto px-4 py-16 text-center">
      <div className="text-7xl mb-4" aria-hidden>✓</div>
      <h1 className="text-3xl font-extrabold mb-3">제출이 완료되었습니다.</h1>
      <p className="text-xl text-slate-700 mb-8">소중한 의견에 감사드립니다.</p>
      <button type="button" onClick={() => { setDone(false); goto(STEPS.length - 1); }}
        className="sv-btn rounded-2xl border-[3px] border-blue-700 bg-white text-blue-900 text-xl font-bold px-6 py-4">제출한 내용 다시 보기</button>
    </main>
  );

  const S = STEPS[step];
  const pctDone = progressPct(A);

  return (
    <SurveyShell fontIdx={fontIdx} setFontIdx={setFontIdx}
      right={<span className="hidden sm:inline text-[0.8rem] text-slate-500 whitespace-nowrap">평가자 {evaluatorId}번</span>}>
      <div ref={topRef} />
      {/* 진행 표시 */}
      <div className="max-w-3xl mx-auto px-4 pt-5">
        <div className="flex items-end justify-between mb-1.5">
          <span className="text-base font-bold text-slate-800">{step + 1} / {STEPS.length} 단계</span>
          <span className="text-[0.8rem] text-slate-500">전체 응답 {pctDone}%</span>
        </div>
        <div className="h-3 rounded-full bg-slate-300/70 overflow-hidden" role="progressbar" aria-valuenow={step + 1} aria-valuemin={1} aria-valuemax={STEPS.length}>
          <div className="h-full bg-blue-700 rounded-full transition-all" style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
        </div>
        <h2 className="text-[1.7rem] sm:text-3xl font-extrabold mt-5 mb-4 leading-tight">{S.title}</h2>
      </div>

      <main className="max-w-3xl mx-auto px-4 pb-48 space-y-5">
        <StepBody id={S.id} cat={S.cat} A={A} update={update} goto={goto} record={record} />
        {missingPrompt != null && (
          <div className="rounded-2xl bg-rose-50 border-2 border-rose-300 p-4" role="alert">
            <p className="text-xl font-bold text-rose-900 mb-3">아직 답하지 않은 문항이 {missingPrompt}개 있습니다.</p>
            <div className="flex flex-col sm:flex-row gap-3">
              <button type="button" onClick={() => setMissingPrompt(null)} className="sv-btn flex-1 rounded-2xl bg-rose-700 text-white text-lg font-bold py-3.5">돌아가서 답하기</button>
              <button type="button" onClick={() => next(true)} className="sv-btn flex-1 rounded-2xl border-[3px] border-slate-500 bg-white text-slate-800 text-lg font-bold py-3.5">나중에 하고 다음으로</button>
            </div>
          </div>
        )}
        {S.id === "review" && (
          <div className="pt-2">
            <button type="button" onClick={() => setSubmitAsk(true)}
              className="sv-btn w-full rounded-3xl bg-emerald-700 hover:bg-emerald-800 text-white text-2xl font-extrabold py-6 shadow-lg">
              {record.status === "submitted" ? "수정한 내용으로 다시 제출하기" : "설문 제출하기"}
            </button>
            {totalMissing(A) > 0 && <p className="text-center text-[0.85rem] text-slate-500 mt-2">답하지 않은 문항이 있어도 제출할 수 있습니다.</p>}
          </div>
        )}
      </main>

      {/* 하단 고정 버튼 */}
      <nav className="fixed bottom-0 inset-x-0 z-30 bg-white/95 backdrop-blur border-t-2 border-slate-200 shadow-[0_-4px_16px_rgba(0,0,0,.06)]">
        {saveState && (
          <div className={cx("text-center text-base font-bold py-2 px-3", saveState.kind === "ok" ? "bg-emerald-100 text-emerald-900" : saveState.kind === "warn" ? "bg-amber-100 text-amber-900" : "bg-slate-100 text-slate-700")} role="status">
            {saveState.kind === "ok" ? "✓ " : saveState.kind === "warn" ? "⚠ " : ""}{saveState.text}
          </div>
        )}
        <div className="max-w-3xl mx-auto px-3 py-3 grid grid-cols-3 gap-2.5">
          <button type="button" onClick={prev} disabled={step === 0}
            className="sv-btn rounded-2xl border-[3px] border-slate-500 bg-white text-slate-800 text-lg sm:text-xl font-extrabold py-3.5 disabled:opacity-30">◀ 이전</button>
          <button type="button" onClick={() => doSave()}
            className="sv-btn rounded-2xl bg-emerald-700 hover:bg-emerald-800 text-white text-lg sm:text-xl font-extrabold py-3.5 shadow">저장하기</button>
          <button type="button" onClick={() => next(false)} disabled={step === STEPS.length - 1}
            className="sv-btn rounded-2xl bg-blue-700 hover:bg-blue-800 text-white text-lg sm:text-xl font-extrabold py-3.5 shadow disabled:opacity-30">다음 ▶</button>
        </div>
      </nav>

      {submitAsk && (
        <div className="fixed inset-0 z-40 bg-black/50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl">
            <h3 className="text-2xl font-extrabold mb-3">설문을 제출하시겠습니까?</h3>
            <p className="text-lg text-slate-700 mb-5">제출 후에도 같은 번호로 들어와 내용을 고치실 수 있습니다.</p>
            <div className="grid grid-cols-2 gap-3">
              <button type="button" onClick={() => setSubmitAsk(false)} className="sv-btn rounded-2xl border-[3px] border-slate-500 text-slate-800 text-xl font-bold py-4">취소</button>
              <button type="button" onClick={submit} className="sv-btn rounded-2xl bg-emerald-700 text-white text-xl font-extrabold py-4">제출합니다</button>
            </div>
          </div>
        </div>
      )}
    </SurveyShell>
  );
}

// ── 단계별 화면 ─────────────────────────────────
function StepBody({ id, cat, A, update, goto, record }) {
  if (id === "intro") return <Intro />;
  if (id === "consent") return <Consent A={A} update={update} />;
  if (id === "basic") return <Basic A={A} update={update} />;
  if (id === "ahpMain") return <AhpMain A={A} update={update} />;
  if (id === "mainReason") return <MainReason A={A} update={update} />;
  if (id === "ahpSub") return <AhpSub A={A} update={update} />;
  if (id.startsWith("abs")) return <AbsCategory cat={cat} A={A} update={update} />;
  if (id === "quant") return <Quant A={A} update={update} />;
  if (id === "satisfaction") return <Satisfaction A={A} update={update} />;
  if (id === "agent") return <Agent A={A} update={update} />;
  if (id === "features") return <Features A={A} update={update} />;
  if (id === "overall") return <Overall A={A} update={update} />;
  if (id === "review") return <Review A={A} goto={goto} record={record} />;
  return null;
}

function Intro() {
  return (
    <>
      <QCard title="안녕하십니까.">
        <div className="text-lg leading-relaxed text-slate-800 space-y-3">
          <p>체험하신 <b>{CFG.productName} {CFG.productVersion}</b>(음성 입력 · 수정 명령, 파노라마 X선 판독, 진료기록 요약, 치아별 과거 이력 조회)에 대한 의견을 여쭙는 설문입니다.</p>
          <p>화면의 <b className="text-blue-800">파란 테두리 버튼</b>을 눌러 답해 주시면 됩니다.</p>
        </div>
      </QCard>
      <QCard title="이렇게 진행됩니다">
        <ol className="space-y-3 text-lg text-slate-800">
          <li className="flex gap-3"><span className="font-black text-blue-800 w-7">1</span><span>한 화면씩 답하고 아래의 <b>[다음 ▶]</b>을 누릅니다.</span></li>
          <li className="flex gap-3"><span className="font-black text-blue-800 w-7">2</span><span>언제든 <b className="text-emerald-800">[저장하기]</b>를 누르면 저장되고, 나중에 이어서 하실 수 있습니다.</span></li>
          <li className="flex gap-3"><span className="font-black text-blue-800 w-7">3</span><span>마지막 화면에서 <b>[설문 제출하기]</b>를 누르면 끝납니다.</span></li>
        </ol>
      </QCard>
      <More label="조사 개요 자세히 보기">
        <p className="mb-2">본 조사는 ㈜퍼즐에이아이에서 개발한 AI 의무기록 자동생성 솔루션 「{CFG.productName} {CFG.productVersion}」의 개념검증(POC) 결과를 객관적으로 평가하기 위해 실시됩니다. POC에서는 시험용 가상(샘플) 진료 데이터와 시험 접속 링크를 통해 실제 EMR을 사용하는 상황을 가정하여 기능을 체험하셨습니다.</p>
        <p className="mb-2">체험하신 기능의 정확성, 처리 속도, 업무부담 변화, 진료흐름 적합성 등을 종합적으로 검토하여, 실제 EMR에 적용되었을 경우의 기대 효과를 사용자 관점에서 분석하는 데 목적이 있습니다. 또한 2차년도 개발 예정 기능(AGENT : 음성 명령 기반 EMR 서식 자동 입력)에 대한 기대 수준을 간단히 여쭙습니다.</p>
        <p>• 대상자 : {CFG.productName} {CFG.productVersion} POC 체험에 참여한 치과 의료진 · 방법 : {CFG.pocUrl}에 배포된 MVP 제품 사용 후 평가지표에 따라 설문 수행 · 문의 : 주식회사 퍼즐에이아이</p>
      </More>
    </>
  );
}

function Consent({ A, update }) {
  const c = A.consent;
  return (
    <>
      <Note>
        <div className="font-bold text-slate-600 mb-1">개인정보 수집 · 이용 안내</div>
        <dl className="space-y-1.5">
          {CONSENT_INFO.map(([k, v]) => <div key={k}><dt className="inline font-semibold text-slate-600">{k} : </dt><dd className="inline">{v}</dd></div>)}
        </dl>
      </Note>
      {CONSENT_ITEMS.map((it, i) => (
        <QCard key={it.id} no={`${i + 1}.`} title={it.text} hint={it.required ? "필수 항목입니다. 동의하지 않으시면 조사 참여가 제한됩니다." : "선택 항목입니다. 동의하지 않아도 불이익이 없습니다."}>
          <ChoiceGrid options={["동의함", "동의하지 않음"]} value={c[it.id] === "agree" ? "동의함" : c[it.id] === "disagree" ? "동의하지 않음" : ""}
            onChange={(v) => update((a) => { a.consent[it.id] = v === "동의함" ? "agree" : v ? "disagree" : ""; })} />
        </QCard>
      ))}
      <QCard title="작성자 정보" hint={`작성일 : ${new Date().toLocaleDateString("ko-KR")}`}>
        <div className="space-y-4">
          <TextField label="소속기관" value={c.org} onChange={(v) => update((a) => { a.consent.org = v; })} />
          <TextField label="진료과목" value={c.dept} onChange={(v) => update((a) => { a.consent.dept = v; })} />
          <TextField label="성명" value={c.name} onChange={(v) => update((a) => { a.consent.name = v; })} />
          <Choice multi selected={c.signed} onClick={() => update((a) => { a.consent.signed = !a.consent.signed; a.consent.signedAt = new Date().toISOString(); })}>
            위 내용을 충분히 이해하였으며, 위와 같이 동의합니다. (서명)
          </Choice>
        </div>
      </QCard>
    </>
  );
}

function Basic({ A, update }) {
  return (
    <>
      <Note>본 조사의 분석을 위한 기초자료로 활용됩니다. 해당하는 것을 눌러 주세요.</Note>
      {BASIC.map((q, i) => (
        <QCard key={q.id} no={`${i + 1}.`} title={q.label} hint={q.hint}>
          <ChoiceGrid options={q.options} multi={q.type === "multi"} value={A.basic[q.id]} cols={q.options.length > 5 ? 2 : q.options.length === 2 ? 2 : 1}
            onChange={(v) => update((a) => { a.basic[q.id] = v; })} />
          {q.etc && (q.type === "multi" ? (A.basic[q.id] || []).includes(q.etc) : A.basic[q.id] === q.etc) && (
            <div className="mt-3"><TextField label="기타 내용을 적어 주세요" value={A.basic[q.id + "Etc"]} onChange={(v) => update((a) => { a.basic[q.id + "Etc"] = v; })} /></div>
          )}
        </QCard>
      ))}
    </>
  );
}

const ScaleNote = () => (
  <More label="중요도 척도(1 · 3 · 5 · 7 · 9) 설명 보기">
    1 : 양쪽이 동등, 3 : 한쪽이 약간 중요, 5 : 한쪽이 중요, 7 : 한쪽이 매우 중요, 9 : 한쪽이 절대적 중요.
    화면에서 「똑같다」 = 1, 「약간 더 중요」 = 3, 「더 중요」 = 5, 「매우 더 중요」 = 7, 「절대적으로 중요」 = 9 로 기록됩니다.
  </More>
);

function AhpMain({ A, update }) {
  const cat = (id) => CATEGORIES.find((c) => c.id === id);
  return (
    <>
      <Note>
        사용성을 4개 분야로 나누어 평가합니다. 두 분야씩 비교하여 <b className="text-slate-600">어느 쪽이 더 중요한지</b> 골라 주세요.
        <div className="mt-2 grid sm:grid-cols-2 gap-x-4 gap-y-1">
          {CATEGORIES.map((c) => <div key={c.id}><b className="text-slate-600">{c.id}. {c.name}</b> — {c.def}</div>)}
        </div>
      </Note>
      <ScaleNote />
      {MAIN_PAIRS.map((p) => (
        <PairCompare key={p.id} no={p.no} left={{ name: cat(p.left).name }} right={{ name: cat(p.right).name }}
          value={A.ahpMain[p.id]} onChange={(v) => update((a) => { a.ahpMain[p.id] = v; })} />
      ))}
    </>
  );
}

function MainReason({ A, update }) {
  return (
    <>
      <QCard title="4개 분야 중 가장 중요하다고 보신 것 1개를 골라 주세요.">
        <ChoiceGrid options={CATEGORIES.map((c) => c.name)} value={CATEGORIES.find((c) => c.id === A.mainTop)?.name || ""}
          onChange={(v) => update((a) => { a.mainTop = CATEGORIES.find((c) => c.name === v)?.id || ""; })} />
      </QCard>
      <QCard title="그렇게 판단하신 이유를 간단히 적어 주세요." hint="가장 중요하게 본 항목과 그 이유, 상대적으로 덜 중요하게 본 항목과 그 이유">
        <TextArea value={A.mainReason} onChange={(v) => update((a) => { a.mainReason = v; })} rows={5} />
      </QCard>
    </>
  );
}

function AhpSub({ A, update }) {
  return (
    <>
      <Note>각 분야 안의 세부 항목 두 개를 비교해 주세요. 척도 기준은 앞 화면과 같습니다.</Note>
      {SUB_PAIRS.map((p) => {
        const [l, r] = SUBITEMS[p.id];
        return (
          <div key={p.id}>
            <h3 className="text-lg font-extrabold text-slate-700 mb-2 mt-2">「{CATEGORIES.find((c) => c.id === p.id).name}」 분야</h3>
            <PairCompare no={p.no} left={l} right={r} value={A.ahpSub[p.id]} onChange={(v) => update((a) => { a.ahpSub[p.id] = v; })} />
          </div>
        );
      })}
    </>
  );
}

function AbsItem({ item, A, update }) {
  const ans = A.abs[item.id] || {};
  const m = ans.m || {};
  const calc = item.calc(m);
  const setM = (k, v) => update((a) => { a.abs[item.id] = { ...(a.abs[item.id] || {}), m: { ...((a.abs[item.id] || {}).m || {}), [k]: v } }; });
  return (
    <QCard no={item.no} title={item.question} hint={`${item.sub} ${item.name}`} >
      {/* 측정값으로 점수 계산 (선택) */}
      <div className="rounded-2xl bg-slate-50 border border-slate-200 p-3 sm:p-4 mb-4">
        <div className="text-[0.85rem] text-slate-500 mb-2.5">측정값을 적으시면 해당하는 점수를 표시해 드립니다 <span className="text-slate-400">(선택 사항)</span></div>
        <div className="flex flex-wrap gap-x-6 gap-y-3 items-end">
          {item.inputs.map((inp) => inp.type === "yesno" ? (
            <div key={inp.id} className="w-full">
              <span className="block text-base font-bold text-slate-800 mb-1">{inp.label}</span>
              <div className="grid grid-cols-2 gap-2 max-w-md">
                {[["no", "아니요 (변경 없음)"], ["yes", "예 (변경 필요)"]].map(([k, lab]) => (
                  <Choice key={k} selected={m[inp.id] === k} onClick={() => setM(inp.id, m[inp.id] === k ? "" : k)}>{lab}</Choice>
                ))}
              </div>
            </div>
          ) : (
            <NumField key={inp.id} label={inp.label} unit={inp.unit} value={m[inp.id]} onChange={(v) => setM(inp.id, v)} />
          ))}
        </div>
        {calc && <div className="mt-3 text-base text-slate-700">→ {calc.text} · <b className="text-amber-800">{calc.score}점 구간</b>에 해당합니다</div>}
      </div>
      <div className="text-lg font-bold text-slate-900 mb-3">점수를 골라 주세요</div>
      <Scale5 value={ans.score} labels={SCALE5} criteria={item.criteria} recommended={calc?.score}
        onChange={(v) => update((a) => { a.abs[item.id] = { ...(a.abs[item.id] || {}), score: v }; })} />
      <More label="평가 지표 · 측정 방법 자세히 보기">
        <p><b className="text-slate-600">정량 지표</b> : {item.metric}</p>
        {item.metricNote && <p className="mt-1">※ {item.metricNote}</p>}
        <p className="mt-1"><b className="text-slate-600">측정 방법</b> : {item.method}</p>
        <p className="mt-1"><b className="text-slate-600">구현 기능</b> : {item.features.join(" · ")}</p>
      </More>
    </QCard>
  );
}

function AbsCategory({ cat, A, update }) {
  const items = ABS_ITEMS.filter((i) => i.cat === cat);
  return (
    <>
      <Note>
        POC 체험 결과를 바탕으로 각 항목을 1~5점으로 평가해 주세요. 점수 버튼 아래 작은 글씨는 점수 기준입니다.
        <More label="공통 점수 산정 원칙 보기">
          <p>• 측정 표본 : POC 시험 데이터(가상 진료 시나리오 {CFG.scenarioCount}건, 초진 · 재진 · 경과기록 포함) 체험 결과 기준. 건수 기반 지표는 비율(%)로 환산합니다.</p>
          <p>• 비교 기준 : Before = 평소 EMR 수기 입력 시(경험 기준), After = PuzzleGen Dental 체험 시. 감소율 · 단축율 = (Before − After) ÷ Before × 100</p>
          <p>• 측정값이 구간 경계에 정확히 일치하면 상위 점수를 적용합니다.</p>
          <p>• 체험 중 해당 기능을 확인할 수 없어 측정할 수 없는 경우 1점으로 처리하고, 비고란에 사유를 적습니다.</p>
          <p>• 용어 표준 : ISO 1942 (KS P ISO 1942) 치과 용어, ISO 3950 (KS P ISO 3950) 치아 및 구강영역의 호칭 시스템</p>
        </More>
      </Note>
      {items.map((it) => <AbsItem key={it.id} item={it} A={A} update={update} />)}
      <QCard title="측정값 · 비고 (선택)" hint="측정이 어려웠던 사유나 덧붙일 의견이 있으면 적어 주세요.">
        <TextArea value={A.absNote[cat]} onChange={(v) => update((a) => { a.absNote[cat] = v; })} rows={3} />
      </QCard>
    </>
  );
}

function Quant({ A, update }) {
  return (
    <>
      <Note>PuzzleGen Dental을 실제 EMR에 적용한다고 가정했을 때의 변화를 대략적인 숫자로 적어 주세요. 정확하지 않아도 체감 기준이면 됩니다. Before = 평소 EMR만 사용, After = PuzzleGen Dental과 함께 사용(예상).</Note>
      {QUANT.map((q, i) => {
        const v = A.quant[q.id] || {};
        const b = Number(v.before), a = Number(v.after);
        const has = v.before !== undefined && v.before !== "" && v.after !== undefined && v.after !== "";
        const dir = has ? (a > b ? "증가" : a < b ? "감소" : "유지") : null;
        const set = (k, val) => update((x) => { x.quant[q.id] = { ...(x.quant[q.id] || {}), [k]: val }; });
        return (
          <QCard key={q.id} no={`Q${i + 1}.`} title={q.title} hint={q.lead}>
            <div className="flex flex-wrap items-end gap-4">
              <NumField label="지금 (Before)" unit={q.unit} value={v.before} onChange={(x) => set("before", x)} />
              <span className="text-3xl text-slate-400 pb-2" aria-hidden>→</span>
              <NumField label="적용 후 (After)" unit={q.unit} value={v.after} onChange={(x) => set("after", x)} />
            </div>
            {dir && <div className="mt-3 text-lg text-slate-700">→ <b className="text-blue-900">{v.before}{q.unit}에서 {v.after}{q.unit}으로 {dir}</b>할 것이다.</div>}
          </QCard>
        );
      })}
    </>
  );
}

function Satisfaction({ A, update }) {
  return (
    <>
      <Note>체험하신 기능별 현재(v1.0) 만족도를 골라 주세요.</Note>
      {SATISFACTION.map((s, i) => (
        <QCard key={s.id} no={`${"①②③④⑤"[i]}`} title={s.name}>
          <Scale5 value={A.satisfaction[s.id]} labels={SAT_SCALE} onChange={(v) => update((a) => { a.satisfaction[s.id] = v; })} />
        </QCard>
      ))}
    </>
  );
}

function Agent({ A, update }) {
  return (
    <>
      <Note>2차년도에 개발 예정인 AGENT(음성 명령으로 EMR 서식 자동 입력)는 이번 POC에서 제공되지 않았습니다. 이 기능이 함께 제공된다고 가정하고 답해 주세요.</Note>
      {AGENT_Q.map((q) => (
        <QCard key={q.id} title={q.name}>
          <Scale5 value={A.agent[q.id]} labels={q.scale} onChange={(v) => update((a) => { a.agent[q.id] = v; })} />
        </QCard>
      ))}
    </>
  );
}

function Features({ A, update }) {
  const f = A.features;
  return (
    <>
      <QCard no="①" title="추가되면 좋을 기능을 모두 골라 주세요." hint="여러 개 선택할 수 있습니다">
        <ChoiceGrid multi options={FEATURES} value={f.selected} cols={1}
          onChange={(v) => update((a) => { a.features.selected = v; if (!v.includes(a.features.top)) a.features.top = ""; })} />
        {f.selected.includes("기타") && <div className="mt-3"><TextField label="기타 기능을 적어 주세요" value={f.etc} onChange={(v) => update((a) => { a.features.etc = v; })} /></div>}
      </QCard>
      <QCard no="②" title="그중 가장 필요한 기능 1개를 골라 주세요." hint={f.selected.length ? "" : "먼저 위에서 기능을 골라 주세요."}>
        {f.selected.length > 0 && <ChoiceGrid options={f.selected} value={f.top} cols={1} onChange={(v) => update((a) => { a.features.top = v; })} />}
      </QCard>
    </>
  );
}

function Overall({ A, update }) {
  const o = A.overall;
  return (
    <>
      <QCard no="①" title="실제 EMR에 적용된다면 사용하실 의향이 있으십니까?">
        <Scale5 value={o.intent} labels={INTENT_SCALE} onChange={(v) => update((a) => { a.overall.intent = v; })} />
      </QCard>
      <QCard no="②" title="도입 · 확산을 결정할 때 가장 중요한 요인 1개를 골라 주세요.">
        <ChoiceGrid options={FACTORS} value={o.factor} onChange={(v) => update((a) => { a.overall.factor = v; })} />
        {o.factor === "기타" && <div className="mt-3"><TextField label="기타 요인을 적어 주세요" value={o.factorEtc} onChange={(v) => update((a) => { a.overall.factorEtc = v; })} /></div>}
      </QCard>
      <QCard no="③" title="기타 의견이 있으시면 자유롭게 적어 주세요." hint="선택 사항입니다">
        <TextArea value={o.comment} onChange={(v) => update((a) => { a.overall.comment = v; })} rows={5} />
      </QCard>
    </>
  );
}

function Review({ A, goto, record }) {
  const rows = STEPS.slice(1, -1).map((s, i) => ({ s, i: i + 1, miss: s.missing(A) }));
  const total = totalMissing(A);
  return (
    <>
      <QCard title={total === 0 ? "모든 문항에 답하셨습니다." : `답하지 않은 문항이 ${total}개 있습니다.`}
        hint={record.status === "submitted" ? `제출 완료 상태입니다 · ${fmtTime(record.submittedAt || record.updatedAt)}` : "아래에서 단계별로 확인하실 수 있습니다."}>
        <ul className="divide-y divide-slate-200">
          {rows.map(({ s, i, miss }) => (
            <li key={s.id} className="flex items-center gap-3 py-2.5">
              <span className={cx("w-9 h-9 rounded-full flex items-center justify-center text-lg font-black shrink-0", miss ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-800")}>{miss ? "!" : "✓"}</span>
              <span className="flex-1 text-lg">{s.title}{miss ? <span className="text-rose-700 font-bold"> · {miss}개 남음</span> : ""}</span>
              <button type="button" onClick={() => goto(i)} className="sv-btn rounded-xl border-[3px] border-blue-700 bg-white text-blue-900 font-bold px-3 py-2 text-base">{miss ? "답하기" : "보기"}</button>
            </li>
          ))}
        </ul>
      </QCard>
    </>
  );
}

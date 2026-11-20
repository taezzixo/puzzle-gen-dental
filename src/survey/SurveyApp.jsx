import { useEffect, useRef, useState } from "react";
import { SURVEY_CONFIG as CFG } from "./config.js";
import {
  CONSENT_ITEMS, CONSENT_INFO, BASIC, CATEGORIES, SUBITEMS, MAIN_PAIRS, SUB_PAIRS, ABS_ITEMS, SCALE5, QUANT,
  SATISFACTION, SAT_SCALE, AGENT_Q, FEATURES, FACTORS, emptyAnswers, normalizeAnswers,
} from "./questions.js";
import { STEPS, progressPct, totalMissing } from "./steps.js";
import { saveRecord, fetchByName, readDraft, writeDraft, clearDraft, nameKey } from "./storage.js";
import { Choice, ChoiceGrid, Scale5, PairCompare, NumField, TextField, TextArea, Note, More, QCard, SignaturePad, cx } from "./ui.jsx";

const fmtTime = (iso) => (iso ? new Date(iso).toLocaleString("ko-KR", { month: "long", day: "numeric", hour: "numeric", minute: "2-digit" }) : "");

const btnPrimary = "sv-btn rounded-lg bg-neutral-900 hover:bg-black text-white font-semibold disabled:opacity-30";
const btnSecondary = "sv-btn rounded-lg border border-neutral-300 hover:border-neutral-900 bg-white text-neutral-900 font-semibold disabled:opacity-30";

export function SurveyShell({ children, right }) {
  return (
    <div className="sv-root min-h-screen bg-neutral-50 text-neutral-900" style={{ fontFamily: "'Pretendard', 'Malgun Gothic', system-ui, sans-serif" }}>
      <header className="bg-white border-b border-neutral-200 sticky top-0 z-30">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center gap-3">
          <div className="flex-1 min-w-0 flex items-baseline gap-2">
            <span className="text-[15px] font-bold tracking-tight">{CFG.productName}</span>
            <span className="text-[13px] text-neutral-500">사용성 평가</span>
          </div>
          {right}
        </div>
      </header>
      {children}
    </div>
  );
}

const freshRecord = () => ({ status: "draft", createdAt: new Date().toISOString(), step: 0, answers: emptyAnswers() });
const CONSENT_STEP = STEPS.findIndex((s) => s.id === "consent");

// ── 메인 ─────────────────────────────────────────
export default function SurveyApp() {
  // 이 브라우저에서 작성하던 응답이 있으면 이어서, 없으면 조사 안내부터 시작
  const [record, setRecord] = useState(() => {
    const d = readDraft();
    return d && d.status !== "submitted" ? { ...d, answers: normalizeAnswers(d.answers) } : freshRecord();
  });
  const [step, setStep] = useState(() => Math.min(record?.step || 0, STEPS.length - 1));
  const [resumed, setResumed] = useState(() => !!nameKey(record?.answers?.consent?.name));
  const [saveState, setSaveState] = useState(null); // {kind:'ok'|'warn'|'saving'|'info', text}
  const [missingPrompt, setMissingPrompt] = useState(null);
  const [submitAsk, setSubmitAsk] = useState(false);
  const [resumeAsk, setResumeAsk] = useState(null); // 같은 성명의 기존 응답
  const [resetAsk, setResetAsk] = useState(false);
  const [checking, setChecking] = useState(false); // 성명 확인 중
  const [done, setDone] = useState(false);
  const dirty = useRef(false);

  // 이어서 작성하는 경우, 다른 기기에서 더 최근에 저장한 내용이 있으면 서버 쪽을 사용
  useEffect(() => {
    const name = record?.answers?.consent?.name;
    if (!record?.key || !nameKey(name)) return;
    fetchByName(name).then((srv) => {
      if (srv && srv.createdAt === record.createdAt && String(srv.savedAt || "") > String(record.savedAt || "")) {
        setRecord({ ...srv, answers: normalizeAnswers(srv.answers) });
        if (srv.status !== "submitted") setStep(Math.min(srv.step || 0, STEPS.length - 1));
      }
    }).catch(() => {});
    // eslint-disable-next-line
  }, []);

  const A = record.answers;
  const update = (fn) => {
    dirty.current = true;
    editSeq.current += 1;
    setRecord((r) => { const answers = structuredClone(r.answers); fn(answers); const nr = { ...r, answers }; writeDraft(nr); return nr; });
  };

  // 저장은 한 번에 하나씩 순서대로 보내고, 보낼 때마다 그 시점의 최신 응답을 사용합니다.
  // 서버 응답이 오는 동안 새로 고른 답이 이전 상태로 덮이지 않도록, 돌아온 값은 저장 정보만 반영합니다.
  const recordRef = useRef(record); recordRef.current = record;
  const stepRef = useRef(step); stepRef.current = step;
  const editSeq = useRef(0);
  const saveQueue = useRef(Promise.resolve());
  const saveNow = async (opts) => {
    const base = recordRef.current;
    if (!base) return null;
    const seqAtStart = editSeq.current;
    const rec = { ...base, step: opts.step ?? stepRef.current, progress: progressPct(base.answers), ...(opts.patch || {}) };
    const k = nameKey(rec.answers.consent?.name);
    // 처음 쓰는 성명이면, 같은 성명으로 이미 저장된 다른 응답이 있는지 먼저 확인
    if (k && k !== base.key) {
      try {
        const existing = await fetchByName(rec.answers.consent.name);
        if (existing && existing.createdAt !== base.createdAt) {
          writeDraft(rec);
          setSaveState(null);
          setResumeAsk(existing);
          return { where: "local", reason: "conflict" };
        }
      } catch { /* 연결 실패 시 아래 저장에서 처리 */ }
    }
    const r = await saveRecord(rec, base.key && base.key !== k ? base.key : undefined);
    setRecord((cur) => ({ ...cur, ...(opts.patch || {}), step: rec.step, progress: rec.progress, updatedAt: r.record.updatedAt, ...(r.where === "server" ? { key: r.record.key, savedAt: r.savedAt } : {}) }));
    if (r.where === "server") {
      if (editSeq.current === seqAtStart) dirty.current = false;
      if (!opts.silent) setSaveState({ kind: "ok", text: `저장되었습니다 · ${fmtTime(r.savedAt)}` }); else setSaveState(null);
    } else if (r.reason === "no-name") {
      if (!opts.silent) setSaveState({ kind: "info", text: "성명을 입력하면 서버에 저장됩니다. 지금은 이 기기에만 보관됩니다." });
    } else setSaveState({ kind: "warn", text: "서버에 저장하지 못해 이 기기에만 임시 저장했습니다. 잠시 후 다시 저장해 주세요." });
    return r;
  };
  // 아직 보내지 않은 저장 요청은 하나로 합침 (어차피 최신 응답을 보내므로)
  const pendingSave = useRef(null);
  const doSave = (opts = {}) => {
    if (!opts.silent) setSaveState({ kind: "saving", text: "저장하는 중…" });
    const q = pendingSave.current;
    if (q) {
      q.opts = { silent: q.opts.silent && opts.silent, step: opts.step ?? q.opts.step, patch: { ...(q.opts.patch || {}), ...(opts.patch || {}) } };
      return q.promise;
    }
    const entry = { opts };
    entry.promise = saveQueue.current.then(() => { pendingSave.current = null; return saveNow(entry.opts); });
    pendingSave.current = entry;
    saveQueue.current = entry.promise.catch(() => {});
    return entry.promise;
  };

  // 창을 닫을 때 서버에 저장하지 않은 내용 경고
  useEffect(() => {
    const h = (e) => { if (dirty.current && nameKey(recordRef.current?.answers?.consent?.name)) { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, []);

  const goto = (i) => {
    setStep(i); setMissingPrompt(null);
    // 현재 위치를 이 브라우저에 바로 기록 (새로고침해도 같은 화면에서 이어서)
    setRecord((r) => { const nr = { ...r, step: i }; writeDraft(nr); return nr; });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const next = async (force) => {
    const miss = STEPS[step].missing(A);
    if (miss > 0 && !force) { setMissingPrompt(miss); return; }
    const to = Math.min(step + 1, STEPS.length - 1);
    // 새 성명을 입력한 동의 화면: 같은 성명의 기존 응답이 있는지 확인한 뒤 이동 (저장은 뒤에서)
    if (step === CONSENT_STEP && nameKey(A.consent.name) && nameKey(A.consent.name) !== record.key) {
      setChecking(true);
      try {
        const existing = await fetchByName(A.consent.name);
        if (existing && existing.createdAt !== record.createdAt) { setResumeAsk(existing); return; }
      } catch { /* 연결 실패 시 저장 단계에서 안내 */ } finally { setChecking(false); }
    }
    if (dirty.current) doSave({ silent: true, step: to });
    goto(to);
  };
  const prev = () => { const to = Math.max(step - 1, 0); if (dirty.current) doSave({ silent: true, step: to }); goto(to); };

  const submit = async () => {
    setSubmitAsk(false);
    const r = await doSave({ patch: { status: "submitted", submittedAt: new Date().toISOString() } });
    if (r?.where === "server") { clearDraft(); setDone(true); }
  };

  // 같은 성명의 기존 응답을 불러와 이어서 작성
  const continueExisting = () => {
    const ex = resumeAsk;
    setResumeAsk(null);
    const rec = { ...ex, answers: normalizeAnswers(ex.answers) };
    setRecord(rec); writeDraft(rec); dirty.current = false; setResumed(true);
    goto(ex.status === "submitted" ? STEPS.length - 1 : Math.max(Math.min(ex.step || 0, STEPS.length - 1), CONSENT_STEP + 1));
    setSaveState({ kind: "ok", text: `${ex.name || ex.answers?.consent?.name} 님의 이전 응답을 불러왔습니다` });
  };

  const startNew = () => {
    clearDraft(); dirty.current = false;
    const r = freshRecord();
    setRecord(r); setResumed(false); setResetAsk(false); setDone(false); setSaveState(null);
    goto(0);
  };

  const myName = A.consent?.name?.trim();

  if (done) return (
    <SurveyShell>
      <main className="max-w-2xl mx-auto px-4 py-20 text-center">
        <div className="mx-auto w-12 h-12 rounded-full bg-neutral-900 text-white flex items-center justify-center text-xl mb-5" aria-hidden>✓</div>
        <h1 className="text-2xl font-bold tracking-tight mb-2">제출이 완료되었습니다</h1>
        <p className="text-[15px] text-neutral-500 mb-8">{myName ? `${myName} 님, ` : ""}소중한 의견 감사합니다.</p>
        <div className="flex flex-col sm:flex-row gap-2 justify-center">
          <button type="button" onClick={() => { setDone(false); goto(STEPS.length - 1); }} className={cx(btnSecondary, "px-5 py-3 text-[14px]")}>제출한 내용 보기</button>
          <button type="button" onClick={startNew} className={cx(btnSecondary, "px-5 py-3 text-[14px]")}>다른 분 응답 새로 작성</button>
        </div>
      </main>
    </SurveyShell>
  );

  const S = STEPS[step];

  return (
    <SurveyShell right={myName ? <span className="text-[12px] text-neutral-500 whitespace-nowrap">{myName} 님</span> : null}>
      {resumed && myName && (
        <div className="bg-neutral-100 border-b border-neutral-200">
          <div className="max-w-2xl mx-auto px-4 py-2 flex items-center gap-3 text-[12px] text-neutral-600">
            <span className="flex-1"><b className="text-neutral-900">{myName}</b> 님의 응답을 이어서 작성 중입니다.</span>
            <button type="button" onClick={() => setResetAsk(true)} className="sv-link underline underline-offset-4 hover:text-neutral-900">본인이 아니면 새로 작성</button>
          </div>
        </div>
      )}
      {/* 진행 표시 */}
      <div className="max-w-2xl mx-auto px-4 pt-6">
        <div className="flex items-center justify-between mb-2 text-[12px] text-neutral-500 tabular-nums">
          <span><b className="text-neutral-900 font-semibold">{step + 1}</b> / {STEPS.length}</span>
          <span>응답 {progressPct(A)}%</span>
        </div>
        <div className="h-1 rounded-full bg-neutral-200 overflow-hidden" role="progressbar" aria-valuenow={step + 1} aria-valuemin={1} aria-valuemax={STEPS.length}>
          <div className="h-full bg-neutral-900 transition-all" style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
        </div>
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight mt-6 mb-4">{S.title}</h2>
      </div>

      <main className="max-w-2xl mx-auto px-4 pb-40 space-y-3">
        <StepBody id={S.id} cat={S.cat} A={A} update={update} goto={goto} record={record} />
        {missingPrompt != null && (
          <div className="rounded-xl border border-neutral-900 bg-white p-4" role="alert">
            <p className="text-[15px] font-semibold mb-3">답하지 않은 문항이 {missingPrompt}개 있습니다.</p>
            <div className="flex flex-col sm:flex-row gap-2">
              <button type="button" onClick={() => setMissingPrompt(null)} className={cx(btnPrimary, "flex-1 py-2.5 text-[14px]")}>돌아가서 답하기</button>
              <button type="button" onClick={() => next(true)} className={cx(btnSecondary, "flex-1 py-2.5 text-[14px]")}>나중에 하고 다음으로</button>
            </div>
          </div>
        )}
        {S.id === "review" && (
          <div className="pt-2">
            <button type="button" onClick={() => setSubmitAsk(true)} disabled={!nameKey(myName)} className={cx(btnPrimary, "w-full py-4 text-[16px]")}>
              {record.status === "submitted" ? "수정 내용으로 다시 제출" : "설문 제출하기"}
            </button>
            {!nameKey(myName) ? <Note className="text-center mt-2">제출하려면 「개인정보 수집 · 이용 동의」 단계에서 성명을 입력해 주세요.</Note>
              : totalMissing(A) > 0 && <Note className="text-center mt-2">답하지 않은 문항이 있어도 제출할 수 있습니다.</Note>}
          </div>
        )}
      </main>

      {/* 하단 고정 버튼 */}
      <nav className="fixed bottom-0 inset-x-0 z-30 bg-white/95 backdrop-blur border-t border-neutral-200">
        {saveState && (
          <div className={cx("text-center text-[13px] py-1.5 px-3 border-b border-neutral-200", saveState.kind === "warn" ? "bg-neutral-900 text-white" : "bg-neutral-50 text-neutral-700")} role="status">
            {saveState.kind === "ok" ? "✓ " : saveState.kind === "warn" ? "⚠ " : ""}{saveState.text}
          </div>
        )}
        <div className="max-w-2xl mx-auto px-4 py-3 grid grid-cols-[1fr_1fr_1.4fr] gap-2">
          <button type="button" onClick={prev} disabled={step === 0} className={cx(btnSecondary, "py-3 text-[14px]")}>← 이전</button>
          <button type="button" onClick={() => doSave()} className={cx(btnSecondary, "py-3 text-[14px]")}>저장</button>
          <button type="button" onClick={() => next(false)} disabled={step === STEPS.length - 1 || checking} className={cx(btnPrimary, "py-3 text-[14px]")}>{checking ? "확인 중…" : "다음 →"}</button>
        </div>
      </nav>

      {submitAsk && (
        <Modal title="설문을 제출할까요?" text="제출 후에도 같은 성명으로 다시 들어와 수정할 수 있습니다."
          cancel="취소" onCancel={() => setSubmitAsk(false)} ok="제출" onOk={submit} />
      )}
      {resumeAsk && (
        <Modal title={`「${resumeAsk.name || resumeAsk.answers?.consent?.name}」 님의 이전 응답이 있습니다`}
          text={`${resumeAsk.status === "submitted" ? "제출 완료" : `작성 중 · 진행률 ${resumeAsk.progress ?? progressPct(normalizeAnswers(resumeAsk.answers))}%`} · ${fmtTime(resumeAsk.savedAt || resumeAsk.updatedAt)} 저장. 본인이면 이어서 작성하세요. 다른 분이라면 성명을 구분해서 입력해 주세요 (예: 홍길동A).`}
          cancel="성명 다시 확인" onCancel={() => { setResumeAsk(null); if (step !== CONSENT_STEP) goto(CONSENT_STEP); }}
          ok="이어서 작성" onOk={continueExisting} />
      )}
      {resetAsk && (
        <Modal title="새로 작성할까요?" text="이 기기에서 작성 중이던 화면을 비우고 처음부터 시작합니다. 이미 서버에 저장된 응답은 지워지지 않으며, 같은 성명을 입력하면 다시 불러올 수 있습니다."
          cancel="취소" onCancel={() => setResetAsk(false)} ok="새로 작성" onOk={startNew} />
      )}
    </SurveyShell>
  );
}

function Modal({ title, text, cancel, onCancel, ok, onOk }) {
  return (
    <div className="fixed inset-0 z-40 bg-black/40 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="bg-white rounded-xl max-w-sm w-full p-6 shadow-xl">
        <h3 className="text-lg font-bold mb-1.5 leading-snug">{title}</h3>
        <p className="text-[14px] text-neutral-500 mb-5 leading-relaxed">{text}</p>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={onCancel} className={cx(btnSecondary, "py-2.5 text-[14px]")}>{cancel}</button>
          <button type="button" onClick={onOk} className={cx(btnPrimary, "py-2.5 text-[14px]")}>{ok}</button>
        </div>
      </div>
    </div>
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
      <QCard title="안녕하세요.">
        <p className="text-[15px] leading-relaxed text-neutral-700">
          체험하신 <b className="text-neutral-900">{CFG.productName} {CFG.productVersion}</b>(음성 입력 · 수정 명령, 파노라마 X선 판독, 진료기록 요약, 치아별 과거 이력 조회)에 대한 의견을 여쭙는 설문입니다.
        </p>
      </QCard>
      <QCard title="진행 방법">
        <ol className="space-y-2 text-[14px] text-neutral-700">
          <li className="flex gap-3"><span className="font-semibold text-neutral-900 w-4">1</span><span>한 화면씩 답하고 <b className="text-neutral-900">다음 →</b>을 누릅니다.</span></li>
          <li className="flex gap-3"><span className="font-semibold text-neutral-900 w-4">2</span><span>다음 단계에서 입력한 <b className="text-neutral-900">성명</b>으로 응답이 저장됩니다. 나중에 같은 성명으로 이어서 작성할 수 있습니다.</span></li>
          <li className="flex gap-3"><span className="font-semibold text-neutral-900 w-4">3</span><span>마지막 화면에서 <b className="text-neutral-900">설문 제출하기</b>를 누르면 끝납니다.</span></li>
        </ol>
      </QCard>
      <More label="조사 개요 자세히 보기">
        <p>본 조사는 ㈜퍼즐에이아이에서 개발한 AI 의무기록 자동생성 솔루션 「{CFG.productName} {CFG.productVersion}」의 개념검증(POC) 결과를 객관적으로 평가하기 위해 실시됩니다. POC에서는 시험용 가상(샘플) 진료 데이터와 시험 접속 링크를 통해 실제 EMR을 사용하는 상황을 가정하여 기능을 체험하셨습니다.</p>
        <p>체험하신 기능의 정확성, 처리 속도, 업무부담 변화, 진료흐름 적합성 등을 종합적으로 검토하여, 실제 EMR에 적용되었을 경우의 기대 효과를 사용자 관점에서 분석하는 데 목적이 있습니다. 또한 2차년도 개발 예정 기능(AGENT)에 대한 기대 수준을 간단히 여쭙습니다.</p>
        <p>대상자 : {CFG.productName} {CFG.productVersion} POC 체험에 참여한 치과 의료진 · 문의 : 주식회사 퍼즐에이아이</p>
      </More>
    </>
  );
}

function Consent({ A, update }) {
  const c = A.consent;
  return (
    <>
      <More label="개인정보 수집 · 이용 안내 보기">
        {CONSENT_INFO.map(([k, v]) => <p key={k}><b className="font-semibold text-neutral-600">{k}</b> : {v}</p>)}
      </More>
      {CONSENT_ITEMS.map((it, i) => (
        <QCard key={it.id} no={`${i + 1}.`} title={it.text} hint={it.required ? "필수 · 동의하지 않으면 조사 참여가 제한됩니다." : "선택 · 동의하지 않아도 불이익이 없습니다."}>
          <ChoiceGrid options={["동의함", "동의하지 않음"]} value={c[it.id] === "agree" ? "동의함" : c[it.id] === "disagree" ? "동의하지 않음" : ""}
            onChange={(v) => update((a) => { a.consent[it.id] = v === "동의함" ? "agree" : v ? "disagree" : ""; })} />
        </QCard>
      ))}
      <QCard title="작성자 정보" hint={`작성일 ${new Date().toLocaleDateString("ko-KR")}`}>
        <div className="space-y-3">
          <TextField label="소속기관" value={c.org} onChange={(v) => update((a) => { a.consent.org = v; })} />
          <TextField label="진료과목" value={c.dept} onChange={(v) => update((a) => { a.consent.dept = v; })} />
          <TextField label="성명" value={c.name} onChange={(v) => update((a) => { a.consent.name = v; })} />
          <Note>응답은 성명 기준으로 저장됩니다. 다른 기기에서도 같은 성명을 입력하면 이어서 작성할 수 있습니다.</Note>
          <Choice multi selected={c.signed} onClick={() => update((a) => { a.consent.signed = !a.consent.signed; a.consent.signedAt = new Date().toISOString(); })}>
            위 내용을 이해하였으며, 위와 같이 동의합니다.
          </Choice>
          <div className="pt-1">
            <span className="block text-[13px] font-medium text-neutral-700 mb-1">서명</span>
            <SignaturePad value={c.signature} onChange={(v) => update((a) => { a.consent.signature = v; a.consent.signatureAt = v ? new Date().toISOString() : ""; })} />
          </div>
        </div>
      </QCard>
    </>
  );
}

function Basic({ A, update }) {
  return (
    <>
      <Note>분석을 위한 기초 정보입니다.</Note>
      {BASIC.map((q, i) => (
        <QCard key={q.id} no={`${i + 1}.`} title={q.label} hint={q.hint}>
          <ChoiceGrid options={q.options} multi={q.type === "multi"} value={A.basic[q.id]} cols={q.options.length > 3 ? 2 : q.options.length}
            onChange={(v) => update((a) => { a.basic[q.id] = v; })} />
          {q.etc && (q.type === "multi" ? (A.basic[q.id] || []).includes(q.etc) : A.basic[q.id] === q.etc) && (
            <div className="mt-3"><TextField label="기타 내용" value={A.basic[q.id + "Etc"]} onChange={(v) => update((a) => { a.basic[q.id + "Etc"] = v; })} /></div>
          )}
        </QCard>
      ))}
    </>
  );
}

const ScaleNote = () => (
  <More label="중요도 척도(1 · 3 · 5 · 7 · 9) 설명">
    <p>1 : 양쪽이 동등, 3 : 한쪽이 약간 중요, 5 : 한쪽이 중요, 7 : 한쪽이 매우 중요, 9 : 한쪽이 절대적 중요</p>
    <p>「같다」 = 1, 「약간 더 중요」 = 3, 「더 중요」 = 5, 「매우 더 중요」 = 7, 「절대적으로 중요」 = 9 로 기록됩니다.</p>
  </More>
);

function AhpMain({ A, update }) {
  const cat = (id) => CATEGORIES.find((c) => c.id === id);
  return (
    <>
      <Note>사용성을 4개 분야로 나누어 두 분야씩 비교합니다. 어느 쪽이 더 중요한지 골라 주세요.</Note>
      <div className="rounded-lg bg-white border border-neutral-200 px-4 py-3 text-[12px] text-neutral-500 space-y-0.5">
        {CATEGORIES.map((c) => <p key={c.id}><b className="font-semibold text-neutral-700">{c.name}</b> — {c.def}</p>)}
      </div>
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
      <QCard title="그렇게 판단하신 이유를 간단히 적어 주세요." hint="가장 중요하게 본 항목과 그 이유, 상대적으로 덜 중요하게 본 항목과 그 이유 · 특별한 이유가 없으면 「없음」이라고 적어 주세요.">
        <TextArea value={A.mainReason} onChange={(v) => update((a) => { a.mainReason = v; })} rows={4} placeholder="없으면 「없음」이라고 적어 주세요." />
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
          <div key={p.id} className="pt-2">
            <h3 className="text-[13px] font-semibold text-neutral-500 mb-2">{CATEGORIES.find((c) => c.id === p.id).name} 분야</h3>
            <PairCompare no={p.no} left={l} right={r} value={A.ahpSub[p.id]} onChange={(v) => update((a) => { a.ahpSub[p.id] = v; })} />
          </div>
        );
      })}
    </>
  );
}

function AbsItem({ item, A, update }) {
  const ans = A.abs[item.id] || {};
  return (
    <QCard no={item.no} title={item.question} hint={`${item.sub} ${item.name}`}>
      <Scale5 value={ans.score} labels={SCALE5} criteria={item.criteria}
        onChange={(v) => update((a) => { a.abs[item.id] = { ...(a.abs[item.id] || {}), score: v }; })} />
      <More label="평가 지표 자세히 보기">
        <p><b className="font-semibold text-neutral-600">정량 지표</b> : {item.metric}</p>
        {item.metricNote && <p>※ {item.metricNote}</p>}
        <p><b className="font-semibold text-neutral-600">판단 방법</b> : {item.method}</p>
        <p><b className="font-semibold text-neutral-600">구현 기능</b> : {item.features.join(" · ")}</p>
      </More>
    </QCard>
  );
}

function AbsCategory({ cat, A, update }) {
  return (
    <>
      <Note>POC 체험을 바탕으로 1~5점 중 골라 주세요. 버튼 아래 회색 글씨는 점수 기준입니다.</Note>
      {ABS_ITEMS.filter((i) => i.cat === cat).map((it) => <AbsItem key={it.id} item={it} A={A} update={update} />)}
    </>
  );
}

function Quant({ A, update }) {
  return (
    <>
      <Note>PuzzleGen Dental을 실제 EMR에 적용한다고 가정했을 때의 변화를 대략적인 숫자로 적어 주세요. 체감 기준이면 충분합니다.</Note>
      {QUANT.map((q, i) => {
        const v = A.quant[q.id] || {};
        const b = Number(v.before), a = Number(v.after);
        const has = v.before !== undefined && v.before !== "" && v.after !== undefined && v.after !== "";
        const dir = has ? (a > b ? "증가" : a < b ? "감소" : "유지") : null;
        const set = (k, val) => update((x) => { x.quant[q.id] = { ...(x.quant[q.id] || {}), [k]: val }; });
        return (
          <QCard key={q.id} no={`Q${i + 1}.`} title={q.title} hint={q.lead}>
            <div className="flex flex-wrap items-end gap-3">
              <NumField label="지금" unit={q.unit} value={v.before} onChange={(x) => set("before", x)} />
              <span className="text-neutral-300 pb-2.5" aria-hidden>→</span>
              <NumField label="적용 후 (예상)" unit={q.unit} value={v.after} onChange={(x) => set("after", x)} />
            </div>
            {dir && <p className="mt-3 text-[13px] text-neutral-600">{v.before}{q.unit} → {v.after}{q.unit} · <b className="text-neutral-900">{dir}</b></p>}
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
        <QCard key={s.id} no={`${i + 1}.`} title={s.name}>
          <Scale5 value={A.satisfaction[s.id]} labels={SAT_SCALE} onChange={(v) => update((a) => { a.satisfaction[s.id] = v; })} />
        </QCard>
      ))}
    </>
  );
}

// 2차년도 개발 예정 AGENT 기능 소개
function AgentIntro() {
  const flow = ["진료 중 음성으로 기록", "AI가 진료기록 생성", "의사가 확인", "AGENT가 EMR에 자동 입력 · 검증"];
  const points = [
    ["우리 병원 EMR 그대로", "병원마다 다른 HIS · EMR 양식에 맞춰 입력할 칸을 스스로 찾아 채웁니다. EMR 업체와 별도의 연동 개발이 필요 없습니다(무연동)."],
    ["화면을 ‘보고’ 일하는 AI", "정해진 위치만 누르는 매크로 · RPA와 달리, EMR 화면을 사람처럼 인식(VLM)해 화면 구성이 달라져도 동작합니다."],
    ["입력 후 스스로 검증", "입력한 값이 진료기록과 맞는지 확인하고, 어긋나면 바로잡아 정합성 문제를 줄입니다."],
  ];
  return (
    <section className="rounded-xl bg-neutral-900 text-white p-5 sm:p-6">
      <div className="text-[11px] tracking-wide text-neutral-400 mb-1">2차년도 개발 예정 · 이번 POC에는 포함되지 않음</div>
      <h3 className="text-lg font-bold leading-snug">무연동 AI Agent</h3>
      <p className="text-[12px] text-neutral-400 mb-3">Workflow Control &amp; Integration Agent</p>
      <p className="text-[15px] leading-relaxed mb-5">
        AI가 만든 진료기록을 <b>의사 대신 EMR 화면에 직접 입력</b>해 주는 기능입니다.
        진료 후 기록을 EMR에 옮겨 적고 칸마다 클릭하던 일이 크게 줄어듭니다.
      </p>
      <ol className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-5">
        {flow.map((f, i) => (
          <li key={f} className="rounded-lg border border-neutral-700 px-3 py-2.5">
            <span className="block text-[11px] text-neutral-400 tabular-nums">STEP {i + 1}</span>
            <span className={cx("block text-[13px] leading-snug", i === flow.length - 1 && "font-semibold")}>{f}</span>
          </li>
        ))}
      </ol>
      <ul className="space-y-3">
        {points.map(([t, d]) => (
          <li key={t} className="flex gap-3">
            <span aria-hidden className="mt-1.5 w-1.5 h-1.5 rounded-full bg-white shrink-0" />
            <span><b className="block text-[14px]">{t}</b><span className="block text-[13px] leading-relaxed text-neutral-300">{d}</span></span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Agent({ A, update }) {
  return (
    <>
      <AgentIntro />
      <Note className="pt-1">위 기능이 함께 제공된다고 가정하고 답해 주세요.</Note>
      {AGENT_Q.map((q, i) => (
        <QCard key={q.id} no={`${i + 1}.`} title={q.name}>
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
      <QCard no="1." title="추가되면 좋을 기능을 모두 골라 주세요." hint="여러 개 선택할 수 있습니다">
        <ChoiceGrid multi options={FEATURES} value={f.selected} cols={1}
          onChange={(v) => update((a) => { a.features.selected = v; if (!v.includes(a.features.top)) a.features.top = ""; })} />
        {f.selected.includes("기타") && <div className="mt-3"><TextField label="기타 기능" value={f.etc} onChange={(v) => update((a) => { a.features.etc = v; })} /></div>}
      </QCard>
      <QCard no="2." title="그중 가장 필요한 기능 1개를 골라 주세요." hint={f.selected.length ? "" : "먼저 위에서 기능을 골라 주세요."}>
        {f.selected.length > 0 && <ChoiceGrid options={f.selected} value={f.top} cols={1} onChange={(v) => update((a) => { a.features.top = v; })} />}
      </QCard>
    </>
  );
}

function Overall({ A, update }) {
  const o = A.overall;
  return (
    <>
      <QCard no="1." title="도입 · 확산을 결정할 때 가장 중요한 요인 1개를 골라 주세요.">
        <ChoiceGrid options={FACTORS} value={o.factor} onChange={(v) => update((a) => { a.overall.factor = v; })} />
        {o.factor === "기타" && <div className="mt-3"><TextField label="기타 요인" value={o.factorEtc} onChange={(v) => update((a) => { a.overall.factorEtc = v; })} /></div>}
      </QCard>
      <QCard no="2." title="기타 의견이 있으면 자유롭게 적어 주세요." hint="선택 사항">
        <TextArea value={o.comment} onChange={(v) => update((a) => { a.overall.comment = v; })} rows={4} />
      </QCard>
    </>
  );
}

function Review({ A, goto, record }) {
  const rows = STEPS.slice(1, -1).map((s, i) => ({ s, i: i + 1, miss: s.missing(A) }));
  const total = totalMissing(A);
  return (
    <QCard title={total === 0 ? "모든 문항에 답하셨습니다." : `답하지 않은 문항이 ${total}개 있습니다.`}
      hint={record.status === "submitted" ? `제출 완료 · ${fmtTime(record.submittedAt || record.updatedAt)}` : "단계별로 확인할 수 있습니다."}>
      <ul className="divide-y divide-neutral-100">
        {rows.map(({ s, i, miss }) => (
          <li key={s.id} className="flex items-center gap-3 py-2.5">
            <span className={cx("w-5 h-5 rounded-full flex items-center justify-center text-[11px] shrink-0", miss ? "border border-neutral-900 text-neutral-900" : "bg-neutral-900 text-white")}>{miss ? "!" : "✓"}</span>
            <span className="flex-1 text-[14px]">{s.title}{miss ? <span className="text-neutral-500"> · {miss}개 남음</span> : ""}</span>
            <button type="button" onClick={() => goto(i)} className={cx(miss ? btnPrimary : btnSecondary, "px-3 py-1.5 text-[12px]")}>{miss ? "답하기" : "보기"}</button>
          </li>
        ))}
      </ul>
    </QCard>
  );
}

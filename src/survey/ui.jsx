// 설문 UI 구성요소 — 블랙 앤 화이트 미니멀 디자인
// 원칙: 누를 수 있는 것 = 테두리 버튼, 선택 시 검정으로 채움
//       설명 · 평가 기준 = 회색 작은 글씨 (눈에 덜 띄게)
import { useState } from "react";
import { INTENSITY } from "./questions.js";

export const cx = (...a) => a.filter(Boolean).join(" ");

const base = "sv-btn border rounded-lg text-left";
const off = "bg-white border-neutral-300 text-neutral-900 hover:border-neutral-900";
const on = "bg-neutral-900 border-neutral-900 text-white";

const Dot = ({ active, square }) => (
  <span aria-hidden className={cx("shrink-0 inline-flex items-center justify-center w-[18px] h-[18px] border text-[11px] leading-none",
    square ? "rounded-[4px]" : "rounded-full",
    active ? "bg-white border-white text-neutral-900" : "border-neutral-400 text-transparent")}>✓</span>
);

// 하나(또는 여러 개)를 고르는 버튼
export function Choice({ selected, onClick, children, sub, className, multi }) {
  return (
    <button type="button" role={multi ? "checkbox" : "radio"} aria-checked={!!selected} onClick={onClick}
      className={cx(base, "w-full flex items-center gap-3 px-4 py-3 min-h-[48px]", selected ? on : off, className)}>
      <Dot active={selected} square={multi} />
      <span className="flex-1">
        <span className="block text-[15px] font-medium leading-snug">{children}</span>
        {sub && <span className={cx("block text-[12px] leading-snug mt-0.5", selected ? "text-neutral-300" : "text-neutral-500")}>{sub}</span>}
      </span>
    </button>
  );
}

export function ChoiceGrid({ options, value, onChange, multi, cols = 2, subs }) {
  const isOn = (o) => (multi ? (value || []).includes(o) : value === o);
  const toggle = (o) => {
    if (!multi) return onChange(value === o ? "" : o);
    const cur = value || [];
    onChange(cur.includes(o) ? cur.filter((x) => x !== o) : [...cur, o]);
  };
  return (
    <div role={multi ? "group" : "radiogroup"} className={cx("grid gap-2", cols === 1 ? "grid-cols-1" : cols === 3 ? "grid-cols-1 sm:grid-cols-3" : "grid-cols-1 sm:grid-cols-2")}>
      {options.map((o, i) => <Choice key={o} multi={multi} selected={isOn(o)} onClick={() => toggle(o)} sub={subs?.[i]}>{o}</Choice>)}
    </div>
  );
}

// 1~5점 척도 (점수 기준은 버튼 아래 회색 작은 글씨)
export function Scale5({ value, onChange, labels, criteria }) {
  return (
    <div role="radiogroup" className="grid grid-cols-1 sm:grid-cols-5 gap-2">
      {[1, 2, 3, 4, 5].map((n) => {
        const active = value === n;
        return (
          <button key={n} type="button" role="radio" aria-checked={active} onClick={() => onChange(active ? null : n)}
            className={cx(base, "px-3 py-3 min-h-[56px] flex sm:flex-col items-center gap-3 sm:gap-0.5 sm:text-center", active ? on : off)}>
            <span className="text-xl font-semibold leading-none w-6 sm:w-auto text-center tabular-nums">{n}</span>
            <span className="flex-1 sm:flex-none">
              <span className="block text-[13px] font-medium">{labels[n - 1]}</span>
              {criteria && <span className={cx("block text-[11px] leading-tight mt-0.5", active ? "text-neutral-300" : "text-neutral-500")}>{criteria[n - 1]}</span>}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// 쌍대비교: ① 어느 쪽이 더 중요? ② 얼마나? — 항목 정의는 카드 아래 주석으로
export function PairCompare({ no, left, right, value, onChange }) {
  const v = value || {};
  const set = (patch) => onChange({ ...v, ...patch });
  const side = (key, item) => {
    const active = v.favor === key;
    return (
      <button type="button" role="radio" aria-checked={active} onClick={() => set({ favor: key, intensity: v.favor === key ? v.intensity : null })}
        className={cx(base, "flex-1 flex items-center gap-3 px-4 py-4 min-h-[56px]", active ? on : off)}>
        <Dot active={active} /><span className="text-[15px] font-semibold">{item.name}</span>
      </button>
    );
  };
  const eq = v.favor === "equal";
  const notes = [left, right].filter((x) => x.def);
  return (
    <div>
      <div className="rounded-xl border border-neutral-200 bg-white p-4 sm:p-5">
        <div className="text-[12px] text-neutral-400 mb-1">문항 {no}</div>
        <p className="text-[16px] font-semibold mb-3">둘 중 어느 쪽이 더 중요합니까?</p>
        <div role="radiogroup" className="flex flex-col sm:flex-row gap-2">
          {side("left", left)}
          <button type="button" role="radio" aria-checked={eq} onClick={() => set({ favor: "equal", intensity: 1 })}
            className={cx(base, "sm:w-28 flex items-center justify-center gap-2 px-3 py-3 min-h-[48px] text-[14px] font-medium", eq ? on : off)}>
            <Dot active={eq} /> 같다
          </button>
          {side("right", right)}
        </div>
        {(v.favor === "left" || v.favor === "right") && (
          <div className="mt-4 pt-4 border-t border-neutral-200">
            <p className="text-[14px] font-medium mb-2">「{v.favor === "left" ? left.name : right.name}」이(가) 얼마나 더 중요합니까?</p>
            <div role="radiogroup" className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {INTENSITY.map((it) => {
                const active = v.intensity === it.v;
                return (
                  <button key={it.v} type="button" role="radio" aria-checked={active} onClick={() => set({ intensity: it.v })}
                    className={cx(base, "px-2 py-2.5 text-center", active ? on : off)}>
                    <span className="block text-[14px] font-medium">{it.label}</span>
                    <span className={cx("block text-[11px]", active ? "text-neutral-300" : "text-neutral-400")}>척도 {it.v}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
      {notes.length > 0 && (
        <div className="mt-2 px-1 space-y-1 text-[12px] leading-relaxed text-neutral-500">
          {notes.map((x) => <p key={x.name}>* {x.name} : {x.def}</p>)}
        </div>
      )}
    </div>
  );
}

// 숫자 입력칸
export function NumField({ label, unit, value, onChange }) {
  return (
    <label className="block">
      <span className="block text-[13px] font-medium text-neutral-700 mb-1">{label}</span>
      <span className="flex items-center gap-2">
        <input type="text" inputMode="decimal" value={value ?? ""} onChange={(e) => onChange(e.target.value.replace(/[^0-9.]/g, ""))}
          className="sv-input w-28 text-lg font-semibold text-center rounded-lg border border-neutral-300 bg-white px-3 py-2" />
        {unit && <span className="text-[14px] text-neutral-600">{unit}</span>}
      </span>
    </label>
  );
}

export function TextField({ label, value, onChange, placeholder }) {
  return (
    <label className="block">
      {label && <span className="block text-[13px] font-medium text-neutral-700 mb-1">{label}</span>}
      <input type="text" value={value ?? ""} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="sv-input w-full text-[15px] rounded-lg border border-neutral-300 bg-white px-3.5 py-2.5 placeholder:text-neutral-400" />
    </label>
  );
}

export function TextArea({ label, value, onChange, placeholder, rows = 4 }) {
  return (
    <label className="block">
      {label && <span className="block text-[13px] font-medium text-neutral-700 mb-1">{label}</span>}
      <textarea value={value ?? ""} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={rows}
        className="sv-input w-full text-[15px] leading-relaxed rounded-lg border border-neutral-300 bg-white px-3.5 py-2.5 placeholder:text-neutral-400" />
    </label>
  );
}

// 눈에 덜 띄는 설명
export function Note({ children, className }) {
  return <div className={cx("text-[13px] leading-relaxed text-neutral-500", className)}>{children}</div>;
}

// 접었다 펴는 상세 설명 (기본 접힘)
export function More({ label = "평가 기준 자세히 보기", children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="mt-2">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open}
        className="sv-link text-[12px] text-neutral-500 underline underline-offset-4 py-1 hover:text-neutral-900">{open ? "설명 접기" : label}</button>
      {open && <Note className="mt-1 rounded-lg bg-neutral-50 px-3.5 py-3 space-y-1">{children}</Note>}
    </div>
  );
}

// 문항 카드
export function QCard({ no, title, hint, children }) {
  return (
    <section className="rounded-xl border border-neutral-200 bg-white p-4 sm:p-5">
      <header className="mb-3">
        <h3 className="text-[16px] font-semibold leading-snug">
          {no && <span className="mr-1.5 text-neutral-400 font-medium">{no}</span>}{title}
        </h3>
        {hint && <p className="text-[12px] text-neutral-500 mt-1">{hint}</p>}
      </header>
      {children}
    </section>
  );
}

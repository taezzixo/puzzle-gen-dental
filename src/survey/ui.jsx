// 고령 평가자(60대 이상)를 위한 큰 글씨 · 큰 버튼 UI 구성요소
// 원칙: 누를 수 있는 것 = 진한 파란 테두리 + 굵은 글씨 + 선택 시 색이 꽉 참 + ✓ 표시
//       설명 · 평가 지표 = 회색 작은 글씨, 연한 배경 (눈에 덜 띄게)
import { useState } from "react";
import { INTENSITY } from "./questions.js";

export const cx = (...a) => a.filter(Boolean).join(" ");

const CheckMark = ({ on, round }) => (
  <span aria-hidden className={cx("shrink-0 inline-flex items-center justify-center border-[3px] text-xl font-black leading-none",
    round ? "rounded-full w-8 h-8" : "rounded-md w-8 h-8",
    on ? "bg-white border-white text-blue-800" : "bg-white border-blue-700 text-transparent")}>✓</span>
);

// 하나만 고르는 큰 버튼
export function Choice({ selected, onClick, children, sub, className, multi }) {
  return (
    <button type="button" role={multi ? "checkbox" : "radio"} aria-checked={!!selected} onClick={onClick}
      className={cx("sv-btn w-full text-left flex items-center gap-3 rounded-2xl border-[3px] px-4 py-3 min-h-[64px]",
        selected ? "bg-blue-700 border-blue-700 text-white shadow-lg" : "bg-white border-blue-700 text-blue-900 hover:bg-blue-50 shadow-sm",
        className)}>
      <CheckMark on={selected} round={!multi} />
      <span className="flex-1">
        <span className="block text-lg font-bold leading-snug">{children}</span>
        {sub && <span className={cx("block text-[0.8rem] leading-snug mt-0.5", selected ? "text-blue-100" : "text-slate-500 font-normal")}>{sub}</span>}
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
    <div role={multi ? "group" : "radiogroup"} className={cx("grid gap-3", cols === 1 ? "grid-cols-1" : cols === 3 ? "grid-cols-1 sm:grid-cols-3" : "grid-cols-1 sm:grid-cols-2")}>
      {options.map((o, i) => <Choice key={o} multi={multi} selected={isOn(o)} onClick={() => toggle(o)} sub={subs?.[i]}>{o}</Choice>)}
    </div>
  );
}

// 1~5점 척도 (점수 기준을 버튼 아래 작은 글씨로)
export function Scale5({ value, onChange, labels, criteria, recommended }) {
  return (
    <div role="radiogroup" className="grid grid-cols-1 sm:grid-cols-5 gap-2.5">
      {[1, 2, 3, 4, 5].map((n) => {
        const on = value === n;
        return (
          <button key={n} type="button" role="radio" aria-checked={on} onClick={() => onChange(on ? null : n)}
            className={cx("sv-btn relative rounded-2xl border-[3px] px-3 py-3 min-h-[72px] flex sm:flex-col items-center sm:justify-start gap-3 sm:gap-1 text-left sm:text-center",
              on ? "bg-blue-700 border-blue-700 text-white shadow-lg" : "bg-white border-blue-700 text-blue-900 hover:bg-blue-50 shadow-sm")}>
            {recommended === n && <span className={cx("absolute -top-3 right-2 sm:left-1/2 sm:-translate-x-1/2 sm:right-auto text-[0.7rem] font-bold px-2 py-0.5 rounded-full whitespace-nowrap", on ? "bg-amber-300 text-amber-950" : "bg-amber-100 text-amber-800 border border-amber-300")}>측정값 기준</span>}
            <span className="text-3xl font-black leading-none w-9 sm:w-auto text-center">{n}</span>
            <span className="flex-1 sm:flex-none">
              <span className="block text-base font-bold">{labels[n - 1]}</span>
              {criteria && <span className={cx("block text-[0.72rem] leading-tight mt-0.5", on ? "text-blue-100" : "text-slate-500")}>{criteria[n - 1]}</span>}
            </span>
            {on && <span aria-hidden className="text-2xl font-black sm:absolute sm:top-1 sm:right-2">✓</span>}
          </button>
        );
      })}
    </div>
  );
}

// 쌍대비교: ① 어느 쪽이 더 중요? ② 얼마나?
export function PairCompare({ no, left, right, value, onChange }) {
  const v = value || {};
  const set = (patch) => onChange({ ...v, ...patch });
  const sideBtn = (side, item) => {
    const on = v.favor === side;
    return (
      <button type="button" role="radio" aria-checked={on} onClick={() => set({ favor: side, intensity: v.favor === side ? v.intensity : null })}
        className={cx("sv-btn flex-1 rounded-2xl border-[3px] px-4 py-4 min-h-[88px] text-left",
          on ? "bg-blue-700 border-blue-700 text-white shadow-lg" : "bg-white border-blue-700 text-blue-900 hover:bg-blue-50 shadow-sm")}>
        <span className="flex items-center gap-2"><CheckMark on={on} round /><span className="text-xl font-extrabold">{item.name}</span></span>
        {item.def && <span className={cx("block text-[0.75rem] leading-snug mt-1.5 pl-10", on ? "text-blue-100" : "text-slate-500")}>{item.def}</span>}
      </button>
    );
  };
  const eqOn = v.favor === "equal";
  return (
    <div className="rounded-3xl bg-white border border-slate-200 shadow-sm p-4 sm:p-5">
      <div className="text-sm text-slate-500 mb-2">문항 {no}</div>
      <p className="text-xl font-bold text-slate-900 mb-3">둘 중 <u className="decoration-amber-400 decoration-4 underline-offset-4">어느 쪽이 더 중요</u>합니까?</p>
      <div role="radiogroup" className="flex flex-col sm:flex-row gap-3 items-stretch">
        {sideBtn("left", left)}
        <button type="button" role="radio" aria-checked={eqOn} onClick={() => set({ favor: "equal", intensity: 1 })}
          className={cx("sv-btn sm:w-36 rounded-2xl border-[3px] px-3 py-3 min-h-[64px] font-extrabold text-lg flex items-center justify-center gap-2",
            eqOn ? "bg-blue-700 border-blue-700 text-white shadow-lg" : "bg-white border-blue-700 text-blue-900 hover:bg-blue-50 shadow-sm")}>
          <CheckMark on={eqOn} round /> 똑같다
        </button>
        {sideBtn("right", right)}
      </div>
      {(v.favor === "left" || v.favor === "right") && (
        <div className="mt-4 rounded-2xl bg-amber-50 border-2 border-amber-300 p-3 sm:p-4">
          <p className="text-lg font-bold text-slate-900 mb-2.5">
            「{v.favor === "left" ? left.name : right.name}」이(가) <u className="decoration-amber-400 decoration-4 underline-offset-4">얼마나 더</u> 중요합니까?
          </p>
          <div role="radiogroup" className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {INTENSITY.map((it) => {
              const on = v.intensity === it.v;
              return (
                <button key={it.v} type="button" role="radio" aria-checked={on} onClick={() => set({ intensity: it.v })}
                  className={cx("sv-btn rounded-2xl border-[3px] px-2 py-3 min-h-[64px] font-bold text-lg flex flex-col items-center",
                    on ? "bg-blue-700 border-blue-700 text-white shadow-lg" : "bg-white border-blue-700 text-blue-900 hover:bg-blue-50")}>
                  <span>{on ? "✓ " : ""}{it.label}</span>
                  <span className={cx("text-[0.7rem] font-normal", on ? "text-blue-100" : "text-slate-500")}>척도 {it.v}점</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// 큰 숫자 입력칸
export function NumField({ label, unit, value, onChange }) {
  return (
    <label className="block">
      <span className="block text-base font-bold text-slate-800 mb-1">{label}</span>
      <span className="flex items-center gap-2">
        <input type="text" inputMode="decimal" value={value ?? ""} onChange={(e) => onChange(e.target.value.replace(/[^0-9.]/g, ""))}
          className="sv-input w-32 text-2xl font-bold text-center rounded-xl border-[3px] border-blue-700 bg-white px-3 py-2.5 text-blue-950" />
        {unit && <span className="text-base text-slate-700">{unit}</span>}
      </span>
    </label>
  );
}

export function TextField({ label, value, onChange, placeholder }) {
  return (
    <label className="block">
      {label && <span className="block text-lg font-bold text-slate-900 mb-1.5">{label}</span>}
      <input type="text" value={value ?? ""} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="sv-input w-full text-xl rounded-xl border-[3px] border-blue-700 bg-white px-4 py-3 text-slate-900 placeholder:text-slate-400" />
    </label>
  );
}

export function TextArea({ label, value, onChange, placeholder, rows = 4 }) {
  return (
    <label className="block">
      {label && <span className="block text-lg font-bold text-slate-900 mb-1.5">{label}</span>}
      <textarea value={value ?? ""} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={rows}
        className="sv-input w-full text-lg leading-relaxed rounded-xl border-[3px] border-blue-700 bg-white px-4 py-3 text-slate-900 placeholder:text-slate-400" />
    </label>
  );
}

// 눈에 덜 띄는 설명 상자
export function Note({ children, className }) {
  return <div className={cx("rounded-xl bg-slate-100/80 text-slate-500 text-[0.85rem] leading-relaxed px-4 py-3", className)}>{children}</div>;
}

// 접었다 펴는 상세 설명 (기본 접힘)
export function More({ label = "평가 기준 자세히 보기", children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="mt-2">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open}
        className="sv-link text-[0.85rem] text-slate-500 underline underline-offset-4 py-1">{open ? "▲ 설명 접기" : `▼ ${label}`}</button>
      {open && <Note className="mt-1">{children}</Note>}
    </div>
  );
}

// 문항 묶음 카드
export function QCard({ no, title, hint, children, missing }) {
  return (
    <section className={cx("rounded-3xl bg-white shadow-sm p-4 sm:p-6 border-2", missing ? "border-rose-300" : "border-transparent")}>
      <header className="mb-3">
        <h3 className="text-xl sm:text-2xl font-extrabold text-slate-900 leading-snug">
          {no && <span className="inline-block mr-2 text-blue-800">{no}</span>}{title}
        </h3>
        {hint && <p className="text-[0.85rem] text-slate-500 mt-1">{hint}</p>}
      </header>
      {children}
    </section>
  );
}

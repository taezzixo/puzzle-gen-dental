import { useState, useMemo, useRef } from "react";
import { Activity, Mic, FileText, Palette, AlertTriangle, Check, X, Clock, CreditCard, Calendar, Zap, Eye, EyeOff, Send, ChevronRight, Stethoscope, Cpu, ShieldCheck, Upload, Save, MessageSquare, User, Wand2, ArrowRight } from "lucide-react";

const UPPER = [18,17,16,15,14,13,12,11,21,22,23,24,25,26,27,28];
const LOWER = [48,47,46,45,44,43,42,41,31,32,33,34,35,36,37,38];

const STATUS = {
  normal:   { label: "정상",   sym: "",  color: "#1e293b", bg: "#ffffff", ring: "#cbd5e1" },
  missing:  { label: "결손치",  sym: "×", color: "#64748b", bg: "#f1f5f9", ring: "#94a3b8" },
  implant:  { label: "임플란트", sym: "I", color: "#1d4ed8", bg: "#dbeafe", ring: "#3b82f6" },
  impacted: { label: "매복치",  sym: "⊠", color: "#b45309", bg: "#fef3c7", ring: "#f59e0b" },
  caries:   { label: "우식",    sym: "C", color: "#b91c1c", bg: "#fee2e2", ring: "#ef4444" },
  filling:  { label: "충전",    sym: "F", color: "#047857", bg: "#d1fae5", ring: "#10b981" },
  perio:    { label: "치주염",  sym: "P", color: "#7c3aed", bg: "#ede9fe", ring: "#8b5cf6" },
  apical:   { label: "치근단",  sym: "A", color: "#be185d", bg: "#fce7f3", ring: "#ec4899" },
  radix:    { label: "잔존치근", sym: "R", color: "#9a3412", bg: "#ffedd5", ring: "#ea580c" },
};

// 기본 탐지 (1단계 공통)
const BASE = () => ({
  18: { status: "impacted", conf: 93, angle: "근심경사 32°" },
  28: { status: "missing",  conf: 97 },
  26: { status: "implant",  conf: 95 },
  46: { status: "implant",  conf: 96 },
  38: { status: "impacted", conf: 91, angle: "수평매복 78°" },
  48: { status: "impacted", conf: 94, angle: "근심경사 41°" },
});

// 2단계 시나리오별 탐지
const seedDetect = (stage, scenario) => {
  const d = BASE();
  if (stage === 1) return d;
  if (scenario === "radix") { d[36] = { status: "missing", conf: 89, draft: true }; return d; }
  d[37] = { status: "caries", conf: 88, icdas: "ICDAS 4", heat: true };
  d[16] = { status: "caries", conf: 86, icdas: "ICDAS 2", heat: true };
  d[36] = { status: "perio",  conf: 85, rbl: "RBL 42%", heat: true };
  d[24] = { status: "apical", conf: 84, lesion: "Ø 4.1mm", heat: true };
  return d;
};

const BOX_POS = {
  18: { x: 7, y: 36, w: 8, h: 15 }, 28: { x: 85, y: 36, w: 8, h: 15 },
  26: { x: 73, y: 40, w: 7, h: 13 }, 46: { x: 71, y: 66, w: 7, h: 16 },
  38: { x: 86, y: 64, w: 8, h: 16 }, 48: { x: 6, y: 64, w: 8, h: 16 },
  37: { x: 80, y: 66, w: 7, h: 14 }, 16: { x: 18, y: 39, w: 7, h: 13 },
  36: { x: 78, y: 68, w: 7, h: 13 }, 24: { x: 59, y: 40, w: 6, h: 12 },
};

const HISTORY = {
  26: [
    { date: "23.04.12", proc: "임플란트 식립 (Fixture)", memo: "₩1,200,000 수납완료" },
    { date: "23.07.08", proc: "보철 장착 (Crown)", memo: "₩650,000 수납완료" },
    { date: "24.11.20", proc: "정기 검진 - 양호", memo: "보험 ₩13,200" },
  ],
  46: [
    { date: "22.09.01", proc: "발치 (#46)", memo: "₩45,000 수납완료" },
    { date: "22.12.15", proc: "임플란트 식립 (오스템 TSIII)", memo: "₩1,350,000 수납완료" },
  ],
  37: [
    { date: "25.02.03", proc: "스케일링", memo: "보험 ₩39,800" },
    { date: "26.05.21", proc: "우식 의심 (신규 탐지)", memo: "미수납" },
  ],
  36: [
    { date: "21.06.10", proc: "신경치료 (#36)", memo: "₩220,000 수납완료" },
    { date: "24.03.22", proc: "보철 탈락 · 잔존치근 확인", memo: "재내원 권고" },
  ],
  16: [{ date: "24.06.30", proc: "복합레진 충전 (Shade A2)", memo: "₩88,000 수납완료" }],
};

const SHADES = [
  { id: "A1", hex: "#e8ddc7" }, { id: "A2", hex: "#e3d4b8" }, { id: "A3", hex: "#dcc9a3" },
  { id: "A3.5", hex: "#d4bd91" }, { id: "B1", hex: "#ece3cf" }, { id: "B2", hex: "#e2d3b0" },
  { id: "C1", hex: "#ddd6c4" }, { id: "C2", hex: "#cfc3a4" }, { id: "D2", hex: "#d9cdb6" },
];

// 2단계 가상 시나리오
const SCENARIOS = {
  caries: {
    name: "우식·치주 시나리오",
    dialogue: [
      { sp: "환자", txt: "오른쪽 아래 어금니가 일주일 전부터 시리고 아파요. 찬물 마시면 특히 심해요." },
      { sp: "의사", txt: "씹을 때도 통증이 있으신가요?" },
      { sp: "환자", txt: "네, 어제부터는 씹을 때도 욱신거려요." },
      { sp: "의사", txt: "파노라마 보니 37번 치아에 우식이 깊게 진행됐네요. 36번 잇몸뼈도 좀 내려가 있고요." },
      { sp: "의사", txt: "오늘 37번 우식 치료 진행하고, 36번은 다음에 스케일링 받으시는 게 좋겠습니다." },
      { sp: "환자", txt: "네 알겠습니다. 비용은 어느 정도 들까요?" },
    ],
    soap: {
      S: "환자 진술: 우측 하악 구치부 1주일 전부터 냉자극 시림, 어제부터 저작 시 통증 동반 (#37 부위)",
      O: "#37 치아우식 ICDAS 4 (88%) · #36 치조골 소실 RBL 42% — 영상 판독 + 문진 일치 확인",
      A: "치아우식증 (K02.1), 만성 치주염 (K05.3) 동반 의심",
      P: "#37 우식 처치 당일 시행 · #36 스케일링 후속 예약 · 보철 색상 추천 연계",
    },
  },
  radix: {
    name: "잔존치근 수정 시나리오",
    dialogue: [
      { sp: "환자", txt: "오른쪽 아래쪽으로 음식을 씹을 때 아파요." },
      { sp: "의사", txt: "언제부터 그러셨어요?" },
      { sp: "환자", txt: "한 2주 정도 된 것 같아요." },
      { sp: "의사", txt: "차트 보니 36번이 결손으로 잡혔는데, 영상 다시 보니 뿌리가 남아있는 잔존치근이네요." },
    ],
    draft: "#16, #26 결손 · #36, #46 임플란트 식립 · 전반적 치조골 흡수 관찰",
    command: "36번은 결손이 아니라 잔존치근으로 수정해줘. 그리고 환자가 오른쪽 아래 씹을 때 아프다고 한 내용 추가해줘.",
    soap: {
      S: "주소(C.C): 우측 하악 저작 시 통증 호소 (2주간 지속)",
      O: "#36 잔존치근(Radix) — AI 초안 '결손' → 음성 명령으로 수정 · #46 임플란트 식립 · 전반적 치조골 흡수 관찰",
      A: "잔존치근 (#36), 저작 기능 장애",
      P: "#36 발치 및 임플란트 식립 상담 필요",
    },
  },
};

function Tooth({ num, det, selected, onClick, onHover, showHeat }) {
  const st = STATUS[det?.status || "normal"];
  const isWisdom = [18,28,38,48].includes(num);
  return (
    <button onClick={() => onClick(num)}
      onMouseEnter={(e) => onHover(num, e.currentTarget)} onMouseLeave={() => onHover(null)}
      className="relative flex flex-col items-center focus:outline-none" style={{ width: 34 }}>
      {showHeat && det?.heat && <span className="absolute -inset-0.5 rounded-md animate-pulse" style={{ background: "radial-gradient(circle, rgba(239,68,68,.55), transparent 70%)" }} />}
      <div className="relative flex items-center justify-center rounded-md border-2 transition-all duration-150"
        style={{ width: 30, height: 36, background: st.bg, borderColor: selected === num ? "#0f172a" : st.ring,
          boxShadow: selected === num ? "0 0 0 3px rgba(15,23,42,.18)" : "none",
          transform: selected === num ? "translateY(-2px)" : "none", opacity: isWisdom && !det ? 0.55 : 1 }}>
        <span className="text-[13px] font-bold leading-none" style={{ color: st.color }}>{st.sym || num.toString().slice(-1)}</span>
        {det && <span className="absolute -top-1.5 -right-1.5 text-[7px] font-bold text-white rounded-full px-1 py-px" style={{ background: det.conf >= 90 ? "#16a34a" : det.conf >= 85 ? "#ca8a04" : "#dc2626" }}>{det.conf}</span>}
      </div>
      <span className="text-[9px] text-slate-500 mt-0.5 font-medium">{num}</span>
    </button>
  );
}

// 호버 팝업 카드
function HoverCard({ num, det, hist }) {
  const st = STATUS[det?.status || "normal"];
  return (
    <div className="bg-white rounded-lg shadow-2xl border border-slate-200 w-52 overflow-hidden">
      <div className="px-3 py-2 flex items-center justify-between" style={{ background: st.bg }}>
        <span className="text-xs font-bold" style={{ color: st.color }}>#{num} {st.label}</span>
        {det && <span className="text-[10px] font-bold px-1.5 rounded-full text-white" style={{ background: det.conf >= 90 ? "#16a34a" : det.conf >= 85 ? "#ca8a04" : "#dc2626" }}>{det.conf}%</span>}
      </div>
      <div className="p-2.5">
        <div className="text-[10px] font-semibold text-slate-500 mb-1.5 flex items-center gap-1"><Clock size={10} /> 과거 치료 이력 (#{num})</div>
        {hist ? (
          <div className="space-y-1">
            {hist.slice(0, 3).map((h, i) => (
              <div key={i} className="text-[10px] leading-tight">
                <span className="text-cyan-600 font-mono font-semibold">{h.date}</span>
                <span className="text-slate-700 ml-1">{h.proc}</span>
              </div>
            ))}
          </div>
        ) : <p className="text-[10px] text-slate-400">연동된 이력 없음</p>}
      </div>
    </div>
  );
}

export default function App() {
  const [stage, setStage] = useState(1);
  const [scenario, setScenario] = useState("caries");
  const [analyzed, setAnalyzed] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [detect, setDetect] = useState({});
  const [selected, setSelected] = useState(null);
  const [hover, setHover] = useState(null);
  const [tab, setTab] = useState("vision");
  const [showHeat, setShowHeat] = useState(false);
  const [showBoxes, setShowBoxes] = useState(true);
  const [voiceLog, setVoiceLog] = useState([]);
  const [voiceInput, setVoiceInput] = useState("");
  const [recShade, setRecShade] = useState(null);
  const [img, setImg] = useState(null);
  const [imgName, setImgName] = useState("");
  const [drag, setDrag] = useState(false);
  const [convVisible, setConvVisible] = useState(0);
  const [convGenerated, setConvGenerated] = useState(false);
  const [cmdApplied, setCmdApplied] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const [emrMsg, setEmrMsg] = useState("");
  const fileRef = useRef(null);

  const loadFile = (f) => {
    if (!f || !f.type.startsWith("image/")) return;
    const r = new FileReader();
    r.onload = () => { setImg(r.result); setImgName(f.name); };
    r.readAsDataURL(f);
  };

  const runAnalysis = () => {
    setAnalyzing(true); setRecShade(null);
    setTimeout(() => { setDetect(seedDetect(stage, scenario)); setAnalyzed(true); setAnalyzing(false); }, 1400);
  };

  const switchStage = (s) => {
    setStage(s);
    setConvGenerated(false); setConvVisible(0); setCmdApplied(false);
    if (analyzed) setDetect(seedDetect(s, scenario));
  };

  const switchScenario = (sc) => {
    setScenario(sc); setConvVisible(0); setConvGenerated(false); setCmdApplied(false); setSelected(null);
    if (analyzed) setDetect(seedDetect(2, sc));
  };

  const SC = SCENARIOS[scenario];

  const playConv = () => {
    setConvVisible(0); setCmdApplied(false); setConvGenerated(false);
    SC.dialogue.forEach((_, i) => setTimeout(() => setConvVisible(i + 1), (i + 1) * 600));
  };

  // 음성 명령 적용 (잔존치근 수정 — 레퍼런스 흐름)
  const applyCommand = () => {
    setDetect((d) => ({ ...d, 36: { status: "radix", conf: 96, manual: true } }));
    setCmdApplied(true);
    setConvGenerated(true); setTab("soap"); setSaveMsg(""); setEmrMsg("");
  };

  const genFromConv = () => { setConvGenerated(true); setTab("soap"); setSaveMsg(""); setEmrMsg(""); };

  const soap = useMemo(() => {
    if (!analyzed) return null;
    if (stage === 2 && convGenerated) return { ...SC.soap, src: "conv" };
    const entries = Object.entries(detect);
    const find = (k) => entries.filter(([, v]) => v.status === k).map(([n]) => "#" + n);
    const O = [];
    if (find("missing").length) O.push(`결손치 ${find("missing").join(", ")}`);
    if (find("implant").length) O.push(`임플란트 식립부 ${find("implant").join(", ")}`);
    if (find("impacted").length) O.push(`매복치 ${find("impacted").join(", ")}`);
    if (find("caries").length) O.push(`치아우식 의심 ${find("caries").join(", ")}`);
    if (find("perio").length) O.push(`치조골 소실 소견 ${find("perio").join(", ")}`);
    if (find("apical").length) O.push(`치근단 투과상 ${find("apical").join(", ")}`);
    return {
      S: stage === 2 ? "문진 대화 미연동 — 좌측 '문진 대화' 패널에서 SOAP 생성 가능" : "환자 주소(C.C) 음성 입력 대기 — Push-to-Talk 활성화 필요",
      O: O.length ? O.join(" / ") : "특이소견 없음",
      A: stage === 2 && find("caries").length ? "치아우식증 (K02), 치주염 동반 의심" : "영상 판독상 구조적 이상 소견",
      P: stage === 2 && find("caries").length ? `${find("caries")[0]} 우식 처치 계획 — 색상 추천 연계` : "정기 검진 및 경과 관찰 권고",
      src: "vision",
    };
  }, [analyzed, detect, stage, convGenerated, scenario]);

  const onHover = (num, el) => {
    if (num == null) { setHover(null); return; }
    const r = el.getBoundingClientRect();
    setHover({ num, x: r.left + r.width / 2, y: r.top });
  };

  const handleTooth = (num) => { setSelected(num); setTab("vision"); };
  const recommendShade = () => { setRecShade(["A2","A3","B2","A3.5"][Math.floor(Math.random()*4)]); setTab("shade"); };

  const sendVoice = () => {
    if (!voiceInput.trim()) return;
    const txt = voiceInput.trim(); const next = { ...detect }; const parsed = [];
    txt.split(/하고|,|그리고|및/).forEach((t) => {
      const m = t.match(/(\d{1,2})\s*번?.*?(우식|결손|임플란트|매복|충전|잔존치근|양호|정상)/);
      if (m) {
        const n = parseInt(m[1], 10);
        const map = { 우식:"caries", 결손:"missing", 임플란트:"implant", 매복:"impacted", 충전:"filling", 잔존치근:"radix" };
        if (m[2]==="양호"||m[2]==="정상") { delete next[n]; parsed.push(`#${n} → 정상 변경`); }
        else if (map[m[2]]) { next[n] = { status: map[m[2]], conf: 99, manual: true }; parsed.push(`#${n} → ${STATUS[map[m[2]]].label} 수정`); }
      }
    });
    setDetect(next);
    setVoiceLog([{ in: txt, out: parsed.length?parsed:["명령 인식 실패 — 다시 시도"], t: new Date().toLocaleTimeString("ko-KR") }, ...voiceLog]);
    setVoiceInput("");
  };

  const doSave = () => { setSaveMsg(`임시저장 완료 · ${new Date().toLocaleTimeString("ko-KR")}`); setTimeout(()=>setSaveMsg(""), 4000); };
  const doEmr = () => setEmrMsg(`EMR 전송 완료 · 정합성 100% · ${new Date().toLocaleTimeString("ko-KR")}`);

  const lowConf = analyzed && Object.values(detect).some((d) => d.conf < 85);
  const selDet = selected ? detect[selected] : null;
  const selHist = selected ? HISTORY[selected] : null;
  const convDone = convVisible >= SC.dialogue.length;

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800" style={{ fontFamily: "'Pretendard', system-ui, sans-serif" }}>
      {/* 호버 팝업 */}
      {hover && (
        <div className="fixed z-50 pointer-events-none" style={{ left: hover.x, top: hover.y - 10, transform: "translate(-50%, -100%)" }}>
          <HoverCard num={hover.num} det={detect[hover.num]} hist={HISTORY[hover.num]} />
          <div className="w-2 h-2 bg-white border-r border-b border-slate-200 rotate-45 mx-auto -mt-1" />
        </div>
      )}

      <header className="bg-slate-900 text-white px-5 py-3 flex items-center justify-between sticky top-0 z-20 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center"><Stethoscope size={20} /></div>
          <div><h1 className="font-bold text-sm tracking-tight">Puzzle Gen Dental</h1><p className="text-[10px] text-slate-400">멀티모달 생성형 EMR 차팅 에이전트 · PoC</p></div>
        </div>
        <div className="flex bg-slate-800 rounded-lg p-0.5">
          {[1, 2].map((s) => <button key={s} onClick={() => switchStage(s)} className={`px-3 py-1 rounded-md text-xs font-semibold transition ${stage === s ? "bg-cyan-500 text-white" : "text-slate-400 hover:text-white"}`}>{s}단계{s === 1 ? " MVP" : " SaMD"}</button>)}
        </div>
      </header>

      <div className="max-w-7xl mx-auto p-4 grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-3 space-y-4">
          {/* 영상 업로드 + 뷰어 */}
          <div className="bg-slate-900 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-slate-300 flex items-center gap-1.5"><Activity size={13} /> 파노라마 영상 (F-VIS-001)</span>
              {analyzed && <button onClick={() => setShowBoxes(!showBoxes)} className={`text-[10px] px-2 py-0.5 rounded-md border ${showBoxes?"bg-cyan-500/20 border-cyan-500/50 text-cyan-300":"border-slate-600 text-slate-400"}`}>탐지 박스 {showBoxes?"ON":"OFF"}</button>}
            </div>
            <div onDragOver={(e)=>{e.preventDefault();setDrag(true);}} onDragLeave={()=>setDrag(false)}
              onDrop={(e)=>{e.preventDefault();setDrag(false);loadFile(e.dataTransfer.files[0]);}}
              onClick={()=>!img&&fileRef.current?.click()}
              className={`relative rounded-lg overflow-hidden transition ${!img?"cursor-pointer":""} ${drag?"ring-2 ring-cyan-400":""}`} style={{ minHeight: 180, background: "#0b1220" }}>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e)=>loadFile(e.target.files[0])} />
              {img ? (
                <div className="relative">
                  <img src={img} alt="panorama" className="w-full block" style={{ maxHeight: 300, objectFit: "contain", margin: "0 auto" }} />
                  {analyzed && showBoxes && Object.entries(detect).map(([n, d]) => {
                    const p = BOX_POS[n]; if (!p) return null;
                    return (
                      <div key={n} onClick={(e)=>{e.stopPropagation();handleTooth(parseInt(n));}}
                        onMouseEnter={(e)=>onHover(parseInt(n), e.currentTarget)} onMouseLeave={()=>onHover(null)}
                        className="absolute cursor-pointer hover:brightness-125" style={{ left:`${p.x}%`, top:`${p.y}%`, width:`${p.w}%`, height:`${p.h}%`,
                          border:`2px solid ${STATUS[d.status].ring}`, borderRadius:4, boxShadow:"0 0 8px rgba(0,0,0,.4)" }}>
                        <span className="absolute -top-4 left-0 text-[8px] font-bold px-1 rounded text-white whitespace-nowrap" style={{ background: STATUS[d.status].ring }}>#{n} {STATUS[d.status].label} {d.conf}%</span>
                      </div>
                    );
                  })}
                  {analyzing && <div className="absolute inset-0 bg-cyan-500/10 flex items-center justify-center"><div className="text-cyan-300 text-xs flex items-center gap-2"><Cpu size={14} className="animate-spin" /> CNN 객체탐지 분석 중...</div></div>}
                  {analyzed && !analyzing && <div className="absolute top-2 right-2 bg-green-500/20 text-green-300 text-[10px] px-2 py-0.5 rounded-full border border-green-500/40">판독 완료 · mAP 91%</div>}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                  <Upload size={28} className="mb-2 opacity-50" /><p className="text-xs">파노라마 X-ray를 드래그하거나 클릭해 업로드</p><p className="text-[10px] text-slate-600 mt-1">PNG · JPG · DICOM 미리보기 지원</p>
                </div>
              )}
            </div>
            {img && <div className="flex items-center justify-between mt-2 text-[10px] text-slate-400"><span className="truncate flex items-center gap-1"><FileText size={11} /> {imgName} · 캘리브레이션 보정 완료</span><button onClick={()=>{setImg(null);setImgName("");setAnalyzed(false);setDetect({});}} className="text-slate-500 hover:text-red-400">제거</button></div>}
            <button onClick={runAnalysis} disabled={analyzing || !img} className="mt-3 w-full bg-cyan-500 hover:bg-cyan-400 disabled:opacity-40 text-white text-sm font-semibold py-2.5 rounded-lg flex items-center justify-center gap-2 transition">
              <Zap size={15} /> {analyzing ? "AI 영상 판독 실행 중..." : !img ? "영상을 먼저 업로드하세요" : analyzed ? "재분석 실행" : "AI 영상 판독 실행"}
            </button>
          </div>

          {lowConf && <div className="bg-amber-50 border border-amber-300 rounded-lg px-3 py-2 flex items-center gap-2 text-xs text-amber-800"><AlertTriangle size={15} /> 일부 항목 신뢰도 임계치(85%) 미달 — 재촬영 또는 음성 재입력 권장 <span className="ml-auto font-mono text-amber-600">[QC-WARN-02]</span></div>}

          {/* 치식 차트 */}
          <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5"><FileText size={13} /> FDI 치식 차트 (F-VIS-003 · F-MAP-001)</span>
              {stage === 2 && <button onClick={() => setShowHeat(!showHeat)} className={`text-[10px] flex items-center gap-1 px-2 py-1 rounded-md border transition ${showHeat?"bg-red-50 border-red-300 text-red-600":"border-slate-300 text-slate-500"}`}>{showHeat ? <Eye size={11} /> : <EyeOff size={11} />} 설명가능성 히트맵</button>}
            </div>
            <p className="text-[10px] text-slate-400 mb-3">치아에 마우스를 올리면 과거 이력 팝업, 클릭하면 상세 보기 (특허 청구항 4·8)</p>
            <div className="space-y-3">
              <div className="flex justify-center gap-0.5 flex-wrap">{UPPER.map((n) => <Tooth key={n} num={n} det={detect[n]} selected={selected} onClick={handleTooth} onHover={onHover} showHeat={showHeat} />)}</div>
              <div className="border-t border-dashed border-slate-200 relative"><span className="absolute left-1/2 -translate-x-1/2 -top-2 bg-white px-2 text-[9px] text-slate-400">상악 / 하악</span></div>
              <div className="flex justify-center gap-0.5 flex-wrap">{LOWER.map((n) => <Tooth key={n} num={n} det={detect[n]} selected={selected} onClick={handleTooth} onHover={onHover} showHeat={showHeat} />)}</div>
            </div>
            <div className="flex flex-wrap gap-2 mt-4 pt-3 border-t border-slate-100">
              {Object.entries(STATUS).filter(([k]) => k !== "normal").map(([k, v]) => <span key={k} className="flex items-center gap-1 text-[10px] text-slate-500"><span className="w-3.5 h-3.5 rounded flex items-center justify-center text-[8px] font-bold border" style={{ background: v.bg, color: v.color, borderColor: v.ring }}>{v.sym}</span>{v.label}</span>)}
            </div>
          </div>

          {/* 2단계 문진 대화 시나리오 */}
          {stage === 2 && (
            <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5"><MessageSquare size={13} /> 환자–의료진 문진 대화 (F-VOC-005 다화자 분리)</span>
                <span className="text-[9px] text-slate-400">DER 91% · 화자 2명</span>
              </div>
              {/* 시나리오 선택 */}
              <div className="flex gap-1.5 mb-3">
                {Object.entries(SCENARIOS).map(([k, v]) => (
                  <button key={k} onClick={() => switchScenario(k)} className={`text-[10px] px-2.5 py-1 rounded-full border transition ${scenario === k ? "bg-slate-900 text-white border-slate-900" : "border-slate-300 text-slate-500 hover:border-slate-400"}`}>{v.name}</button>
                ))}
              </div>
              <button onClick={playConv} className="text-[10px] flex items-center gap-1 bg-cyan-500 text-white px-2.5 py-1.5 rounded-md hover:bg-cyan-400 mb-3"><Mic size={11} /> 문진 음성 분석 재생</button>

              <div className="space-y-2 max-h-52 overflow-auto">
                {SC.dialogue.slice(0, convVisible).map((d, i) => (
                  <div key={i} className={`flex ${d.sp === "의사" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[80%] rounded-2xl px-3 py-2 ${d.sp === "의사" ? "bg-cyan-50 rounded-tr-sm" : "bg-slate-100 rounded-tl-sm"}`}>
                      <div className="flex items-center gap-1 mb-0.5">{d.sp === "의사" ? <Stethoscope size={9} className="text-cyan-600" /> : <User size={9} className="text-slate-500" />}<span className="text-[9px] font-bold" style={{ color: d.sp === "의사" ? "#0891b2" : "#64748b" }}>{d.sp}</span></div>
                      <p className="text-[11px] text-slate-700 leading-relaxed">{d.txt}</p>
                    </div>
                  </div>
                ))}
                {convVisible === 0 && <p className="text-[11px] text-slate-400 text-center py-5">「문진 음성 분석 재생」을 눌러 다화자 분리 결과를 확인하세요</p>}
              </div>

              {/* 시나리오별 후속 흐름 */}
              {convDone && scenario === "caries" && (
                <button onClick={genFromConv} className="mt-3 w-full text-xs flex items-center justify-center gap-1.5 bg-slate-900 text-white px-2.5 py-2 rounded-lg hover:bg-slate-700"><FileText size={12} /> 이 대화로 SOAP 차트 생성</button>
              )}
              {convDone && scenario === "radix" && (
                <div className="mt-3 space-y-2">
                  {/* AI 초안 */}
                  <div className="border border-slate-200 rounded-lg p-2.5 bg-slate-50">
                    <div className="text-[9px] font-bold text-slate-500 mb-1 flex items-center gap-1"><Cpu size={10} /> AI 초안 (Draft)</div>
                    <p className="text-[10px] text-slate-600">{SC.draft}</p>
                  </div>
                  <div className="flex justify-center text-slate-300"><ArrowRight size={14} className="rotate-90" /></div>
                  {/* 의사 음성 명령 */}
                  <div className="border border-cyan-200 rounded-lg p-2.5 bg-cyan-50">
                    <div className="text-[9px] font-bold text-cyan-600 mb-1 flex items-center gap-1"><Mic size={10} /> 의사 음성 명령 (Voice Command)</div>
                    <p className="text-[10px] text-slate-700">"{SC.command}"</p>
                  </div>
                  <button onClick={applyCommand} disabled={cmdApplied} className="w-full text-xs flex items-center justify-center gap-1.5 bg-gradient-to-r from-cyan-500 to-blue-600 disabled:opacity-50 text-white px-2.5 py-2 rounded-lg hover:opacity-90">
                    <Wand2 size={12} /> {cmdApplied ? "수정 완료 · 최종 기록 생성됨" : "음성 명령 적용 → 최종 의무기록 생성"}
                  </button>
                  {cmdApplied && <div className="text-[10px] text-green-700 bg-green-50 rounded-md px-2 py-1.5 flex items-center gap-1"><Check size={11} /> #36 결손 → 잔존치근(Radix) 수정 완료. 차트·치식에 반영됨</div>}
                </div>
              )}
            </div>
          )}

          {/* 음성 명령 */}
          <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
            <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5 mb-2"><Mic size={13} /> 음성 명령 시뮬레이션 (F-VOC-003·006)</span>
            <div className="flex gap-2">
              <input value={voiceInput} onChange={(e) => setVoiceInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && sendVoice()} placeholder="예: 36번 잔존치근으로 수정하고 28번 정상으로 변경" className="flex-1 text-xs border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:border-cyan-500" />
              <button onClick={sendVoice} className="bg-slate-900 text-white px-3 rounded-lg hover:bg-slate-700 transition"><Send size={14} /></button>
            </div>
            {voiceLog.length > 0 && <div className="mt-2 space-y-1.5 max-h-28 overflow-auto">{voiceLog.map((l, i) => <div key={i} className="text-[10px] bg-slate-50 rounded-md px-2 py-1.5"><div className="text-slate-500">🎙 "{l.in}" <span className="text-slate-300">· {l.t}</span></div><div className="text-cyan-700 font-medium">↳ {l.out.join(" / ")}</div></div>)}</div>}
          </div>
        </div>

        {/* 우측 */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="flex border-b border-slate-200">
              {[{ id: "vision", label: "판별결과", icon: Eye }, { id: "soap", label: "SOAP 차트", icon: FileText }, { id: "shade", label: "색상추천", icon: Palette }].map((t) => <button key={t.id} onClick={() => setTab(t.id)} className={`flex-1 py-2.5 text-xs font-semibold flex items-center justify-center gap-1.5 transition ${tab === t.id ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-50"}`}><t.icon size={13} /> {t.label}</button>)}
            </div>
            <div className="p-4">
              {tab === "vision" && (
                <div>
                  {selected ? (
                    <div>
                      <div className="flex items-center justify-between mb-3"><span className="text-sm font-bold">#{selected} 치아 상세</span><button onClick={() => setSelected(null)} className="text-slate-400 hover:text-slate-600"><X size={16} /></button></div>
                      <div className="rounded-lg p-3 mb-3" style={{ background: STATUS[selDet?.status || "normal"].bg }}>
                        <span className="text-xs font-semibold" style={{ color: STATUS[selDet?.status || "normal"].color }}>{STATUS[selDet?.status || "normal"].label}</span>
                        {selDet && <div className="text-[11px] text-slate-600 mt-1 space-y-0.5"><div>신뢰도: <span className="font-bold">{selDet.conf}%</span></div>{selDet.angle && <div>매복 각도: {selDet.angle}</div>}{selDet.icdas && <div>우식 단계: {selDet.icdas}</div>}{selDet.rbl && <div>치조골 소실: {selDet.rbl}</div>}{selDet.lesion && <div>병소 크기: {selDet.lesion}</div>}{selDet.manual && <div className="text-cyan-600">✎ 음성 명령으로 수정됨</div>}</div>}
                      </div>
                      <div className="text-[11px] font-semibold text-slate-600 mb-2 flex items-center gap-1"><Clock size={12} /> 진료 이력 타임라인</div>
                      {selHist ? <div className="space-y-2">{selHist.map((h, i) => <div key={i} className="relative pl-4 border-l-2 border-cyan-200"><span className="absolute -left-[5px] top-1 w-2 h-2 rounded-full bg-cyan-500" /><div className="text-[11px] font-medium text-slate-700">{h.proc}</div><div className="text-[10px] text-slate-400 flex items-center gap-2 mt-0.5"><span className="flex items-center gap-0.5"><Calendar size={9} />{h.date}</span><span className="flex items-center gap-0.5"><CreditCard size={9} />{h.memo}</span></div></div>)}</div> : <p className="text-[11px] text-slate-400">연동된 과거 진료 기록 없음</p>}
                      {(selDet?.status === "implant" || selDet?.status === "missing" || selDet?.status === "radix" || (stage === 2 && selDet?.status === "caries")) && <button onClick={recommendShade} className="mt-3 w-full text-xs bg-gradient-to-r from-pink-500 to-rose-500 text-white py-2 rounded-lg flex items-center justify-center gap-1.5 hover:opacity-90 transition"><Palette size={13} /> 보철물 색상 추천 받기</button>}
                    </div>
                  ) : analyzed ? (
                    <div>
                      <div className="text-xs font-semibold text-slate-600 mb-2">탐지 항목 ({Object.keys(detect).length}건)</div>
                      <div className="space-y-1.5 max-h-80 overflow-auto">{Object.entries(detect).map(([n, d]) => <button key={n} onClick={() => handleTooth(parseInt(n))} onMouseEnter={(e)=>onHover(parseInt(n), e.currentTarget)} onMouseLeave={()=>onHover(null)} className="w-full flex items-center justify-between text-xs bg-slate-50 hover:bg-slate-100 rounded-lg px-3 py-2 transition"><span className="flex items-center gap-2"><span className="w-5 h-5 rounded flex items-center justify-center text-[9px] font-bold" style={{ background: STATUS[d.status].bg, color: STATUS[d.status].color }}>{STATUS[d.status].sym}</span><span className="font-medium">#{n} {STATUS[d.status].label}</span></span><span className="flex items-center gap-1.5"><span className={`text-[10px] font-bold ${d.conf >= 90 ? "text-green-600" : d.conf >= 85 ? "text-amber-600" : "text-red-600"}`}>{d.conf}%</span><ChevronRight size={13} className="text-slate-300" /></span></button>)}</div>
                    </div>
                  ) : <div className="text-center py-10 text-slate-400"><Eye size={28} className="mx-auto mb-2 opacity-40" /><p className="text-xs">영상 업로드 후 AI 판독을 실행하세요</p></div>}
                </div>
              )}

              {tab === "soap" && (
                <div>
                  {soap ? (
                    <div>
                      <div className="text-xs font-semibold text-slate-600 mb-3 flex items-center justify-between"><span className="flex items-center gap-1.5"><FileText size={13} /> {soap.src === "conv" ? "최종 의무기록 (Final Record)" : "S.O.A.P 차트 초안"}</span><span className={`text-[9px] px-1.5 py-0.5 rounded ${soap.src === "conv" ? "bg-cyan-100 text-cyan-700" : "bg-slate-100 text-slate-500"}`}>{soap.src === "conv" ? "문진 대화 기반" : "영상 판독 기반"}</span></div>
                      <div className="space-y-2">{[["S","Subjective",soap.S],["O","Objective",soap.O],["A","Assessment",soap.A],["P","Plan",soap.P]].map(([k, full, txt]) => <div key={k} className="border border-slate-200 rounded-lg overflow-hidden"><div className="bg-slate-800 text-white px-2 py-1 text-[10px] font-bold">{k} · {full}</div><textarea key={txt} defaultValue={txt} rows={2} className="w-full text-[11px] p-2 resize-none focus:outline-none focus:bg-cyan-50/40" /></div>)}</div>
                      <div className="grid grid-cols-2 gap-2 mt-3">
                        <button onClick={doSave} className="bg-white border-2 border-slate-300 hover:border-slate-400 text-slate-700 text-xs font-semibold py-2.5 rounded-lg flex items-center justify-center gap-1.5 transition"><Save size={14} /> 임시저장</button>
                        <button onClick={doEmr} className="bg-green-600 hover:bg-green-500 text-white text-xs font-semibold py-2.5 rounded-lg flex items-center justify-center gap-1.5 transition"><Send size={14} /> EMR 전송</button>
                      </div>
                      {saveMsg && <div className="mt-2 text-[10px] text-slate-600 bg-slate-100 rounded-md px-2 py-1.5 flex items-center gap-1"><Save size={11} /> {saveMsg}</div>}
                      {emrMsg && <div className="mt-2 text-[10px] text-green-700 bg-green-50 rounded-md px-2 py-1.5 flex items-center gap-1"><Check size={11} /> {emrMsg} (F-EMR-002)</div>}
                      <p className="text-[9px] text-slate-400 mt-2 flex items-center gap-1"><ShieldCheck size={10} /> 의사 수정 데이터는 AI 모델 고도화용 정답 라벨로 회귀됩니다</p>
                    </div>
                  ) : <div className="text-center py-10 text-slate-400"><FileText size={28} className="mx-auto mb-2 opacity-40" /><p className="text-xs">분석 후 SOAP 초안이 생성됩니다</p></div>}
                </div>
              )}

              {tab === "shade" && (
                <div>
                  <div className="text-xs font-semibold text-slate-600 mb-1 flex items-center gap-1.5"><Palette size={13} /> 보철물 색상 추천 (F-VIS-010)</div>
                  <p className="text-[10px] text-slate-400 mb-3">가이드 샘플 보정 픽셀 기반 색상 매핑 (특허 청구항 1·7)</p>
                  {recShade ? (
                    <div>
                      <div className="rounded-xl p-4 mb-3 text-center" style={{ background: SHADES.find((s) => s.id === recShade)?.hex }}><div className="text-2xl font-bold text-slate-800">{recShade}</div><div className="text-[10px] text-slate-600 mt-1">AI 추천 셰이드 · 시각 이질감 &lt; 5%</div></div>
                      {selected && <p className="text-[11px] text-slate-500 mb-3">#{selected} 주변 치아 색상을 종합 분석한 결과입니다.</p>}
                      <div className="grid grid-cols-3 gap-1.5">{SHADES.map((s) => <div key={s.id} className={`rounded-lg py-2.5 text-center text-[10px] font-bold border-2 transition ${s.id === recShade ? "border-pink-500 scale-105" : "border-transparent"}`} style={{ background: s.hex, color: "#475569" }}>{s.id}</div>)}</div>
                      <button className="mt-3 w-full bg-slate-900 text-white text-xs font-semibold py-2.5 rounded-lg flex items-center justify-center gap-1.5 hover:bg-slate-700 transition"><Send size={13} /> 기공소 의뢰서(Lab Sheet) 자동 전송</button>
                    </div>
                  ) : <div className="text-center py-10 text-slate-400"><Palette size={28} className="mx-auto mb-2 opacity-40" /><p className="text-xs">판별결과에서 임플란트·결손·잔존치근·우식<br />치아를 선택 후 색상 추천을 요청하세요</p></div>}
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
            <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5 mb-2"><ShieldCheck size={13} /> 시스템 상태 (F-SYS)</span>
            <div className="grid grid-cols-2 gap-2 text-[10px]">{[["보안","AES-256 / TLS 1.3",true],["비식별화","메타데이터 제거",true],["감사 로그","100% 기록",true],["EMR 연동",stage===2?"양방향 활성":"스냅샷 DB",stage===2]].map(([k,v,ok]) => <div key={k} className="flex items-center gap-1.5 bg-slate-50 rounded-md px-2 py-1.5"><span className={`w-1.5 h-1.5 rounded-full ${ok?"bg-green-500":"bg-amber-400"}`} /><span className="text-slate-500">{k}</span><span className="ml-auto text-slate-700 font-medium">{v}</span></div>)}</div>
          </div>
        </div>
      </div>

      <footer className="text-center text-[10px] text-slate-400 py-4">Puzzle Gen Dental v{stage === 1 ? "1.0 (1단계 MVP)" : "2.0 (2단계 SaMD)"} · 기술이전 특허 KR 10-2392312 / US 12,205,689 · PoC 프로토타입 (AI 결과는 시뮬레이션)</footer>
    </div>
  );
}

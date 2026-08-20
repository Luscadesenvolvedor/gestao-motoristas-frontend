import { useState } from "react";
import {
  ComposedChart, Area, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";
import {
  Truck, Package, MapPin, Navigation, Clock, Award, Wallet,
  Bell, ArrowUpRight, ArrowDownRight, TrendingUp, Settings,
  ChevronDown, Fuel, Route, AlertCircle, CheckCircle2, Radio,
} from "lucide-react";
import "../painel.css";

// ─── Data ─────────────────────────────────────────────────────────────────────
const allMonthData = {
  Jan: { faturamento: 312400, diarias: 18, saldo: 74200, folga: 5, bonificacoes: 9800,  meta: 320000, viagens: 142, km: 87400,  entregas: 389, motoristasAtivos: 34 },
  Fev: { faturamento: 289700, diarias: 16, saldo: 62100, folga: 7, bonificacoes: 7200,  meta: 300000, viagens: 128, km: 79200,  entregas: 341, motoristasAtivos: 32 },
  Mar: { faturamento: 358900, diarias: 20, saldo: 89300, folga: 4, bonificacoes: 14500, meta: 340000, viagens: 167, km: 102600, entregas: 451, motoristasAtivos: 37 },
  Abr: { faturamento: 334200, diarias: 19, saldo: 81000, folga: 6, bonificacoes: 11200, meta: 340000, viagens: 154, km: 94800,  entregas: 412, motoristasAtivos: 35 },
  Mai: { faturamento: 371500, diarias: 21, saldo: 93700, folga: 3, bonificacoes: 15800, meta: 360000, viagens: 178, km: 109300, entregas: 487, motoristasAtivos: 38 },
  Jun: { faturamento: 402800, diarias: 22, saldo: 107400, folga: 8, bonificacoes: 19200, meta: 380000, viagens: 191, km: 117500, entregas: 523, motoristasAtivos: 40 },
  Jul: { faturamento: 388100, diarias: 20, saldo: 98200, folga: 6, bonificacoes: 16400, meta: 390000, viagens: 184, km: 113200, entregas: 501, motoristasAtivos: 39 },
  Ago: { faturamento: 431600, diarias: 23, saldo: 118900, folga: 8, bonificacoes: 22300, meta: 410000, viagens: 203, km: 124800, entregas: 558, motoristasAtivos: 41 },
};
const months = Object.keys(allMonthData);
const chartData = months.map((mes) => ({ mes, ...allMonthData[mes] }));

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (v) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0 }).format(v);
const fmtShort = (v) => {
  if (v >= 1_000_000) return `R$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `R$${(v / 1_000).toFixed(0)}k`;
  return `R$${v}`;
};
const fmtKm = (v) => new Intl.NumberFormat("pt-BR").format(v) + " km";
const pct = (curr, prev) => prev === 0 ? 0 : ((curr - prev) / prev) * 100;

// ─── Sub-components ───────────────────────────────────────────────────────────
function StatusDot({ active }) {
  return (
    <span className="relative flex h-2 w-2">
      {active && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#f97316] opacity-60" />}
      <span className={`relative inline-flex rounded-full h-2 w-2 ${active ? "bg-[#f97316]" : "bg-[#7a7d8a]"}`} />
    </span>
  );
}

function Tag({ children, color = "orange" }) {
  const c = {
    orange: "bg-[#f973161a] text-[#f97316] border-[#f9731630]",
    yellow: "bg-[#facc151a] text-[#facc15] border-[#facc1530]",
    blue:   "bg-[#3b82f61a] text-[#3b82f6] border-[#3b82f630]",
    green:  "bg-[#10b9811a] text-[#10b981] border-[#10b98130]",
    red:    "bg-[#ef44441a] text-[#ef4444] border-[#ef444430]",
    gray:   "bg-[#7a7d8a1a] text-[#7a7d8a] border-[#7a7d8a30]",
  }[color];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wider border rounded ${c}`}>
      {children}
    </span>
  );
}

function Delta({ delta }) {
  const pos = delta >= 0;
  return (
    <Tag color={pos ? "green" : "red"}>
      {pos ? <ArrowUpRight className="w-2.5 h-2.5" /> : <ArrowDownRight className="w-2.5 h-2.5" />}
      {Math.abs(delta).toFixed(1)}%
    </Tag>
  );
}

const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded border border-[#f9731620] shadow-2xl p-4" style={{ background: "#111318", minWidth: 210 }}>
      <div className="flex items-center gap-2 mb-3">
        <div className="w-1 h-4 rounded-full bg-[#f97316]" />
        <p className="text-[#7a7d8a] font-mono text-xs uppercase tracking-widest">{label} · 2026</p>
      </div>
      {payload.map((e) => (
        <div key={e.dataKey} className="flex items-center justify-between gap-8 mb-1.5">
          <span className="flex items-center gap-1.5 text-[#7a7d8a] text-xs font-mono">
            <span className="w-2 h-2 rounded-sm inline-block" style={{ background: e.color }} />
            {e.name}
          </span>
          <span className="font-mono font-bold text-[#f0ede8] text-xs">
            {e.dataKey === "viagens" ? `${e.value} viagens` : e.dataKey === "diarias" ? `${e.value} diárias` : fmtShort(e.value)}
          </span>
        </div>
      ))}
    </div>
  );
};

function TruckSilhouette() {
  return (
    <svg viewBox="0 0 120 48" fill="none" className="w-24 h-10 opacity-10">
      <rect x="2" y="14" width="72" height="28" rx="2" fill="#f97316" />
      <rect x="74" y="22" width="34" height="20" rx="2" fill="#f97316" />
      <path d="M74 22 L88 14 L108 14 L108 22 Z" fill="#f97316" />
      <circle cx="20" cy="42" r="5" fill="#0a0b0e" stroke="#f97316" strokeWidth="2" />
      <circle cx="56" cy="42" r="5" fill="#0a0b0e" stroke="#f97316" strokeWidth="2" />
      <circle cx="96" cy="42" r="5" fill="#0a0b0e" stroke="#f97316" strokeWidth="2" />
      <rect x="90" y="24" width="12" height="10" rx="1" fill="#0a0b0e" opacity="0.4" />
    </svg>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function PainelOperacional() {
  const [selectedMonth, setSelectedMonth] = useState("Ago");
  const [chartMode, setChartMode] = useState("faturamento");
  const [dropdown, setDropdown] = useState(false);

  const d = allMonthData[selectedMonth];
  const prevKey = months[months.indexOf(selectedMonth) - 1];
  const p = prevKey ? allMonthData[prevKey] : null;

  const fatDelta  = p ? pct(d.faturamento,  p.faturamento)  : 0;
  const bonDelta  = p ? pct(d.bonificacoes, p.bonificacoes) : 0;
  const saldoDelta = p ? pct(d.saldo,       p.saldo)        : 0;

  const metaPct   = Math.min(100, Math.round((d.faturamento / d.meta) * 100));
  const folgaUsada = 10 - d.folga;
  const ytdIdx    = months.indexOf(selectedMonth) + 1;
  const ytdFat    = months.slice(0, ytdIdx).reduce((a, m) => a + allMonthData[m].faturamento, 0);
  const ytdKm     = months.slice(0, ytdIdx).reduce((a, m) => a + allMonthData[m].km, 0);
  const ytdViagens = months.slice(0, ytdIdx).reduce((a, m) => a + allMonthData[m].viagens, 0);

  return (
    <div
      className="painel-root min-h-screen bg-[#0a0b0e]"
      style={{ fontFamily: "'Barlow', sans-serif" }}
      onClick={() => dropdown && setDropdown(false)}
    >
      {/* Road-stripe accent */}
      <div className="fixed top-0 left-0 right-0 h-1 z-50 flex">
        {Array.from({ length: 40 }).map((_, i) => (
          <div key={i} className={`flex-1 ${i % 2 === 0 ? "bg-[#f97316]" : "bg-transparent"}`} />
        ))}
      </div>
      {/* Diagonal grid texture */}
      <div
        className="fixed inset-0 pointer-events-none opacity-[0.025]"
        style={{ backgroundImage: "repeating-linear-gradient(45deg,#f97316 0px,#f97316 1px,transparent 0px,transparent 50%)", backgroundSize: "28px 28px" }}
      />

      {/* ── Header ── */}
      <header className="sticky top-1 z-40 border-b border-[#2a2d35]" style={{ background: "rgba(10,11,14,0.92)", backdropFilter: "blur(24px)" }}>
        <div className="max-w-[1440px] mx-auto px-6 h-16 flex items-center justify-between gap-4">
          {/* Brand */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-9 h-9 rounded bg-[#f97316] flex items-center justify-center">
              <Truck className="w-5 h-5 text-[#0a0b0e]" strokeWidth={2.5} />
            </div>
            <div>
              <p className="font-black text-[#f0ede8] text-base tracking-tight leading-none" style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 20, letterSpacing: "0.04em" }}>
                TRANSFOLHA
              </p>
              <p className="text-[#f97316] text-[9px] font-mono font-bold uppercase tracking-[0.2em] leading-none mt-0.5">
                Sistema de Gestão
              </p>
            </div>
          </div>
          {/* Nav */}
          <nav className="hidden lg:flex items-center gap-0.5">
            {["Painel", "Frota", "Motoristas", "Rotas", "Relatórios"].map((item, i) => (
              <button key={item} className={`px-4 py-2 text-sm font-semibold transition-all rounded ${i === 0 ? "bg-[#f973161a] text-[#f97316] border border-[#f9731625]" : "text-[#7a7d8a] hover:text-[#f0ede8]"}`}>
                {item}
              </button>
            ))}
          </nav>
          {/* Controls */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded border border-[#f9731625] bg-[#f973160a]">
              <StatusDot active />
              <span className="text-[11px] font-mono font-bold text-[#f97316] uppercase tracking-wider">{d.motoristasAtivos} em rota</span>
            </div>
            <div className="relative">
              <button onClick={(e) => { e.stopPropagation(); setDropdown(!dropdown); }}
                className="flex items-center gap-2 px-3 py-1.5 rounded border border-[#2a2d35] text-sm text-[#7a7d8a] hover:text-[#f0ede8] hover:border-[#f9731640] transition-all">
                <Clock className="w-3.5 h-3.5" />
                <span className="font-mono font-semibold">{selectedMonth}/2026</span>
                <ChevronDown className="w-3 h-3" />
              </button>
              {dropdown && (
                <div className="absolute right-0 top-full mt-2 bg-[#111318] border border-[#2a2d35] rounded shadow-2xl p-2 z-50 grid grid-cols-4 gap-1 w-44" onClick={(e) => e.stopPropagation()}>
                  {months.map((m) => (
                    <button key={m} onClick={() => { setSelectedMonth(m); setDropdown(false); }}
                      className={`px-2 py-1.5 rounded text-xs font-mono font-bold transition-all ${m === selectedMonth ? "bg-[#f97316] text-[#0a0b0e]" : "text-[#7a7d8a] hover:text-[#f0ede8] hover:bg-[#1c1e24]"}`}>
                      {m}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button className="relative p-2 rounded border border-[#2a2d35] text-[#7a7d8a] hover:text-[#f0ede8] transition-all">
              <Bell className="w-4 h-4" />
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-[#f97316]" />
            </button>
            <button className="p-2 rounded border border-[#2a2d35] text-[#7a7d8a] hover:text-[#f0ede8] transition-all">
              <Settings className="w-4 h-4" />
            </button>
            <div className="w-8 h-8 rounded bg-gradient-to-br from-[#f97316] to-[#ea580c] flex items-center justify-center text-xs font-black text-[#0a0b0e]">JR</div>
          </div>
        </div>
      </header>

      {/* ── Main ── */}
      <main className="max-w-[1440px] mx-auto px-6 py-7 relative z-10">
        {/* Title bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-7">
          <div className="flex items-center gap-4">
            <TruckSilhouette />
            <div>
              <h1 className="text-[#f0ede8] font-black leading-none uppercase" style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 28, letterSpacing: "0.05em" }}>
                Painel Operacional
              </h1>
              <p className="text-[#7a7d8a] text-sm font-medium mt-1">
                Competência: <span className="text-[#f97316] font-mono font-bold">{selectedMonth} / 2026</span>
                <span className="mx-2 text-[#2a2d35]">·</span>
                <span className="text-[#f0ede8] font-semibold">{d.motoristasAtivos} motoristas ativos</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 bg-[#161820] p-1 rounded overflow-x-auto">
            {months.map((m) => (
              <button key={m} onClick={() => setSelectedMonth(m)}
                className={`px-3 py-1.5 rounded text-xs font-mono font-bold whitespace-nowrap transition-all ${m === selectedMonth ? "bg-[#f97316] text-[#0a0b0e]" : "text-[#7a7d8a] hover:text-[#f0ede8]"}`}>
                {m}
              </button>
            ))}
          </div>
        </div>

        {/* Live status strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          {[
            { label: "Veículos em Rota",       value: `${d.motoristasAtivos}`, icon: <Radio className="w-3.5 h-3.5" />,       color: "#f97316", live: true  },
            { label: "KM Rodados no Mês",       value: fmtKm(d.km),            icon: <Navigation className="w-3.5 h-3.5" />,  color: "#facc15", live: false },
            { label: "Entregas Realizadas",     value: `${d.entregas}`,        icon: <Package className="w-3.5 h-3.5" />,     color: "#10b981", live: false },
            { label: "Índice de Pontualidade",  value: "96,4%",                icon: <CheckCircle2 className="w-3.5 h-3.5" />,color: "#3b82f6", live: false },
          ].map(({ label, value, icon, color, live }) => (
            <div key={label} className="flex items-center gap-3 px-4 py-3 rounded border border-[#2a2d35] bg-[#111318]">
              <div className="w-8 h-8 rounded flex items-center justify-center shrink-0" style={{ background: `${color}1a`, color }}>
                {icon}
              </div>
              <div className="min-w-0">
                <p className="text-[10px] text-[#7a7d8a] font-semibold uppercase tracking-wider truncate">{label}</p>
                <div className="flex items-center gap-1.5">
                  <p className="font-mono font-bold text-[#f0ede8] text-sm">{value}</p>
                  {live && <StatusDot active />}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4 mb-5">
          {/* FATURAMENTO */}
          <div className="xl:col-span-2 relative rounded border border-[#f9731625] bg-[#111318] overflow-hidden hover:border-[#f9731660] hover:shadow-[0_0_48px_rgba(249,115,22,0.10)] transition-all duration-300">
            <div className="absolute top-0 left-0 w-1 h-full bg-[#f97316]" />
            <div className="absolute top-0 right-0 w-32 h-32 rounded-full bg-[#f97316] opacity-[0.04] -translate-y-1/2 translate-x-1/2" />
            <div className="pl-5 pr-5 pt-5 pb-4">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded bg-[#f973161a] flex items-center justify-center">
                    <Truck style={{ width: 18, height: 18, color: "#f97316" }} strokeWidth={2} />
                  </div>
                  <div>
                    <p className="text-[#7a7d8a] text-[11px] font-bold uppercase tracking-widest">Faturamento</p>
                    <p className="text-[10px] text-[#7a7d8a] font-mono">Fretes · {selectedMonth} 2026</p>
                  </div>
                </div>
                <Delta delta={fatDelta} />
              </div>
              <p className="font-black text-[#f0ede8] leading-none mb-1" style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 36, letterSpacing: "-0.01em" }}>
                {fmt(d.faturamento)}
              </p>
              <div className="flex items-center justify-between mt-3 mb-2">
                <p className="text-[#7a7d8a] text-xs font-medium">
                  Meta: <span className="text-[#f0ede8] font-mono font-bold">{fmt(d.meta)}</span>
                </p>
                <Tag color={metaPct >= 100 ? "green" : "orange"}>{metaPct}% da meta</Tag>
              </div>
              <div className="h-1.5 bg-[#1c1e24] rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-700" style={{ width: `${metaPct}%`, background: metaPct >= 100 ? "#10b981" : "#f97316" }} />
              </div>
            </div>
          </div>

          {/* DIÁRIAS */}
          <div className="relative rounded border border-[#2a2d35] bg-[#111318] overflow-hidden hover:border-[#facc1540] hover:shadow-[0_0_32px_rgba(250,204,21,0.07)] transition-all duration-300">
            <div className="absolute top-0 left-0 w-1 h-full bg-[#facc15]" />
            <div className="pl-5 pr-4 pt-5 pb-4">
              <div className="flex items-start justify-between mb-4">
                <div className="w-9 h-9 rounded bg-[#facc151a] flex items-center justify-center">
                  <Fuel className="w-4 h-4 text-[#facc15]" />
                </div>
                <Tag color="yellow">Diárias</Tag>
              </div>
              <p className="font-black text-[#f0ede8] leading-none mb-1" style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 42 }}>{d.diarias}</p>
              <p className="text-[#7a7d8a] text-xs font-semibold uppercase tracking-wide mb-3">pernoites / viagens longas</p>
              <div className="flex items-center gap-1.5 text-xs text-[#7a7d8a]">
                <MapPin className="w-3.5 h-3.5 text-[#facc15]" />
                <span>{d.viagens} viagens este mês</span>
              </div>
            </div>
          </div>

          {/* SALDO */}
          <div className="relative rounded border border-[#2a2d35] bg-[#111318] overflow-hidden hover:border-[#3b82f640] hover:shadow-[0_0_32px_rgba(59,130,246,0.07)] transition-all duration-300">
            <div className="absolute top-0 left-0 w-1 h-full bg-[#3b82f6]" />
            <div className="pl-5 pr-4 pt-5 pb-4">
              <div className="flex items-start justify-between mb-4">
                <div className="w-9 h-9 rounded bg-[#3b82f61a] flex items-center justify-center">
                  <Wallet className="w-4 h-4 text-[#3b82f6]" />
                </div>
                <Delta delta={saldoDelta} />
              </div>
              <p className="font-black text-[#f0ede8] leading-none mb-1" style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 26 }}>{fmt(d.saldo)}</p>
              <p className="text-[#7a7d8a] text-xs font-semibold uppercase tracking-wide mb-3">saldo / prévia</p>
              <p className="text-xs text-[#3b82f6] font-semibold">Liberação prevista em 5 dias</p>
            </div>
          </div>

          {/* FOLGA */}
          <div className="relative rounded border border-[#2a2d35] bg-[#111318] overflow-hidden hover:border-[#10b98140] hover:shadow-[0_0_32px_rgba(16,185,129,0.07)] transition-all duration-300">
            <div className="absolute top-0 left-0 w-1 h-full bg-[#10b981]" />
            <div className="pl-5 pr-4 pt-5 pb-4">
              <div className="flex items-start justify-between mb-4">
                <div className="w-9 h-9 rounded bg-[#10b9811a] flex items-center justify-center">
                  <Clock className="w-4 h-4 text-[#10b981]" />
                </div>
                <Tag color="green">Folga</Tag>
              </div>
              <p className="font-black text-[#f0ede8] leading-none mb-1" style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 42 }}>{d.folga}</p>
              <p className="text-[#7a7d8a] text-xs font-semibold uppercase tracking-wide mb-3">dias disponíveis</p>
              <div className="flex gap-1">
                {Array.from({ length: 10 }).map((_, i) => (
                  <div key={i} className="h-2 flex-1 rounded-sm" style={{ background: i < folgaUsada ? "#10b981" : "#1c1e24" }} />
                ))}
              </div>
              <p className="text-[10px] text-[#7a7d8a] font-mono mt-1.5">{folgaUsada} usado · {d.folga} restante</p>
            </div>
          </div>

          {/* BONIFICAÇÕES */}
          <div className="xl:col-span-2 relative rounded border border-[#2a2d35] bg-[#111318] overflow-hidden hover:border-[#f9731640] hover:shadow-[0_0_32px_rgba(249,115,22,0.07)] transition-all duration-300">
            <div className="absolute top-0 left-0 w-1 h-full bg-[#f97316]" />
            <div className="pl-5 pr-5 pt-5 pb-4">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded bg-[#f973161a] flex items-center justify-center">
                    <Award className="w-4 h-4 text-[#f97316]" />
                  </div>
                  <div>
                    <p className="text-[#7a7d8a] text-[11px] font-bold uppercase tracking-widest">Bonificações</p>
                    <p className="text-[10px] text-[#7a7d8a] font-mono">Performance · {selectedMonth} 2026</p>
                  </div>
                </div>
                <Delta delta={bonDelta} />
              </div>
              <p className="font-black text-[#f0ede8] leading-none mb-3" style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 34 }}>{fmt(d.bonificacoes)}</p>
              <div className="flex items-center gap-5 flex-wrap">
                <div className="flex items-center gap-1.5 text-xs text-[#7a7d8a]">
                  <TrendingUp className="w-3.5 h-3.5 text-[#10b981]" />
                  <span>Melhor mês: <span className="text-[#f0ede8] font-mono font-bold">{fmt(Math.max(...Object.values(allMonthData).map((v) => v.bonificacoes)))}</span></span>
                </div>
                <div className="w-px h-3 bg-[#2a2d35]" />
                <div className="flex items-center gap-1.5 text-xs text-[#7a7d8a]">
                  <Award className="w-3.5 h-3.5 text-[#f97316]" />
                  <span>Acumulado: <span className="text-[#f0ede8] font-mono font-bold">{fmt(months.slice(0, months.indexOf(selectedMonth) + 1).reduce((a, m) => a + allMonthData[m].bonificacoes, 0))}</span></span>
                </div>
              </div>
            </div>
          </div>

          {/* YTD */}
          <div className="xl:col-span-3 relative rounded border border-[#2a2d35] bg-[#111318] overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-[#facc15]" />
            <div className="pl-5 pr-5 pt-5 pb-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded bg-[#facc151a] flex items-center justify-center">
                    <Route className="w-4 h-4 text-[#facc15]" />
                  </div>
                  <div>
                    <p className="text-[#7a7d8a] text-[11px] font-bold uppercase tracking-widest">Acumulado 2026</p>
                    <p className="text-[10px] text-[#7a7d8a] font-mono">Jan — {selectedMonth}</p>
                  </div>
                </div>
                <Tag color="yellow">YTD</Tag>
              </div>
              <div className="grid grid-cols-3 gap-4">
                {[
                  { label: "Faturamento", value: fmtShort(ytdFat),     color: "#f97316" },
                  { label: "KM Rodados",  value: fmtKm(ytdKm),         color: "#facc15" },
                  { label: "Viagens",     value: `${ytdViagens}`,      color: "#10b981" },
                ].map(({ label, value, color }) => (
                  <div key={label}>
                    <p className="text-[#7a7d8a] text-[10px] font-semibold uppercase tracking-wider mb-1">{label}</p>
                    <p className="font-black leading-none" style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 22, color }}>{value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Chart */}
        <div className="rounded border border-[#2a2d35] bg-[#111318] overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-6 pt-5 pb-4 border-b border-[#2a2d35]">
            <div className="flex items-center gap-3">
              <div className="w-1 h-6 rounded-full bg-[#f97316]" />
              <div>
                <h2 className="text-[#f0ede8] font-black leading-tight uppercase" style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 20, letterSpacing: "0.05em" }}>
                  Evolução Mensal — Jan a Ago 2026
                </h2>
                <p className="text-[#7a7d8a] text-xs font-medium mt-0.5">Faturamento de fretes e bonificações por período</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {["faturamento", "viagens"].map((tab) => (
                <button key={tab} onClick={() => setChartMode(tab)}
                  className={`px-4 py-1.5 rounded text-xs font-bold uppercase tracking-wide transition-all ${chartMode === tab ? "bg-[#f973161a] text-[#f97316] border border-[#f9731630]" : "text-[#7a7d8a] border border-transparent hover:text-[#f0ede8]"}`}>
                  {tab === "faturamento" ? "Faturamento" : "Viagens"}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-6 px-6 py-3 border-b border-[#2a2d35]">
            <div className="flex items-center gap-2">
              <div className="w-4 h-2 rounded bg-[#f97316]" />
              <span className="text-[11px] text-[#7a7d8a] font-semibold uppercase tracking-wide">{chartMode === "faturamento" ? "Faturamento" : "Viagens"}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-2 rounded bg-[#facc15]" />
              <span className="text-[11px] text-[#7a7d8a] font-semibold uppercase tracking-wide">Bonificações</span>
            </div>
            <div className="flex items-center gap-2 ml-auto">
              <AlertCircle className="w-3.5 h-3.5 text-[#7a7d8a]" />
              <span className="text-[11px] text-[#7a7d8a]">Linha pontilhada = Meta mensal</span>
            </div>
          </div>
          <div className="px-4 pt-4 pb-2 h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradOrange" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f97316" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#f97316" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                <XAxis dataKey="mes" tick={{ fill: "#7a7d8a", fontSize: 11, fontFamily: "monospace", fontWeight: 600 }} axisLine={false} tickLine={false} dy={8} />
                <YAxis tick={{ fill: "#7a7d8a", fontSize: 10, fontFamily: "monospace" }} axisLine={false} tickLine={false}
                  tickFormatter={chartMode === "faturamento" ? fmtShort : (v) => `${v}`}
                  width={chartMode === "faturamento" ? 62 : 36} />
                <Tooltip content={<ChartTooltip />} cursor={{ stroke: "rgba(249,115,22,0.08)", strokeWidth: 20, strokeLinecap: "butt" }} />
                <ReferenceLine y={chartMode === "faturamento" ? d.meta : undefined} stroke="#f97316" strokeDasharray="6 4" strokeOpacity={0.35} strokeWidth={1.5} />
                <Area type="monotone" dataKey={chartMode === "faturamento" ? "faturamento" : "viagens"}
                  name={chartMode === "faturamento" ? "Faturamento" : "Viagens"}
                  stroke="#f97316" strokeWidth={2.5} fill="url(#gradOrange)"
                  dot={(props) => {
                    const sel = props.payload.mes === selectedMonth;
                    return <circle key={props.key} cx={props.cx} cy={props.cy} r={sel ? 6 : 3} fill={sel ? "#f97316" : "#0a0b0e"} stroke="#f97316" strokeWidth={sel ? 0 : 2} />;
                  }}
                  activeDot={{ r: 6, fill: "#f97316", stroke: "#0a0b0e", strokeWidth: 2 }}
                />
                <Bar dataKey="bonificacoes" name="Bonificações" fill="#facc15" fillOpacity={0.65} radius={[3, 3, 0, 0]} barSize={14} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-8 gap-0 border-t border-[#2a2d35]">
            {chartData.map((row) => {
              const sel = row.mes === selectedMonth;
              const peak = row.faturamento === Math.max(...chartData.map((r) => r.faturamento));
              return (
                <button key={row.mes} onClick={() => setSelectedMonth(row.mes)}
                  className={`flex flex-col items-center gap-1 py-3 px-2 transition-all border-r border-[#2a2d35] last:border-r-0 ${sel ? "bg-[#f973160d]" : "hover:bg-[#1c1e24]"}`}>
                  <span className={`text-[10px] font-mono font-bold ${sel ? "text-[#f97316]" : "text-[#7a7d8a]"}`}>{row.mes}</span>
                  <span className={`text-[9px] font-mono font-semibold ${sel ? "text-[#f97316]" : "text-[#f0ede8]"}`}>{fmtShort(row.faturamento)}</span>
                  {peak && <span className="text-[8px] font-mono font-black text-[#facc15] uppercase">▲ pico</span>}
                  {sel && <div className="w-4 h-0.5 rounded-full bg-[#f97316] mt-0.5" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-5 flex items-center justify-between text-[10px] text-[#7a7d8a] font-mono">
          <div className="flex items-center gap-2">
            <StatusDot active />
            <span>Sistema online · Atualizado em 20/08/2026 às 07:15</span>
          </div>
          <span>TransFolha Gestão v3.1 · CNPJ 12.345.678/0001-90</span>
        </div>
      </main>

      <style>{`.no-scrollbar::-webkit-scrollbar{display:none}.no-scrollbar{-ms-overflow-style:none;scrollbar-width:none}`}</style>
    </div>
  );
}

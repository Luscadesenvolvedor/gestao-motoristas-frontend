import { useState } from "react";
import {
  ComposedChart, Area, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";
import {
  Truck, Package, Navigation, Clock, Award, Wallet,
  ArrowUpRight, ArrowDownRight, TrendingUp,
  ChevronDown, Fuel, Route, AlertCircle, CheckCircle2, Radio,
} from "lucide-react";
import "../painel.css";

// ─── Dados ────────────────────────────────────────────────────────────────────
const allMonthData = {
  Jan: { faturamento: 312400, diarias: 18, saldo: 74200,  folga: 5, bonificacoes: 9800,  meta: 320000, viagens: 142, km: 87400,  entregas: 389, motoristasAtivos: 34 },
  Fev: { faturamento: 289700, diarias: 16, saldo: 62100,  folga: 7, bonificacoes: 7200,  meta: 300000, viagens: 128, km: 79200,  entregas: 341, motoristasAtivos: 32 },
  Mar: { faturamento: 358900, diarias: 20, saldo: 89300,  folga: 4, bonificacoes: 14500, meta: 340000, viagens: 167, km: 102600, entregas: 451, motoristasAtivos: 37 },
  Abr: { faturamento: 334200, diarias: 19, saldo: 81000,  folga: 6, bonificacoes: 11200, meta: 340000, viagens: 154, km: 94800,  entregas: 412, motoristasAtivos: 35 },
  Mai: { faturamento: 371500, diarias: 21, saldo: 93700,  folga: 3, bonificacoes: 15800, meta: 360000, viagens: 178, km: 109300, entregas: 487, motoristasAtivos: 38 },
  Jun: { faturamento: 402800, diarias: 22, saldo: 107400, folga: 8, bonificacoes: 19200, meta: 380000, viagens: 191, km: 117500, entregas: 523, motoristasAtivos: 40 },
  Jul: { faturamento: 388100, diarias: 20, saldo: 98200,  folga: 6, bonificacoes: 16400, meta: 390000, viagens: 184, km: 113200, entregas: 501, motoristasAtivos: 39 },
  Ago: { faturamento: 431600, diarias: 23, saldo: 118900, folga: 8, bonificacoes: 22300, meta: 410000, viagens: 203, km: 124800, entregas: 558, motoristasAtivos: 41 },
};
const months = Object.keys(allMonthData);
const chartData = months.map((mes) => ({ mes, ...allMonthData[mes] }));

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt     = (v) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0 }).format(v);
const fmtShort = (v) => {
  if (v >= 1_000_000) return `R$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000)     return `R$${(v / 1_000).toFixed(0)}k`;
  return `R$${v}`;
};
const fmtKm  = (v) => new Intl.NumberFormat("pt-BR").format(v) + " km";
const pct    = (curr, prev) => prev === 0 ? 0 : ((curr - prev) / prev) * 100;

// ─── Sub-componentes ──────────────────────────────────────────────────────────
function StatusDot({ active }) {
  return (
    <span style={{ position: "relative", display: "inline-flex", width: 8, height: 8 }}>
      {active && (
        <span style={{
          position: "absolute", inset: 0, borderRadius: "50%",
          background: "#f97316", opacity: 0.5,
          animation: "ping 1.2s cubic-bezier(0,0,0.2,1) infinite",
        }} />
      )}
      <span style={{
        position: "relative", display: "inline-flex", borderRadius: "50%",
        width: 8, height: 8,
        background: active ? "#f97316" : "#7a7d8a",
      }} />
    </span>
  );
}

function Tag({ children, color = "orange" }) {
  const palettes = {
    orange: { bg: "#f973161a", color: "#f97316", border: "#f9731630" },
    yellow: { bg: "#facc151a", color: "#facc15", border: "#facc1530" },
    blue:   { bg: "#3b82f61a", color: "#3b82f6", border: "#3b82f630" },
    green:  { bg: "#10b9811a", color: "#10b981", border: "#10b98130" },
    red:    { bg: "#ef44441a", color: "#ef4444", border: "#ef444430" },
    gray:   { bg: "#7a7d8a1a", color: "#7a7d8a", border: "#7a7d8a30" },
  };
  const p = palettes[color] || palettes.orange;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 3,
      padding: "2px 8px", fontSize: 10, fontWeight: 700,
      fontFamily: "monospace", textTransform: "uppercase", letterSpacing: "0.08em",
      background: p.bg, color: p.color,
      border: `1px solid ${p.border}`, borderRadius: 4,
    }}>
      {children}
    </span>
  );
}

function Delta({ delta }) {
  const pos = delta >= 0;
  return (
    <Tag color={pos ? "green" : "red"}>
      {pos
        ? <ArrowUpRight style={{ width: 10, height: 10 }} />
        : <ArrowDownRight style={{ width: 10, height: 10 }} />
      }
      {Math.abs(delta).toFixed(1)}%
    </Tag>
  );
}

const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: "#111318", border: "1px solid #f9731620",
      borderRadius: 8, padding: "12px 16px", minWidth: 180,
      boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <div style={{ width: 3, height: 14, borderRadius: 2, background: "#f97316" }} />
        <p style={{ color: "#7a7d8a", fontFamily: "monospace", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.1em" }}>
          {label} · 2026
        </p>
      </div>
      {payload.map((e) => (
        <div key={e.dataKey} style={{ display: "flex", justifyContent: "space-between", gap: 24, marginBottom: 4, alignItems: "center" }}>
          <span style={{ display: "flex", alignItems: "center", gap: 6, color: "#7a7d8a", fontSize: 11, fontFamily: "monospace" }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: e.color, display: "inline-block" }} />
            {e.name}
          </span>
          <span style={{ fontFamily: "monospace", fontWeight: 700, color: "#f0ede8", fontSize: 12 }}>
            {e.dataKey === "viagens" ? `${e.value}` : fmtShort(e.value)}
          </span>
        </div>
      ))}
    </div>
  );
};

// ─── Card escuro base ─────────────────────────────────────────────────────────
function DCard({ accentColor, children, style = {} }) {
  return (
    <div style={{
      position: "relative", borderRadius: 10, overflow: "hidden",
      background: "#111318", border: "1px solid #2a2d35",
      transition: "border-color 0.2s",
      ...style,
    }}>
      <div style={{ position: "absolute", top: 0, left: 0, width: 3, height: "100%", background: accentColor, borderRadius: "10px 0 0 10px" }} />
      <div style={{ paddingLeft: 18, paddingRight: 18, paddingTop: 18, paddingBottom: 16 }}>
        {children}
      </div>
    </div>
  );
}

// ─── Página Principal ─────────────────────────────────────────────────────────
export default function PainelOperacional() {
  const [selectedMonth, setSelectedMonth] = useState("Ago");
  const [chartMode, setChartMode] = useState("faturamento");
  const [dropdown, setDropdown] = useState(false);

  const d    = allMonthData[selectedMonth];
  const prev = months[months.indexOf(selectedMonth) - 1];
  const p    = prev ? allMonthData[prev] : null;

  const fatDelta  = p ? pct(d.faturamento,  p.faturamento)  : 0;
  const bonDelta  = p ? pct(d.bonificacoes, p.bonificacoes) : 0;
  const saldoDelta = p ? pct(d.saldo,       p.saldo)        : 0;

  const metaPct    = Math.min(100, Math.round((d.faturamento / d.meta) * 100));
  const folgaUsada = 10 - d.folga;

  const ytdIdx    = months.indexOf(selectedMonth) + 1;
  const ytdFat    = months.slice(0, ytdIdx).reduce((a, m) => a + allMonthData[m].faturamento, 0);
  const ytdKm     = months.slice(0, ytdIdx).reduce((a, m) => a + allMonthData[m].km, 0);
  const ytdViagens = months.slice(0, ytdIdx).reduce((a, m) => a + allMonthData[m].viagens, 0);
  const ytdBon    = months.slice(0, ytdIdx).reduce((a, m) => a + allMonthData[m].bonificacoes, 0);

  return (
    <div className="painel-root" onClick={() => dropdown && setDropdown(false)}
      style={{ fontFamily: "'Barlow', 'Inter', sans-serif" }}>

      <style>{`
        @keyframes ping { 75%,100%{transform:scale(2);opacity:0} }
        .painel-card:hover { border-color: #f9731640 !important; }
      `}</style>

      {/* ── Cabeçalho da página ── */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        flexWrap: "wrap", gap: 12, marginBottom: 20,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 8, background: "#f97316",
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}>
            <Truck style={{ width: 20, height: 20, color: "#0a0b0e" }} strokeWidth={2.5} />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: "#1f2937", letterSpacing: "0.01em" }}>
              Painel Operacional
            </h1>
            <p style={{ margin: 0, fontSize: 12, color: "#6b7280" }}>
              Competência: <strong style={{ color: "#f97316" }}>{selectedMonth}/2026</strong>
              &nbsp;·&nbsp;{d.motoristasAtivos} motoristas ativos
            </p>
          </div>
        </div>

        {/* Seletor de mês */}
        <div style={{ position: "relative" }}>
          <button
            onClick={(e) => { e.stopPropagation(); setDropdown(!dropdown); }}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "7px 12px", borderRadius: 8,
              border: "1px solid #e5e7eb", background: "#fff",
              fontSize: 13, fontWeight: 600, color: "#374151",
              cursor: "pointer", fontFamily: "monospace",
            }}>
            <Clock style={{ width: 14, height: 14 }} />
            {selectedMonth}/2026
            <ChevronDown style={{ width: 12, height: 12 }} />
          </button>
          {dropdown && (
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                position: "absolute", right: 0, top: "calc(100% + 6px)",
                background: "#fff", border: "1px solid #e5e7eb",
                borderRadius: 8, boxShadow: "0 4px 24px rgba(0,0,0,0.12)",
                display: "grid", gridTemplateColumns: "repeat(4, 1fr)",
                gap: 4, padding: 8, zIndex: 50, width: 176,
              }}>
              {months.map((m) => (
                <button key={m}
                  onClick={() => { setSelectedMonth(m); setDropdown(false); }}
                  style={{
                    padding: "6px 4px", borderRadius: 6, border: "none",
                    fontFamily: "monospace", fontSize: 12, fontWeight: 700,
                    cursor: "pointer",
                    background: m === selectedMonth ? "#f97316" : "transparent",
                    color: m === selectedMonth ? "#fff" : "#6b7280",
                  }}>
                  {m}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Status strip ── */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
        gap: 12, marginBottom: 16,
      }}>
        {[
          { label: "Veículos em Rota",     value: `${d.motoristasAtivos}`,  icon: <Radio style={{ width: 15, height: 15 }} />,        color: "#f97316", live: true  },
          { label: "KM Rodados no Mês",    value: fmtKm(d.km),             icon: <Navigation style={{ width: 15, height: 15 }} />,   color: "#facc15", live: false },
          { label: "Entregas Realizadas",  value: `${d.entregas}`,         icon: <Package style={{ width: 15, height: 15 }} />,      color: "#10b981", live: false },
          { label: "Pontualidade",         value: "96,4%",                  icon: <CheckCircle2 style={{ width: 15, height: 15 }} />, color: "#3b82f6", live: false },
        ].map(({ label, value, icon, color, live }) => (
          <div key={label} style={{
            display: "flex", alignItems: "center", gap: 12,
            padding: "12px 16px", borderRadius: 10,
            background: "#111318", border: "1px solid #2a2d35",
          }}>
            <div style={{
              width: 34, height: 34, borderRadius: 8, flexShrink: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
              background: `${color}1a`, color,
            }}>
              {icon}
            </div>
            <div style={{ minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 10, color: "#7a7d8a", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</p>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <p style={{ margin: 0, fontFamily: "monospace", fontWeight: 700, color: "#f0ede8", fontSize: 14 }}>{value}</p>
                {live && <StatusDot active />}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Cards KPI principais ── */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
        gap: 12, marginBottom: 16,
      }}>
        {/* Faturamento */}
        <DCard accentColor="#f97316" style={{ gridColumn: "span 2", minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: "#f973161a", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Truck style={{ width: 18, height: 18, color: "#f97316" }} strokeWidth={2} />
              </div>
              <div>
                <p style={{ margin: 0, color: "#7a7d8a", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em" }}>Faturamento</p>
                <p style={{ margin: 0, color: "#7a7d8a", fontSize: 10, fontFamily: "monospace" }}>Fretes · {selectedMonth} 2026</p>
              </div>
            </div>
            <Delta delta={fatDelta} />
          </div>
          <p style={{ margin: "0 0 10px", fontWeight: 900, color: "#f0ede8", fontSize: 32, fontFamily: "'Barlow Condensed','Barlow','Inter',sans-serif", letterSpacing: "-0.01em", lineHeight: 1 }}>
            {fmt(d.faturamento)}
          </p>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
            <p style={{ margin: 0, color: "#7a7d8a", fontSize: 11 }}>
              Meta: <span style={{ color: "#f0ede8", fontFamily: "monospace", fontWeight: 700 }}>{fmt(d.meta)}</span>
            </p>
            <Tag color={metaPct >= 100 ? "green" : "orange"}>{metaPct}% da meta</Tag>
          </div>
          <div style={{ height: 6, background: "#1c1e24", borderRadius: 3, overflow: "hidden" }}>
            <div style={{ height: "100%", borderRadius: 3, transition: "width 0.6s", width: `${metaPct}%`, background: metaPct >= 100 ? "#10b981" : "#f97316" }} />
          </div>
        </DCard>

        {/* Diárias */}
        <DCard accentColor="#facc15">
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: "#facc151a", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Fuel style={{ width: 16, height: 16, color: "#facc15" }} />
            </div>
            <Tag color="yellow">Diárias</Tag>
          </div>
          <p style={{ margin: "0 0 4px", fontWeight: 900, color: "#f0ede8", fontSize: 38, fontFamily: "'Barlow Condensed','Barlow','Inter',sans-serif", lineHeight: 1 }}>{d.diarias}</p>
          <p style={{ margin: "0 0 10px", color: "#7a7d8a", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>pernoites / longas</p>
          <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "#7a7d8a" }}>
            <Navigation style={{ width: 12, height: 12, color: "#facc15" }} />
            {d.viagens} viagens este mês
          </div>
        </DCard>

        {/* Saldo */}
        <DCard accentColor="#3b82f6">
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: "#3b82f61a", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Wallet style={{ width: 16, height: 16, color: "#3b82f6" }} />
            </div>
            <Delta delta={saldoDelta} />
          </div>
          <p style={{ margin: "0 0 4px", fontWeight: 900, color: "#f0ede8", fontSize: 22, fontFamily: "'Barlow Condensed','Barlow','Inter',sans-serif", lineHeight: 1 }}>{fmt(d.saldo)}</p>
          <p style={{ margin: "0 0 10px", color: "#7a7d8a", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>saldo / prévia</p>
          <p style={{ margin: 0, fontSize: 11, color: "#3b82f6", fontWeight: 600 }}>Liberação prevista em 5 dias</p>
        </DCard>

        {/* Folga */}
        <DCard accentColor="#10b981">
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: "#10b9811a", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Clock style={{ width: 16, height: 16, color: "#10b981" }} />
            </div>
            <Tag color="green">Folga</Tag>
          </div>
          <p style={{ margin: "0 0 4px", fontWeight: 900, color: "#f0ede8", fontSize: 38, fontFamily: "'Barlow Condensed','Barlow','Inter',sans-serif", lineHeight: 1 }}>{d.folga}</p>
          <p style={{ margin: "0 0 10px", color: "#7a7d8a", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>dias disponíveis</p>
          <div style={{ display: "flex", gap: 4, marginBottom: 4 }}>
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} style={{ height: 6, flex: 1, borderRadius: 3, background: i < folgaUsada ? "#10b981" : "#1c1e24" }} />
            ))}
          </div>
          <p style={{ margin: 0, fontSize: 10, color: "#7a7d8a", fontFamily: "monospace" }}>{folgaUsada} usado · {d.folga} restante</p>
        </DCard>
      </div>

      {/* ── Cards secundários: Bonificações + YTD ── */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
        gap: 12, marginBottom: 16,
      }}>
        {/* Bonificações */}
        <DCard accentColor="#f97316">
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: "#f973161a", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Award style={{ width: 16, height: 16, color: "#f97316" }} />
              </div>
              <div>
                <p style={{ margin: 0, color: "#7a7d8a", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em" }}>Bonificações</p>
                <p style={{ margin: 0, color: "#7a7d8a", fontSize: 10, fontFamily: "monospace" }}>Performance · {selectedMonth} 2026</p>
              </div>
            </div>
            <Delta delta={bonDelta} />
          </div>
          <p style={{ margin: "0 0 12px", fontWeight: 900, color: "#f0ede8", fontSize: 26, fontFamily: "'Barlow Condensed','Barlow','Inter',sans-serif", lineHeight: 1 }}>{fmt(d.bonificacoes)}</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, fontSize: 11, color: "#7a7d8a" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <TrendingUp style={{ width: 12, height: 12, color: "#10b981" }} />
              Melhor: <span style={{ color: "#f0ede8", fontFamily: "monospace", fontWeight: 700, marginLeft: 3 }}>{fmt(Math.max(...Object.values(allMonthData).map(v => v.bonificacoes)))}</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <Award style={{ width: 12, height: 12, color: "#f97316" }} />
              Acum.: <span style={{ color: "#f0ede8", fontFamily: "monospace", fontWeight: 700, marginLeft: 3 }}>{fmt(ytdBon)}</span>
            </div>
          </div>
        </DCard>

        {/* YTD */}
        <DCard accentColor="#facc15">
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: "#facc151a", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Route style={{ width: 16, height: 16, color: "#facc15" }} />
              </div>
              <div>
                <p style={{ margin: 0, color: "#7a7d8a", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em" }}>Acumulado 2026</p>
                <p style={{ margin: 0, color: "#7a7d8a", fontSize: 10, fontFamily: "monospace" }}>Jan — {selectedMonth}</p>
              </div>
            </div>
            <Tag color="yellow">YTD</Tag>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
            {[
              { label: "Faturamento", value: fmtShort(ytdFat),  color: "#f97316" },
              { label: "KM Rodados",  value: fmtKm(ytdKm),      color: "#facc15" },
              { label: "Viagens",     value: `${ytdViagens}`,   color: "#10b981" },
            ].map(({ label, value, color }) => (
              <div key={label}>
                <p style={{ margin: "0 0 2px", color: "#7a7d8a", fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</p>
                <p style={{ margin: 0, fontWeight: 900, fontSize: 18, fontFamily: "'Barlow Condensed','Barlow','Inter',sans-serif", color }}>{value}</p>
              </div>
            ))}
          </div>
        </DCard>
      </div>

      {/* ── Gráfico ── */}
      <div style={{ borderRadius: 10, background: "#111318", border: "1px solid #2a2d35", overflow: "hidden" }}>
        {/* Header do gráfico */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          flexWrap: "wrap", gap: 10,
          padding: "16px 20px", borderBottom: "1px solid #2a2d35",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 3, height: 20, borderRadius: 2, background: "#f97316" }} />
            <div>
              <h2 style={{ margin: 0, color: "#f0ede8", fontWeight: 800, fontSize: 15, letterSpacing: "0.03em", textTransform: "uppercase", fontFamily: "'Barlow Condensed','Barlow','Inter',sans-serif" }}>
                Evolução Mensal — Jan a Ago 2026
              </h2>
              <p style={{ margin: 0, color: "#7a7d8a", fontSize: 11, marginTop: 2 }}>Faturamento e bonificações por período</p>
            </div>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            {[["faturamento", "Faturamento"], ["viagens", "Viagens"]].map(([tab, label]) => (
              <button key={tab}
                onClick={() => setChartMode(tab)}
                style={{
                  padding: "5px 12px", borderRadius: 6, fontSize: 12, fontWeight: 700,
                  textTransform: "uppercase", letterSpacing: "0.05em", cursor: "pointer",
                  background: chartMode === tab ? "#f973161a" : "transparent",
                  color: chartMode === tab ? "#f97316" : "#7a7d8a",
                  border: `1px solid ${chartMode === tab ? "#f9731630" : "transparent"}`,
                  transition: "all 0.15s",
                }}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Legenda */}
        <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap", padding: "10px 20px", borderBottom: "1px solid #2a2d35" }}>
          {[
            { color: "#f97316", label: chartMode === "faturamento" ? "Faturamento" : "Viagens" },
            { color: "#facc15", label: "Bonificações" },
          ].map(({ color, label }) => (
            <div key={label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 14, height: 6, borderRadius: 3, background: color }} />
              <span style={{ fontSize: 11, color: "#7a7d8a", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</span>
            </div>
          ))}
          <div style={{ display: "flex", alignItems: "center", gap: 5, marginLeft: "auto" }}>
            <AlertCircle style={{ width: 12, height: 12, color: "#7a7d8a" }} />
            <span style={{ fontSize: 11, color: "#7a7d8a" }}>Pontilhado = meta mensal</span>
          </div>
        </div>

        {/* Área do gráfico */}
        <div style={{ padding: "12px 8px 4px", height: 280 }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="gradOrange" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f97316" stopOpacity={0.28} />
                  <stop offset="100%" stopColor="#f97316" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
              <XAxis dataKey="mes" tick={{ fill: "#7a7d8a", fontSize: 11, fontFamily: "monospace", fontWeight: 600 }} axisLine={false} tickLine={false} dy={8} />
              <YAxis tick={{ fill: "#7a7d8a", fontSize: 10, fontFamily: "monospace" }} axisLine={false} tickLine={false}
                tickFormatter={chartMode === "faturamento" ? fmtShort : (v) => `${v}`}
                width={chartMode === "faturamento" ? 58 : 32} />
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
              <Bar dataKey="bonificacoes" name="Bonificações" fill="#facc15" fillOpacity={0.6} radius={[3, 3, 0, 0]} barSize={12} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Mini nav meses */}
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${months.length}, 1fr)`, borderTop: "1px solid #2a2d35" }}>
          {chartData.map((row) => {
            const sel = row.mes === selectedMonth;
            const peak = row.faturamento === Math.max(...chartData.map(r => r.faturamento));
            return (
              <button key={row.mes}
                onClick={() => setSelectedMonth(row.mes)}
                style={{
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
                  padding: "10px 4px", cursor: "pointer",
                  background: sel ? "#f973160d" : "transparent",
                  border: "none", borderRight: "1px solid #2a2d35",
                  transition: "background 0.15s",
                }}>
                <span style={{ fontSize: 10, fontFamily: "monospace", fontWeight: 700, color: sel ? "#f97316" : "#7a7d8a" }}>{row.mes}</span>
                <span style={{ fontSize: 9, fontFamily: "monospace", fontWeight: 600, color: sel ? "#f97316" : "#f0ede8" }}>{fmtShort(row.faturamento)}</span>
                {peak && <span style={{ fontSize: 8, fontWeight: 800, color: "#facc15", textTransform: "uppercase", fontFamily: "monospace" }}>▲ pico</span>}
                {sel && <div style={{ width: 14, height: 2, borderRadius: 1, background: "#f97316" }} />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Rodapé */}
      <div style={{ marginTop: 14, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <StatusDot active />
          <span style={{ fontSize: 10, color: "#9ca3af", fontFamily: "monospace" }}>Sistema online · Atualizado em 20/08/2026 às 07:15</span>
        </div>
        <span style={{ fontSize: 10, color: "#9ca3af", fontFamily: "monospace" }}>Gestão de Motoristas v3.1</span>
      </div>
    </div>
  );
}

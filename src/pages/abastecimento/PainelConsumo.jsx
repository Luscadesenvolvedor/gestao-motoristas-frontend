import { useState, useEffect, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Cell
} from 'recharts';
import api from '../../services/api';

/* ─── paleta dark neon ─── */
const C = {
  bg:        '#05070d',
  surface:   '#0b0f1c',
  surface2:  '#111729',
  surface3:  '#182036',
  text1:     '#eef3fb',
  text2:     '#9aacc9',
  text3:     '#63718c',
  border:    'rgba(56,189,248,0.20)',
  borderStr: 'rgba(56,189,248,0.42)',
  accent:    '#22d3ee',
  accent2:   '#38bdf8',
  good:      '#34d399',
  warn:      '#fbbf24',
  crit:      '#f87171',
  red:       '#EB3238',
};

const fmtKm   = v => Number(v||0).toLocaleString('pt-BR', { maximumFractionDigits:0 }) + ' km';
const fmtLit  = v => Number(v||0).toLocaleString('pt-BR', { maximumFractionDigits:0 }) + ' L';
const fmtR$   = v => 'R$ ' + Number(v||0).toLocaleString('pt-BR', { minimumFractionDigits:2 });
const fmtMedia= v => Number(v||0).toLocaleString('pt-BR', { minimumFractionDigits:2 }) + ' km/L';
const fmtMes  = s => { if (!s) return ''; const [a,m]=s.split('-'); return new Date(+a,+m-1,1).toLocaleDateString('pt-BR',{month:'short',year:'2-digit'}); };

/* ─── gauge SVG ─── */
const MAX_KML = 6;
function Gauge({ value = 0 }) {
  const clamp = Math.min(Math.max(value, 0), MAX_KML);
  const angle = -90 + (clamp / MAX_KML) * 180;
  const color = clamp >= 3 ? C.accent : clamp >= 1.8 ? C.warn : C.crit;
  const label = clamp >= 3 ? 'Excelente' : clamp >= 1.8 ? 'Regular' : 'Crítico';
  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:6, width:'100%' }}>
      <svg viewBox="0 0 280 150" style={{ width:'100%', maxWidth:280, overflow:'visible' }}>
        {/* trilha base */}
        <path fill="none" stroke={C.surface3} strokeWidth="15"
          d="M 48 130 A 92 92 0 0 1 232 130" />
        {/* banda crítica */}
        <path fill="none" stroke={C.crit} strokeWidth="15" strokeLinecap="round"
          d="M 48.01 128.39 A 92 92 0 0 1 73.82 66.09" />
        {/* banda regular */}
        <path fill="none" stroke={C.warn} strokeWidth="15" strokeLinecap="round"
          d="M 76.09 63.82 A 92 92 0 0 1 114.64 41.56" />
        {/* banda boa */}
        <path fill="none" stroke={C.accent} strokeWidth="15" strokeLinecap="round"
          style={{ filter:`drop-shadow(0 0 5px ${C.accent})` }}
          d="M 117.74 40.73 A 92 92 0 0 1 231.99 128.39" />
        {/* ticks */}
        {[
          [37,130,30,130,'0'], [50.8,78.5,44.7,75,'1'],
          [88.5,40.8,85,34.7,'2'], [140,27,140,20,'3'],
          [191.5,40.8,195,34.7,'4'], [229.2,78.5,235.3,75,'5'], [243,130,250,130,'6'],
        ].map(([x1,y1,x2,y2,lbl], i) => (
          <g key={i}>
            <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={C.text3} strokeWidth="1.4" strokeLinecap="round" />
            <text x={x2 + (x2>140?8:x2<140?-8:0)} y={y2 + (y2<80?-4:6)}
              fill={C.text3} fontSize="10.5" textAnchor="middle" dominantBaseline="middle"
              fontFamily="monospace">{lbl}</text>
          </g>
        ))}
        {/* agulha */}
        <g style={{ transformBox:'view-box', transformOrigin:'140px 130px', transform:`rotate(${angle}deg)`,
          filter:'drop-shadow(0 1px 3px rgba(0,0,0,0.5))',
          transition:'transform 0.9s cubic-bezier(.2,.8,.2,1)' }}>
          <polygon points="140,52 135.5,144 144.5,144" fill="#ffffff" />
        </g>
        <circle cx="140" cy="130" r="9" fill="#ffffff" stroke={C.surface} strokeWidth="3" />
      </svg>
      <div style={{ textAlign:'center', marginTop:-8 }}>
        <div style={{ fontFamily:'monospace', fontWeight:700, fontSize:32, color, letterSpacing:'-0.02em', lineHeight:1 }}>
          {Number(value||0).toLocaleString('pt-BR',{minimumFractionDigits:1})}<span style={{ fontSize:16, color:C.text3, fontWeight:500 }}>/6,0</span>
        </div>
        <div style={{ fontSize:13, fontWeight:700, letterSpacing:'0.03em', color, textTransform:'uppercase', marginTop:4 }}>{label}</div>
      </div>
    </div>
  );
}

/* ─── card escuro ─── */
function Card({ children, style }) {
  return (
    <div style={{
      background: `linear-gradient(180deg, ${C.surface2}, ${C.surface})`,
      border: `1px solid ${C.border}`,
      borderRadius: 16,
      ...style,
    }}>{children}</div>
  );
}

/* ─── chip de info ─── */
function InfoChip({ icon, label, value }) {
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:10,
      background:C.surface2, border:`1px solid ${C.border}`, borderRadius:12, padding:'10px 14px' }}>
      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
        <div style={{ width:30, height:30, borderRadius:9, flexShrink:0,
          background:'rgba(34,211,238,0.12)', border:'1px solid rgba(34,211,238,0.3)',
          display:'flex', alignItems:'center', justifyContent:'center', color:C.accent, fontSize:14 }}>
          <i className={`ti ${icon}`}></i>
        </div>
        <span style={{ fontSize:11, color:C.text3, letterSpacing:'0.03em' }}>{label}</span>
      </div>
      <span style={{ fontFamily:'monospace', fontWeight:600, color:C.accent, fontSize:15 }}>{value}</span>
    </div>
  );
}

/* ─── metric card ─── */
function MetricCard({ label, value, delta, deltaLabel, iconCls, iconColor }) {
  const up = delta >= 0;
  return (
    <Card style={{ padding:'18px 18px 16px' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:10 }}>
        <span style={{ color:C.text2, fontSize:13 }}>{label}</span>
        <div style={{ width:32, height:32, borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
          background: iconColor+'22', border:`1px solid ${iconColor}55`, color:iconColor, fontSize:15 }}>
          <i className={`ti ${iconCls}`}></i>
        </div>
      </div>
      <div style={{ marginTop:12, fontFamily:'monospace', fontWeight:700, fontSize:28, letterSpacing:'-0.01em', color:C.text1 }}>{value}</div>
      {delta !== undefined && (
        <div style={{ marginTop:8, display:'flex', alignItems:'center', gap:6, fontSize:13 }}>
          <span style={{ fontFamily:'monospace', fontWeight:700, color: up ? C.good : C.crit }}>
            {up ? '▲' : '▼'}
          </span>
          <strong style={{ color: up ? C.good : C.crit }}>{Math.abs(delta).toLocaleString('pt-BR',{minimumFractionDigits:1})}%</strong>
          <span style={{ color:C.text3 }}>{deltaLabel}</span>
        </div>
      )}
    </Card>
  );
}

/* ─── tooltip recharts ─── */
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background:C.surface3, border:`1px solid ${C.borderStr}`, borderRadius:8,
      padding:'8px 12px', fontSize:12, color:C.text1 }}>
      <div style={{ color:C.text3, marginBottom:4 }}>{fmtMes(label)}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ fontFamily:'monospace', color:C.accent }}>
          {p.name === 'mediaReal' ? fmtMedia(p.value) : fmtKm(p.value)}
        </div>
      ))}
    </div>
  );
};

/* ─── SVG caminhão baú ─── */
function TruckSVG() {
  return (
    <svg viewBox="0 0 600 300" style={{ width:'100%', maxWidth:520, height:'auto' }}>
      <defs>
        <linearGradient id="pg-bodyGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f1f5f9" /><stop offset="1" stopColor="#b9c3d1" />
        </linearGradient>
        <linearGradient id="pg-cabGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#e7ecf3" /><stop offset="1" stopColor="#a8b3c4" />
        </linearGradient>
        <radialGradient id="pg-wheelHub" cx="0.35" cy="0.35" r="0.75">
          <stop offset="0" stopColor="#94a3b8" /><stop offset="1" stopColor="#334155" />
        </radialGradient>
        <radialGradient id="pg-shadowGrad" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="rgba(0,0,0,0.45)" /><stop offset="1" stopColor="rgba(0,0,0,0)" />
        </radialGradient>
      </defs>
      <ellipse cx="320" cy="256" rx="250" ry="16" fill="url(#pg-shadowGrad)" />
      <rect x="70" y="222" width="470" height="8" rx="3" fill="#1e293b" />
      <rect x="228" y="82" width="300" height="146" rx="10" fill="url(#pg-bodyGrad)" stroke="#7d8aa0" strokeWidth="1.5" />
      <line x1="228" y1="118" x2="528" y2="118" stroke="#7d8aa0" strokeWidth="1" opacity="0.6" />
      <line x1="330" y1="90" x2="330" y2="228" stroke="#7d8aa0" strokeWidth="1" opacity="0.45" />
      <line x1="430" y1="90" x2="430" y2="228" stroke="#7d8aa0" strokeWidth="1" opacity="0.45" />
      <rect x="242" y="96" width="58" height="16" rx="3" fill="#22d3ee" opacity="0.85" />
      <rect x="228" y="200" width="300" height="10" fill="#0f172a" opacity="0.12" />
      <path d="M100 228 V148 Q100 128 120 124 L206 110 Q222 107 232 122 L232 228 Z" fill="url(#pg-cabGrad)" stroke="#7d8aa0" strokeWidth="1.5" />
      <path d="M124 150 L152 128 Q160 122 170 122 L200 122 Q206 122 206 130 L206 150 Q206 156 200 156 L130 156 Q124 156 124 150 Z" fill="#7dd3fc" opacity="0.55" stroke="#5eb8de" strokeWidth="1" />
      <rect x="100" y="185" width="16" height="30" rx="3" fill="#94a3b8" opacity="0.7" />
      <circle cx="222" cy="196" r="8" fill="#fbbf24" opacity="0.9" />
      <rect x="204" y="172" width="26" height="8" rx="2" fill="#64748b" opacity="0.7" />
      <rect x="86" y="132" width="16" height="10" rx="3" fill="#cbd5e1" stroke="#7d8aa0" strokeWidth="1" />
      {[150, 410, 468].map(cx => (
        <g key={cx}>
          <circle cx={cx} cy="232" r="30" fill="#0f172a" />
          <circle cx={cx} cy="232" r="15" fill="url(#pg-wheelHub)" />
          <circle cx={cx} cy="232" r="4" fill="#22d3ee" />
        </g>
      ))}
    </svg>
  );
}

/* ════════════════════════════════════════════
   COMPONENTE PRINCIPAL
═══════════════════════════════════════════ */
export default function PainelConsumo() {
  const [motoristas, setMotoristas] = useState([]);
  const [sel, setSel]               = useState(null);
  const [busca, setBusca]           = useState('');
  const [mensal, setMensal]         = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [carregandoMes, setCarregandoMes] = useState(false);
  const [mostrarTabela, setMostrarTabela] = useState(false);
  const [frotaFiltro, setFrotaFiltro]     = useState('');

  useEffect(() => {
    api.get('/medias-consumo/painel-motoristas')
      .then(r => { setMotoristas(r.data); if (r.data.length) setSel(r.data[0]); })
      .catch(() => {})
      .finally(() => setCarregando(false));
  }, []);

  useEffect(() => {
    if (!sel) return;
    setCarregandoMes(true);
    api.get('/medias-consumo/resumo-mensal', { params: { motorista: sel.motorista } })
      .then(r => setMensal(r.data))
      .catch(() => setMensal([]))
      .finally(() => setCarregandoMes(false));
  }, [sel]);

  const lista = useMemo(() => {
    let l = motoristas;
    if (frotaFiltro) l = l.filter(m => m.frota === frotaFiltro);
    if (busca.trim()) {
      const q = busca.toLowerCase();
      l = l.filter(m => m.motorista.toLowerCase().includes(q));
    }
    return l;
  }, [motoristas, busca, frotaFiltro]);

  const frotas = useMemo(() => [...new Set(motoristas.map(m => m.frota).filter(Boolean))], [motoristas]);

  // mês atual e anterior
  const mesAtual  = mensal[mensal.length - 1];
  const mesAnterior = mensal[mensal.length - 2];

  const delta = (cur, prev) => {
    if (!prev || !prev) return undefined;
    const d = prev === 0 ? 0 : ((cur - prev) / prev) * 100;
    return d;
  };

  if (carregando) return (
    <div style={{ background:C.bg, minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', color:C.text3, fontSize:14 }}>
      Carregando motoristas...
    </div>
  );

  if (!motoristas.length) return (
    <div style={{ background:C.bg, minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center',
      flexDirection:'column', gap:12, color:C.text2 }}>
      <i className="ti ti-gauge" style={{ fontSize:40, color:C.text3 }}></i>
      <span>Nenhuma importação de consumo encontrada.</span>
    </div>
  );

  return (
    <div style={{ background:C.bg, minHeight:'100vh', position:'relative', fontFamily:'"Segoe UI", system-ui, sans-serif',
      WebkitFontSmoothing:'antialiased' }}>
      {/* blobs de fundo */}
      <div style={{ position:'fixed', top:-160, left:-120, width:520, height:520, borderRadius:'50%',
        background:C.accent, opacity:0.08, filter:'blur(90px)', pointerEvents:'none', zIndex:0 }} />
      <div style={{ position:'fixed', bottom:-180, right:-120, width:460, height:460, borderRadius:'50%',
        background:C.good, opacity:0.06, filter:'blur(90px)', pointerEvents:'none', zIndex:0 }} />

      <div style={{ position:'relative', zIndex:1, maxWidth:1200, margin:'0 auto', padding:'28px 20px 72px' }}>

        {/* ── Cabeçalho ── */}
        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:16, flexWrap:'wrap', marginBottom:24 }}>
          <div>
            <h1 style={{ margin:0, fontSize:20, fontWeight:700, color:C.text1, letterSpacing:'-0.01em' }}>
              Painel de Consumo
            </h1>
            <p style={{ margin:'4px 0 0', fontSize:13, color:C.text3, fontFamily:'monospace' }}>
              Levantamentos × Médias de Consumo
            </p>
          </div>

          {/* seletor de motorista */}
          <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center' }}>
            {frotas.length > 1 && frotas.map(f => (
              <button key={f} onClick={() => setFrotaFiltro(frotaFiltro === f ? '' : f)}
                style={{ padding:'6px 14px', borderRadius:20, border:`1px solid ${frotaFiltro===f ? C.accent : C.border}`,
                  background: frotaFiltro===f ? 'rgba(34,211,238,0.12)' : C.surface2,
                  color: frotaFiltro===f ? C.accent : C.text2, fontSize:12, fontWeight:600, cursor:'pointer' }}>
                {f}
              </button>
            ))}
            <div style={{ position:'relative' }}>
              <i className="ti ti-search" style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', color:C.text3, fontSize:13 }} />
              <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar motorista..."
                style={{ paddingLeft:30, paddingRight:10, paddingTop:7, paddingBottom:7, background:C.surface2,
                  border:`1px solid ${C.borderStr}`, borderRadius:9, color:C.text1, fontSize:13, outline:'none', width:200 }} />
            </div>
            <select value={sel?.motorista || ''} onChange={e => setSel(lista.find(m => m.motorista === e.target.value) || null)}
              style={{ padding:'7px 12px', background:C.surface2, border:`1px solid ${C.borderStr}`,
                borderRadius:9, color:C.text1, fontSize:13, outline:'none', maxWidth:260 }}>
              {lista.map(m => (
                <option key={m.motorista} value={m.motorista}>{m.motorista}</option>
              ))}
            </select>
          </div>
        </div>

        {sel && (
          <>
            {/* ── Top grid: driver card + truck ── */}
            <div style={{ border:`1.5px dashed ${C.borderStr}`, borderRadius:22, padding:18, marginBottom:20,
              boxShadow:`0 0 0 1px rgba(56,189,248,0.05), 0 30px 60px -40px rgba(34,211,238,0.15)`,
              display:'grid', gridTemplateColumns:'minmax(270px,360px) 1fr', gap:16 }}>

              {/* Driver card */}
              <Card style={{ padding:20, display:'flex', flexDirection:'column', gap:16 }}>
                <div style={{ display:'flex', alignItems:'center', gap:14 }}>
                  {/* avatar */}
                  <svg viewBox="0 0 56 56" style={{ width:56, height:56, flexShrink:0,
                    borderRadius:'50%', boxShadow:`0 0 0 2px ${C.accent}, 0 0 16px 1px rgba(34,211,238,0.45)` }}>
                    <defs>
                      <linearGradient id="pg-avatarBg" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0" stopColor="#1e293b" /><stop offset="1" stopColor="#0b1220" />
                      </linearGradient>
                    </defs>
                    <circle cx="28" cy="28" r="28" fill="url(#pg-avatarBg)" />
                    <circle cx="28" cy="23" r="10" fill={C.accent2} opacity="0.9" />
                    <path d="M8 54c2-11 11-18 20-18s18 7 20 18" fill={C.accent2} opacity="0.9" />
                  </svg>
                  <div>
                    <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                      <span style={{ fontSize:15, fontWeight:700, color:C.text1 }}>{sel.motorista}</span>
                      <span style={{ display:'inline-flex', alignItems:'center', gap:5,
                        background:'rgba(52,211,153,0.14)', border:'1px solid rgba(52,211,153,0.4)',
                        color:C.good, fontSize:11, fontWeight:700, letterSpacing:'0.04em',
                        padding:'2px 9px 2px 7px', borderRadius:999 }}>
                        <span style={{ width:6, height:6, borderRadius:'50%', background:C.good,
                          boxShadow:'0 0 6px 1px rgba(52,211,153,0.35)', display:'block' }} />
                        {sel.status?.toUpperCase() || 'ATIVO'}
                      </span>
                    </div>
                    <p style={{ margin:'2px 0 0', color:C.text2, fontSize:12 }}>
                      {sel.categoria || 'Motorista'} · {sel.frota || '—'}
                    </p>
                  </div>
                </div>

                <InfoChip icon="ti-license-plate" label="Placa atual"      value={sel.placa_atual || '—'} />
                <InfoChip icon="ti-truck"          label="Frota"           value={sel.frota || '—'} />

                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                  {[
                    { label:'Registros', val: (sel.total_registros||0).toLocaleString('pt-BR') },
                    { label:'Média geral', val: fmtMedia(sel.media_geral) },
                  ].map(({ label, val }) => (
                    <div key={label} style={{ background:C.surface2, border:`1px solid ${C.border}`, borderRadius:12, padding:'10px 12px' }}>
                      <div style={{ fontSize:10, color:C.text3, letterSpacing:'0.05em', textTransform:'uppercase' }}>{label}</div>
                      <div style={{ marginTop:4, fontWeight:700, fontSize:15, fontFamily:'monospace', color:C.text1 }}>{val}</div>
                    </div>
                  ))}
                </div>
              </Card>

              {/* Truck card */}
              <Card style={{ position:'relative', overflow:'hidden', display:'flex', flexDirection:'column', minHeight:260 }}>
                <div style={{ position:'relative', flex:1, display:'flex', alignItems:'center', justifyContent:'center', padding:'18px 18px 0' }}>
                  <div style={{ position:'absolute', width:340, height:120, left:'50%', bottom:52,
                    transform:'translateX(-50%)', background:'radial-gradient(ellipse at center, rgba(34,211,238,0.30), transparent 70%)',
                    filter:'blur(6px)', pointerEvents:'none' }} />
                  <TruckSVG />
                </div>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:8,
                  padding:'10px 16px', borderTop:`1px solid ${C.border}`, background:'rgba(5,7,13,0.5)', flexWrap:'wrap' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, color:C.text1, fontSize:13, fontWeight:500 }}>
                    <i className="ti ti-truck" style={{ color:C.accent }}></i>
                    {sel.placa_atual ? `Placa: ${sel.placa_atual}` : 'Sem placa registrada'}
                  </div>
                  <span style={{ color:C.text3, fontSize:12 }}>
                    {sel.frota ? `Frota ${sel.frota}` : ''}
                    {sel.ultima_data ? ` · Último registro: ${new Date(sel.ultima_data).toLocaleDateString('pt-BR')}` : ''}
                  </span>
                </div>
              </Card>
            </div>

            {/* ── Métricas do mês atual ── */}
            <div style={{ border:`1.5px dashed ${C.borderStr}`, borderRadius:22, padding:18, marginBottom:20,
              display:'grid', gridTemplateColumns:'repeat(3,1fr) minmax(220px,300px)', gap:16 }}>

              <MetricCard
                label="KM rodados (diesel)"
                value={fmtKm(mesAtual?.totalKm)}
                delta={mesAnterior?.totalKm ? delta(mesAtual?.totalKm, mesAnterior?.totalKm) : undefined}
                deltaLabel="vs mês anterior"
                iconCls="ti-road"
                iconColor={C.accent2}
              />
              <MetricCard
                label="Litros diesel"
                value={fmtLit(mesAtual?.totalLitros)}
                delta={mesAnterior?.totalLitros ? delta(mesAtual?.totalLitros, mesAnterior?.totalLitros) : undefined}
                deltaLabel="vs mês anterior"
                iconCls="ti-droplet"
                iconColor={C.warn}
              />
              <MetricCard
                label="Gasto total"
                value={fmtR$(mesAtual?.totalGasto)}
                delta={mesAnterior?.totalGasto ? delta(mesAtual?.totalGasto, mesAnterior?.totalGasto) : undefined}
                deltaLabel="vs mês anterior"
                iconCls="ti-currency-dollar"
                iconColor={C.good}
              />

              {/* Gauge */}
              <Card style={{ padding:'18px 18px 14px', display:'flex', flexDirection:'column', alignItems:'center', gap:4 }}>
                <div style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:4 }}>
                  <span style={{ color:C.text2, fontSize:13 }}>Média km/L</span>
                  <span style={{ fontSize:11, color:C.text3, fontFamily:'monospace' }}>
                    {mesAtual ? fmtMes(mesAtual.mes) : '—'}
                  </span>
                </div>
                {carregandoMes
                  ? <div style={{ color:C.text3, fontSize:12, padding:20 }}>Carregando...</div>
                  : <Gauge value={mesAtual?.mediaReal ?? 0} />
                }
              </Card>
            </div>

            {/* ── Gráfico mensal ── */}
            <div style={{ border:`1.5px dashed ${C.borderStr}`, borderRadius:22, padding:18 }}>
              <Card style={{ padding:'20px 22px 16px' }}>
                <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:12, flexWrap:'wrap', marginBottom:20 }}>
                  <div>
                    <h2 style={{ margin:0, fontSize:17, fontWeight:700, color:C.text1 }}>Histórico Mensal</h2>
                    <p style={{ margin:'3px 0 0', color:C.text3, fontSize:13 }}>Média km/L por mês · {sel.motorista}</p>
                  </div>
                  <div style={{ display:'flex', gap:12, alignItems:'center', flexWrap:'wrap' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:7, fontSize:13, color:C.text2 }}>
                      <span style={{ width:11, height:11, borderRadius:3, background:`linear-gradient(180deg,${C.accent2},${C.accent})`, display:'inline-block' }} />
                      km/L
                    </div>
                    <button onClick={() => setMostrarTabela(v => !v)}
                      style={{ border:`1px solid ${C.borderStr}`, background:C.surface2, color:C.text1,
                        borderRadius:8, padding:'7px 13px', fontSize:13, fontWeight:500, cursor:'pointer' }}>
                      {mostrarTabela ? 'Ver gráfico' : 'Ver tabela'}
                    </button>
                  </div>
                </div>

                {carregandoMes ? (
                  <div style={{ textAlign:'center', padding:40, color:C.text3 }}>Carregando...</div>
                ) : !mensal.length ? (
                  <div style={{ textAlign:'center', padding:40, color:C.text3 }}>Sem dados de consumo para este motorista.</div>
                ) : mostrarTabela ? (
                  <div style={{ overflowX:'auto' }}>
                    <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13, fontFamily:'monospace' }}>
                      <thead>
                        <tr>
                          {['Mês','KM (diesel)','Litros','Gasto Total','km/L'].map(h => (
                            <th key={h} style={{ padding:'7px 10px', textAlign: h==='Mês'?'left':'right',
                              color:C.text2, fontWeight:600, fontFamily:'inherit',
                              borderBottom:`1px solid ${C.border}` }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {mensal.map(m => (
                          <tr key={m.mes}>
                            <td style={{ padding:'7px 10px', color:C.text1, fontFamily:'"Segoe UI",sans-serif' }}>{fmtMes(m.mes)}</td>
                            <td style={{ padding:'7px 10px', textAlign:'right', color:C.text1 }}>{fmtKm(m.totalKm)}</td>
                            <td style={{ padding:'7px 10px', textAlign:'right', color:C.text1 }}>{fmtLit(m.totalLitros)}</td>
                            <td style={{ padding:'7px 10px', textAlign:'right', color:C.text1 }}>{fmtR$(m.totalGasto)}</td>
                            <td style={{ padding:'7px 10px', textAlign:'right',
                              color: m.mediaReal >= 3 ? C.good : m.mediaReal >= 1.8 ? C.warn : C.crit,
                              fontWeight:700 }}>{fmtMedia(m.mediaReal)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={mensal} margin={{ top:16, right:8, left:0, bottom:4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false} />
                      <XAxis dataKey="mes" tickFormatter={fmtMes} tick={{ fill:C.text3, fontSize:12, fontFamily:'monospace' }} axisLine={false} tickLine={false} />
                      <YAxis tickFormatter={v => v.toFixed(1)} tick={{ fill:C.text3, fontSize:12, fontFamily:'monospace' }} axisLine={false} tickLine={false} width={40} />
                      <Tooltip content={<CustomTooltip />} cursor={{ fill:'rgba(34,211,238,0.06)' }} />
                      <ReferenceLine y={3} stroke={C.text3} strokeDasharray="4 3"
                        label={{ value:'Meta 3,0', fill:C.text3, fontSize:11, position:'insideTopLeft' }} />
                      <Bar dataKey="mediaReal" name="mediaReal" radius={[6,6,0,0]}
                        maxBarSize={36}>
                        {mensal.map((m, i) => (
                          <Cell key={i}
                            fill={m.mediaReal >= 3 ? C.accent : m.mediaReal >= 1.8 ? C.warn : C.crit}
                            style={{ filter:`drop-shadow(0 0 6px ${m.mediaReal>=3?C.accent:m.mediaReal>=1.8?C.warn:C.crit}55)` }}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </Card>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

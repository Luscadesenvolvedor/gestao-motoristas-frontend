import { useState, useEffect, useMemo } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine
} from 'recharts';
import api from '../../services/api';

/* ─── paleta ─── */
const C = {
  bg:        '#06080f',
  surface:   '#0c1020',
  surface2:  '#111829',
  surface3:  '#1a2338',
  text1:     '#eef3fb',
  text2:     '#9aacc9',
  text3:     '#55657f',
  border:    'rgba(56,189,248,0.13)',
  borderStr: 'rgba(56,189,248,0.35)',
  accent:    '#22d3ee',
  accent2:   '#38bdf8',
  accentBg:  'rgba(34,211,238,0.10)',
  good:      '#34d399',
  goodBg:    'rgba(52,211,153,0.12)',
  warn:      '#fbbf24',
  warnBg:    'rgba(251,191,36,0.12)',
  crit:      '#f87171',
  critBg:    'rgba(248,113,113,0.12)',
};

const fmtKm    = v => Number(v||0).toLocaleString('pt-BR',{maximumFractionDigits:0})+' km';
const fmtLit   = v => Number(v||0).toLocaleString('pt-BR',{maximumFractionDigits:0})+' L';
const fmtR$    = v => 'R$ '+Number(v||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
const fmtMedia = v => Number(v||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
const fmtMes   = s => { if(!s) return ''; const[a,m]=s.split('-'); return new Date(+a,+m-1,1).toLocaleDateString('pt-BR',{month:'short',year:'2-digit'}); };
const pct      = (cur,prev) => (!prev||prev===0) ? undefined : ((cur-prev)/prev)*100;

/* ─── Gauge ─── */
const MAX_KML = 6;
function Gauge({ value = 0 }) {
  const v      = Math.min(Math.max(+value||0, 0), MAX_KML);
  const angle  = -90 + (v / MAX_KML) * 180;
  const color  = v >= 3 ? C.good : v >= 1.8 ? C.warn : C.crit;
  const status = v >= 3 ? 'Excelente' : v >= 1.8 ? 'Regular' : 'Crítico';
  return (
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',width:'100%',gap:0}}>
      <svg viewBox="0 0 280 155" style={{width:'100%',maxWidth:260,overflow:'visible'}}>
        <path fill="none" stroke={C.surface3} strokeWidth="16"
          d="M48 132 A92 92 0 0 1 232 132"/>
        <path fill="none" stroke={C.crit}   strokeWidth="16" strokeLinecap="round"
          d="M48.01 130.4 A92 92 0 0 1 73.82 68.1"/>
        <path fill="none" stroke={C.warn}   strokeWidth="16" strokeLinecap="round"
          d="M76.09 65.8 A92 92 0 0 1 114.64 43.6"/>
        <path fill="none" stroke={C.good}   strokeWidth="16" strokeLinecap="round"
          style={{filter:`drop-shadow(0 0 6px ${C.good}88)`}}
          d="M117.74 42.7 A92 92 0 0 1 231.99 130.4"/>
        {[['0',16,132],['1',32,70],['2',80,24],['3',140,8],['4',200,24],['5',248,70],['6',264,132]].map(([l,x,y])=>(
          <text key={l} x={x} y={y} fill={C.text3} fontSize="10" textAnchor="middle"
            dominantBaseline="middle" fontFamily="monospace">{l}</text>
        ))}
        <g style={{
          transformBox:'view-box', transformOrigin:'140px 132px',
          transform:`rotate(${angle}deg)`,
          transition:'transform 1s cubic-bezier(.2,.8,.2,1)',
          filter:'drop-shadow(0 2px 4px rgba(0,0,0,0.6))',
        }}>
          <polygon points="140,48 136,146 144,146" fill="#fff"/>
        </g>
        <circle cx="140" cy="132" r="10" fill={C.surface2} stroke="#fff" strokeWidth="2.5"/>
        <circle cx="140" cy="132" r="4"  fill={color}/>
      </svg>
      <div style={{textAlign:'center',marginTop:-4}}>
        <div style={{fontFamily:'monospace',fontWeight:800,fontSize:36,color,letterSpacing:'-0.02em',lineHeight:1}}>
          {fmtMedia(value)}<span style={{fontSize:14,color:C.text3,fontWeight:400}}> km/L</span>
        </div>
        <div style={{fontSize:12,fontWeight:700,color,letterSpacing:'0.06em',textTransform:'uppercase',marginTop:6}}>
          {status}
        </div>
      </div>
    </div>
  );
}

/* ─── MetricCard ─── */
function MetricCard({ label, value, sub, icon, bg, color }) {
  return (
    <div style={{
      background:`linear-gradient(145deg,${C.surface2},${C.surface})`,
      border:`1px solid ${C.border}`, borderRadius:16, padding:'18px 20px',
      display:'flex', flexDirection:'column', gap:10,
    }}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <span style={{fontSize:12,color:C.text2,fontWeight:500,letterSpacing:'0.02em'}}>{label}</span>
        <div style={{
          width:34, height:34, borderRadius:10, flexShrink:0,
          background:bg, display:'flex', alignItems:'center', justifyContent:'center',
          fontSize:16, color,
        }}>
          <i className={`ti ${icon}`}/>
        </div>
      </div>
      <div style={{fontFamily:'monospace',fontWeight:800,fontSize:26,color:C.text1,letterSpacing:'-0.02em',lineHeight:1}}>
        {value}
      </div>
      {sub !== undefined && (
        <div style={{display:'flex',alignItems:'center',gap:5,fontSize:12}}>
          {sub === null ? (
            <span style={{color:C.text3}}>Sem dados anteriores</span>
          ) : (
            <>
              <span style={{fontFamily:'monospace',fontWeight:700,color:sub>=0?C.good:C.crit}}>
                {sub>=0?'▲':'▼'}
              </span>
              <span style={{fontWeight:700,color:sub>=0?C.good:C.crit}}>
                {Math.abs(sub).toFixed(1)}%
              </span>
              <span style={{color:C.text3}}>vs mês anterior</span>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Truck SVG ─── */
function TruckSVG() {
  return (
    <svg viewBox="0 0 600 280" style={{width:'100%',maxWidth:480,height:'auto'}}>
      <defs>
        <linearGradient id="pg2-body" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#dde5f0"/><stop offset="1" stopColor="#a8b5c8"/>
        </linearGradient>
        <linearGradient id="pg2-cab" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#e2eaf5"/><stop offset="1" stopColor="#9bafc4"/>
        </linearGradient>
        <radialGradient id="pg2-wheel" cx="0.35" cy="0.35" r="0.75">
          <stop offset="0" stopColor="#94a3b8"/><stop offset="1" stopColor="#1e293b"/>
        </radialGradient>
        <radialGradient id="pg2-shadow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="rgba(0,0,0,0.5)"/><stop offset="1" stopColor="rgba(0,0,0,0)"/>
        </radialGradient>
        <filter id="pg2-glow"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      </defs>
      {/* sombra */}
      <ellipse cx="310" cy="245" rx="240" ry="14" fill="url(#pg2-shadow)"/>
      {/* chassis */}
      <rect x="70" y="210" width="470" height="8" rx="3" fill="#1e293b"/>
      {/* baú */}
      <rect x="220" y="75" width="310" height="142" rx="10" fill="url(#pg2-body)" stroke="#8090a8" strokeWidth="1.5"/>
      <line x1="220" y1="108" x2="530" y2="108" stroke="#8090a8" strokeWidth="1" opacity="0.5"/>
      <line x1="320" y1="83" x2="320" y2="217" stroke="#8090a8" strokeWidth="1" opacity="0.35"/>
      <line x1="420" y1="83" x2="420" y2="217" stroke="#8090a8" strokeWidth="1" opacity="0.35"/>
      {/* stripes cyan */}
      <rect x="234" y="89" width="62" height="14" rx="3" fill={C.accent} opacity="0.8" style={{filter:`drop-shadow(0 0 4px ${C.accent})`}}/>
      <rect x="220" y="192" width="310" height="8" fill="#0f172a" opacity="0.10"/>
      {/* cabine */}
      <path d="M96 218 V142 Q96 122 118 118 L200 104 Q218 101 228 116 L228 218 Z" fill="url(#pg2-cab)" stroke="#8090a8" strokeWidth="1.5"/>
      {/* janela */}
      <path d="M120 144 L150 122 Q158 116 168 116 L198 116 Q204 116 204 124 L204 144 Q204 150 198 150 L126 150 Q120 150 120 144 Z" fill="#7dd3fc" opacity="0.5" stroke="#5eb8de" strokeWidth="1"/>
      {/* espelhos + farol */}
      <rect x="96" y="178" width="15" height="28" rx="3" fill="#94a3b8" opacity="0.6"/>
      <circle cx="218" cy="190" r="9" fill="#fbbf24" opacity="0.9" style={{filter:'drop-shadow(0 0 5px #fbbf24)'}}/>
      <rect x="82" y="126" width="16" height="10" rx="3" fill="#cbd5e1" stroke="#8090a8" strokeWidth="1"/>
      {/* rodas */}
      {[144,400,458].map(cx=>(
        <g key={cx}>
          <circle cx={cx} cy="222" r="29" fill="#0f172a"/>
          <circle cx={cx} cy="222" r="14" fill="url(#pg2-wheel)"/>
          <circle cx={cx} cy="222" r="4"  fill={C.accent} style={{filter:`drop-shadow(0 0 4px ${C.accent})`}}/>
        </g>
      ))}
    </svg>
  );
}

/* ─── Tooltip do gráfico ─── */
const ChartTip = ({active,payload,label}) => {
  if(!active||!payload?.length) return null;
  return (
    <div style={{background:C.surface3,border:`1px solid ${C.borderStr}`,borderRadius:10,
      padding:'10px 14px',fontSize:12,color:C.text1,boxShadow:'0 8px 32px rgba(0,0,0,0.5)'}}>
      <div style={{color:C.text3,marginBottom:6,fontWeight:600}}>{fmtMes(label)}</div>
      {payload.map((p,i)=>(
        <div key={i} style={{display:'flex',alignItems:'center',gap:8}}>
          <span style={{width:8,height:8,borderRadius:2,background:C.accent,display:'block'}}/>
          <span style={{color:C.accent,fontFamily:'monospace',fontWeight:700}}>{fmtMedia(p.value)} km/L</span>
        </div>
      ))}
      {payload[0]?.payload && (
        <div style={{marginTop:6,paddingTop:6,borderTop:`1px solid ${C.border}`,color:C.text3,fontSize:11}}>
          {fmtKm(payload[0].payload.totalKm)} · {fmtLit(payload[0].payload.totalLitros)}
        </div>
      )}
    </div>
  );
};

/* ════════════════════════════════════════════
   PRINCIPAL
════════════════════════════════════════════ */
export default function PainelConsumo() {
  const [motoristas,    setMotoristas]    = useState([]);
  const [sel,           setSel]           = useState(null);
  const [busca,         setBusca]         = useState('');
  const [mensal,        setMensal]        = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [loadingMes,    setLoadingMes]    = useState(false);
  const [mostrarTabela, setMostrarTabela] = useState(false);
  const [frotaFiltro,   setFrotaFiltro]   = useState('');

  useEffect(() => {
    api.get('/medias-consumo/painel-motoristas')
      .then(r => { setMotoristas(r.data); if(r.data.length) setSel(r.data[0]); })
      .catch(()=>{})
      .finally(()=>setLoading(false));
  }, []);

  useEffect(() => {
    if(!sel) return;
    setLoadingMes(true);
    api.get('/medias-consumo/resumo-mensal', {params:{motorista:sel.motorista}})
      .then(r=>setMensal(r.data))
      .catch(()=>setMensal([]))
      .finally(()=>setLoadingMes(false));
  }, [sel]);

  const lista = useMemo(() => {
    let l = motoristas;
    if(frotaFiltro) l = l.filter(m=>m.frota===frotaFiltro);
    if(busca.trim()) { const q=busca.toLowerCase(); l=l.filter(m=>m.motorista.toLowerCase().includes(q)); }
    return l;
  }, [motoristas,busca,frotaFiltro]);

  const frotas = useMemo(() => [...new Set(motoristas.map(m=>m.frota).filter(Boolean))], [motoristas]);

  const mesAtual    = mensal[mensal.length-1];
  const mesAnterior = mensal[mensal.length-2];

  /* ── loading / vazio ── */
  if(loading) return (
    <div style={{background:C.bg,minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',color:C.text3,fontSize:14}}>
      <i className="ti ti-loader-2" style={{fontSize:24,marginRight:10,color:C.accent}}/> Carregando...
    </div>
  );
  if(!motoristas.length) return (
    <div style={{background:C.bg,minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:14,color:C.text2}}>
      <i className="ti ti-gauge-off" style={{fontSize:48,color:C.text3}}/>
      <span style={{fontSize:15}}>Nenhuma importação de Médias de Consumo encontrada.</span>
    </div>
  );

  return (
    <div style={{background:C.bg,minHeight:'100vh',fontFamily:'"Segoe UI",system-ui,sans-serif',WebkitFontSmoothing:'antialiased',position:'relative'}}>
      {/* blobs */}
      <div style={{position:'fixed',top:-200,left:-150,width:600,height:600,borderRadius:'50%',background:C.accent,opacity:0.07,filter:'blur(100px)',pointerEvents:'none',zIndex:0}}/>
      <div style={{position:'fixed',bottom:-200,right:-150,width:500,height:500,borderRadius:'50%',background:C.good,opacity:0.05,filter:'blur(100px)',pointerEvents:'none',zIndex:0}}/>

      <div style={{position:'relative',zIndex:1,maxWidth:1280,margin:'0 auto',padding:'24px 24px 60px'}}>

        {/* ══ HEADER ══ */}
        <div style={{
          display:'flex',alignItems:'center',justifyContent:'space-between',
          gap:16,flexWrap:'wrap',
          background:`linear-gradient(135deg,${C.surface2},${C.surface})`,
          border:`1px solid ${C.borderStr}`,borderRadius:18,
          padding:'16px 20px',marginBottom:20,
        }}>
          <div style={{display:'flex',alignItems:'center',gap:12}}>
            <div style={{width:40,height:40,borderRadius:12,background:C.accentBg,border:`1px solid ${C.borderStr}`,
              display:'flex',alignItems:'center',justifyContent:'center',color:C.accent,fontSize:20}}>
              <i className="ti ti-gauge"/>
            </div>
            <div>
              <h1 style={{margin:0,fontSize:17,fontWeight:700,color:C.text1,letterSpacing:'-0.01em'}}>Painel de Consumo</h1>
              <p style={{margin:0,fontSize:12,color:C.text3,fontFamily:'monospace'}}>
                {motoristas.length} motoristas · {mensal.length} meses
              </p>
            </div>
          </div>

          <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
            {/* filtros de frota */}
            {frotas.map(f=>(
              <button key={f} onClick={()=>setFrotaFiltro(frotaFiltro===f?'':f)}
                style={{padding:'6px 14px',borderRadius:20,fontSize:12,fontWeight:600,cursor:'pointer',
                  border:`1px solid ${frotaFiltro===f?C.accent:C.border}`,
                  background:frotaFiltro===f?C.accentBg:C.surface2,
                  color:frotaFiltro===f?C.accent:C.text2,transition:'all .15s'}}>
                {f}
              </button>
            ))}

            {/* busca */}
            <div style={{position:'relative'}}>
              <i className="ti ti-search" style={{position:'absolute',left:10,top:'50%',transform:'translateY(-50%)',color:C.text3,fontSize:13,pointerEvents:'none'}}/>
              <input value={busca} onChange={e=>setBusca(e.target.value)} placeholder="Buscar..."
                style={{paddingLeft:30,paddingRight:10,paddingTop:7,paddingBottom:7,
                  background:C.surface2,border:`1px solid ${C.border}`,borderRadius:10,
                  color:C.text1,fontSize:13,outline:'none',width:180}}/>
            </div>

            {/* select */}
            <select value={sel?.motorista||''} onChange={e=>setSel(lista.find(m=>m.motorista===e.target.value)||null)}
              style={{padding:'7px 12px',background:C.surface2,border:`1px solid ${C.borderStr}`,
                borderRadius:10,color:C.text1,fontSize:13,outline:'none',maxWidth:280,cursor:'pointer'}}>
              {lista.map(m=>(
                <option key={m.motorista} value={m.motorista}>{m.motorista}</option>
              ))}
            </select>
          </div>
        </div>

        {sel && (
          <>
            {/* ══ ROW 1: DRIVER + TRUCK ══ */}
            <div style={{display:'grid',gridTemplateColumns:'340px 1fr',gap:16,marginBottom:16}}>

              {/* ── Driver card ── */}
              <div style={{
                background:`linear-gradient(145deg,${C.surface2},${C.surface})`,
                border:`1px solid ${C.border}`,borderRadius:18,padding:22,
                display:'flex',flexDirection:'column',gap:16,
              }}>
                {/* avatar + nome */}
                <div style={{display:'flex',alignItems:'center',gap:14}}>
                  <div style={{position:'relative',flexShrink:0}}>
                    <svg viewBox="0 0 64 64" width="60" height="60" style={{borderRadius:'50%',display:'block',
                      boxShadow:`0 0 0 2px ${C.accent},0 0 20px 2px rgba(34,211,238,0.3)`}}>
                      <defs>
                        <linearGradient id="pg2-avBg" x1="0" y1="0" x2="1" y2="1">
                          <stop offset="0" stopColor="#1e293b"/><stop offset="1" stopColor="#0c1220"/>
                        </linearGradient>
                      </defs>
                      <circle cx="32" cy="32" r="32" fill="url(#pg2-avBg)"/>
                      <circle cx="32" cy="26" r="11" fill={C.accent2} opacity="0.9"/>
                      <path d="M8 62c2-14 13-22 24-22s22 8 24 22" fill={C.accent2} opacity="0.9"/>
                    </svg>
                    {/* dot online */}
                    <span style={{position:'absolute',bottom:2,right:2,width:12,height:12,borderRadius:'50%',
                      background:C.good,border:`2px solid ${C.surface}`,
                      boxShadow:`0 0 8px ${C.good}`}}/>
                  </div>
                  <div style={{minWidth:0}}>
                    <div style={{fontWeight:700,fontSize:15,color:C.text1,lineHeight:1.2,
                      whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>
                      {sel.motorista}
                    </div>
                    <div style={{fontSize:12,color:C.text2,marginTop:3}}>
                      {sel.categoria||'Motorista'}
                    </div>
                    <div style={{marginTop:6,display:'inline-flex',alignItems:'center',gap:5,
                      background:C.goodBg,border:`1px solid rgba(52,211,153,0.35)`,
                      color:C.good,fontSize:10,fontWeight:700,letterSpacing:'0.06em',
                      padding:'2px 8px',borderRadius:99}}>
                      <span style={{width:5,height:5,borderRadius:'50%',background:C.good,display:'block'}}/>
                      {(sel.status||'ATIVO').toUpperCase()}
                    </div>
                  </div>
                </div>

                {/* chips */}
                <div style={{display:'flex',flexDirection:'column',gap:8}}>
                  {[
                    {icon:'ti-license-plate', label:'Placa atual',   val: sel.placa_atual||'—'},
                    {icon:'ti-truck',          label:'Frota',         val: sel.frota||'—'},
                  ].map(({icon,label,val})=>(
                    <div key={label} style={{display:'flex',alignItems:'center',justifyContent:'space-between',
                      background:C.surface3,border:`1px solid ${C.border}`,borderRadius:12,padding:'10px 14px',gap:10}}>
                      <div style={{display:'flex',alignItems:'center',gap:10}}>
                        <div style={{width:30,height:30,borderRadius:8,background:C.accentBg,
                          border:`1px solid ${C.borderStr}`,display:'flex',alignItems:'center',
                          justifyContent:'center',color:C.accent,fontSize:14,flexShrink:0}}>
                          <i className={`ti ${icon}`}/>
                        </div>
                        <span style={{fontSize:11,color:C.text3}}>{label}</span>
                      </div>
                      <span style={{fontFamily:'monospace',fontWeight:700,color:C.accent,fontSize:14}}>{val}</span>
                    </div>
                  ))}
                </div>

                {/* mini stats */}
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                  {[
                    {label:'Registros',   val:(sel.total_registros||0).toLocaleString('pt-BR')},
                    {label:'Média geral', val:fmtMedia(sel.media_geral)+' km/L'},
                  ].map(({label,val})=>(
                    <div key={label} style={{background:C.surface3,border:`1px solid ${C.border}`,borderRadius:12,padding:'10px 12px'}}>
                      <div style={{fontSize:10,color:C.text3,textTransform:'uppercase',letterSpacing:'0.05em'}}>{label}</div>
                      <div style={{marginTop:5,fontFamily:'monospace',fontWeight:700,fontSize:14,color:C.text1}}>{val}</div>
                    </div>
                  ))}
                </div>

                {/* período */}
                {sel.ultima_data && (
                  <div style={{fontSize:11,color:C.text3,textAlign:'center',paddingTop:4,borderTop:`1px solid ${C.border}`}}>
                    Último registro: {new Date(sel.ultima_data).toLocaleDateString('pt-BR')}
                  </div>
                )}
              </div>

              {/* ── Truck card ── */}
              <div style={{
                background:`linear-gradient(145deg,${C.surface2},${C.surface})`,
                border:`1px solid ${C.border}`,borderRadius:18,overflow:'hidden',
                display:'flex',flexDirection:'column',
              }}>
                <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',
                  padding:'24px 24px 0',position:'relative'}}>
                  {/* glow chão */}
                  <div style={{position:'absolute',bottom:0,left:'50%',transform:'translateX(-50%)',
                    width:'70%',height:60,
                    background:`radial-gradient(ellipse at center,${C.accent}33,transparent 70%)`,
                    filter:'blur(8px)',pointerEvents:'none'}}/>
                  <TruckSVG/>
                </div>
                {/* rodapé */}
                <div style={{padding:'12px 20px',borderTop:`1px solid ${C.border}`,
                  background:'rgba(6,8,15,0.6)',display:'flex',alignItems:'center',
                  justifyContent:'space-between',flexWrap:'wrap',gap:8}}>
                  <div style={{display:'flex',alignItems:'center',gap:8,color:C.text1,fontSize:13,fontWeight:600}}>
                    <i className="ti ti-truck" style={{color:C.accent,fontSize:16}}/>
                    {sel.placa_atual ? `Placa: ${sel.placa_atual}` : 'Sem placa registrada'}
                  </div>
                  <span style={{color:C.text3,fontSize:12,fontFamily:'monospace'}}>
                    {mesAtual ? `${fmtMes(mesAtual.mes)} · ${fmtKm(mesAtual.totalKm)}` : '—'}
                  </span>
                </div>
              </div>
            </div>

            {/* ══ ROW 2: 4 MÉTRICAS ══ */}
            <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:16,marginBottom:16}}>
              <MetricCard
                label="KM Rodados (diesel)"
                value={fmtKm(mesAtual?.totalKm)}
                sub={mesAtual&&mesAnterior ? pct(mesAtual.totalKm,mesAnterior.totalKm) : null}
                icon="ti-road" bg={C.accentBg} color={C.accent2}
              />
              <MetricCard
                label="Litros Consumidos"
                value={fmtLit(mesAtual?.totalLitros)}
                sub={mesAtual&&mesAnterior ? pct(mesAtual.totalLitros,mesAnterior.totalLitros) : null}
                icon="ti-droplet" bg={C.warnBg} color={C.warn}
              />
              <MetricCard
                label="Gasto Total"
                value={fmtR$(mesAtual?.totalGasto)}
                sub={mesAtual&&mesAnterior ? pct(mesAtual.totalGasto,mesAnterior.totalGasto) : null}
                icon="ti-currency-dollar" bg={C.goodBg} color={C.good}
              />
              <MetricCard
                label="Média km/L"
                value={fmtMedia(mesAtual?.mediaReal||0)}
                sub={mesAtual&&mesAnterior&&mesAnterior.mediaReal>0 ? pct(mesAtual.mediaReal,mesAnterior.mediaReal) : null}
                icon="ti-gauge" bg={C.critBg} color={C.crit}
              />
            </div>

            {/* ══ ROW 3: GAUGE + GRÁFICO ══ */}
            <div style={{display:'grid',gridTemplateColumns:'300px 1fr',gap:16}}>

              {/* ── Gauge ── */}
              <div style={{
                background:`linear-gradient(145deg,${C.surface2},${C.surface})`,
                border:`1px solid ${C.border}`,borderRadius:18,padding:'22px 18px 18px',
                display:'flex',flexDirection:'column',alignItems:'center',gap:8,
              }}>
                <div style={{width:'100%',display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:4}}>
                  <span style={{fontSize:13,fontWeight:600,color:C.text2}}>Média km/L do Mês</span>
                  {mesAtual && <span style={{fontSize:11,color:C.text3,fontFamily:'monospace'}}>{fmtMes(mesAtual.mes)}</span>}
                </div>
                {loadingMes
                  ? <div style={{color:C.text3,padding:40,fontSize:13}}>Carregando...</div>
                  : <Gauge value={mesAtual?.mediaReal??0}/>
                }
                {/* meta */}
                <div style={{width:'100%',marginTop:8,padding:'10px 14px',
                  background:C.surface3,border:`1px solid ${C.border}`,borderRadius:12,
                  display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                  <span style={{fontSize:11,color:C.text3}}>Meta mínima</span>
                  <span style={{fontFamily:'monospace',fontWeight:700,color:C.accent,fontSize:14}}>3,00 km/L</span>
                </div>
                {mesAtual?.mediaReal > 0 && (
                  <div style={{width:'100%',padding:'10px 14px',
                    background: mesAtual.mediaReal>=3?C.goodBg:C.critBg,
                    border:`1px solid ${mesAtual.mediaReal>=3?'rgba(52,211,153,0.3)':'rgba(248,113,113,0.3)'}`,
                    borderRadius:12,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                    <span style={{fontSize:11,color:C.text3}}>
                      {mesAtual.mediaReal>=3?'Acima da meta':'Abaixo da meta'}
                    </span>
                    <span style={{fontFamily:'monospace',fontWeight:700,
                      color:mesAtual.mediaReal>=3?C.good:C.crit,fontSize:14}}>
                      {mesAtual.mediaReal>=3?'+':''}{((mesAtual.mediaReal-3)/3*100).toFixed(1)}%
                    </span>
                  </div>
                )}
              </div>

              {/* ── Gráfico ── */}
              <div style={{
                background:`linear-gradient(145deg,${C.surface2},${C.surface})`,
                border:`1px solid ${C.border}`,borderRadius:18,padding:'22px 22px 16px',
              }}>
                <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:12,marginBottom:20,flexWrap:'wrap'}}>
                  <div>
                    <h2 style={{margin:0,fontSize:16,fontWeight:700,color:C.text1}}>Histórico Mensal</h2>
                    <p style={{margin:'4px 0 0',fontSize:12,color:C.text3}}>
                      Média de consumo km/L · {mensal.length} meses importados
                    </p>
                  </div>
                  <div style={{display:'flex',gap:8,alignItems:'center'}}>
                    <div style={{display:'flex',alignItems:'center',gap:6,fontSize:12,color:C.text2}}>
                      <span style={{width:10,height:10,borderRadius:3,background:C.accent,display:'block'}}/>
                      km/L realizado
                    </div>
                    <button onClick={()=>setMostrarTabela(v=>!v)}
                      style={{border:`1px solid ${C.borderStr}`,background:C.surface2,color:C.text1,
                        borderRadius:8,padding:'6px 12px',fontSize:12,fontWeight:500,cursor:'pointer'}}>
                      {mostrarTabela?'Gráfico':'Tabela'}
                    </button>
                  </div>
                </div>

                {loadingMes ? (
                  <div style={{textAlign:'center',padding:60,color:C.text3,fontSize:13}}>Carregando...</div>
                ) : !mensal.length ? (
                  <div style={{textAlign:'center',padding:60,color:C.text3,fontSize:13}}>
                    <i className="ti ti-chart-bar-off" style={{fontSize:32,display:'block',marginBottom:8}}/>
                    Sem dados para este motorista
                  </div>
                ) : mostrarTabela ? (
                  <div style={{overflowX:'auto',maxHeight:360,overflowY:'auto'}}>
                    <table style={{width:'100%',borderCollapse:'collapse',fontSize:12,fontFamily:'monospace'}}>
                      <thead>
                        <tr>
                          {['Mês','KM diesel','Litros','Gasto Total','km/L'].map(h=>(
                            <th key={h} style={{padding:'8px 12px',textAlign:h==='Mês'?'left':'right',
                              color:C.text2,fontWeight:600,fontFamily:'"Segoe UI",sans-serif',
                              borderBottom:`1px solid ${C.border}`,fontSize:11,textTransform:'uppercase',letterSpacing:'0.04em'}}>
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {mensal.map(m=>(
                          <tr key={m.mes} style={{borderBottom:`1px solid ${C.border}`}}>
                            <td style={{padding:'9px 12px',color:C.text1,fontFamily:'"Segoe UI",sans-serif',fontWeight:500}}>{fmtMes(m.mes)}</td>
                            <td style={{padding:'9px 12px',textAlign:'right',color:C.text2}}>{fmtKm(m.totalKm)}</td>
                            <td style={{padding:'9px 12px',textAlign:'right',color:C.text2}}>{fmtLit(m.totalLitros)}</td>
                            <td style={{padding:'9px 12px',textAlign:'right',color:C.text2}}>{fmtR$(m.totalGasto)}</td>
                            <td style={{padding:'9px 12px',textAlign:'right',fontWeight:700,
                              color:m.mediaReal>=3?C.good:m.mediaReal>=1.8?C.warn:C.crit}}>
                              {fmtMedia(m.mediaReal)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={310}>
                    <AreaChart data={mensal} margin={{top:10,right:8,left:-10,bottom:4}}>
                      <defs>
                        <linearGradient id="pg2-areaGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={C.accent} stopOpacity={0.35}/>
                          <stop offset="100%" stopColor={C.accent} stopOpacity={0.02}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false}/>
                      <XAxis dataKey="mes" tickFormatter={fmtMes}
                        tick={{fill:C.text3,fontSize:11,fontFamily:'monospace'}}
                        axisLine={false} tickLine={false}/>
                      <YAxis tickFormatter={v=>v.toFixed(1)}
                        tick={{fill:C.text3,fontSize:11,fontFamily:'monospace'}}
                        axisLine={false} tickLine={false} width={36}/>
                      <Tooltip content={<ChartTip/>} cursor={{stroke:C.borderStr,strokeWidth:1,strokeDasharray:'4 3'}}/>
                      <ReferenceLine y={3} stroke={C.text3} strokeDasharray="5 4"
                        label={{value:'Meta 3,0',fill:C.text3,fontSize:10,position:'insideTopLeft',dx:4}}/>
                      <Area
                        type="monotone" dataKey="mediaReal" name="km/L"
                        stroke={C.accent} strokeWidth={2.5}
                        fill="url(#pg2-areaGrad)"
                        dot={(p)=>{
                          const v=p.payload?.mediaReal??0;
                          const col=v>=3?C.good:v>=1.8?C.warn:C.crit;
                          return <circle key={p.index} cx={p.cx} cy={p.cy} r={5} fill={col} stroke={C.surface} strokeWidth={2}/>;
                        }}
                        activeDot={{r:7,fill:C.accent,stroke:C.surface,strokeWidth:2}}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

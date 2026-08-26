import { useState, useRef, useMemo, useEffect } from 'react';
import api from '../../services/api';
import toast from 'react-hot-toast';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, Cell, ReferenceLine, LabelList
} from 'recharts';

/* ── classificação por conjunto ── */
const corConjunto = conj => conj
  ? { bg:'#eff6ff', color:'#1d4ed8' }
  : { bg:'#f0fdf4', color:'#15803d' };

/* ── helpers ── */
const fmtMesStr = s => {
  const [ano, mes] = s.split('-');
  return new Date(Number(ano), Number(mes) - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
};
const fmtDt = s => s ? new Date(s + 'T12:00:00').toLocaleDateString('pt-BR') : '—';
const fmtN = (v, d = 2) => v != null && v !== '' ? Number(v).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—';
const fmtR = v => v != null ? `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—';
const corPerc = p => p >= 100 ? '#16a34a' : p >= 85 ? '#d97706' : '#dc2626';

const fmtMesCurto = s => {
  const [ano, mes] = s.split('-');
  return new Date(Number(ano), Number(mes) - 1, 1).toLocaleDateString('pt-BR', { month: 'short' }).replace('.','');
};

const TooltipGrafico = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  return (
    <div style={{ background:'#1e293b', borderRadius:12, padding:'14px 18px', fontSize:12, boxShadow:'0 8px 32px rgba(0,0,0,0.28)', minWidth:200 }}>
      <div style={{ fontWeight:700, marginBottom:10, color:'#f1f5f9', fontSize:13 }}>{fmtMesStr(d?.mes)}</div>
      <div style={{ display:'flex', justifyContent:'space-between', gap:20, marginBottom:4 }}>
        <span style={{ color:'#94a3b8' }}>Total gasto</span>
        <strong style={{ color:'#fb7185' }}>{fmtR(d?.totalGasto)}</strong>
      </div>
      <div style={{ display:'flex', justifyContent:'space-between', gap:20, marginBottom:4 }}>
        <span style={{ color:'#94a3b8' }}>Distância</span>
        <strong style={{ color:'#e2e8f0' }}>{fmtN(d?.totalKm,0)} km</strong>
      </div>
      <div style={{ display:'flex', justifyContent:'space-between', gap:20, marginBottom:4 }}>
        <span style={{ color:'#94a3b8' }}>Litros diesel</span>
        <strong style={{ color:'#e2e8f0' }}>{fmtN(d?.totalLitros)} L</strong>
      </div>
      {d?.mediaReal > 0 && (
        <div style={{ display:'flex', justifyContent:'space-between', gap:20, borderTop:'1px solid #334155', marginTop:8, paddingTop:8 }}>
          <span style={{ color:'#94a3b8' }}>Média real</span>
          <strong style={{ color:'#60a5fa' }}>{fmtN(d?.mediaReal)} km/L</strong>
        </div>
      )}
    </div>
  );
};

const inp = { width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13, outline: 'none', background: '#fff', cursor: 'pointer', boxSizing: 'border-box' };
const lbl = { fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 };

export default function MediasConsumo() {
  // ── estado importações ──
  const [importacoes,  setImportacoes]  = useState([]);
  const [importacaoId, setImportacaoId] = useState('');
  const [loadingImps,  setLoadingImps]  = useState(true);

  const [frotaSel,    setFrotaSel]    = useState('BAÚ'); // filtro rápido de frota
  const [abaAtiva,    setAbaAtiva]    = useState('geral'); // 'geral' | 'placa'

  const FROTAS = ['BAÚ', 'FROTA'];
  const rowRefs  = useRef({});

  // ── filtros do relatório ──
  const [placa,      setPlaca]      = useState('');   // placa commitada (dispara API)
  const [buscaPlaca, setBuscaPlaca] = useState('');   // texto do input (local)
  const [mesSel,    setMesSel]      = useState('');   // accordion dentro da tabela
  const [mesFiltro, setMesFiltro]   = useState('');   // filtro global de mês (YYYY-MM)
  const [placas,       setPlacas]       = useState([]);
  const [meses,        setMeses]        = useState([]);
  const [resumoChart,  setResumoChart]  = useState([]);
  const [loadingChart, setLoadingChart] = useState(false);

  // ── resumo por motorista (view de mês) ──
  const [resumoMotoristas, setResumoMotoristas] = useState([]);
  const [loadingResMot,    setLoadingResMot]    = useState(false);
  const [placasExpandidas, setPlacasExpandidas] = useState(new Set());

  // ── dados carregados do banco ──
  const [registros,  setRegistros]  = useState([]);
  const [loadingReg, setLoadingReg] = useState(false);

  /* ── sincronizar importacaoId quando frotaSel muda ──
     Com frota por registro, não filtramos o dropdown por ic.frota.
     Todas as importações ficam disponíveis; o filtro de frota age nos dados. */
  useEffect(() => {
    if (!importacoes.length) return;
    // apenas garante que o importacaoId selecionado ainda existe na lista
    if (!importacoes.find(i => i.id === importacaoId)) {
      setImportacaoId(importacoes[0].id);
      setPlaca(''); setBuscaPlaca(''); setMesSel('');
    }
  }, [frotaSel, importacoes]);

  /* ── buscar importações ao montar ── */
  useEffect(() => {
    setLoadingImps(true);
    api.get('/medias-consumo/importacoes')
      .then(({ data }) => {
        setImportacoes(data);
        if (data.length > 0) setImportacaoId(data[0].id);
      })
      .catch(() => toast.error('Erro ao carregar importações'))
      .finally(() => setLoadingImps(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // chave estável: evita duplo disparo quando frotaSel muda importacaoId
  const queryKey = frotaSel ? `frota:${frotaSel}` : importacaoId ? `imp:${importacaoId}` : '';

  /* ── buscar placas, meses e resumo geral quando filtro muda ── */
  useEffect(() => {
    if (!queryKey) {
      setPlacas([]); setMeses([]); setPlaca(''); setBuscaPlaca(''); setMesSel('');
      setResumoChart([]); setRegistros([]);
      return;
    }
    const p = frotaSel ? { frota: frotaSel } : { importacaoId };
    api.get('/medias-consumo/placas', { params: p })
      .then(r => { setPlacas(r.data); setPlaca(''); setBuscaPlaca(''); setMesSel(''); setRegistros([]); })
      .catch(() => {});
    api.get('/medias-consumo/meses', { params: p })
      .then(r => setMeses(r.data))
      .catch(() => {});
    setLoadingChart(true);
    api.get('/medias-consumo/resumo-mensal', { params: p })
      .then(r => setResumoChart(r.data))
      .catch(() => {})
      .finally(() => setLoadingChart(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryKey]);

  /* ── atualizar gráfico quando placa muda ── */
  useEffect(() => {
    if (!queryKey && !placa) return;
    setLoadingChart(true);
    // quando há placa, ignora frota e busca em todas as importações
    const params = placa
      ? { placa }
      : frotaSel ? { frota: frotaSel } : { importacaoId };
    api.get('/medias-consumo/resumo-mensal', { params })
      .then(r => setResumoChart(r.data))
      .catch(() => {})
      .finally(() => setLoadingChart(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryKey, placa]);

  /* ── buscar registros quando placa muda ── */
  useEffect(() => {
    if (!placa) { setRegistros([]); setMesSel(''); return; }
    setLoadingReg(true);
    // busca só pela placa, sem restrição de frota
    api.get('/medias-consumo', { params: { placa } })
      .then(r => setRegistros(r.data))
      .catch(() => toast.error('Erro ao carregar dados'))
      .finally(() => setLoadingReg(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placa]);

  /* ── carregar resumo por motorista quando mesFiltro muda ── */
  useEffect(() => {
    if (!queryKey || !mesFiltro) { setResumoMotoristas([]); return; }
    const base = frotaSel ? { frota: frotaSel } : { importacaoId };
    const [ano, mes] = mesFiltro.split('-');
    setLoadingResMot(true);
    api.get('/medias-consumo/resumo-motoristas', { params: { ...base, mes, ano } })
      .then(r => setResumoMotoristas(r.data))
      .catch(() => toast.error('Erro ao carregar resumo do mês'))
      .finally(() => setLoadingResMot(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryKey, mesFiltro]);

  /* ── resumo mensal ── */
  const resumoMensal = useMemo(() => {
    if (!registros.length) return [];
    const map = {};
    for (const r of registros) {
      const chave = r.data?.slice(0, 7); // YYYY-MM
      if (!chave) continue;
      if (!map[chave]) map[chave] = { chave, diesel: [], todos: [] };
      map[chave].todos.push(r);
      if (String(r.produto || '').toLowerCase().includes('diesel')) map[chave].diesel.push(r);
    }
    return Object.values(map).sort((a, b) => a.chave.localeCompare(b.chave)).map(m => {
      const dieselComKm = m.diesel.filter(r => Number(r.distancia) > 0);
      const totalKm    = dieselComKm.reduce((s, r) => s + Number(r.distancia || 0), 0);
      const totalLit   = dieselComKm.reduce((s, r) => s + Number(r.litros || 0), 0);
      const totalGasto = m.todos.reduce((s, r) => s + Number(r.vlrTotal || 0), 0);
      const mediaReal  = totalLit > 0 ? totalKm / totalLit : 0;
      const sugs       = dieselComKm.filter(r => Number(r.mediaSugerida) > 0);
      const mediaSug   = sugs.length ? sugs.reduce((s, r) => s + Number(r.mediaSugerida), 0) / sugs.length : 0;
      const perc       = mediaSug > 0 ? (mediaReal / mediaSug) * 100 : 0;
      return { ...m, totalKm, totalLit, totalGasto, mediaReal, mediaSug, perc };
    });
  }, [registros]);

  /* ── detalhe mês ── */
  const detalhe = useMemo(() => {
    if (!mesSel) return [];
    return registros.filter(r => r.data?.slice(0, 7) === mesSel).sort((a, b) => a.data?.localeCompare(b.data));
  }, [registros, mesSel]);

  const summaryMes = useMemo(() => {
    if (!detalhe.length) return null;
    const dieselTodos = detalhe.filter(r => String(r.produto || '').toLowerCase().includes('diesel'));
    const diesel      = dieselTodos.filter(r => Number(r.distancia) > 0);
    const arla        = detalhe.filter(r => String(r.produto || '').toLowerCase().includes('arla'));
    const totalKm     = diesel.reduce((s, r) => s + Number(r.distancia || 0), 0);
    const totalLit    = diesel.reduce((s, r) => s + Number(r.litros || 0), 0);
    const totalArla   = arla.reduce((s, r) => s + Number(r.litros || 0), 0);
    const totalGasto  = detalhe.reduce((s, r) => s + Number(r.vlrTotal || 0), 0);
    const mediaReal   = totalLit > 0 ? totalKm / totalLit : 0;
    const sugs        = diesel.filter(r => Number(r.mediaSugerida) > 0);
    const mediaSug    = sugs.length ? sugs.reduce((s, r) => s + Number(r.mediaSugerida), 0) / sugs.length : 0;
    const perc        = mediaSug > 0 ? (mediaReal / mediaSug) * 100 : 0;
    const custoKm     = totalKm > 0 ? totalGasto / totalKm : 0;
    return { totalKm, totalLit, totalArla, totalGasto, mediaReal, mediaSug, perc, custoKm };
  }, [detalhe]);

  function toggleMes(chave) {
    const abrindo = mesSel !== chave;
    setMesSel(abrindo ? chave : '');
    setTimeout(() => {
      const el = rowRefs.current[chave];
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, abrindo ? 50 : 0);
  }

  // KPIs: mês selecionado ou totais gerais
  const kpis = useMemo(() => {
    if (!resumoChart.length) return null;
    const fonte = mesFiltro
      ? resumoChart.filter(m => m.mes === mesFiltro)
      : resumoChart;
    if (!fonte.length) return null;
    const totalGasto  = fonte.reduce((s, m) => s + m.totalGasto, 0);
    const totalKm     = fonte.reduce((s, m) => s + m.totalKm, 0);
    const totalLitros = fonte.reduce((s, m) => s + m.totalLitros, 0);
    const totalArla   = fonte.reduce((s, m) => s + (m.totalArla || 0), 0);
    const mediaReal   = totalLitros > 0 ? totalKm / totalLitros : 0;
    const custoKm     = totalKm > 0 ? totalGasto / totalKm : 0;
    return { totalGasto, totalKm, totalLitros, totalArla, mediaReal, custoKm };
  }, [resumoChart, mesFiltro]);

  const imp = importacoes.find(i => i.id === importacaoId);

  /* ─────────── render ─────────── */
  return (
    <div>
      {/* ── HEADER com título + abas ── */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <h2 style={{ fontSize:20, fontWeight:700, color:'#1a1a2e', margin:0 }}>Médias de Consumo</h2>
          <div style={{ display:'flex', gap:4, background:'#f1f5f9', borderRadius:10, padding:4 }}>
            {[{ id:'geral', label:'Geral' }, { id:'placa', label:'Por Placa' }].map(ab => (
              <button key={ab.id} onClick={() => { setAbaAtiva(ab.id); setPlaca(''); setBuscaPlaca(''); setMesSel(''); setMesFiltro(''); }}
                style={{ padding:'5px 14px', borderRadius:7, border:'none', fontSize:12, fontWeight:600, cursor:'pointer',
                  background: abaAtiva === ab.id ? '#fff' : 'transparent',
                  color: abaAtiva === ab.id ? '#EB3238' : '#64748b',
                  boxShadow: abaAtiva === ab.id ? '0 1px 4px rgba(0,0,0,0.08)' : 'none' }}>
                {ab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Sem importações ── */}
      {!loadingImps && importacoes.length === 0 && (
        <div style={{ textAlign:'center', padding:60, color:'#9ca3af', background:'#fff', borderRadius:12, border:'1px dashed #d1d5db' }}>
          <i className="ti ti-file-spreadsheet" style={{ fontSize:40, display:'block', marginBottom:10, color:'#d1d5db' }}></i>
          <div style={{ fontWeight:500, marginBottom:4 }}>Nenhum dado importado</div>
          <div style={{ fontSize:12 }}>Use a aba "Importações Consumo" para carregar planilhas</div>
        </div>
      )}

      {importacoes.length > 0 && (
        <>
          {/* ── FROTA PILLS ── */}
          <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap', marginBottom:10 }}>
            {FROTAS.map(f => {
              const bgAtivo = f === 'FROTA' ? '#065f46' : '#EB3238';
              return (
                <button key={f} onClick={() => setFrotaSel(frotaSel === f ? '' : f)}
                  style={{ padding:'6px 20px', borderRadius:20, border:'none', fontSize:12, fontWeight:700, cursor:'pointer',
                    background: frotaSel === f ? bgAtivo : '#f1f5f9',
                    color:      frotaSel === f ? '#fff'   : '#64748b',
                    boxShadow:  frotaSel === f ? '0 2px 8px rgba(0,0,0,0.15)' : 'none' }}>
                  {f}
                </button>
              );
            })}
          </div>

          {/* ══════════════ ABA GERAL ══════════════ */}
          {abaAtiva === 'geral' && (
            <>
              {/* ── FILTRO DE MÊS ── */}
              {meses.length > 0 && (
                <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap', marginBottom:16 }}>
                  <button onClick={() => setMesFiltro('')}
                    style={{ padding:'5px 14px', borderRadius:20, fontSize:12, fontWeight:600, cursor:'pointer', border:'none',
                      background: !mesFiltro ? '#EB3238' : '#f1f5f9',
                      color:      !mesFiltro ? '#fff'    : '#64748b' }}>
                    Todos
                  </button>
                  {meses.map(m => {
                    const [ano, mes] = m.split('-');
                    const label = new Date(Number(ano), Number(mes)-1, 1).toLocaleDateString('pt-BR', { month:'short', year:'2-digit' }).replace('.','');
                    return (
                      <button key={m} onClick={() => setMesFiltro(mesFiltro === m ? '' : m)}
                        style={{ padding:'4px 12px', borderRadius:20, fontSize:11, fontWeight:500, cursor:'pointer',
                          border:      mesFiltro === m ? '1px solid #EB3238' : '1px solid #e2e8f0',
                          background:  mesFiltro === m ? '#EB3238' : '#fff',
                          color:       mesFiltro === m ? '#fff'    : '#475569' }}>
                        {label}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* ── KPI CARDS (filtrados pelo mês se selecionado) ── */}
              {kpis && (
                <div style={{ marginBottom:16 }}>
                  {mesFiltro && (
                    <div style={{ fontSize:11, fontWeight:700, color:'#EB3238', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:8, display:'flex', alignItems:'center', gap:6 }}>
                      <i className="ti ti-calendar-event"></i>
                      {fmtMesStr(mesFiltro)}
                    </div>
                  )}
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(150px, 1fr))', gap:12 }}>
                    {[
                      { label:'Total Gasto',   value: fmtR(kpis.totalGasto),          icon:'ti-currency-real',  color:'#EB3238', bg:'#fef2f2' },
                      { label:'Km Rodados',    value: `${fmtN(kpis.totalKm,0)} km`,   icon:'ti-road',           color:'#1d4ed8', bg:'#eff6ff' },
                      { label:'Litros Diesel', value: `${fmtN(kpis.totalLitros)} L`,  icon:'ti-droplet',        color:'#0f766e', bg:'#f0fdfa' },
                      { label:'Litros Arla',   value: `${fmtN(kpis.totalArla)} L`,    icon:'ti-droplet-half-2', color:'#7c3aed', bg:'#f5f3ff' },
                      { label:'Média Real',    value: `${fmtN(kpis.mediaReal)} km/L`, icon:'ti-gauge',          color:'#d97706', bg:'#fffbeb' },
                      { label:'Custo/km',      value: `R$ ${fmtN(kpis.custoKm,3)}`,  icon:'ti-coin',           color:'#374151', bg:'#f9fafb' },
                    ].map(card => (
                      <div key={card.label} style={{ background:'#fff', border:'1px solid #e5e7eb', borderRadius:12, padding:'14px 16px' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
                          <div style={{ width:28, height:28, borderRadius:7, background:card.bg, display:'flex', alignItems:'center', justifyContent:'center' }}>
                            <i className={`ti ${card.icon}`} style={{ fontSize:14, color:card.color }}></i>
                          </div>
                          <span style={{ fontSize:10, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'0.5px' }}>{card.label}</span>
                        </div>
                        <div style={{ fontSize:18, fontWeight:800, color:card.color }}>{card.value}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── GRÁFICO MENSAL ── */}
              {resumoChart.length > 0 && (
                <div style={{ background:'linear-gradient(135deg,#1e293b 0%,#0f172a 100%)', borderRadius:16, padding:'24px 20px 16px', boxShadow:'0 8px 32px rgba(0,0,0,0.18)', marginBottom:16 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
                    <div>
                      <div style={{ color:'#f1f5f9', fontSize:15, fontWeight:700 }}>Total gasto por mês</div>
                      <div style={{ color:'#64748b', fontSize:12, marginTop:2 }}>
                        {mesFiltro ? fmtMesStr(mesFiltro) + ' selecionado' : 'Selecione um mês acima para filtrar'}
                      </div>
                    </div>
                    {loadingChart && <span style={{ fontSize:12, color:'#64748b' }}>Carregando...</span>}
                  </div>
                  {!loadingChart && (
                    <ResponsiveContainer width="100%" height={340}>
                      <ComposedChart
                        data={resumoChart.map(m => ({ ...m, label: fmtMesCurto(m.mes) }))}
                        margin={{ top: 28, right: 16, left: 0, bottom: 4 }}
                        barCategoryGap="28%"
                      >
                        {(() => {
                          const corBase = frotaSel === 'FROTA' ? '#10b981' : '#3b82f6';
                          const corBaseDark = frotaSel === 'FROTA' ? '#065f46' : '#1d4ed8';
                          const corSel  = frotaSel === 'FROTA' ? '#34d399' : '#60a5fa';
                          const corLabel = frotaSel === 'FROTA' ? '#6ee7b7' : '#93c5fd';
                          return (
                            <>
                              <defs>
                                <linearGradient id="mcBarGrad" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="0%" stopColor={corBase} stopOpacity={1} />
                                  <stop offset="100%" stopColor={corBaseDark} stopOpacity={0.9} />
                                </linearGradient>
                                <linearGradient id="mcBarGradSel" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="0%" stopColor={corSel} stopOpacity={1} />
                                  <stop offset="100%" stopColor={corBase} stopOpacity={1} />
                                </linearGradient>
                              </defs>
                              <CartesianGrid strokeDasharray="3 3" stroke="#1e3a5f" vertical={false} />
                              <XAxis dataKey="label" tick={{ fontSize:12, fill:'#94a3b8', fontWeight:500 }} axisLine={false} tickLine={false} interval={0} />
                              <YAxis tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} tick={{ fontSize:11, fill:'#64748b' }} axisLine={false} tickLine={false} width={62} />
                              <Tooltip content={<TooltipGrafico />} cursor={{ fill:'rgba(255,255,255,0.04)' }} />
                              <Bar dataKey="totalGasto" name="Total Gasto" radius={[8,8,0,0]} maxBarSize={52}>
                                {resumoChart.map((entry, i) => (
                                  <Cell key={i} fill={mesFiltro === entry.mes ? 'url(#mcBarGradSel)' : 'url(#mcBarGrad)'} />
                                ))}
                                <LabelList dataKey="totalGasto" position="top" style={{ fontSize:10, fontWeight:700, fill: corLabel }} formatter={v => `R$${(v/1000).toFixed(1)}k`} />
                                <LabelList dataKey="totalCaminhoes" position="insideTop" style={{ fontSize:10, fontWeight:700, fill:'rgba(255,255,255,0.92)' }} formatter={v => v > 0 ? `🚛 ${v}` : ''} />
                              </Bar>
                              <Line dataKey="totalGasto" name="Tendência" type="monotone" stroke="#fbbf24" strokeWidth={2} dot={{ r:3, fill:'#fbbf24', stroke:'#0f172a', strokeWidth:2 }} activeDot={{ r:5, fill:'#fbbf24' }} legendType="none" />
                            </>
                          );
                        })()}
                      </ComposedChart>
                    </ResponsiveContainer>
                  )}
                </div>
              )}
            </>
          )}

          {/* ══════════════ ABA POR PLACA ══════════════ */}
          {abaAtiva === 'placa' && (
            <>
              {/* ── filtros: mês + busca placa ── */}
              <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap', marginBottom:12 }}>
                {/* pills de mês */}
                {meses.length > 0 && (
                  <>
                    <button onClick={() => { setMesFiltro(''); setPlaca(''); setBuscaPlaca(''); setMesSel(''); }}
                      style={{ padding:'5px 14px', borderRadius:20, fontSize:12, fontWeight:600, cursor:'pointer', border:'none',
                        background: !mesFiltro ? '#EB3238' : '#f1f5f9',
                        color:      !mesFiltro ? '#fff'    : '#64748b' }}>
                      Todos
                    </button>
                    {meses.map(m => {
                      const [ano, mes] = m.split('-');
                      const label = new Date(Number(ano), Number(mes)-1, 1).toLocaleDateString('pt-BR', { month:'short', year:'2-digit' }).replace('.','');
                      return (
                        <button key={m} onClick={() => { setMesFiltro(mesFiltro === m ? '' : m); setPlaca(''); setBuscaPlaca(''); setMesSel(''); }}
                          style={{ padding:'4px 12px', borderRadius:20, fontSize:11, fontWeight:500, cursor:'pointer',
                            border:     mesFiltro === m ? '1px solid #EB3238' : '1px solid #e2e8f0',
                            background: mesFiltro === m ? '#EB3238' : '#fff',
                            color:      mesFiltro === m ? '#fff'    : '#475569' }}>
                          {label}
                        </button>
                      );
                    })}
                    <span style={{ color:'#d1d5db', fontSize:14, marginLeft:2, marginRight:2 }}>|</span>
                  </>
                )}

                {/* busca placa */}
                <div style={{ position:'relative' }}>
                  <i className="ti ti-search" style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', fontSize:13, color:'#9ca3af', pointerEvents:'none' }}></i>
                  <input
                    value={buscaPlaca}
                    onChange={e => { setBuscaPlaca(e.target.value.toUpperCase()); }}
                    onBlur={() => { setPlaca(buscaPlaca); setMesSel(''); setMesFiltro(''); }}
                    onKeyDown={e => { if (e.key === 'Enter') { setPlaca(buscaPlaca); setMesSel(''); setMesFiltro(''); e.target.blur(); } }}
                    placeholder="Buscar placa..."
                    style={{ padding:'6px 10px 6px 30px', border:'1.5px solid #d1d5db', borderRadius:8, fontSize:12, color:'#374151', background:'#fff', outline:'none', width:200 }}
                  />
                </div>
                {(placa || buscaPlaca) && (
                  <button onClick={() => { setPlaca(''); setBuscaPlaca(''); setMesSel(''); }}
                    style={{ padding:'5px 9px', border:'none', borderRadius:7, background:'#fee2e2', color:'#dc2626', fontSize:11, cursor:'pointer', display:'flex', alignItems:'center', gap:3 }}>
                    <i className="ti ti-x"></i> Limpar placa
                  </button>
                )}
              </div>

              {/* ── tabela de motoristas quando mês selecionado (sem placa) ── */}
              {mesFiltro && !placa && (
                <div style={{ background:'#fff', border:'1px solid #e5e7eb', borderRadius:12, overflow:'hidden', marginBottom:16 }}>
                  <div style={{ padding:'14px 20px', display:'flex', alignItems:'center', gap:8, borderBottom:'1px solid #f3f4f6' }}>
                    <i className="ti ti-users" style={{ color:'#EB3238', fontSize:15 }}></i>
                    <span style={{ fontWeight:700, fontSize:14, color:'#1a1a2e' }}>{fmtMesStr(mesFiltro)} — por motorista</span>
                    {loadingResMot && <span style={{ fontSize:11, color:'#9ca3af' }}>carregando...</span>}
                  </div>
                  {!loadingResMot && resumoMotoristas.length > 0 && (
                    <div style={{ overflowX:'auto' }}>
                      <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
                        <thead>
                          <tr style={{ background:'#f8fafc' }}>
                            {['Motorista','Placa','Km','Litros','Média Real','Média Sug.','% Ating.','Total Gasto'].map(h => (
                              <th key={h} style={{ padding:'9px 14px', textAlign:h==='Motorista'||h==='Placa'?'left':'right', fontSize:10, fontWeight:700, color:'#374151', textTransform:'uppercase', letterSpacing:'0.4px', borderBottom:'1px solid #e5e7eb', whiteSpace:'nowrap' }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {resumoMotoristas.map((m, i) => (
                            <tr key={m.motorista} style={{ background:i%2===0?'#fff':'#fafafa' }}
                              onMouseEnter={e => e.currentTarget.style.background='#fef2f2'}
                              onMouseLeave={e => e.currentTarget.style.background=i%2===0?'#fff':'#fafafa'}>
                              <td style={{ padding:'10px 14px', fontWeight:600, color:'#1a1a2e', borderBottom:'1px solid #f3f4f6', whiteSpace:'nowrap' }}>{m.motorista}</td>
                              <td style={{ padding:'10px 14px', borderBottom:'1px solid #f3f4f6' }}>
                                <span style={{ padding:'2px 8px', borderRadius:6, background:'#f1f5f9', color:'#374151', fontSize:11, fontWeight:700, fontFamily:'monospace' }}>{(m.placas||'—').split(', ')[0]}</span>
                              </td>
                              <td style={{ padding:'10px 14px', textAlign:'right', borderBottom:'1px solid #f3f4f6' }}>{fmtN(m.totalKm,0)}</td>
                              <td style={{ padding:'10px 14px', textAlign:'right', borderBottom:'1px solid #f3f4f6' }}>{fmtN(m.totalLitros)}</td>
                              <td style={{ padding:'10px 14px', textAlign:'right', fontWeight:600, borderBottom:'1px solid #f3f4f6' }}>{fmtN(m.mediaReal)}</td>
                              <td style={{ padding:'10px 14px', textAlign:'right', color:'#6b7280', borderBottom:'1px solid #f3f4f6' }}>{fmtN(m.mediaSug)}</td>
                              <td style={{ padding:'10px 14px', textAlign:'right', borderBottom:'1px solid #f3f4f6' }}>
                                <span style={{ fontWeight:700, color:corPerc(m.perc) }}>{fmtN(m.perc,1)}%</span>
                                <div style={{ marginTop:3, height:3, borderRadius:2, background:'#e5e7eb', width:60, marginLeft:'auto' }}>
                                  <div style={{ height:'100%', borderRadius:2, background:corPerc(m.perc), width:`${Math.min(m.perc,100)}%` }}></div>
                                </div>
                              </td>
                              <td style={{ padding:'10px 14px', textAlign:'right', fontWeight:600, color:'#EB3238', borderBottom:'1px solid #f3f4f6' }}>{fmtR(m.totalGasto)}</td>
                            </tr>
                          ))}
                        </tbody>
                        {resumoMotoristas.length > 1 && (() => {
                          const tk=resumoMotoristas.reduce((s,m)=>s+m.totalKm,0);
                          const tl=resumoMotoristas.reduce((s,m)=>s+m.totalLitros,0);
                          const tg=resumoMotoristas.reduce((s,m)=>s+m.totalGasto,0);
                          const mr=tl>0?tk/tl:0;
                          const sg=resumoMotoristas.filter(m=>m.mediaSug>0);
                          const ms=sg.length?sg.reduce((s,m)=>s+m.mediaSug,0)/sg.length:0;
                          const pc=ms>0?(mr/ms)*100:0;
                          return (
                            <tfoot>
                              <tr style={{ background:'#f8fafc', fontWeight:700 }}>
                                <td style={{ padding:'11px 14px', color:'#374151' }}>TOTAL / MÉDIA</td>
                                <td style={{ padding:'11px 14px' }}></td>
                                <td style={{ padding:'11px 14px', textAlign:'right' }}>{fmtN(tk,0)}</td>
                                <td style={{ padding:'11px 14px', textAlign:'right' }}>{fmtN(tl)}</td>
                                <td style={{ padding:'11px 14px', textAlign:'right' }}>{fmtN(mr)}</td>
                                <td style={{ padding:'11px 14px', textAlign:'right', color:'#6b7280' }}>{fmtN(ms)}</td>
                                <td style={{ padding:'11px 14px', textAlign:'right', color:corPerc(pc) }}>{fmtN(pc,1)}%</td>
                                <td style={{ padding:'11px 14px', textAlign:'right', color:'#EB3238' }}>{fmtR(tg)}</td>
                              </tr>
                            </tfoot>
                          );
                        })()}
                      </table>
                    </div>
                  )}
                  {!loadingResMot && resumoMotoristas.length === 0 && (
                    <div style={{ padding:30, textAlign:'center', color:'#9ca3af', fontSize:13 }}>Nenhum dado para este mês.</div>
                  )}
                </div>
              )}

              {/* estado vazio: sem mês e sem placa */}
              {!mesFiltro && !placa && (
                <div style={{ textAlign:'center', padding:60, color:'#9ca3af', background:'#fff', borderRadius:12, border:'1px dashed #d1d5db' }}>
                  <i className="ti ti-truck" style={{ fontSize:40, display:'block', marginBottom:10, color:'#d1d5db' }}></i>
                  <div style={{ fontWeight:500, marginBottom:4 }}>Selecione um mês ou busque uma placa</div>
                  <div style={{ fontSize:12 }}>Use os filtros acima para ver os detalhes</div>
                </div>
              )}

              {loadingReg && (
                <div style={{ textAlign:'center', padding:30, color:'#9ca3af' }}>Carregando dados...</div>
              )}

              {/* KPIs da placa */}
              {placa && kpis && (
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(150px, 1fr))', gap:12, marginBottom:16 }}>
                  {[
                    { label:'Total Gasto',   value: fmtR(kpis.totalGasto),          icon:'ti-currency-real',  color:'#EB3238', bg:'#fef2f2' },
                    { label:'Km Rodados',    value: `${fmtN(kpis.totalKm,0)} km`,   icon:'ti-road',           color:'#1d4ed8', bg:'#eff6ff' },
                    { label:'Litros Diesel', value: `${fmtN(kpis.totalLitros)} L`,  icon:'ti-droplet',        color:'#0f766e', bg:'#f0fdfa' },
                    { label:'Litros Arla',   value: `${fmtN(kpis.totalArla)} L`,    icon:'ti-droplet-half-2', color:'#7c3aed', bg:'#f5f3ff' },
                    { label:'Média Real',    value: `${fmtN(kpis.mediaReal)} km/L`, icon:'ti-gauge',          color:'#d97706', bg:'#fffbeb' },
                    { label:'Custo/km',      value: `R$ ${fmtN(kpis.custoKm,3)}`,  icon:'ti-coin',           color:'#374151', bg:'#f9fafb' },
                  ].map(card => (
                    <div key={card.label} style={{ background:'#fff', border:'1px solid #e5e7eb', borderRadius:12, padding:'14px 16px' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
                        <div style={{ width:28, height:28, borderRadius:7, background:card.bg, display:'flex', alignItems:'center', justifyContent:'center' }}>
                          <i className={`ti ${card.icon}`} style={{ fontSize:14, color:card.color }}></i>
                        </div>
                        <span style={{ fontSize:10, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'0.5px' }}>{card.label}</span>
                      </div>
                      <div style={{ fontSize:18, fontWeight:800, color:card.color }}>{card.value}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Resumo mensal accordion por placa */}
              {!loadingReg && resumoMensal.length > 0 && (
                <div style={{ background:'#fff', border:'1px solid #e5e7eb', borderRadius:12, overflow:'hidden' }}>
                  <div style={{ padding:'16px 20px', borderBottom:'1px solid #e5e7eb', display:'flex', alignItems:'center', gap:8 }}>
                    <i className="ti ti-chart-line" style={{ color:'#EB3238', fontSize:16 }}></i>
                    <span style={{ fontWeight:600, fontSize:14, color:'#1a1a2e' }}>{placa} — resumo mensal</span>
                    <span style={{ marginLeft:'auto', fontSize:12, color:'#9ca3af' }}>Clique em um mês para detalhar</span>
                  </div>
                  <div style={{ overflowX:'auto' }}>
                    <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
                      <thead>
                        <tr style={{ background:'#f8fafc' }}>
                          {['Mês','Distância (km)','Litros Diesel','Média Real','Média Sug.','% Atingido','Total Gasto'].map(h => (
                            <th key={h} style={{ padding:'10px 16px', textAlign:h==='Mês'?'left':'right', fontSize:11, fontWeight:700, color:'#374151', textTransform:'uppercase', letterSpacing:'0.4px', borderBottom:'1px solid #e5e7eb', whiteSpace:'nowrap' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {resumoMensal.map(m => {
                          const aberto = mesSel === m.chave;
                          const det = aberto ? detalhe : [];
                          const sm  = aberto ? summaryMes : null;
                          return (
                            <>
                              <tr key={m.chave}
                                ref={el => rowRefs.current[m.chave] = el}
                                onClick={() => toggleMes(m.chave)}
                                style={{ cursor:'pointer', background: aberto ? '#eff6ff' : '' }}
                                onMouseEnter={e => { if (!aberto) e.currentTarget.style.background='#f0f9ff'; }}
                                onMouseLeave={e => { if (!aberto) e.currentTarget.style.background=''; }}>
                                <td style={{ padding:'12px 16px', borderBottom: aberto?'none':'1px solid #f3f4f6', fontWeight:600, color:'#1a1a2e' }}>
                                  <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                                    <i className={`ti ${aberto?'ti-chevron-down':'ti-chevron-right'}`} style={{ fontSize:12, color:'#EB3238' }}></i>
                                    {fmtMesStr(m.chave)}
                                  </div>
                                </td>
                                <td style={{ padding:'12px 16px', textAlign:'right', borderBottom: aberto?'none':'1px solid #f3f4f6' }}>{fmtN(m.totalKm,0)} km</td>
                                <td style={{ padding:'12px 16px', textAlign:'right', borderBottom: aberto?'none':'1px solid #f3f4f6' }}>{fmtN(m.totalLit)} L</td>
                                <td style={{ padding:'12px 16px', textAlign:'right', borderBottom: aberto?'none':'1px solid #f3f4f6', fontWeight:600, color:'#1a1a2e' }}>{fmtN(m.mediaReal)}</td>
                                <td style={{ padding:'12px 16px', textAlign:'right', borderBottom: aberto?'none':'1px solid #f3f4f6', color:'#6b7280' }}>{fmtN(m.mediaSug)}</td>
                                <td style={{ padding:'12px 16px', textAlign:'right', borderBottom: aberto?'none':'1px solid #f3f4f6' }}>
                                  <span style={{ fontWeight:700, color:corPerc(m.perc) }}>{fmtN(m.perc,1)}%</span>
                                  <div style={{ marginTop:4, height:4, borderRadius:2, background:'#e5e7eb', width:80, marginLeft:'auto' }}>
                                    <div style={{ height:'100%', borderRadius:2, background:corPerc(m.perc), width:`${Math.min(m.perc,100)}%` }}></div>
                                  </div>
                                </td>
                                <td style={{ padding:'12px 16px', textAlign:'right', borderBottom: aberto?'none':'1px solid #f3f4f6', fontWeight:600 }}>{fmtR(m.totalGasto)}</td>
                              </tr>
                              {aberto && sm && (
                                <tr key={`${m.chave}-det`}>
                                  <td colSpan={7} style={{ padding:'0 0 8px', background:'#f8fafc', borderBottom:'2px solid #e5e7eb' }}>
                                    <div style={{ display:'flex', flexWrap:'wrap', gap:10, padding:'14px 16px 10px' }}>
                                      {[
                                        ['Distância',    `${fmtN(sm.totalKm,0)} km`],
                                        ['Litros Diesel',`${fmtN(sm.totalLit)} L`],
                                        ['Litros Arla',  `${fmtN(sm.totalArla)} L`],
                                        ['Média Real',   `${fmtN(sm.mediaReal)} km/L`, corPerc(sm.perc)],
                                        ['Média Sugerida',`${fmtN(sm.mediaSug)} km/L`],
                                        ['% Atingido',   `${fmtN(sm.perc,1)}%`, corPerc(sm.perc)],
                                        ['Custo/km',     `R$ ${fmtN(sm.custoKm,4)}`],
                                        ['Total Gasto',  fmtR(sm.totalGasto)],
                                      ].map(([lbl,val,cor='#1a1a2e']) => (
                                        <div key={lbl} style={{ background:'#fff', border:'1px solid #e5e7eb', borderRadius:8, padding:'10px 14px', minWidth:110 }}>
                                          <div style={{ fontSize:10, color:'#6b7280', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.4px', marginBottom:4 }}>{lbl}</div>
                                          <div style={{ fontSize:18, fontWeight:700, color:cor }}>{val}</div>
                                        </div>
                                      ))}
                                    </div>
                                    <div style={{ overflowX:'auto', padding:'0 8px 8px' }}>
                                      <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12, background:'#fff', borderRadius:8, overflow:'hidden' }}>
                                        <thead>
                                          <tr style={{ background:'#f1f5f9' }}>
                                            {['Data','Produto','Litros','Distância','Média Real','Média Sug','%','Vlr Total','Posto'].map(h => (
                                              <th key={h} style={{ padding:'8px 10px', textAlign:['Litros','Distância','Média Real','Média Sug','%','Vlr Total'].includes(h)?'right':'left', fontSize:10, fontWeight:700, color:'#374151', textTransform:'uppercase', whiteSpace:'nowrap', borderBottom:'1px solid #e5e7eb' }}>{h}</th>
                                            ))}
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {det.map((r,i) => {
                                            const isDiesel = String(r.produto||'').toLowerCase().includes('diesel');
                                            const perc = r.mediaSugerida>0?(r.mediaRealizada/r.mediaSugerida)*100:null;
                                            return (
                                              <tr key={i} style={{ background:i%2===0?'#fff':'#f9fafb' }}>
                                                <td style={{ padding:'7px 10px', whiteSpace:'nowrap', borderBottom:'1px solid #f3f4f6' }}>{fmtDt(r.data?.slice(0,10))}</td>
                                                <td style={{ padding:'7px 10px', borderBottom:'1px solid #f3f4f6' }}>
                                                  <span style={{ padding:'2px 6px', borderRadius:4, fontSize:10, fontWeight:600, background:isDiesel?'#eff6ff':'#f0fdf4', color:isDiesel?'#1d4ed8':'#15803d' }}>{isDiesel?'Diesel':'Arla'}</span>
                                                </td>
                                                <td style={{ padding:'7px 10px', textAlign:'right', borderBottom:'1px solid #f3f4f6' }}>{fmtN(r.litros)}</td>
                                                <td style={{ padding:'7px 10px', textAlign:'right', borderBottom:'1px solid #f3f4f6' }}>{r.distancia?`${fmtN(r.distancia,0)} km`:'—'}</td>
                                                <td style={{ padding:'7px 10px', textAlign:'right', fontWeight:600, borderBottom:'1px solid #f3f4f6' }}>{isDiesel&&r.mediaRealizada?fmtN(r.mediaRealizada):'—'}</td>
                                                <td style={{ padding:'7px 10px', textAlign:'right', color:'#6b7280', borderBottom:'1px solid #f3f4f6' }}>{isDiesel&&r.mediaSugerida?fmtN(r.mediaSugerida):'—'}</td>
                                                <td style={{ padding:'7px 10px', textAlign:'right', borderBottom:'1px solid #f3f4f6' }}>{perc!==null&&isDiesel?<span style={{ fontWeight:700, color:corPerc(perc) }}>{fmtN(perc,0)}%</span>:'—'}</td>
                                                <td style={{ padding:'7px 10px', textAlign:'right', fontWeight:600, borderBottom:'1px solid #f3f4f6' }}>{fmtR(r.vlrTotal)}</td>
                                                <td style={{ padding:'7px 10px', color:'#6b7280', maxWidth:140, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', borderBottom:'1px solid #f3f4f6' }}>{r.posto}</td>
                                              </tr>
                                            );
                                          })}
                                        </tbody>
                                      </table>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </>
                          );
                        })}
                      </tbody>
                      {resumoMensal.length > 1 && (() => {
                        const tk=resumoMensal.reduce((s,m)=>s+m.totalKm,0);
                        const tl=resumoMensal.reduce((s,m)=>s+m.totalLit,0);
                        const tg=resumoMensal.reduce((s,m)=>s+m.totalGasto,0);
                        const mr=tl>0?tk/tl:0;
                        const sg=resumoMensal.filter(m=>m.mediaSug>0);
                        const ms=sg.length?sg.reduce((s,m)=>s+m.mediaSug,0)/sg.length:0;
                        const pc=ms>0?(mr/ms)*100:0;
                        return (
                          <tfoot>
                            <tr style={{ background:'#f8fafc', fontWeight:700 }}>
                              <td style={{ padding:'12px 16px', color:'#374151' }}>TOTAL / MÉDIA GERAL</td>
                              <td style={{ padding:'12px 16px', textAlign:'right' }}>{fmtN(tk,0)} km</td>
                              <td style={{ padding:'12px 16px', textAlign:'right' }}>{fmtN(tl)} L</td>
                              <td style={{ padding:'12px 16px', textAlign:'right', color:'#1a1a2e' }}>{fmtN(mr)}</td>
                              <td style={{ padding:'12px 16px', textAlign:'right', color:'#6b7280' }}>{fmtN(ms)}</td>
                              <td style={{ padding:'12px 16px', textAlign:'right', color:corPerc(pc) }}>{fmtN(pc,1)}%</td>
                              <td style={{ padding:'12px 16px', textAlign:'right' }}>{fmtR(tg)}</td>
                            </tr>
                          </tfoot>
                        );
                      })()}
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}

    </div>
  );
}

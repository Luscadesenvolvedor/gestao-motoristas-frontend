import { useState, useEffect, useCallback, useRef } from 'react';
import * as d3 from 'd3';
import api from '../../services/api';
import {
  ComposedChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts';

const UF_LABELS = {
  AC:'Acre', AL:'Alagoas', AM:'Amazonas', AP:'Amapá', BA:'Bahia',
  CE:'Ceará', DF:'Distrito Federal', ES:'Espírito Santo', GO:'Goiás',
  MA:'Maranhão', MG:'Minas Gerais', MS:'Mato Grosso do Sul', MT:'Mato Grosso',
  PA:'Pará', PB:'Paraíba', PE:'Pernambuco', PI:'Piauí', PR:'Paraná',
  RJ:'Rio de Janeiro', RN:'Rio Grande do Norte', RO:'Rondônia', RR:'Roraima',
  RS:'Rio Grande do Sul', SC:'Santa Catarina', SE:'Sergipe', SP:'São Paulo',
  TO:'Tocantins',
};

const GEOJSON_URL = 'https://raw.githubusercontent.com/codeforamerica/click_that_hood/master/public/data/brazil-states.geojson';
const W = 460, H = 500;
const PAD = 30;

function getTopColor(pct, maxPct) {
  if (!pct || !maxPct) return '#1e3a5f';
  const t = pct / maxPct;
  if (t > 0.75) return '#b91c1c';
  if (t > 0.55) return '#dc2626';
  if (t > 0.38) return '#ea580c';
  if (t > 0.22) return '#f97316';
  if (t > 0.10) return '#fbbf24';
  if (t > 0.03) return '#34d399';
  return '#1d4b6a';
}
function fmtR(v) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
}
function fmtN(v, dec = 1) {
  return Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

/* ─── Modal Redes de Postos ─── */
function ModalRedes({ onClose }) {
  const [aba, setAba] = useState('redes');          // 'redes' | 'vincular'
  const [redes, setRedes] = useState([]);
  const [postos, setPostos] = useState([]);
  const [novaRede, setNovaRede] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [busca, setBusca] = useState('');
  const [selecionados, setSelecionados] = useState(new Set());
  const [redeSel, setRedeSel] = useState('');
  const [vinculando, setVinculando] = useState(false);
  const [msg, setMsg] = useState('');

  const carregarRedes = useCallback(async () => {
    const { data } = await api.get('/medias-consumo/redes');
    setRedes(data);
  }, []);

  const carregarPostos = useCallback(async () => {
    const { data } = await api.get('/medias-consumo/postos-lista');
    setPostos(data);
  }, []);

  useEffect(() => { carregarRedes(); }, [carregarRedes]);
  useEffect(() => { if (aba === 'vincular') carregarPostos(); }, [aba, carregarPostos]);

  async function criarRede() {
    if (!novaRede.trim()) return;
    setSalvando(true);
    try {
      const { data } = await api.post('/medias-consumo/redes', { nome: novaRede.trim() });
      setRedes(r => [...r, data]);
      setNovaRede('');
      setMsg('Rede cadastrada!');
    } catch (e) {
      setMsg(e.response?.data?.error || 'Erro ao cadastrar');
    } finally {
      setSalvando(false);
      setTimeout(() => setMsg(''), 2500);
    }
  }

  async function excluirRede(id) {
    if (!confirm('Excluir esta rede?')) return;
    await api.delete(`/medias-consumo/redes/${id}`);
    setRedes(r => r.filter(x => x.id !== id));
  }

  function toggleSel(posto) {
    setSelecionados(prev => {
      const n = new Set(prev);
      n.has(posto) ? n.delete(posto) : n.add(posto);
      return n;
    });
  }
  function toggleTodos() {
    const visiveis = postosFiltrados.map(p => p.posto);
    const todosMarcados = visiveis.every(p => selecionados.has(p));
    setSelecionados(prev => {
      const n = new Set(prev);
      if (todosMarcados) visiveis.forEach(p => n.delete(p));
      else visiveis.forEach(p => n.add(p));
      return n;
    });
  }

  async function vincular() {
    if (!selecionados.size) return setMsg('Selecione ao menos um posto');
    if (!redeSel) return setMsg('Escolha uma rede');
    setVinculando(true);
    try {
      await api.post('/medias-consumo/postos-vincular', {
        postos: [...selecionados],
        redeId: redeSel,
      });
      setMsg(`${selecionados.size} posto(s) vinculado(s)!`);
      setSelecionados(new Set());
      setRedeSel('');
      await carregarPostos();
    } catch (e) {
      setMsg(e.response?.data?.error || 'Erro ao vincular');
    } finally {
      setVinculando(false);
      setTimeout(() => setMsg(''), 3000);
    }
  }

  const postosFiltrados = postos.filter(p =>
    !busca || p.posto.toLowerCase().includes(busca.toLowerCase()) ||
    (p.redeNome || '').toLowerCase().includes(busca.toLowerCase())
  );

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 200,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        background: '#fff', borderRadius: 20, width: '92%', maxWidth: 720,
        maxHeight: '88vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 24px 80px rgba(0,0,0,0.3)',
      }}>
        {/* Modal header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderBottom: '1px solid #f1f5f9' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#1a1a2e' }}>Redes de Postos</h3>
            <div style={{ display: 'flex', gap: 4, background: '#f1f5f9', borderRadius: 10, padding: 4 }}>
              {[{ id:'redes', label:'Redes' }, { id:'vincular', label:'Vincular Postos' }].map(t => (
                <button key={t.id} onClick={() => setAba(t.id)} style={{
                  padding: '5px 14px', borderRadius: 7, border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  background: aba === t.id ? '#fff' : 'transparent',
                  color:      aba === t.id ? '#EB3238' : '#64748b',
                  boxShadow:  aba === t.id ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                }}>{t.label}</button>
              ))}
            </div>
          </div>
          <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 20, color: '#94a3b8', lineHeight: 1 }}>×</button>
        </div>

        {/* Mensagem feedback */}
        {msg && (
          <div style={{ margin: '12px 24px 0', padding: '10px 16px', borderRadius: 10, background: msg.includes('Erro') || msg.includes('Selecione') || msg.includes('Escolha') ? '#fef2f2' : '#f0fdf4', color: msg.includes('Erro') || msg.includes('Selecione') || msg.includes('Escolha') ? '#dc2626' : '#16a34a', fontSize: 13, fontWeight: 600 }}>
            {msg}
          </div>
        )}

        {/* Aba Redes */}
        {aba === 'redes' && (
          <div style={{ flex: 1, overflow: 'auto', padding: '20px 24px' }}>
            {/* Adicionar rede */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
              <input
                value={novaRede}
                onChange={e => setNovaRede(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && criarRede()}
                placeholder="Nome da rede (ex: Shell, Ipiranga, Petrobras...)"
                style={{ flex: 1, padding: '10px 14px', borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: 13, outline: 'none' }}
              />
              <button onClick={criarRede} disabled={salvando || !novaRede.trim()} style={{
                padding: '10px 20px', borderRadius: 10, border: 'none', background: '#EB3238',
                color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                opacity: !novaRede.trim() ? 0.5 : 1,
              }}>Cadastrar</button>
            </div>

            {/* Lista de redes */}
            {redes.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: 13, padding: 32 }}>Nenhuma rede cadastrada</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {redes.map(r => (
                  <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderRadius: 12, background: '#f8fafc', border: '1px solid #f1f5f9' }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14, color: '#1a1a2e' }}>{r.nome}</div>
                      <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{r.total_postos} posto(s) vinculado(s)</div>
                    </div>
                    <button onClick={() => excluirRede(r.id)} style={{ border: 'none', background: '#fef2f2', color: '#dc2626', padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                      Excluir
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Aba Vincular Postos */}
        {aba === 'vincular' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '16px 24px 20px' }}>
            {/* Barra de ação */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
              <input
                value={busca}
                onChange={e => setBusca(e.target.value)}
                placeholder="Buscar posto..."
                style={{ flex: 1, minWidth: 200, padding: '9px 14px', borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: 13, outline: 'none' }}
              />
              <select
                value={redeSel}
                onChange={e => setRedeSel(e.target.value)}
                style={{ padding: '9px 14px', borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: 13, color: '#1a1a2e', outline: 'none', minWidth: 180 }}
              >
                <option value="">Selecionar rede...</option>
                {redes.map(r => <option key={r.id} value={r.id}>{r.nome}</option>)}
              </select>
              <button onClick={vincular} disabled={vinculando || !selecionados.size || !redeSel} style={{
                padding: '9px 20px', borderRadius: 10, border: 'none',
                background: selecionados.size && redeSel ? '#065f46' : '#f1f5f9',
                color: selecionados.size && redeSel ? '#fff' : '#94a3b8',
                fontSize: 13, fontWeight: 700, cursor: selecionados.size && redeSel ? 'pointer' : 'default',
                transition: 'background 0.2s',
              }}>
                {vinculando ? 'Vinculando...' : `Vincular${selecionados.size ? ` (${selecionados.size})` : ''}`}
              </button>
            </div>

            {/* Cabeçalho tabela */}
            <div style={{ display: 'grid', gridTemplateColumns: '36px 1fr 140px 130px', gap: 8, padding: '6px 12px', fontSize: 10, fontWeight: 700, color: '#94a3b8', letterSpacing: 0.8 }}>
              <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                <input type="checkbox"
                  checked={postosFiltrados.length > 0 && postosFiltrados.every(p => selecionados.has(p.posto))}
                  onChange={toggleTodos}
                  style={{ cursor: 'pointer' }}
                />
              </label>
              <span>POSTO</span>
              <span style={{ textAlign: 'right' }}>TOTAL DIESEL</span>
              <span>REDE</span>
            </div>

            {/* Lista de postos */}
            <div style={{ flex: 1, overflowY: 'auto', borderRadius: 12, border: '1px solid #f1f5f9' }}>
              {postosFiltrados.length === 0 ? (
                <div style={{ padding: 32, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
                  {postos.length === 0 ? 'Nenhum posto encontrado nos dados importados' : 'Nenhum posto encontrado para essa busca'}
                </div>
              ) : postosFiltrados.map((p, i) => (
                <div key={p.posto} onClick={() => toggleSel(p.posto)} style={{
                  display: 'grid', gridTemplateColumns: '36px 1fr 140px 130px', gap: 8,
                  padding: '10px 12px', cursor: 'pointer',
                  background: selecionados.has(p.posto) ? '#f0fdf4' : i % 2 === 0 ? '#fff' : '#fafafa',
                  borderBottom: '1px solid #f1f5f9',
                  transition: 'background 0.12s',
                }}>
                  <input type="checkbox" checked={selecionados.has(p.posto)} onChange={() => toggleSel(p.posto)}
                    onClick={e => e.stopPropagation()} style={{ cursor: 'pointer' }} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1a2e' }}>{p.posto}</div>
                    <div style={{ fontSize: 10, color: '#94a3b8' }}>{p.totalRegistros} abastecimentos</div>
                  </div>
                  <div style={{ textAlign: 'right', fontSize: 12, fontWeight: 700, color: '#475569', alignSelf: 'center' }}>
                    {fmtR(p.totalGasto)}
                  </div>
                  <div style={{ alignSelf: 'center' }}>
                    {p.redeNome ? (
                      <span style={{ background: '#eff6ff', color: '#1d4ed8', fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20 }}>
                        {p.redeNome}
                      </span>
                    ) : (
                      <span style={{ color: '#cbd5e1', fontSize: 11 }}>—</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 8 }}>
              {postosFiltrados.length} posto(s) exibido(s) · {selecionados.size} selecionado(s)
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Cores fixas para redes (cicla automaticamente)
const REDE_CORES = ['#EB3238','#3b82f6','#10b981','#f59e0b','#8b5cf6','#ec4899','#06b6d4','#84cc16'];

/* ─── Dashboard Consulta Posto ─── */
const D = {
  bg:      '#0d1117',
  card:    '#161b27',
  card2:   '#1c2333',
  border:  'rgba(255,255,255,0.08)',
  text:    '#e2e8f0',
  muted:   '#6b7280',
  green:   '#4ade80',
  orange:  '#fb923c',
  red:     '#f87171',
  blue:    '#60a5fa',
};

function ConsultaPosto() {
  const [redes, setRedes]           = useState([]);
  const [rankingRedes, setRankingRedes] = useState([]);
  const [todosPostos, setTodosPostos] = useState([]);
  const [rankingPostos, setRankingPostos] = useState([]);
  const [resumoGeral, setResumoGeral] = useState({ totalGasto: 0, totalLitros: 0, melhorPreco: 0, piorPreco: 0, precoMedio: 0 });
  const [redeSel, setRedeSel]       = useState(null);
  const [postoSel, setPostoSel]     = useState('');
  const [dadosChart, setDadosChart]       = useState([]);
  const [dadosGeral, setDadosGeral]       = useState([]);
  const [loading, setLoading]             = useState(false);
  const [loadingGeral, setLoadingGeral]   = useState(true);
  const [periodo]                         = useState('3m'); // mantido para ranking

  useEffect(() => {
    Promise.all([
      api.get('/medias-consumo/redes'),
      api.get('/medias-consumo/ranking-redes'),
      api.get('/medias-consumo/postos-lista'),
      api.get('/medias-consumo/resumo-diesel'),
      api.get('/medias-consumo/grafico-anual'),
    ]).then(([r1, r2, r3, r4, r5]) => {
      setRedes(r1.data);
      setRankingRedes(r2.data);
      setTodosPostos(r3.data);
      setResumoGeral(r4.data);
      setDadosGeral(r5.data);
    }).catch(() => {}).finally(() => setLoadingGeral(false));
  }, []);

  useEffect(() => {
    api.get('/medias-consumo/ranking-postos')
      .then(({ data }) => setRankingPostos(data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (postoSel) {
      setLoading(true);
      api.get('/medias-consumo/consulta-posto-anual', { params: { posto: postoSel } })
        .then(({ data }) => setDadosChart(data))
        .catch(() => setDadosChart([]))
        .finally(() => setLoading(false));
    } else if (redeSel) {
      setLoading(true);
      api.get('/medias-consumo/grafico-rede', { params: { redeId: redeSel.id } })
        .then(({ data }) => setDadosChart(data))
        .catch(() => setDadosChart([]))
        .finally(() => setLoading(false));
    } else {
      setDadosChart([]);
    }
  }, [postoSel, redeSel]);

  const postosDaRede = redeSel ? todosPostos.filter(p => p.redeNome === redeSel.nome) : [];
  const redeStats    = rankingRedes.find(r => r.id === redeSel?.id);

  const rankingDaRede = redeSel
    ? rankingPostos.filter(p => p.redeNome === redeSel.nome)
    : rankingPostos;
  const melhores = rankingDaRede.slice(0, 5);
  const piores   = rankingDaRede.slice(-5).reverse();

  const totalLitros  = dadosChart.reduce((a, d) => a + d.totalLitros, 0);
  const totalGasto   = dadosChart.reduce((a, d) => a + d.totalGasto, 0);
  const avgPreco     = dadosChart.length > 0 ? dadosChart.reduce((a, d) => a + d.precoMedio, 0) / dadosChart.length : 0;
  const avgLitrosMes = dadosChart.length > 0 ? totalLitros / dadosChart.length : 0;

  const fmtMes = m => {
    if (!m) return m;
    const [y, mo] = m.split('-');
    return `${['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'][parseInt(mo)-1]}/${y.slice(2)}`;
  };

  const DkTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
      <div style={{ background: D.card2, border: `1px solid ${D.border}`, borderRadius: 10, padding: '10px 14px', fontSize: 12 }}>
        <div style={{ fontWeight: 700, marginBottom: 6, color: D.text }}>{label}</div>
        {payload.map(p => (
          <div key={p.dataKey} style={{ color: p.color, marginBottom: 2 }}>
            {p.name}: <strong>{p.dataKey === 'precoMedio' ? `R$ ${fmtN(p.value, 2)}/L` : `${fmtN(p.value, 0)} L`}</strong>
          </div>
        ))}
      </div>
    );
  };

  // Base dos KPIs: posto selecionado > rede selecionada > resumo geral do banco
  const kpiBase = (() => {
    if (postoSel && dadosChart.length > 0) {
      const tGasto  = dadosChart.reduce((a, d) => a + d.totalGasto, 0);
      const tLitros = dadosChart.reduce((a, d) => a + d.totalLitros, 0);
      const precos  = dadosChart.filter(d => d.precoMedio > 0).map(d => d.precoMedio);
      return {
        totalGasto:  tGasto,
        totalLitros: tLitros,
        melhorPreco: precos.length > 0 ? Math.min(...precos) : 0,
        piorPreco:   precos.length > 0 ? Math.max(...precos) : 0,
        precoMedio:  precos.length > 0 ? precos.reduce((a, v) => a + v, 0) / precos.length : 0,
      };
    }
    if (redeSel) {
      const fonte = rankingPostos.filter(p => p.redeNome === redeSel.nome);
      const precos = fonte.filter(p => p.precoMedio > 0).map(p => p.precoMedio);
      return {
        totalGasto:  fonte.reduce((a, p) => a + p.totalGasto, 0),
        totalLitros: fonte.reduce((a, p) => a + p.totalLitros, 0),
        melhorPreco: precos.length > 0 ? Math.min(...precos) : 0,
        piorPreco:   precos.length > 0 ? Math.max(...precos) : 0,
        precoMedio:  precos.length > 0 ? precos.reduce((a, v) => a + v, 0) / precos.length : 0,
      };
    }
    // nada selecionado → usa resumo completo do banco
    return resumoGeral;
  })();
  const { totalGasto: globalTotalGasto, totalLitros: globalTotalLitros,
          melhorPreco: globalMelhorPreco, piorPreco: globalPiorPreco,
          precoMedio: globalPrecoMedio } = kpiBase;

  return (
    <div style={{ display: 'flex', height: '100%', gap: 10, background: D.bg, borderRadius: 16, padding: 12, overflow: 'hidden', boxSizing: 'border-box' }}>

      {/* ── Sidebar ── */}
      <div style={{ width: 200, display: 'flex', flexDirection: 'column', gap: 6, overflowY: 'auto', flexShrink: 0 }}>
        {/* Redes */}
        <div style={{ fontSize: 9, color: D.muted, fontWeight: 700, letterSpacing: 1.2, marginBottom: 2 }}>REDES</div>
        {redes.length === 0 && <div style={{ fontSize: 11, color: D.muted }}>Nenhuma rede cadastrada</div>}
        {redes.map(r => {
          const sel = redeSel?.id === r.id;
          return (
            <div key={r.id} onClick={() => { setRedeSel(sel ? null : r); setPostoSel(''); }}
              style={{ padding: '7px 10px', borderRadius: 9, cursor: 'pointer', transition: 'all 0.15s',
                background: sel ? 'rgba(74,222,128,0.12)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${sel ? D.green : D.border}` }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: sel ? D.green : D.text }}>{r.nome}</div>
              <div style={{ fontSize: 10, color: D.muted }}>{r.total_postos ?? r.totalPostos ?? '—'} postos</div>
            </div>
          );
        })}

        {/* Postos da rede */}
        {redeSel && postosDaRede.length > 0 && (
          <>
            <div style={{ fontSize: 9, color: D.muted, fontWeight: 700, letterSpacing: 1.2, marginTop: 8, marginBottom: 2 }}>POSTOS — {redeSel.nome}</div>
            {postosDaRede.map(p => {
              const sel = postoSel === p.posto;
              return (
                <div key={p.posto} onClick={() => setPostoSel(sel ? '' : p.posto)}
                  style={{ padding: '5px 10px', borderRadius: 8, cursor: 'pointer', transition: 'all 0.15s',
                    background: sel ? 'rgba(251,146,60,0.12)' : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${sel ? D.orange : D.border}` }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: sel ? D.orange : D.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.posto}</div>
                </div>
              );
            })}
          </>
        )}
      </div>

      {/* ── Conteúdo principal ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10, minHeight: 0 }}>

        {/* ── KPI cards globais ── */}
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>

          {/* Total Combustível */}
          <div style={{ flex: 1, background: D.card, borderRadius: 12, padding: '10px 14px', border: `1px solid ${D.border}` }}>
            <div style={{ fontSize: 9, color: D.muted, fontWeight: 700, letterSpacing: 1, marginBottom: 4 }}>TOTAL GASTO (DIESEL)</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: D.orange }}>{fmtR(globalTotalGasto)}</div>
          </div>

          {/* Litragem — com galão animado */}
          <div style={{ flex: 1, background: D.card, borderRadius: 12, padding: '10px 14px', border: `1px solid ${D.border}`, display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ flexShrink: 0 }}>
              <svg width="36" height="48" viewBox="0 0 36 48" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <clipPath id="canClip">
                    <rect x="4" y="6" width="28" height="38" rx="4" />
                  </clipPath>
                  <linearGradient id="fuelGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.9" />
                    <stop offset="100%" stopColor="#0369a1" stopOpacity="1" />
                  </linearGradient>
                </defs>
                {/* corpo */}
                <rect x="4" y="6" width="28" height="38" rx="4" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" />
                {/* bico */}
                <rect x="13" y="1" width="10" height="6" rx="2" fill="rgba(255,255,255,0.15)" />
                {/* líquido animado */}
                <g clipPath="url(#canClip)">
                  <rect x="4" y="22" width="28" height="22" fill="url(#fuelGrad)">
                    <animate attributeName="y" values="22;20;22" dur="2s" repeatCount="indefinite" />
                  </rect>
                  {/* onda */}
                  <path d="M4,22 Q10,19 18,22 Q26,25 32,22 L32,44 L4,44 Z" fill="#38bdf8" opacity="0.4">
                    <animate attributeName="d"
                      values="M4,22 Q10,19 18,22 Q26,25 32,22 L32,44 L4,44 Z;M4,20 Q10,23 18,20 Q26,17 32,20 L32,44 L4,44 Z;M4,22 Q10,19 18,22 Q26,25 32,22 L32,44 L4,44 Z"
                      dur="2s" repeatCount="indefinite" />
                  </path>
                </g>
                {/* marcações */}
                <line x1="28" y1="16" x2="31" y2="16" stroke="rgba(255,255,255,0.25)" strokeWidth="1" />
                <line x1="28" y1="24" x2="31" y2="24" stroke="rgba(255,255,255,0.25)" strokeWidth="1" />
                <line x1="28" y1="32" x2="31" y2="32" stroke="rgba(255,255,255,0.25)" strokeWidth="1" />
              </svg>
            </div>
            <div>
              <div style={{ fontSize: 9, color: D.muted, fontWeight: 700, letterSpacing: 1, marginBottom: 4 }}>TOTAL LITROS</div>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#38bdf8' }}>{fmtN(globalTotalLitros, 0)} L</div>
            </div>
          </div>

          {/* Melhor preço */}
          <div style={{ flex: 1, background: D.card, borderRadius: 12, padding: '10px 14px', border: `1px solid ${D.border}` }}>
            <div style={{ fontSize: 9, color: D.muted, fontWeight: 700, letterSpacing: 1, marginBottom: 4 }}>MELHOR PREÇO/L</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: D.green }}>R$ {fmtN(globalMelhorPreco, 2)}</div>
          </div>

          {/* Preço médio */}
          <div style={{ flex: 1, background: D.card, borderRadius: 12, padding: '10px 14px', border: `1px solid ${D.border}` }}>
            <div style={{ fontSize: 9, color: D.muted, fontWeight: 700, letterSpacing: 1, marginBottom: 4 }}>PREÇO MÉDIO/L</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: D.orange }}>R$ {fmtN(globalPrecoMedio, 2)}</div>
          </div>

          {/* Pior preço */}
          <div style={{ flex: 1, background: D.card, borderRadius: 12, padding: '10px 14px', border: `1px solid ${D.border}` }}>
            <div style={{ fontSize: 9, color: D.muted, fontWeight: 700, letterSpacing: 1, marginBottom: 4 }}>PIOR PREÇO/L</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: D.red }}>R$ {fmtN(globalPiorPreco, 2)}</div>
          </div>

        </div>


        <div style={{ flex: 1 }} />
        {/* Gráfico — sempre visível, por mês */}
        <div style={{ height: 220, flexShrink: 0, background: D.card, borderRadius: 14, padding: '12px 8px 8px', border: `1px solid ${D.border}` }}>
          {(loading || loadingGeral) ? (
            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: D.muted }}>Carregando...</div>
          ) : (() => {
            const dados = (postoSel || redeSel) ? dadosChart : dadosGeral;
            const xKey  = 'mes';
            const titulo = postoSel
              ? <>Preço (R$/L) vs Volume (L) — <span style={{ color: D.text }}>{postoSel}</span></>
              : redeSel
              ? <>Preço (R$/L) vs Volume (L) — <span style={{ color: D.text }}>{redeSel.nome}</span></>
              : <>Preço (R$/L) vs Volume (L) — <span style={{ color: D.text }}>Geral (todos os postos)</span></>;
            if (dados.length === 0) return (
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: D.muted, fontSize: 13 }}>
                Nenhum dado disponível
              </div>
            );
            return (
              <>
                <div style={{ fontSize: 11, fontWeight: 700, color: D.muted, marginBottom: 6, paddingLeft: 8 }}>{titulo}</div>
                <ResponsiveContainer width="100%" height="90%">
                  <ComposedChart data={dados} margin={{ top: 4, right: 20, left: 0, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey={xKey} tickFormatter={fmtMes} tick={{ fontSize: 9, fill: D.muted }} axisLine={false} tickLine={false} />
                    <YAxis yAxisId="left"  tick={{ fontSize: 9, fill: D.orange }} tickFormatter={v => `R$${fmtN(v,2)}`} domain={['auto','auto']} width={58} axisLine={false} tickLine={false} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 9, fill: D.blue }} tickFormatter={v => `${fmtN(v,0)}L`} domain={['auto','auto']} width={52} axisLine={false} tickLine={false} />
                    <Tooltip content={<DkTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 10, color: D.muted }} />
                    <Line yAxisId="left"  type="monotone" dataKey="precoMedio"  name="Preço médio (R$/L)" stroke={D.orange} strokeWidth={2.5} dot={{ r: 3, fill: D.orange }} activeDot={{ r: 5 }}
                      label={{ position: 'top', fontSize: 8, fill: D.orange, formatter: v => `R$${fmtN(v,2)}` }} />
                    <Line yAxisId="right" type="monotone" dataKey="totalLitros" name="Volume (L)"          stroke={D.blue}   strokeWidth={2.5} dot={{ r: 3, fill: D.blue }}   activeDot={{ r: 5 }}
                      label={{ position: 'bottom', fontSize: 8, fill: D.blue, formatter: v => `${fmtN(v,0)}L` }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </>
            );
          })()}
        </div>
      </div>
    </div>
  );
}

/* ─── Página principal ─── */
export default function MediasPrecoCombustivel() {
  const [abaAtiva, setAbaAtiva]     = useState('mapa');
  const [dados, setDados]           = useState([]);
  const [loading, setLoading]       = useState(true);
  const [statePaths, setStatePaths] = useState([]);
  const [geoLoading, setGeoLoading] = useState(true);
  const [hovUF, setHovUF]           = useState(null);
  const [mouse, setMouse]           = useState({ x: 0, y: 0 });
  const [modalRedes, setModalRedes] = useState(false);
  const [limiteRedes, setLimiteRedes]   = useState(5);
  const [limiteEstados, setLimiteEstados] = useState(5);
  const [redes, setRedes]               = useState([]);
  const [loadingRedes, setLoadingRedes] = useState(true);
  const [ufsDaRede, setUfsDaRede]       = useState({});     // { [redeId]: [...] }
  const containerRef = useRef();
  const projRef          = useRef(null);
  const svgRef           = useRef(null);
  const zoomBehaviorRef  = useRef(null);
  const mapGRef                      = useRef(null); // DOM ref para o <g> do mapa — zoom sem re-render
  const [postosBid, setPostosBid]   = useState([]);
  const [modalBid, setModalBid]     = useState(false);
  const [editingBid, setEditingBid] = useState(null);
  const [formBid, setFormBid]       = useState({ nome: '', rede: '', cidade: '', uf: '', latitude: '', longitude: '', precoDiesel: '', linkMaps: '' });
  const [coordsOk, setCoordsOk]     = useState(false);
  const [painelBidAberto, setPainelBidAberto] = useState(false);
  const [hovPostoBid, setHovPostoBid] = useState(null);
  const [buscarBid, setBuscarBid]     = useState('');
  const [trrs, setTrrs]             = useState([]);
  const [modalTrr, setModalTrr]     = useState(false);
  const [editingTrr, setEditingTrr] = useState(null);
  const [formTrr, setFormTrr]       = useState({ nome: '', uf: '', precoDiesel: '' });
  const [savingTrr, setSavingTrr]   = useState(false);
  const [savingBid, setSavingBid]   = useState(false);
  const [toastBid, setToastBid]     = useState(null); // { msg, type }
  const toastTimerRef = useRef(null);

  useEffect(() => {
    fetch(GEOJSON_URL)
      .then(r => r.json())
      .then(geo => {
        const proj = d3.geoMercator().fitExtent([[PAD, PAD], [W + PAD, H + PAD]], geo);
        projRef.current = proj;
        const pathGen = d3.geoPath().projection(proj);
        const paths = geo.features
          .map(f => ({
            sigla: (f.properties.sigla || '').toUpperCase(),
            d: pathGen(f),
            centroid: pathGen.centroid(f),
          }))
          .filter(p => p.sigla && p.d);
        setStatePaths(paths);
        setGeoLoading(false);
      })
      .catch(() => setGeoLoading(false));
  }, []);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/medias-consumo/por-uf');
      setDados(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  const carregarRedes = useCallback(async () => {
    setLoadingRedes(true);
    try {
      const { data } = await api.get('/medias-consumo/ranking-redes');
      setRedes(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingRedes(false);
    }
  }, []);

  const carregarPostosBid = useCallback(async () => {
    try {
      const { data } = await api.get('/postos-bid');
      setPostosBid(data);
    } catch (err) { console.error(err); }
  }, []);

  const showToast = (msg, type = 'alert') => {
    clearTimeout(toastTimerRef.current);
    setToastBid({ msg, type });
    toastTimerRef.current = setTimeout(() => setToastBid(null), 5000);
  };

  const salvarBid = async () => {
    setSavingBid(true);
    try {
      const precoAnterior = editingBid?.precoDiesel;
      const precoNovo = formBid.precoDiesel
        ? parseFloat(String(formBid.precoDiesel).replace(',', '.'))
        : null;

      if (editingBid) {
        await api.put(`/postos-bid/${editingBid.id}`, formBid);
        // detecta mudança de preço
        if (precoNovo != null && precoAnterior != null && Math.abs(precoNovo - precoAnterior) > 0.001) {
          const fmt = v => Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
          showToast(`⚠️ Preço atualizado — ${formBid.nome}: R$ ${fmt(precoAnterior)} → R$ ${fmt(precoNovo)}`, 'alert');
        } else if (precoNovo != null && precoAnterior == null) {
          showToast(`📌 Preço cadastrado — ${formBid.nome}: R$ ${Number(precoNovo).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 'info');
        }
      } else {
        await api.post('/postos-bid', formBid);
        showToast(`✅ Posto cadastrado: ${formBid.nome}`, 'info');
      }

      await carregarPostosBid();
      setModalBid(false);
      setEditingBid(null);
      setFormBid({ nome: '', rede: '', cidade: '', uf: '', latitude: '', longitude: '', precoDiesel: '', linkMaps: '' });
      setCoordsOk(false);
    } catch (err) { console.error(err); }
    finally { setSavingBid(false); }
  };

  const deletarBid = async (id) => {
    if (!window.confirm('Remover este posto do mapa?')) return;
    await api.delete(`/postos-bid/${id}`);
    await carregarPostosBid();
  };

  const carregarTrrs = useCallback(async () => {
    try { const { data } = await api.get('/trr'); setTrrs(data); } catch {}
  }, []);

  useEffect(() => { carregar(); }, [carregar]);
  useEffect(() => { carregarRedes(); }, [carregarRedes]);
  useEffect(() => { if (abaAtiva === 'bid') carregarPostosBid(); }, [abaAtiva, carregarPostosBid]);
  useEffect(() => { if (abaAtiva === 'mapa') carregarTrrs(); }, [abaAtiva, carregarTrrs]);

  // Zoom interativo (só na aba BID)
  useEffect(() => {
    if (!svgRef.current || geoLoading || abaAtiva !== 'bid') return;
    const zoom = d3.zoom()
      .scaleExtent([0.5, 14])
      // exclui wheel — vamos interceptar manualmente para fixar âncora no centro
      .filter(ev => ev.type !== 'wheel' && !ev.button)
      .on('zoom', e => {
        if (mapGRef.current) {
          mapGRef.current.setAttribute(
            'transform',
            `translate(${e.transform.x},${e.transform.y}) scale(${e.transform.k})`
          );
        }
      });
    zoomBehaviorRef.current = zoom;
    const sel = d3.select(svgRef.current);
    sel.call(zoom);

    // Wheel sempre expandindo a partir do centro do SVG
    const svgEl = svgRef.current;
    const wheelHandler = (event) => {
      event.preventDefault();
      const { width, height } = svgEl.getBoundingClientRect();
      const factor = event.deltaY < 0 ? 1.25 : 0.8;
      zoom.scaleBy(sel, factor, [width / 2, height / 2]);
    };
    svgEl.addEventListener('wheel', wheelHandler, { passive: false });

    sel.on('dblclick.zoom', () =>
      sel.transition().duration(350).call(zoom.transform, d3.zoomIdentity));
    return () => {
      svgEl.removeEventListener('wheel', wheelHandler);
      sel.on('.zoom', null);
      zoomBehaviorRef.current = null;
      if (mapGRef.current) mapGRef.current.setAttribute('transform', '');
    };
  }, [geoLoading, abaAtiva]);

  const zoomIn    = () => svgRef.current && zoomBehaviorRef.current && d3.select(svgRef.current).transition().duration(250).call(zoomBehaviorRef.current.scaleBy, 1.6);
  const zoomOut   = () => svgRef.current && zoomBehaviorRef.current && d3.select(svgRef.current).transition().duration(250).call(zoomBehaviorRef.current.scaleBy, 0.625);
  const zoomReset = () => svgRef.current && zoomBehaviorRef.current && d3.select(svgRef.current).transition().duration(350).call(zoomBehaviorRef.current.transform, d3.zoomIdentity);

  // Carrega UFs de todas as redes após carregar o ranking
  useEffect(() => {
    if (!redes.length) return;
    redes.forEach(async r => {
      if (ufsDaRede[r.id]) return;
      try {
        const { data } = await api.get(`/medias-consumo/ranking-redes/${r.id}/por-uf`);
        setUfsDaRede(prev => ({ ...prev, [r.id]: data }));
      } catch {}
    });
  }, [redes]);

  const byUF    = Object.fromEntries(dados.map(d => [d.uf, d]));
  const maxPct  = dados.length > 0 ? Math.max(...dados.map(d => d.percentual)) : 1;
  const totalGasto = dados.reduce((a, d) => a + d.totalGasto, 0);
  const hovData = hovUF ? byUF[hovUF] : null;

  const Dk = { bg: '#0d1117', card: '#161b27', card2: '#1c2333', border: 'rgba(255,255,255,0.08)', text: '#e2e8f0', muted: '#6b7280', red: '#EB3238' };

  return (
    <div style={{ padding: '8px 12px', fontFamily: 'Inter, sans-serif', background: Dk.bg, height: 'calc(100% + 48px)', margin: -24, display: 'flex', flexDirection: 'column', boxSizing: 'border-box', overflow: 'hidden' }}>
      {modalRedes && <ModalRedes onClose={() => setModalRedes(false)} />}

      {/* ── Modal TRR ── */}
      {modalTrr && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <div style={{ background: Dk.card, borderRadius:16, padding:24, width:380, border:`1px solid ${Dk.border}` }}>
            <div style={{ fontWeight:700, fontSize:14, color:Dk.text, marginBottom:16 }}>
              {editingTrr ? 'Editar TRR' : 'Cadastrar TRR'}
            </div>

            {/* Lista de TRRs existentes */}
            {trrs.length > 0 && (
              <div style={{ marginBottom:16, maxHeight:160, overflowY:'auto' }}>
                {trrs.map(t => (
                  <div key={t.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'6px 10px', borderRadius:8, background:'rgba(255,255,255,0.04)', marginBottom:4 }}>
                    <div>
                      <span style={{ fontWeight:600, fontSize:12, color:Dk.text }}>{t.nome}</span>
                      <span style={{ fontSize:11, color:Dk.muted, marginLeft:8 }}>{t.uf}</span>
                      {t.precoDiesel && <span style={{ fontSize:11, color:'#4ade80', marginLeft:8 }}>R$ {Number(t.precoDiesel).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})}/L</span>}
                    </div>
                    <div style={{ display:'flex', gap:6 }}>
                      <button onClick={() => { setEditingTrr(t); setFormTrr({ nome:t.nome, uf:t.uf, precoDiesel: t.precoDiesel ?? '' }); }}
                        style={{ background:'none', border:'none', cursor:'pointer', color:'#60a5fa', fontSize:12 }}>✏</button>
                      <button onClick={async () => { await api.delete(`/trr/${t.id}`); carregarTrrs(); }}
                        style={{ background:'none', border:'none', cursor:'pointer', color:'#f87171', fontSize:12 }}>✕</button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Formulário */}
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              <input placeholder="Nome do TRR" value={formTrr.nome}
                onChange={e => setFormTrr(f => ({ ...f, nome: e.target.value }))}
                style={{ padding:'8px 12px', borderRadius:8, border:`1px solid ${Dk.border}`, background:Dk.card2, color:Dk.text, fontSize:12 }} />
              <select value={formTrr.uf} onChange={e => setFormTrr(f => ({ ...f, uf: e.target.value }))}
                style={{ padding:'8px 12px', borderRadius:8, border:`1px solid ${Dk.border}`, background:Dk.card2, color:Dk.text, fontSize:12 }}>
                <option value="">Selecione o Estado</option>
                {Object.entries({AC:'Acre',AL:'Alagoas',AM:'Amazonas',AP:'Amapá',BA:'Bahia',CE:'Ceará',DF:'Distrito Federal',ES:'Espírito Santo',GO:'Goiás',MA:'Maranhão',MG:'Minas Gerais',MS:'Mato Grosso do Sul',MT:'Mato Grosso',PA:'Pará',PB:'Paraíba',PE:'Pernambuco',PI:'Piauí',PR:'Paraná',RJ:'Rio de Janeiro',RN:'Rio Grande do Norte',RO:'Rondônia',RR:'Roraima',RS:'Rio Grande do Sul',SC:'Santa Catarina',SE:'Sergipe',SP:'São Paulo',TO:'Tocantins'}).map(([uf,nome]) => (
                  <option key={uf} value={uf}>{uf} — {nome}</option>
                ))}
              </select>
              <input placeholder="Preço Diesel (ex: 5,89)" value={formTrr.precoDiesel}
                onChange={e => setFormTrr(f => ({ ...f, precoDiesel: e.target.value }))}
                style={{ padding:'8px 12px', borderRadius:8, border:`1px solid ${Dk.border}`, background:Dk.card2, color:Dk.text, fontSize:12 }} />
            </div>

            <div style={{ display:'flex', gap:8, marginTop:16 }}>
              <button onClick={() => { setModalTrr(false); setEditingTrr(null); }}
                style={{ flex:1, padding:'8px', borderRadius:8, border:`1px solid ${Dk.border}`, background:'transparent', color:Dk.muted, fontSize:12, cursor:'pointer' }}>
                Fechar
              </button>
              <button disabled={savingTrr || !formTrr.nome || !formTrr.uf}
                onClick={async () => {
                  setSavingTrr(true);
                  try {
                    if (editingTrr) {
                      await api.put(`/trr/${editingTrr.id}`, formTrr);
                    } else {
                      await api.post('/trr', formTrr);
                    }
                    setFormTrr({ nome:'', uf:'', precoDiesel:'' });
                    setEditingTrr(null);
                    await carregarTrrs();
                  } finally { setSavingTrr(false); }
                }}
                style={{ flex:1, padding:'8px', borderRadius:8, border:'none', background:'#60a5fa', color:'#fff', fontSize:12, fontWeight:700, cursor:'pointer', opacity: (!formTrr.nome||!formTrr.uf)?0.5:1 }}>
                {savingTrr ? 'Salvando...' : editingTrr ? 'Salvar' : 'Cadastrar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header compacto */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ display: 'flex', gap: 2, background: Dk.card, borderRadius: 8, padding: 3, border: `1px solid ${Dk.border}` }}>
            {[{ id: 'mapa', label: '🗺 Mapa' }, { id: 'consulta', label: '🔍 Consulta Posto' }, { id: 'bid', label: '🏷 BID Postos' }].map(t => (
              <button key={t.id} onClick={() => setAbaAtiva(t.id)} style={{
                padding: '4px 12px', borderRadius: 6, border: 'none', fontSize: 11, fontWeight: 600, cursor: 'pointer',
                background: abaAtiva === t.id ? Dk.red : 'transparent',
                color: abaAtiva === t.id ? '#fff' : Dk.muted,
              }}>{t.label}</button>
            ))}
          </div>
          {/* KPI inline no header */}
          {abaAtiva === 'mapa' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 12px', background: Dk.card, borderRadius: 8, border: `1px solid ${Dk.border}` }}>
              <span style={{ fontSize: 9, color: Dk.muted, fontWeight: 700, letterSpacing: 0.8 }}>TOTAL DIESEL</span>
              <span style={{ fontSize: 13, fontWeight: 800, color: Dk.red }}>{loading ? '—' : fmtR(totalGasto)}</span>
              <span style={{ fontSize: 9, color: Dk.muted }}>· {dados.length} estados</span>
            </div>
          )}
        </div>
        {abaAtiva === 'mapa' && (
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => setModalRedes(true)} style={{
              padding: '4px 12px', borderRadius: 8, border: `1px solid ${Dk.border}`,
              background: Dk.card, color: Dk.text, fontSize: 11, fontWeight: 600,
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5,
            }}>
              🏪 Redes de Postos
            </button>
            <button onClick={() => { setEditingTrr(null); setFormTrr({ nome: '', uf: '', precoDiesel: '' }); setModalTrr(true); }} style={{
              padding: '4px 12px', borderRadius: 8, border: `1px solid ${Dk.border}`,
              background: Dk.card, color: '#60a5fa', fontSize: 11, fontWeight: 600,
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5,
            }}>
              🚛 TRR
            </button>
          </div>
        )}
      </div>

      {/* Consulta Posto */}
      {abaAtiva === 'consulta' && (
        <div style={{ flex: 1, minHeight: 0 }}>
          <ConsultaPosto />
        </div>
      )}

      {/* Toast BID */}
      {toastBid && (
        <div style={{
          position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)',
          zIndex: 300, padding: '12px 20px', borderRadius: 12,
          background: toastBid.type === 'alert' ? 'rgba(234,88,12,0.97)' : 'rgba(22,163,74,0.97)',
          color: '#fff', fontWeight: 700, fontSize: 13,
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', gap: 12,
          border: `1px solid ${toastBid.type === 'alert' ? '#f97316' : '#4ade80'}`,
          maxWidth: '90vw', whiteSpace: 'nowrap',
        }}>
          {toastBid.msg}
          <button onClick={() => setToastBid(null)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 16, padding: 0, marginLeft: 4, opacity: 0.7 }}>✕</button>
        </div>
      )}

      <div style={{ display: (abaAtiva === 'mapa' || abaAtiva === 'bid') ? 'flex' : 'none', gap: 10, flex: 1, minHeight: 0 }}>
        {/* ─── Mapa ─── */}
        <div
          ref={containerRef}
          style={{
            flex: abaAtiva === 'bid' ? '1 1 0' : '0 0 38%',
            background: 'transparent',
            borderRadius: 16, padding: '4px 8px',
            position: 'relative', overflow: 'hidden',
            display: 'flex', flexDirection: 'column',
          }}
          onMouseMove={e => {
            if (!containerRef.current) return;
            const rect = containerRef.current.getBoundingClientRect();
            setMouse({ x: e.clientX - rect.left, y: e.clientY - rect.top });
          }}
        >
          <div style={{
            position: 'absolute', inset: 0, opacity: 0.035,
            backgroundImage: 'radial-gradient(#60a5fa 1px, transparent 1px)',
            backgroundSize: '28px 28px', pointerEvents: 'none',
          }} />
          <div style={{ color: '#475569', fontSize: 9, marginBottom: 8, fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase', flexShrink: 0 }}>
            Abastecimento por Estado — % do gasto total (Diesel)
          </div>

          <div style={{ perspective: abaAtiva === 'bid' ? 'none' : '1200px', perspectiveOrigin: '50% 40%', flex: 1, minHeight: 0, position: 'relative' }}>
            {geoLoading ? (
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569', fontSize: 13 }}>
                Carregando mapa...
              </div>
            ) : (
              <svg
                ref={svgRef}
                viewBox={`${PAD} ${PAD} ${W} ${H}`}
                style={{ width: '100%', height: '100%', display: 'block', transform: abaAtiva === 'bid' ? 'none' : 'rotateX(22deg)', transformOrigin: '50% 50%', cursor: abaAtiva === 'bid' ? 'grab' : 'default', willChange: 'transform' }}
                shapeRendering={abaAtiva === 'bid' ? 'optimizeSpeed' : 'auto'}
                onMouseLeave={() => setHovUF(null)}
              >
                <defs>
                  {/* Fundo atmosférico */}
                  <radialGradient id="mapAtmos" cx="45%" cy="40%" r="65%">
                    <stop offset="0%" stopColor="#0d1b2e" />
                    <stop offset="100%" stopColor="#04080f" />
                  </radialGradient>
                  {/* Iluminação sobre estado (topo-esquerda = claro, baixo-direita = escuro) */}
                  <linearGradient id="stateLightOverlay" x1="0%" y1="0%" x2="80%" y2="100%">
                    <stop offset="0%" stopColor="rgba(255,255,255,0.13)" />
                    <stop offset="100%" stopColor="rgba(0,0,0,0.28)" />
                  </linearGradient>
                  {/* Sombra projetada nos estados */}
                  <filter id="stateDrop" x="-15%" y="-15%" width="140%" height="145%">
                    <feDropShadow dx="1.5" dy="2.5" stdDeviation="2" floodColor="#000" floodOpacity="0.75" />
                  </filter>
                  {/* Brilho dos pins no hover */}
                  <filter id="pinGlow" x="-60%" y="-60%" width="220%" height="220%">
                    <feGaussianBlur stdDeviation="3" result="blur" />
                    <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
                  </filter>
                  {/* Gradientes esféricos para pins */}
                  {[
                    { id: 'pinGreen',  hi: '#bbf7d0', mid: '#4ade80', lo: '#14532d' },
                    { id: 'pinYellow', hi: '#fef9c3', mid: '#facc15', lo: '#78350f' },
                    { id: 'pinRed',    hi: '#fee2e2', mid: '#f87171', lo: '#7f1d1d' },
                    { id: 'pinBlue',   hi: '#dbeafe', mid: '#60a5fa', lo: '#1e3a8a' },
                  ].map(({ id, hi, mid, lo }) => (
                    <radialGradient key={id} id={id} cx="33%" cy="28%" r="68%">
                      <stop offset="0%"   stopColor={hi}  />
                      <stop offset="42%"  stopColor={mid} />
                      <stop offset="100%" stopColor={lo}  />
                    </radialGradient>
                  ))}
                </defs>
                <g ref={mapGRef}>
                {statePaths.map(({ sigla, d, centroid }) => {
                  const info  = byUF[sigla];
                  const isHov = hovUF === sigla;
                  const [cx, cy] = centroid || [0, 0];
                  const validC = !isNaN(cx) && !isNaN(cy);
                  const temPostos = abaAtiva === 'bid' && postosBid.some(p => p.uf === sigla);
                  return (
                    <g key={sigla}>
                      {/* Camada de extrusão 3D (BID) */}
                      {abaAtiva === 'bid' && (
                        <>
                          <path d={d} transform="translate(3,4)"
                            fill={temPostos ? '#07203d' : '#06090f'}
                            stroke="none" style={{ pointerEvents: 'none' }} />
                          <path d={d} transform="translate(2,2.5)"
                            fill={temPostos ? '#0e2e55' : '#0a0e1a'}
                            stroke="none" style={{ pointerEvents: 'none' }} />
                        </>
                      )}
                      {/* Face principal */}
                      <path
                        d={d}
                        fill={abaAtiva === 'bid'
                          ? (temPostos ? '#1a3a6b' : '#111827')
                          : (isHov ? '#e0f2fe' : getTopColor(info?.percentual, maxPct))}

                        stroke={abaAtiva === 'bid'
                          ? (temPostos ? 'rgba(96,165,250,0.5)' : 'rgba(255,255,255,0.07)')
                          : (isHov ? '#7dd3fc' : '#03070f')}
                        strokeWidth={abaAtiva === 'bid' ? (temPostos ? 0.9 : 0.35) : (isHov ? 1.6 : 0.5)}
                        style={{ cursor: abaAtiva === 'bid' ? 'default' : 'pointer', transition: 'fill 0.18s' }}
                        onMouseEnter={() => abaAtiva !== 'bid' && setHovUF(sigla)}
                        onMouseLeave={() => abaAtiva !== 'bid' && setHovUF(null)}
                      />
                      {/* Overlay de iluminação direcional (BID) */}
                      {abaAtiva === 'bid' && (
                        <path d={d} fill="url(#stateLightOverlay)"
                          opacity={0.18} style={{ pointerEvents: 'none' }} />
                      )}
                      {validC && (
                        <g style={{ pointerEvents: 'none' }}>
                          <text x={cx} y={cy - 1} textAnchor="middle" fontSize={abaAtiva === 'bid' ? 6 : 7.5} fontWeight="800"
                            fill={abaAtiva === 'bid' ? (temPostos ? 'rgba(147,197,253,0.95)' : 'rgba(255,255,255,0.18)') : (isHov ? '#0284c7' : 'rgba(255,255,255,0.95)')}>
                            {sigla}
                          </text>
                          {info && abaAtiva !== 'bid' && (
                            <text x={cx} y={cy + 9} textAnchor="middle" fontSize={5.5} fontWeight="600"
                              fill={isHov ? '#0284c7' : 'rgba(255,255,255,0.65)'}>
                              {fmtN(info.percentual, 1)}%
                            </text>
                          )}
                        </g>
                      )}
                    </g>
                  );
                })}
                {/* Pins BID — marcadores estilo mapa */}
                {abaAtiva === 'bid' && projRef.current && postosBid.map(p => {
                  const coords = projRef.current([p.longitude, p.latitude]);
                  if (!coords) return null;
                  const [px, py] = coords;
                  const termo = buscarBid.trim().toLowerCase();
                  const matched = termo
                    ? (p.nome?.toLowerCase().includes(termo) || p.cidade?.toLowerCase().includes(termo) || p.uf?.toLowerCase().includes(termo))
                    : true;
                  if (!matched) return null;
                  const isHovPin = hovPostoBid?.id === p.id;
                  const preco = p.precoDiesel ? Number(p.precoDiesel) : null;
                  const gradId = preco
                    ? (preco < 5.5 ? 'pinGreen' : preco < 6.2 ? 'pinYellow' : 'pinRed')
                    : 'pinBlue';
                  const pinColor = preco
                    ? (preco < 5.5 ? '#4ade80' : preco < 6.2 ? '#facc15' : '#f87171')
                    : '#60a5fa';
                  const R = isHovPin ? 4.5 : 3;
                  const stemLen = R + 3;
                  return (
                    <g key={p.id} style={{ cursor: 'pointer' }}
                      onMouseEnter={() => setHovPostoBid(p)}
                      onMouseLeave={() => setHovPostoBid(null)}>
                      {/* Haste */}
                      <line x1={px} y1={py + R * 0.8} x2={px} y2={py + stemLen}
                        stroke={pinColor} strokeWidth={1} strokeLinecap="round" />
                      {/* Anel de borda (depth) */}
                      <circle cx={px} cy={py} r={R + 0.7} fill="rgba(0,0,0,0.5)" />
                      {/* Esfera com gradiente 3D */}
                      <circle cx={px} cy={py} r={R}
                        fill={`url(#${gradId})`}
                        filter={isHovPin ? 'url(#pinGlow)' : undefined} />
                      {/* Reflexo de luz */}
                      <circle cx={px - R * 0.28} cy={py - R * 0.32} r={R * 0.22}
                        fill="rgba(255,255,255,0.55)" style={{ pointerEvents: 'none' }} />
                      {/* Nome e preço — só no hover */}
                      {isHovPin && (
                        <g style={{ pointerEvents: 'none' }}>
                          <text x={px} y={py - R - 3} textAnchor="middle"
                            fontSize={3.5} fontWeight="700" fill="#fff">
                            {p.nome}
                          </text>
                          {preco && (
                            <text x={px} y={py + stemLen + 5} textAnchor="middle"
                              fontSize={3.5} fontWeight="800" fill={pinColor}>
                              {`R$ ${preco.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                            </text>
                          )}
                        </g>
                      )}
                    </g>
                  );
                })}
                </g>
              </svg>
            )}

            {/* Busca de postos (BID) */}
            {abaAtiva === 'bid' && !geoLoading && (
              <div style={{
                position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)',
                zIndex: 20, display: 'flex', alignItems: 'center', gap: 6,
                background: 'rgba(15,23,42,0.82)', backdropFilter: 'blur(8px)',
                border: '1px solid rgba(96,165,250,0.25)', borderRadius: 20,
                padding: '5px 12px', boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
              }}>
                <span style={{ fontSize: 13, color: '#64748b' }}>🔍</span>
                <input
                  value={buscarBid}
                  onChange={e => setBuscarBid(e.target.value)}
                  placeholder="Buscar posto..."
                  style={{
                    background: 'transparent', border: 'none', outline: 'none',
                    color: '#e2e8f0', fontSize: 13, width: 180,
                    caretColor: '#60a5fa',
                  }}
                />
                {buscarBid && (
                  <button onClick={() => setBuscarBid('')}
                    style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 13, padding: 0, lineHeight: 1 }}>
                    ✕
                  </button>
                )}
              </div>
            )}

            {/* Controles de zoom (BID) */}
            {abaAtiva === 'bid' && !geoLoading && (
              <div style={{ position: 'absolute', bottom: 14, right: 14, display: 'flex', flexDirection: 'column', gap: 4, zIndex: 10 }}>
                {[
                  { label: '+', action: zoomIn,    title: 'Aproximar' },
                  { label: '⊙', action: zoomReset, title: 'Resetar zoom' },
                  { label: '−', action: zoomOut,   title: 'Afastar' },
                ].map(({ label, action, title }) => (
                  <button key={label} onClick={action} title={title} style={{
                    width: 30, height: 30, borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)',
                    background: 'rgba(22,27,39,0.92)', color: '#e2e8f0', fontSize: 16, fontWeight: 700,
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    backdropFilter: 'blur(4px)', lineHeight: 1,
                  }}>{label}</button>
                ))}
                <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.3)', textAlign: 'center', marginTop: 2 }}>scroll / drag</div>
              </div>
            )}
          </div>

          {/* Tooltip */}
          {hovUF && hovData && abaAtiva !== 'bid' && (
            <div style={{
              position: 'absolute',
              left: Math.min(mouse.x + 16, 260),
              top: Math.max(mouse.y - 90, 50),
              background: 'rgba(2,8,23,0.97)',
              border: '1px solid #1e3a5f', borderRadius: 14,
              padding: '14px 18px', fontSize: 12,
              boxShadow: '0 12px 40px rgba(0,0,0,0.6)',
              minWidth: 210, pointerEvents: 'none', zIndex: 30,
            }}>
              <div style={{ fontWeight: 800, color: '#f0f9ff', fontSize: 13, marginBottom: 10 }}>
                {hovUF} — {UF_LABELS[hovUF] || ''}
              </div>
              {[
                { label: '% do gasto',    val: `${fmtN(hovData.percentual, 1)}%`, color: '#fbbf24' },
                { label: 'Total gasto',   val: fmtR(hovData.totalGasto),           color: '#fb7185' },
                { label: 'Total litros',  val: `${fmtN(hovData.totalLitros, 0)} L`, color: '#93c5fd' },
                { label: 'Preço médio/L', val: fmtR(hovData.precoMedio),            color: '#34d399' },
                { label: 'Registros',     val: hovData.totalRegistros,              color: '#a78bfa' },
              ].map(({ label, val, color }) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, marginBottom: 5 }}>
                  <span style={{ color: '#64748b' }}>{label}</span>
                  <strong style={{ color }}>{val}</strong>
                </div>
              ))}
            </div>
          )}

          {/* Tooltip posto BID */}
          {hovPostoBid && abaAtiva === 'bid' && (
            <div style={{
              position: 'absolute',
              left: Math.min(mouse.x + 16, 300), top: Math.max(mouse.y - 80, 10),
              background: 'rgba(2,8,23,0.97)', border: '1px solid rgba(96,165,250,0.3)',
              borderRadius: 12, padding: '12px 16px', fontSize: 12,
              boxShadow: '0 8px 30px rgba(0,0,0,0.6)', minWidth: 180, pointerEvents: 'none', zIndex: 50,
            }}>
              <div style={{ fontWeight: 800, color: '#e2e8f0', fontSize: 13, marginBottom: 8 }}>
                📍 {hovPostoBid.nome}
              </div>
              {[
                { label: 'Rede',   val: hovPostoBid.rede || '—',   color: '#93c5fd' },
                { label: 'Cidade', val: hovPostoBid.cidade ? `${hovPostoBid.cidade} / ${hovPostoBid.uf}` : hovPostoBid.uf, color: '#cbd5e1' },
                { label: 'Diesel', val: hovPostoBid.precoDiesel
                    ? `R$ ${Number(hovPostoBid.precoDiesel).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/L`
                    : 'Sem preço', color: hovPostoBid.precoDiesel ? '#4ade80' : '#6b7280' },
              ].map(({ label, val, color }) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 4 }}>
                  <span style={{ color: '#64748b', fontSize: 11 }}>{label}</span>
                  <strong style={{ color, fontSize: 11 }}>{val}</strong>
                </div>
              ))}
            </div>
          )}

          {/* Legenda cores preço BID */}
          {abaAtiva === 'bid' && postosBid.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, flexShrink: 0 }}>
              {[{ color: '#4ade80', label: '< R$5,50' }, { color: '#facc15', label: 'R$5,50–6,20' }, { color: '#f87171', label: '> R$6,20' }, { color: '#60a5fa', label: 'sem preço' }].map(({ color, label }) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
                  <span style={{ fontSize: 9, color: Dk.muted }}>{label}</span>
                </div>
              ))}
            </div>
          )}

          {abaAtiva !== 'bid' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, flexShrink: 0 }}>
              <span style={{ color: Dk.muted, fontSize: 8, fontWeight: 700 }}>BAIXO</span>
              <div style={{ flex: 1, height: 4, borderRadius: 4, background: 'linear-gradient(to right, #1d4b6a, #34d399, #fbbf24, #f97316, #ea580c, #dc2626, #b91c1c)' }} />
              <span style={{ color: Dk.muted, fontSize: 8, fontWeight: 700 }}>ALTO</span>
            </div>
          )}
        </div>

        {/* ─── Ranking Redes ─── */}
        {abaAtiva === 'mapa' && <div style={{ width: 260, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 8, justifyContent: 'flex-end' }}>

          {/* Ranking Redes */}
          <div style={{ background: Dk.card, borderRadius: 12, border: `1px solid ${Dk.border}`, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '6px 12px', borderBottom: `1px solid ${Dk.border}`, fontWeight: 700, fontSize: 11, color: Dk.text, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Ranking por Rede</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                {[5, 10, 999].map(n => (
                  <button key={n} onClick={() => setLimiteRedes(n)} style={{
                    padding: '2px 6px', borderRadius: 4, border: `1px solid ${limiteRedes === n ? Dk.red : Dk.border}`,
                    background: limiteRedes === n ? 'rgba(235,50,56,0.15)' : 'transparent',
                    color: limiteRedes === n ? Dk.red : Dk.muted, fontSize: 9, fontWeight: 700, cursor: 'pointer',
                  }}>{n === 999 ? 'Todos' : n}</button>
                ))}
                <button onClick={carregarRedes} title="Atualizar" style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 12, color: Dk.muted, marginLeft: 2 }}>↻</button>
              </div>
            </div>
            {loadingRedes ? (
              <div style={{ padding: '12px', color: Dk.muted, fontSize: 12, textAlign: 'center' }}>Carregando...</div>
            ) : redes.length === 0 ? (
              <div style={{ padding: '12px 14px', color: Dk.muted, fontSize: 11 }}>
                Nenhuma rede vinculada. Use <strong style={{ color: Dk.text }}>Redes de Postos</strong> para cadastrar.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', overflowY: 'auto', maxHeight: 300 }}>
                {redes.slice(0, limiteRedes).map((r, i) => {
                  const cor     = REDE_CORES[i % REDE_CORES.length];
                  const estados = ufsDaRede[r.id] || [];
                  return (
                    <div key={r.id} style={{ padding: '8px 14px', borderBottom: `1px solid ${Dk.border}` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                          <div style={{ width: 7, height: 7, borderRadius: '50%', background: cor, flexShrink: 0 }} />
                          <span style={{ fontSize: 11, fontWeight: 700, color: Dk.text }}>{r.nome}</span>
                          <span style={{ fontSize: 9, color: Dk.muted }}>{r.totalPostos} posto(s)</span>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: cor }}>{fmtN(r.percentual, 1)}%</span>
                          <span style={{ fontSize: 9, color: Dk.muted, marginLeft: 6 }}>{fmtR(r.totalGasto)}</span>
                        </div>
                      </div>
                      <div style={{ height: 3, background: 'rgba(255,255,255,0.06)', borderRadius: 4, overflow: 'hidden', marginBottom: 4 }}>
                        <div style={{ height: '100%', borderRadius: 4, width: `${r.percentual}%`, background: cor, transition: 'width 0.6s ease' }} />
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, alignItems: 'center' }}>
                        {estados.length === 0 ? (
                          <span style={{ fontSize: 9, color: Dk.muted }}>carregando...</span>
                        ) : estados.map((u, idx) => (
                          <span key={u.uf} title={UF_LABELS[u.uf] || u.uf} style={{ fontSize: 9, color: Dk.muted, whiteSpace: 'nowrap' }}>
                            <strong style={{ color: cor }}>{u.uf}</strong> {fmtN(u.percentual, 1)}%
                            {idx < estados.length - 1 && <span style={{ color: Dk.border, marginLeft: 4 }}>·</span>}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>}

        {/* ─── Ranking por Estado ─── */}
        {abaAtiva === 'mapa' &&
        <div style={{ width: 230, flexShrink: 0, background: Dk.card, borderRadius: 12, border: `1px solid ${Dk.border}`, overflow: 'hidden', display: 'flex', flexDirection: 'column', alignSelf: 'flex-end' }}>
          <div style={{ padding: '6px 12px', borderBottom: `1px solid ${Dk.border}`, fontWeight: 700, fontSize: 11, color: Dk.text, flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Ranking por Estado</span>
            <div style={{ display: 'flex', gap: 4 }}>
              {[5, 10, 20, 999].map(n => (
                <button key={n} onClick={() => setLimiteEstados(n)} style={{
                  padding: '2px 6px', borderRadius: 4, border: `1px solid ${limiteEstados === n ? Dk.red : Dk.border}`,
                  background: limiteEstados === n ? 'rgba(235,50,56,0.15)' : 'transparent',
                  color: limiteEstados === n ? Dk.red : Dk.muted, fontSize: 9, fontWeight: 700, cursor: 'pointer',
                }}>{n === 999 ? 'Todos' : n}</button>
              ))}
            </div>
          </div>
          <div style={{ overflowY: 'auto', maxHeight: 195 }}>
            {loading ? (
              <div style={{ padding: 20, color: Dk.muted, textAlign: 'center', fontSize: 12 }}>Carregando...</div>
            ) : dados.length === 0 ? (
              <div style={{ padding: 20, color: Dk.muted, textAlign: 'center', fontSize: 12 }}>Nenhum dado</div>
            ) : dados.slice(0, limiteEstados).map((d, i) => {
              const trrDoEstado = trrs.find(t => t.uf === d.uf);
              return (
              <div key={d.uf}
                onMouseEnter={() => setHovUF(d.uf)}
                onMouseLeave={() => setHovUF(null)}
                style={{ padding: '5px 12px', borderBottom: `1px solid ${Dk.border}`, background: hovUF === d.uf ? 'rgba(255,255,255,0.04)' : 'transparent', cursor: 'default', transition: 'background 0.15s' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 18, height: 18, borderRadius: 5, background: getTopColor(d.percentual, maxPct), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 800, color: '#fff', flexShrink: 0 }}>{i + 1}</div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 10, color: Dk.text }}>{d.uf} <span style={{ fontWeight: 400, color: Dk.muted, fontSize: 9 }}>{UF_LABELS[d.uf] || ''}</span></div>
                      <div style={{ fontSize: 9, color: Dk.muted }}>{fmtR(d.totalGasto)}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 11, color: Dk.red }}>{fmtN(d.percentual, 1)}%</div>
                    {trrDoEstado && trrDoEstado.precoDiesel && (
                      <div title={`TRR: ${trrDoEstado.nome}`} style={{ fontSize: 9, color: '#4ade80', fontWeight: 600 }}>
                        🚛 R$ {Number(trrDoEstado.precoDiesel).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})}/L
                      </div>
                    )}
                  </div>
                </div>
                <div style={{ height: 2, background: 'rgba(255,255,255,0.06)', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ height: '100%', borderRadius: 4, width: `${(d.percentual / maxPct) * 100}%`, background: getTopColor(d.percentual, maxPct), transition: 'width 0.5s ease' }} />
                </div>
              </div>
              );
            })}
          </div>
        </div>}

        {/* ─── Painel BID Postos (recolhível) ─── */}
        {abaAtiva === 'bid' && (
          <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', minHeight: 0, width: painelBidAberto ? 200 : 'auto' }}>
            {/* Header sempre visível */}
            <div style={{ background: Dk.card, borderRadius: painelBidAberto ? '12px 12px 0 0' : 12, border: `1px solid ${Dk.border}`, padding: '8px 10px', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
              <button onClick={() => setPainelBidAberto(v => !v)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: Dk.muted, padding: 0, lineHeight: 1 }}>
                {painelBidAberto ? '◀' : '▶'}
              </button>
              <span style={{ fontWeight: 700, fontSize: 10, color: Dk.text, whiteSpace: 'nowrap' }}>
                📍 {painelBidAberto ? 'Postos' : ''} {postosBid.length > 0 ? `(${postosBid.length})` : ''}
              </span>
              <button onClick={() => { setEditingBid(null); setFormBid({ nome:'', rede:'', cidade:'', uf:'', latitude:'', longitude:'', precoDiesel:'', linkMaps:'' }); setCoordsOk(false); setModalBid(true); }}
                style={{ padding: '2px 8px', borderRadius: 5, border: 'none', background: Dk.red, color: '#fff', fontSize: 9, fontWeight: 700, cursor: 'pointer', marginLeft: 'auto' }}>
                +
              </button>
            </div>

            {/* Lista — só quando aberto */}
            {painelBidAberto && (
              <div style={{ background: Dk.card, borderRadius: '0 0 12px 12px', border: `1px solid ${Dk.border}`, borderTop: 'none', overflowY: 'auto', flex: 1 }}>
                {postosBid.length === 0 ? (
                  <div style={{ padding: 20, color: Dk.muted, textAlign: 'center', fontSize: 11 }}>Nenhum posto ainda</div>
                ) : postosBid.map(p => (
                  <div key={p.id} style={{ padding: '7px 10px', borderBottom: `1px solid ${Dk.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <div style={{ fontWeight: 700, fontSize: 10, color: Dk.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.nome}</div>
                        {p.precoDiesel && <span style={{ fontSize: 9, fontWeight: 800, color: '#4ade80', flexShrink: 0 }}>R$ {Number(p.precoDiesel).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>}
                      </div>
                      <div style={{ fontSize: 9, color: Dk.muted }}>{[p.rede, p.cidade, p.uf].filter(Boolean).join(' · ')}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
                      <button onClick={() => { setEditingBid(p); setFormBid({ nome: p.nome, rede: p.rede||'', cidade: p.cidade||'', uf: p.uf, latitude: p.latitude, longitude: p.longitude, precoDiesel: p.precoDiesel||'', linkMaps:'' }); setCoordsOk(false); setModalBid(true); }}
                        style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 12, padding: '1px 3px' }}>✏️</button>
                      <button onClick={() => deletarBid(p.id)}
                        style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 12, padding: '1px 3px' }}>🗑️</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal BID */}
      {modalBid && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#1c2333', borderRadius: 16, border: '1px solid rgba(255,255,255,0.1)', padding: 24, width: 400, maxWidth: '92vw', boxShadow: '0 20px 60px rgba(0,0,0,0.6)' }}>
            <div style={{ fontWeight: 800, fontSize: 14, color: '#e2e8f0', marginBottom: 20 }}>{editingBid ? '✏️ Editar Posto' : '📍 Cadastrar Posto'}</div>
            {[
              { key: 'nome',        label: 'Nome / Razão Social *', placeholder: 'Ex: Posto BR Centro' },
              { key: 'rede',        label: 'Rede / Bandeira',       placeholder: 'Ex: Shell, Ipiranga, BR...' },
              { key: 'cidade',      label: 'Cidade',                placeholder: 'Ex: São Paulo' },
              { key: 'uf',          label: 'UF *',                  placeholder: 'Ex: SP' },
              { key: 'precoDiesel', label: 'Preço Diesel (R$/L)',   placeholder: 'Ex: 5,90' },
            ].map(({ key, label, placeholder }) => (
              <div key={key} style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#6b7280', marginBottom: 4, letterSpacing: 0.6, textTransform: 'uppercase' }}>{label}</label>
                <input
                  value={formBid[key]}
                  onChange={e => setFormBid(f => ({ ...f, [key]: e.target.value }))}
                  placeholder={placeholder}
                  maxLength={key === 'uf' ? 2 : undefined}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: '#0d1117', color: '#e2e8f0', fontSize: 12, outline: 'none' }}
                />
              </div>
            ))}

            {/* Link do Google Maps */}
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: '#6b7280', marginBottom: 4, letterSpacing: 0.6, textTransform: 'uppercase' }}>
                Link do Google Maps *
              </label>
              <input
                value={formBid.linkMaps}
                onChange={e => {
                  const url = e.target.value;
                  setFormBid(f => ({ ...f, linkMaps: url }));
                  // tenta extrair @lat,lng
                  const m1 = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
                  // tenta extrair ?q=lat,lng ou ?ll=lat,lng
                  const m2 = url.match(/[?&](?:q|ll)=(-?\d+\.\d+),(-?\d+\.\d+)/);
                  const match = m1 || m2;
                  if (match) {
                    setFormBid(f => ({ ...f, linkMaps: url, latitude: match[1], longitude: match[2] }));
                    setCoordsOk(true);
                  } else {
                    setCoordsOk(false);
                  }
                }}
                placeholder="Cole o link do Google Maps aqui"
                style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: 8, border: `1px solid ${coordsOk ? '#4ade80' : 'rgba(255,255,255,0.1)'}`, background: '#0d1117', color: '#e2e8f0', fontSize: 12, outline: 'none' }}
              />
              {coordsOk && (
                <div style={{ fontSize: 10, color: '#4ade80', marginTop: 4 }}>
                  ✓ Coordenadas identificadas: {Number(formBid.latitude).toFixed(4)}, {Number(formBid.longitude).toFixed(4)}
                </div>
              )}
              {formBid.linkMaps && !coordsOk && (
                <div style={{ fontSize: 10, color: '#f87171', marginTop: 4 }}>
                  ✗ Não foi possível extrair coordenadas — verifique o link
                </div>
              )}
            </div>
            {editingBid && formBid.latitude && !coordsOk && (
              <div style={{ fontSize: 10, color: '#6b7280', marginBottom: 12 }}>
                📍 Localização atual: {Number(formBid.latitude).toFixed(4)}, {Number(formBid.longitude).toFixed(4)}
              </div>
            )}
            <div style={{ fontSize: 10, color: '#6b7280', marginBottom: 18, lineHeight: 1.5 }}>
              💡 No Google Maps: clique no posto → toque nos três pontos → <strong style={{ color: '#e2e8f0' }}>Compartilhar</strong> → copie o link.
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => { setModalBid(false); setEditingBid(null); }}
                style={{ padding: '8px 18px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.12)', background: 'transparent', color: '#e2e8f0', fontSize: 12, cursor: 'pointer' }}>
                Cancelar
              </button>
              <button onClick={salvarBid} disabled={savingBid}
                style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: Dk.red, color: '#fff', fontSize: 12, fontWeight: 700, cursor: savingBid ? 'default' : 'pointer', opacity: savingBid ? 0.7 : 1 }}>
                {savingBid ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

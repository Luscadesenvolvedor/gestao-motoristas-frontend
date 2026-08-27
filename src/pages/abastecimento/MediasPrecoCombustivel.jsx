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

/* ─── Consulta Posto ─── */
function ConsultaPosto() {
  const [postos, setPostos]         = useState([]);
  const [postoSel, setPostoSel]     = useState('');
  const [dados, setDados]           = useState([]);
  const [loading, setLoading]       = useState(false);
  const [loadingPostos, setLoadingPostos] = useState(true);
  const [ranking, setRanking]       = useState([]);
  const [loadingRanking, setLoadingRanking] = useState(true);
  const [periodo, setPeriodo]       = useState('3m');

  const PERIODOS = [
    { id: '1m',  label: 'Último mês' },
    { id: '3m',  label: 'Últimos 3 meses' },
    { id: '6m',  label: 'Últimos 6 meses' },
    { id: '12m', label: 'Último ano' },
    { id: 'all', label: 'Todo o período' },
  ];

  function calcDatas(p) {
    if (p === 'all') return {};
    const fim = new Date();
    const ini = new Date();
    const meses = { '1m': 1, '3m': 3, '6m': 6, '12m': 12 }[p];
    ini.setMonth(ini.getMonth() - meses);
    const fmt = d => d.toISOString().slice(0, 10);
    return { dataInicio: fmt(ini), dataFim: fmt(fim) };
  }

  useEffect(() => {
    api.get('/medias-consumo/postos-lista')
      .then(({ data }) => setPostos(data))
      .catch(() => {})
      .finally(() => setLoadingPostos(false));
  }, []);

  useEffect(() => {
    setLoadingRanking(true);
    api.get('/medias-consumo/ranking-postos', { params: calcDatas(periodo) })
      .then(({ data }) => setRanking(data))
      .catch(() => {})
      .finally(() => setLoadingRanking(false));
  }, [periodo]);

  useEffect(() => {
    if (!postoSel) return;
    setLoading(true);
    api.get('/medias-consumo/consulta-posto', { params: { posto: postoSel, ...calcDatas(periodo) } })
      .then(({ data }) => setDados(data))
      .catch(() => setDados([]))
      .finally(() => setLoading(false));
  }, [postoSel, periodo]);

  const totalLitros   = dados.reduce((a, d) => a + d.totalLitros, 0);
  const totalGasto    = dados.reduce((a, d) => a + d.totalGasto, 0);
  const avgPreco      = dados.length > 0 ? dados.reduce((a, d) => a + d.precoMedio, 0) / dados.length : 0;
  const avgLitrosMes  = dados.length > 0 ? totalLitros / dados.length : 0;

  // Score: preço baixo + litros alto = bom
  let scoreLabel = null, scoreCor = '#94a3b8', scoreBg = '#f8fafc';
  if (dados.length >= 2) {
    // últimos 3 meses vs primeiros 3
    const init = dados.slice(0, Math.min(3, dados.length));
    const fim  = dados.slice(-Math.min(3, dados.length));
    const precoSubiu   = fim.reduce((a, d) => a + d.precoMedio, 0)   / fim.length  > init.reduce((a, d) => a + d.precoMedio, 0)   / init.length;
    const litrosSubiu  = fim.reduce((a, d) => a + d.totalLitros, 0)  / fim.length  > init.reduce((a, d) => a + d.totalLitros, 0)  / init.length;
    if (!precoSubiu && litrosSubiu)       { scoreLabel = '✓ Tendência positiva — preço caindo, volume aumentando'; scoreCor = '#15803d'; scoreBg = '#f0fdf4'; }
    else if (precoSubiu && !litrosSubiu)  { scoreLabel = '✗ Tendência negativa — preço subindo, volume caindo';   scoreCor = '#dc2626'; scoreBg = '#fef2f2'; }
    else                                  { scoreLabel = '~ Tendência estável';                                    scoreCor = '#b45309'; scoreBg = '#fffbeb'; }
  }

  const fmtMes = (m) => {
    if (!m) return m;
    const [y, mo] = m.split('-');
    const nomes = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
    return `${nomes[parseInt(mo) - 1]}/${y.slice(2)}`;
  };

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
      <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '10px 14px', fontSize: 12, boxShadow: '0 4px 16px rgba(0,0,0,0.1)' }}>
        <div style={{ fontWeight: 700, marginBottom: 6, color: '#1a1a2e' }}>{fmtMes(label)}</div>
        {payload.map(p => (
          <div key={p.dataKey} style={{ color: p.color, marginBottom: 2 }}>
            {p.name}: <strong>{p.dataKey === 'precoMedio' ? `R$ ${fmtN(p.value, 2)}/L` : `${fmtN(p.value, 0)} L`}</strong>
          </div>
        ))}
      </div>
    );
  };

  const melhores = ranking.slice(0, 5);
  const piores   = ranking.slice(-5).reverse();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, height: '100%' }}>

      {/* Seletor período */}
      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
        {PERIODOS.map(p => (
          <button key={p.id} onClick={() => setPeriodo(p.id)} style={{
            padding: '5px 12px', borderRadius: 20, border: '1.5px solid',
            borderColor: periodo === p.id ? '#EB3238' : '#e2e8f0',
            background: periodo === p.id ? '#EB3238' : '#fff',
            color: periodo === p.id ? '#fff' : '#64748b',
            fontSize: 11, fontWeight: 600, cursor: 'pointer',
          }}>{p.label}</button>
        ))}
      </div>

      {/* Ranking melhores / piores */}
      <div style={{ display: 'flex', gap: 10, flexShrink: 0 }}>
        {/* Melhores preços */}
        <div style={{ flex: 1, background: '#fff', borderRadius: 14, padding: '10px 14px', boxShadow: '0 2px 6px rgba(0,0,0,0.06)', borderLeft: '3px solid #10b981' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#10b981', letterSpacing: 1, marginBottom: 8 }}>✓ MELHORES PREÇOS (DIESEL)</div>
          {loadingRanking ? <div style={{ fontSize: 11, color: '#94a3b8' }}>Carregando...</div> : melhores.map((p, i) => (
            <div key={p.posto} onClick={() => setPostoSel(p.posto)}
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: i < melhores.length - 1 ? '1px solid #f1f5f9' : 'none', cursor: 'pointer' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 18, height: 18, borderRadius: '50%', background: '#dcfce7', color: '#15803d', fontSize: 9, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{i + 1}</span>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: postoSel === p.posto ? '#10b981' : '#1a1a2e', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.posto}</div>
                  {p.redeNome && <div style={{ fontSize: 9, color: '#94a3b8' }}>{p.redeNome}</div>}
                </div>
              </div>
              <span style={{ fontSize: 12, fontWeight: 800, color: '#10b981', flexShrink: 0 }}>R$ {fmtN(p.precoMedio, 2)}</span>
            </div>
          ))}
        </div>

        {/* Piores preços */}
        <div style={{ flex: 1, background: '#fff', borderRadius: 14, padding: '10px 14px', boxShadow: '0 2px 6px rgba(0,0,0,0.06)', borderLeft: '3px solid #EB3238' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#EB3238', letterSpacing: 1, marginBottom: 8 }}>✗ PIORES PREÇOS (DIESEL)</div>
          {loadingRanking ? <div style={{ fontSize: 11, color: '#94a3b8' }}>Carregando...</div> : piores.map((p, i) => (
            <div key={p.posto} onClick={() => setPostoSel(p.posto)}
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: i < piores.length - 1 ? '1px solid #f1f5f9' : 'none', cursor: 'pointer' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 18, height: 18, borderRadius: '50%', background: '#fef2f2', color: '#dc2626', fontSize: 9, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{i + 1}</span>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: postoSel === p.posto ? '#EB3238' : '#1a1a2e', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.posto}</div>
                  {p.redeNome && <div style={{ fontSize: 9, color: '#94a3b8' }}>{p.redeNome}</div>}
                </div>
              </div>
              <span style={{ fontSize: 12, fontWeight: 800, color: '#EB3238', flexShrink: 0 }}>R$ {fmtN(p.precoMedio, 2)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Seletor de posto */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexShrink: 0 }}>
        <select
          value={postoSel}
          onChange={e => setPostoSel(e.target.value)}
          disabled={loadingPostos}
          style={{ flex: 1, padding: '9px 14px', borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: 13, color: '#1a1a2e', outline: 'none', background: '#fff' }}
        >
          <option value="">{loadingPostos ? 'Carregando postos...' : 'Selecione um posto para ver o histórico...'}</option>
          {postos.map(p => <option key={p.posto} value={p.posto}>{p.posto}{p.redeNome ? ` — ${p.redeNome}` : ''}</option>)}
        </select>
      </div>

      {!postoSel && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: 13 }}>
          Selecione um posto para visualizar a análise
        </div>
      )}

      {postoSel && loading && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: 13 }}>
          Carregando...
        </div>
      )}

      {postoSel && !loading && dados.length === 0 && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: 13 }}>
          Nenhum dado de diesel encontrado para este posto
        </div>
      )}

      {postoSel && !loading && dados.length > 0 && (
        <>
          {/* KPIs */}
          <div style={{ display: 'flex', gap: 10, flexShrink: 0 }}>
            {[
              { label: 'Preço médio/L',   val: `R$ ${fmtN(avgPreco, 2)}`,        cor: '#f59e0b' },
              { label: 'Total litros',    val: `${fmtN(totalLitros, 0)} L`,        cor: '#3b82f6' },
              { label: 'Total gasto',     val: fmtR(totalGasto),                   cor: '#EB3238' },
              { label: 'Média litros/mês',val: `${fmtN(avgLitrosMes, 0)} L`,       cor: '#10b981' },
            ].map(k => (
              <div key={k.label} style={{ flex: 1, background: '#fff', borderRadius: 12, padding: '10px 14px', boxShadow: '0 2px 6px rgba(0,0,0,0.06)', borderLeft: `3px solid ${k.cor}` }}>
                <div style={{ fontSize: 9, color: '#94a3b8', fontWeight: 700, letterSpacing: 1, marginBottom: 4 }}>{k.label.toUpperCase()}</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#1a1a2e' }}>{k.val}</div>
              </div>
            ))}
          </div>

          {/* Badge de tendência */}
          {scoreLabel && (
            <div style={{ padding: '8px 14px', borderRadius: 10, background: scoreBg, color: scoreCor, fontSize: 12, fontWeight: 600, flexShrink: 0 }}>
              {scoreLabel}
            </div>
          )}

          {/* Gráfico dual eixo */}
          <div style={{ flex: 1, background: '#fff', borderRadius: 14, padding: '16px 8px 8px', boxShadow: '0 2px 8px rgba(0,0,0,0.07)', minHeight: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', marginBottom: 6, paddingLeft: 12 }}>
              Preço médio (R$/L) vs Volume abastecido (L) — Diesel · {postoSel}
            </div>
            <ResponsiveContainer width="100%" height="90%">
              <ComposedChart data={dados} margin={{ top: 4, right: 24, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="mes" tickFormatter={fmtMes} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                <YAxis yAxisId="left"  tick={{ fontSize: 10, fill: '#f59e0b' }}
                  tickFormatter={v => `R$${fmtN(v, 2)}`}
                  domain={['auto', 'auto']}
                  width={64}
                />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: '#3b82f6' }}
                  tickFormatter={v => `${fmtN(v, 0)}L`}
                  domain={['auto', 'auto']}
                  width={60}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line yAxisId="left"  type="monotone" dataKey="precoMedio"  name="Preço médio (R$/L)"
                  stroke="#f59e0b" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                <Line yAxisId="right" type="monotone" dataKey="totalLitros" name="Volume (L)"
                  stroke="#3b82f6" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
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
  const [redes, setRedes]               = useState([]);
  const [loadingRedes, setLoadingRedes] = useState(true);
  const [ufsDaRede, setUfsDaRede]       = useState({});     // { [redeId]: [...] }
  const containerRef = useRef();

  useEffect(() => {
    fetch(GEOJSON_URL)
      .then(r => r.json())
      .then(geo => {
        const proj = d3.geoMercator().fitExtent([[PAD, PAD], [W + PAD, H + PAD]], geo);
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

  useEffect(() => { carregar(); }, [carregar]);
  useEffect(() => { carregarRedes(); }, [carregarRedes]);

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

  return (
    <div style={{ padding: '14px 20px', fontFamily: 'Inter, sans-serif', background: '#f8fafc', height: '100vh', display: 'flex', flexDirection: 'column', boxSizing: 'border-box', overflow: 'hidden' }}>
      {modalRedes && <ModalRedes onClose={() => setModalRedes(false)} />}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: '#1a1a2e', margin: 0 }}>Preço Combustível</h2>
          {/* Tabs */}
          <div style={{ display: 'flex', gap: 4, background: '#f1f5f9', borderRadius: 10, padding: 4 }}>
            {[{ id: 'mapa', label: '🗺 Mapa por Estado' }, { id: 'consulta', label: '🔍 Consulta Posto' }].map(t => (
              <button key={t.id} onClick={() => setAbaAtiva(t.id)} style={{
                padding: '5px 14px', borderRadius: 7, border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                background: abaAtiva === t.id ? '#fff' : 'transparent',
                color: abaAtiva === t.id ? '#EB3238' : '#64748b',
                boxShadow: abaAtiva === t.id ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
              }}>{t.label}</button>
            ))}
          </div>
        </div>
        <button onClick={() => setModalRedes(true)} style={{
          padding: '6px 16px', borderRadius: 20, border: '1.5px solid #e2e8f0',
          background: '#fff', color: '#475569', fontSize: 12, fontWeight: 700,
          cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
        }}>
          🏪 Redes de Postos
        </button>
      </div>

      {/* Consulta Posto */}
      {abaAtiva === 'consulta' && (
        <div style={{ flex: 1, minHeight: 0 }}>
          <ConsultaPosto />
        </div>
      )}

      <div style={{ display: abaAtiva === 'mapa' ? 'flex' : 'none', gap: 16, flex: 1, minHeight: 0 }}>
        {/* ─── Mapa ─── */}
        <div
          ref={containerRef}
          style={{
            flex: '0 0 38%',
            background: 'linear-gradient(160deg, #060d1a 0%, #0f172a 50%, #060d1a 100%)',
            borderRadius: 16, padding: '14px 16px 12px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.35)',
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

          <div style={{ perspective: '1200px', perspectiveOrigin: '50% 40%', flex: 1, minHeight: 0 }}>
            {geoLoading ? (
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569', fontSize: 13 }}>
                Carregando mapa...
              </div>
            ) : (
              <svg
                viewBox={`0 0 ${W + PAD * 2} ${H + PAD * 2}`}
                style={{ width: '100%', height: '100%', display: 'block', transform: 'rotateX(22deg)', transformOrigin: '50% 50%' }}
                onMouseLeave={() => setHovUF(null)}
              >
                {statePaths.map(({ sigla, d, centroid }) => {
                  const info  = byUF[sigla];
                  const isHov = hovUF === sigla;
                  const [cx, cy] = centroid || [0, 0];
                  const validC = !isNaN(cx) && !isNaN(cy);
                  return (
                    <g key={sigla}>
                      <path
                        d={d}
                        fill={isHov ? '#e0f2fe' : getTopColor(info?.percentual, maxPct)}
                        stroke={isHov ? '#7dd3fc' : '#03070f'}
                        strokeWidth={isHov ? 1.6 : 0.5}
                        style={{ cursor: 'pointer', transition: 'fill 0.18s' }}
                        onMouseEnter={() => setHovUF(sigla)}
                        onMouseLeave={() => setHovUF(null)}
                      />
                      {validC && (
                        <g style={{ pointerEvents: 'none' }}>
                          <text x={cx} y={cy - 1} textAnchor="middle" fontSize={7.5} fontWeight="800"
                            fill={isHov ? '#0284c7' : 'rgba(255,255,255,0.95)'}>
                            {sigla}
                          </text>
                          {info && (
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
              </svg>
            )}
          </div>

          {/* Tooltip */}
          {hovUF && hovData && (
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

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, flexShrink: 0 }}>
            <span style={{ color: '#475569', fontSize: 8, fontWeight: 700 }}>BAIXO</span>
            <div style={{ flex: 1, height: 5, borderRadius: 4, background: 'linear-gradient(to right, #1d4b6a, #34d399, #fbbf24, #f97316, #ea580c, #dc2626, #b91c1c)' }} />
            <span style={{ color: '#475569', fontSize: 8, fontWeight: 700 }}>ALTO</span>
          </div>
        </div>

        {/* ─── Painel direito ─── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10, minHeight: 0 }}>
          {/* KPI */}
          <div style={{ background: '#fff', borderRadius: 14, padding: '12px 16px', boxShadow: '0 2px 8px rgba(0,0,0,0.07)', borderLeft: '4px solid #EB3238', flexShrink: 0 }}>
            <div style={{ fontSize: 9, color: '#94a3b8', fontWeight: 700, letterSpacing: 1, marginBottom: 4 }}>TOTAL GASTO (DIESEL)</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#1a1a2e' }}>{loading ? '—' : fmtR(totalGasto)}</div>
            <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>{dados.length} estado(s) com abastecimento</div>
          </div>

          {/* Ranking Redes */}
          <div style={{ background: '#fff', borderRadius: 14, boxShadow: '0 2px 8px rgba(0,0,0,0.07)', overflow: 'hidden', flexShrink: 0 }}>
            <div style={{ padding: '10px 14px', borderBottom: '1px solid #f1f5f9', fontWeight: 700, fontSize: 12, color: '#1a1a2e', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Ranking por Rede</span>
              <button onClick={carregarRedes} title="Atualizar" style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 13, color: '#94a3b8' }}>↻</button>
            </div>
            {loadingRedes ? (
              <div style={{ padding: '14px', color: '#94a3b8', fontSize: 12, textAlign: 'center' }}>Carregando...</div>
            ) : redes.length === 0 ? (
              <div style={{ padding: '14px 14px', color: '#94a3b8', fontSize: 11 }}>
                Nenhuma rede vinculada ainda. Use <strong>Redes de Postos</strong> para cadastrar e vincular.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {redes.map((r, i) => {
                  const cor     = REDE_CORES[i % REDE_CORES.length];
                  const estados = ufsDaRede[r.id] || [];
                  return (
                    <div key={r.id} style={{ padding: '10px 14px', borderBottom: '1px solid #f1f5f9' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                          <div style={{ width: 8, height: 8, borderRadius: '50%', background: cor, flexShrink: 0 }} />
                          <span style={{ fontSize: 12, fontWeight: 700, color: '#1a1a2e' }}>{r.nome}</span>
                          <span style={{ fontSize: 9, color: '#94a3b8' }}>{r.totalPostos} posto(s)</span>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: cor }}>{fmtN(r.percentual, 1)}%</span>
                          <span style={{ fontSize: 9, color: '#94a3b8', marginLeft: 6 }}>{fmtR(r.totalGasto)}</span>
                        </div>
                      </div>
                      <div style={{ height: 4, background: '#f1f5f9', borderRadius: 4, overflow: 'hidden', marginBottom: 5 }}>
                        <div style={{ height: '100%', borderRadius: 4, width: `${r.percentual}%`, background: cor, transition: 'width 0.6s ease' }} />
                      </div>
                      {/* Estados em linha: SP 32% · MG 20% · ... */}
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                        {estados.length === 0 ? (
                          <span style={{ fontSize: 9, color: '#cbd5e1' }}>carregando...</span>
                        ) : estados.map((u, idx) => (
                          <span key={u.uf} title={UF_LABELS[u.uf] || u.uf}
                            style={{ fontSize: 10, color: '#475569', whiteSpace: 'nowrap' }}>
                            <strong style={{ color: cor }}>{u.uf}</strong>
                            {' '}{fmtN(u.percentual, 1)}%
                            {idx < estados.length - 1 && <span style={{ color: '#cbd5e1', marginLeft: 6 }}>·</span>}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Ranking por Estado */}
          <div style={{ background: '#fff', borderRadius: 14, boxShadow: '0 2px 8px rgba(0,0,0,0.07)', overflow: 'hidden', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '10px 14px', borderBottom: '1px solid #f1f5f9', fontWeight: 700, fontSize: 12, color: '#1a1a2e', flexShrink: 0 }}>
              Ranking por Estado
            </div>
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {loading ? (
                <div style={{ padding: 20, color: '#94a3b8', textAlign: 'center', fontSize: 12 }}>Carregando...</div>
              ) : dados.length === 0 ? (
                <div style={{ padding: 20, color: '#94a3b8', textAlign: 'center', fontSize: 12 }}>Nenhum dado encontrado</div>
              ) : dados.map((d, i) => (
                <div key={d.uf}
                  onMouseEnter={() => setHovUF(d.uf)}
                  onMouseLeave={() => setHovUF(null)}
                  style={{ padding: '7px 14px', borderBottom: '1px solid #f8fafc', background: hovUF === d.uf ? '#f0f9ff' : '#fff', cursor: 'default', transition: 'background 0.15s' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 22, height: 22, borderRadius: 6, background: getTopColor(d.percentual, maxPct), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 800, color: '#fff', flexShrink: 0 }}>{i + 1}</div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 12, color: '#1a1a2e' }}>{d.uf}</div>
                        <div style={{ fontSize: 9, color: '#94a3b8' }}>{UF_LABELS[d.uf] || ''}</div>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 12, color: '#EB3238' }}>{fmtN(d.percentual, 1)}%</div>
                      <div style={{ fontSize: 9, color: '#64748b' }}>{fmtR(d.totalGasto)}</div>
                    </div>
                  </div>
                  <div style={{ height: 3, background: '#f1f5f9', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ height: '100%', borderRadius: 4, width: `${(d.percentual / maxPct) * 100}%`, background: getTopColor(d.percentual, maxPct), transition: 'width 0.5s ease' }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

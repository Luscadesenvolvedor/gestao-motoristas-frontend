// frontend/src/pages/Levantamentos.jsx
import { useState, useEffect, useMemo } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, LabelList,
  ResponsiveContainer
} from 'recharts';

const FORM_VAZIO = { mes: '', tipo: 'FROTA', motoristasFechados: '', saldo: '', custoFolha: '', observacao: '' };


const CustomTooltip = ({ active, payload, label, fmtVal }) => {
  if (!active || !payload?.length) return null;
  const totalVal = payload.reduce((s, p) => s + (p.value || 0), 0);
  return (
    <div style={{ background:'#1e293b', borderRadius:10, padding:'12px 16px', boxShadow:'0 8px 32px rgba(0,0,0,0.25)', minWidth:200 }}>
      <div style={{ color:'#94a3b8', fontSize:11, fontWeight:600, marginBottom:8, textTransform:'uppercase', letterSpacing:'0.05em' }}>{label}</div>
      {payload.map(p => (
        <div key={p.name} style={{ display:'flex', justifyContent:'space-between', gap:24, marginBottom:4 }}>
          <span style={{ color: p.fill, fontSize:12, display:'flex', alignItems:'center', gap:6 }}>
            <span style={{ width:8, height:8, borderRadius:'50%', background:p.fill, display:'inline-block' }}/>
            {p.name}
          </span>
          <span style={{ color:'#f1f5f9', fontSize:12, fontWeight:600 }}>{fmtVal(p.value)}</span>
        </div>
      ))}
      <div style={{ borderTop:'1px solid #334155', marginTop:8, paddingTop:8, display:'flex', justifyContent:'space-between' }}>
        <span style={{ color:'#94a3b8', fontSize:12 }}>Total</span>
        <span style={{ color:'#fff', fontSize:13, fontWeight:700 }}>{fmtVal(totalVal)}</span>
      </div>
    </div>
  );
};

export default function Levantamentos() {
  const [lista, setLista] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [showLista, setShowLista] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [form, setForm] = useState(FORM_VAZIO);
  const [editandoInlineId, setEditandoInlineId] = useState(null);
  const [inlineForm, setInlineForm] = useState({});
  const [anoFiltro, setAnoFiltro] = useState(null);
  const [mesFiltro, setMesFiltro] = useState(null);
  const [tipoFiltro, setTipoFiltro] = useState(null);

  // ── Por Motorista ──
  const [abaAtiva, setAbaAtiva]           = useState('geral'); // 'geral' | 'motoristas'
  const [regsMot, setRegsMot]             = useState([]);
  const [mesFiltroMot, setMesFiltroMot]   = useState('');
  const [buscaMot, setBuscaMot]           = useState('');
  const [importacoesMot, setImportacoesMot] = useState([]);

  const TIPOS_MOT = [
    { key: 'saldo',       label: 'Saldo/Prévia',      cor:'#EB3238', icon:'ti-wallet' },
    { key: 'diarias',     label: 'Diárias Dedicados',  cor:'#0ea5e9', icon:'ti-truck' },
    { key: 'bonificacao', label: 'Bonificações',        cor:'#16a34a', icon:'ti-gift' },
  ];

  const totaisPorTipo = useMemo(() => {
    const map = { saldo: 0, diarias: 0, bonificacao: 0 };
    for (const im of importacoesMot) {
      const k = im.tipoPagamento;
      if (k && map[k] !== undefined) map[k] += parseFloat(im.totalValor || 0);
    }
    return map;
  }, [importacoesMot]);

  const fmtR = v => `R$ ${parseFloat(v||0).toLocaleString('pt-BR', { minimumFractionDigits:2 })}`;
  const fmtDt = s => s ? new Date(s+'T12:00:00').toLocaleDateString('pt-BR') : '—';

  useEffect(() => {
    api.get('/levantamentos-motoristas')
      .then(r => setRegsMot(r.data))
      .catch(() => {});
    api.get('/levantamentos-motoristas/importacoes')
      .then(r => setImportacoesMot(r.data))
      .catch(() => {});
  }, []);

  const mesesMot = useMemo(() => [...new Set(regsMot.map(r => r.mes))].sort(), [regsMot]);

  const regsFiltrados = useMemo(() => {
    const filtrado = regsMot.filter(r => {
      if (mesFiltroMot && r.mes !== mesFiltroMot) return false;
      if (buscaMot && !r.motorista.toLowerCase().includes(buscaMot.toLowerCase())) return false;
      return true;
    });
    // agrupar por motorista + veiculo, somando valores
    const map = {};
    for (const r of filtrado) {
      const key = r.motorista.trim().toUpperCase();
      if (!map[key]) map[key] = { motorista: r.motorista, veiculo: r.veiculo, valor: 0, meses: new Set() };
      map[key].valor += parseFloat(r.valor || 0);
      if (r.mes) map[key].meses.add(r.mes);
    }
    return Object.values(map).sort((a, b) => a.motorista.localeCompare(b.motorista));
  }, [regsMot, mesFiltroMot, buscaMot]);

  const totalMot = regsFiltrados.reduce((s, r) => s + r.valor, 0);



  function carregar() {
    api.get('/levantamentos').then(r => setLista(r.data)).catch(err => {
      const status = err?.response?.status;
      const msg = err?.response?.data?.error || 'Erro desconhecido';
      toast.error(`Erro ${status || ''}: ${msg}`);
    });
  }

  useEffect(() => { carregar(); }, []);

  function abrirNovo() { setEditandoId(null); setForm(FORM_VAZIO); setShowForm(true); }

  function abrirEdicao(l) {
    setEditandoId(l.id);
    setForm({ mes: l.mes, tipo: l.tipo || 'FROTA', motoristasFechados: l.motoristasFechados, saldo: parseFloat(l.previa||0)+parseFloat(l.saldo||0), custoFolha: l.custoFolha, observacao: l.observacao || '' });
    setShowForm(true);
  }

  async function salvar(e) {
    e.preventDefault();
    try {
      if (editandoId) { await api.put(`/levantamentos/${editandoId}`, form); toast.success('Atualizado!'); }
      else { await api.post('/levantamentos', form); toast.success('Registrado!'); }
      setShowForm(false); setEditandoId(null); setForm(FORM_VAZIO); carregar();
    } catch (err) { toast.error(err?.response?.data?.error || 'Erro ao salvar'); }
  }

  function abrirInline(l) {
    setEditandoInlineId(l.id);
    setInlineForm({ motoristasFechados: l.motoristasFechados, saldo: parseFloat(l.previa||0)+parseFloat(l.saldo||0), custoFolha: l.custoFolha });
  }

  async function salvarInline(id) {
    try {
      await api.put(`/levantamentos/${id}`, { ...inlineForm, mes: lista.find(l=>l.id===id)?.mes });
      toast.success('Atualizado!');
      setEditandoInlineId(null);
      carregar();
    } catch (err) { toast.error(err?.response?.data?.error || 'Erro ao salvar'); }
  }

  async function excluir(id) {
    if (!confirm('Excluir este levantamento?')) return;
    try { await api.delete(`/levantamentos/${id}`); carregar(); }
    catch { toast.error('Erro ao excluir'); }
  }

  const lbl = { display:'block', fontSize:11, fontWeight:500, color:'#6b7280', marginBottom:4, textTransform:'uppercase' };
  const inp = { width:'100%', padding:'8px 10px', border:'1px solid #d1d5db', borderRadius:8, fontSize:13, boxSizing:'border-box' };
  const fmt  = v => `R$ ${parseFloat(v||0).toLocaleString('pt-BR', { minimumFractionDigits:2 })}`;
  const fmtK = v => v >= 1000 ? `R$${(v/1000).toFixed(1)}k` : `R$${v.toFixed(0)}`;
  const fmtMes = mes => {
    if (!mes) return '—';
    const nomes = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
    const parts = mes.split('-');
    if (parts.length >= 2) {
      const [ano, m] = parts;
      return `${nomes[parseInt(m,10)-1] || m}/${ano.slice(2)}`;
    }
    // fallback: nome por extenso (ex: "Janeiro", "JANEIRO")
    const MESES_PT_NUM = { janeiro:1,fevereiro:2,marco:3,abril:4,maio:5,junho:6,julho:7,agosto:8,setembro:9,outubro:10,novembro:11,dezembro:12 };
    const normStr = mes.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').trim();
    const num = MESES_PT_NUM[normStr];
    if (num) {
      const anoAtual = String(new Date().getFullYear()).slice(2);
      return `${nomes[num-1]}/${anoAtual}`;
    }
    return mes;
  };
  const total = l => parseFloat(l.previa||0)+parseFloat(l.saldo||0)+parseFloat(l.custoFolha||0);

  // anos e meses disponíveis
  const anos = [...new Set(lista.map(l => l.mes.split('-')[0]))].sort((a,b) => b-a);
  const listaFiltrada = lista.filter(l => {
    if (tipoFiltro && l.tipo !== tipoFiltro) return false;
    if (mesFiltro) return l.mes === mesFiltro;
    if (anoFiltro) return l.mes.startsWith(anoFiltro);
    return true;
  });

  const mesesChart = [...new Set(listaFiltrada.map(l => l.mes))].sort();
  const chartData = mesesChart.map(mes => {
    const frota = listaFiltrada.find(l => l.mes === mes && l.tipo === 'FROTA');
    const meli  = listaFiltrada.find(l => l.mes === mes && l.tipo === 'MELI');
    return {
      mes: fmtMes(mes),
      ...(frota ? { FROTA: total(frota) } : {}),
      ...(meli  ? { MELI:  total(meli)  } : {}),
    };
  });

  const soma = key => listaFiltrada.reduce((s,l) => s + parseFloat(l[key]||0), 0);

  const calcMedia = (registros) => {
    const t = registros.reduce((s,l) => s + total(l), 0);
    const m = registros.reduce((s,l) => s + (parseInt(l.motoristasFechados)||0), 0);
    return m > 0 ? t / m : 0;
  };

  const listaFrota = lista.filter(l => (!anoFiltro || l.mes.startsWith(anoFiltro)) && (!mesFiltro || l.mes === mesFiltro) && l.tipo === 'FROTA');
  const listaMeli  = lista.filter(l => (!anoFiltro || l.mes.startsWith(anoFiltro)) && (!mesFiltro || l.mes === mesFiltro) && l.tipo === 'MELI');

  const cardsMedia = tipoFiltro
    ? [{ label:`Média/Motorista ${tipoFiltro}`, valor: fmt(calcMedia(listaFiltrada)), cor:'#8b5cf6', icon:'ti-chart-bar' }]
    : [
        { label:'Média/Motorista FROTA', valor: fmt(calcMedia(listaFrota)), cor:'#10b981', icon:'ti-chart-bar' },
        { label:'Média/Motorista MELI',  valor: fmt(calcMedia(listaMeli)),  cor:'#8b5cf6', icon:'ti-chart-bar' },
        { label:'Média/Motorista Geral', valor: fmt(calcMedia(listaFiltrada)), cor:'#f59e0b', icon:'ti-chart-bar' },
      ];

  const resumo = [
    { label:'Total Geral',  valor: fmt(listaFiltrada.reduce((s,l)=>s+total(l),0)), cor:'#EB3238', icon:'ti-cash' },
    ...(mesFiltro ? [{ label:'Motoristas Fechados', valor: listaFiltrada.reduce((s,l)=>s+(parseInt(l.motoristasFechados)||0),0), cor:'#0ea5e9', icon:'ti-users' }] : []),
    { label:'Custo Folha',  valor: fmt(soma('custoFolha')), cor:'#3b82f6', icon:'ti-id-badge' },
    { label:'Saldo/Prévia', valor: fmt(soma('saldo') + soma('previa')), cor:'#06b6d4', icon:'ti-wallet' },
    ...cardsMedia,
  ];

  return (
    <div>
      {/* Header com abas */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <h2 style={{ fontSize:20, fontWeight:700, color:'#1a1a2e', margin:0 }}>Levantamentos</h2>
          <div style={{ display:'flex', gap:4, background:'#f1f5f9', borderRadius:10, padding:4 }}>
            {[{ id:'geral', label:'Geral' }, { id:'motoristas', label:'Por Motorista' }].map(ab => (
              <button key={ab.id} onClick={() => setAbaAtiva(ab.id)}
                style={{ padding:'5px 14px', borderRadius:7, border:'none', fontSize:12, fontWeight:600, cursor:'pointer',
                  background: abaAtiva === ab.id ? '#fff' : 'transparent',
                  color: abaAtiva === ab.id ? '#EB3238' : '#64748b',
                  boxShadow: abaAtiva === ab.id ? '0 1px 4px rgba(0,0,0,0.08)' : 'none' }}>
                {ab.label}
              </button>
            ))}
          </div>
        </div>
        <button onClick={abrirNovo}
          style={{ display:'flex', alignItems:'center', gap:8, padding:'9px 18px', background:'#EB3238', color:'#fff', border:'none', borderRadius:8, fontSize:13, fontWeight:600, cursor:'pointer', boxShadow:'0 2px 8px rgba(235,50,56,0.3)' }}>
          <i className="ti ti-plus"></i> Incluir
        </button>
      </div>

      {/* ═══════════════ ABA POR MOTORISTA ═══════════════ */}
      {abaAtiva === 'motoristas' && (
        <div>
          {/* Barra de ferramentas */}
          <div style={{ background:'#fff', border:'1px solid #e5e7eb', borderRadius:12, padding:'14px 20px', marginBottom:16, display:'flex', gap:10, flexWrap:'wrap', alignItems:'center' }}>
            <div style={{ display:'flex', gap:8, alignItems:'center', width:'100%' }}>
              {/* busca motorista */}
              <div style={{ position:'relative' }}>
                <i className="ti ti-search" style={{ position:'absolute', left:8, top:'50%', transform:'translateY(-50%)', fontSize:12, color:'#9ca3af', pointerEvents:'none' }}></i>
                <input value={buscaMot} onChange={e => setBuscaMot(e.target.value)} placeholder="Buscar motorista..."
                  style={{ padding:'6px 10px 6px 26px', border:'1.5px solid #e5e7eb', borderRadius:8, fontSize:12, outline:'none', width:180 }} />
              </div>
              {/* filtros rápidos de mês */}
              {mesesMot.length > 0 && (
                <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
                  <button onClick={() => setMesFiltroMot('')}
                    style={{ padding:'4px 10px', borderRadius:20, border:'1.5px solid', fontSize:11, fontWeight:600, cursor:'pointer', transition:'all .15s',
                      borderColor: mesFiltroMot === '' ? '#6366f1' : '#e5e7eb',
                      background:  mesFiltroMot === '' ? '#6366f1' : '#f9fafb',
                      color:       mesFiltroMot === '' ? '#fff'    : '#6b7280' }}>
                    Todos
                  </button>
                  {mesesMot.map(m => (
                    <button key={m} onClick={() => setMesFiltroMot(mesFiltroMot === m ? '' : m)}
                      style={{ padding:'4px 10px', borderRadius:20, border:'1.5px solid', fontSize:11, fontWeight:600, cursor:'pointer', transition:'all .15s',
                        borderColor: mesFiltroMot === m ? '#6366f1' : '#e5e7eb',
                        background:  mesFiltroMot === m ? '#6366f1' : '#f9fafb',
                        color:       mesFiltroMot === m ? '#fff'    : '#6b7280' }}>
                      {fmtMes(m)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Cards resumo */}
          {regsFiltrados.length > 0 && (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(160px,1fr))', gap:12, marginBottom:16 }}>
              <div style={{ background:'#fff', border:'1px solid #e5e7eb', borderRadius:12, padding:'14px 18px' }}>
                <div style={{ fontSize:10, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:6 }}>Total</div>
                <div style={{ fontSize:22, fontWeight:800, color:'#EB3238' }}>{fmtR(totalMot)}</div>
              </div>
              <div style={{ background:'#fff', border:'1px solid #e5e7eb', borderRadius:12, padding:'14px 18px' }}>
                <div style={{ fontSize:10, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:6 }}>Motoristas</div>
                <div style={{ fontSize:22, fontWeight:800, color:'#0ea5e9' }}>{regsFiltrados.length}</div>
              </div>
            </div>
          )}

          {/* Tabela */}
          {regsFiltrados.length > 0 ? (
            <div style={{ background:'#fff', border:'1px solid #e5e7eb', borderRadius:12, overflow:'hidden' }}>
              <div style={{ overflowX:'auto' }}>
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
                  <thead>
                    <tr style={{ background:'#f8fafc' }}>
                      {['Motorista','Veículo','Mês(es)','Valor Total'].map(h => (
                        <th key={h} style={{ padding:'10px 16px', textAlign: h==='Valor Total' ? 'right' : 'left', fontSize:11, fontWeight:700, color:'#374151', textTransform:'uppercase', letterSpacing:'0.4px', borderBottom:'1px solid #e5e7eb', whiteSpace:'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {regsFiltrados.map((r, i) => (
                      <tr key={r.motorista} style={{ background: i%2===0?'#fff':'#fafafa' }}
                        onMouseEnter={e => e.currentTarget.style.background='#fef2f2'}
                        onMouseLeave={e => e.currentTarget.style.background=i%2===0?'#fff':'#fafafa'}>
                        <td style={{ padding:'10px 16px', fontWeight:600, color:'#1a1a2e', borderBottom:'1px solid #f3f4f6' }}>{r.motorista}</td>
                        <td style={{ padding:'10px 16px', borderBottom:'1px solid #f3f4f6' }}>
                          {r.veiculo ? <span style={{ padding:'2px 8px', borderRadius:6, background:'#f1f5f9', color:'#374151', fontSize:11, fontWeight:700, fontFamily:'monospace' }}>{r.veiculo}</span> : <span style={{ color:'#d1d5db' }}>—</span>}
                        </td>
                        <td style={{ padding:'10px 16px', borderBottom:'1px solid #f3f4f6', color:'#475569', fontSize:12 }}>
                          {[...r.meses].sort().map(m => fmtMes(m)).join(', ') || '—'}
                        </td>
                        <td style={{ padding:'10px 16px', textAlign:'right', fontWeight:700, color:'#EB3238', borderBottom:'1px solid #f3f4f6' }}>{fmtR(r.valor)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ background:'#f8fafc', fontWeight:700 }}>
                      <td colSpan={3} style={{ padding:'11px 16px', color:'#374151' }}>TOTAL</td>
                      <td style={{ padding:'11px 16px', textAlign:'right', color:'#EB3238' }}>{fmtR(totalMot)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          ) : (
            <div style={{ textAlign:'center', padding:60, color:'#9ca3af', background:'#fff', borderRadius:12, border:'1px dashed #d1d5db' }}>
              <i className="ti ti-users" style={{ fontSize:36, display:'block', marginBottom:10, color:'#d1d5db' }}></i>
              <div style={{ fontWeight:500, marginBottom:4 }}>Nenhum dado</div>
              <div style={{ fontSize:12 }}>Importe uma planilha para começar</div>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════ ABA GERAL ═══════════════ */}
      {abaAtiva === 'geral' && <>

      {/* Form */}
      {showForm && (
        <div style={{ background:'#fff', borderRadius:12, padding:20, marginBottom:20, border:'1px solid #e5e7eb', boxShadow:'0 2px 8px rgba(0,0,0,0.06)' }}>
          <form onSubmit={salvar}>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:12 }}>
              <div>
                <label style={lbl}>Mês</label>
                <input type="month" value={form.mes} onChange={e=>setForm(f=>({...f,mes:e.target.value}))} required style={inp}/>
                {form.mes && lista.some(l=>l.mes===form.mes) && !editandoId && (
                  <div style={{ marginTop:4, fontSize:11, color:'#f59e0b', display:'flex', alignItems:'center', gap:4 }}>
                    <i className="ti ti-plus"></i> Os valores serão somados ao registro existente
                  </div>
                )}
              </div>
              <div>
                <label style={lbl}>Tipo</label>
                <select value={form.tipo} onChange={e=>setForm(f=>({...f,tipo:e.target.value}))} style={{...inp, cursor:'pointer'}}>
                  <option value="FROTA">FROTA</option>
                  <option value="MELI">MELI</option>
                </select>
              </div>
              <div><label style={lbl}>Motoristas Fechados</label><input type="number" min="0" step="1" value={form.motoristasFechados} onChange={e=>setForm(f=>({...f,motoristasFechados:e.target.value}))} style={inp}/></div>
              <div><label style={lbl}>Saldo/Prévia (R$)</label><input type="number" step="0.01" min="0" value={form.saldo} onChange={e=>setForm(f=>({...f,saldo:e.target.value}))} style={inp}/></div>
              <div><label style={lbl}>Custo Folha (R$)</label><input type="number" step="0.01" min="0" value={form.custoFolha} onChange={e=>setForm(f=>({...f,custoFolha:e.target.value}))} style={inp}/></div>
              <div style={{ gridColumn:'span 4' }}><label style={lbl}>Observação</label><input type="text" value={form.observacao} onChange={e=>setForm(f=>({...f,observacao:e.target.value}))} style={inp}/></div>
            </div>
            <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:12 }}>
              <button type="button" onClick={()=>{setShowForm(false);setEditandoId(null);}} style={{ padding:'8px 16px', border:'1px solid #d1d5db', borderRadius:8, fontSize:13, cursor:'pointer', background:'#fff' }}>Cancelar</button>
              <button type="submit" style={{ padding:'8px 20px', background:'#EB3238', color:'#fff', border:'none', borderRadius:8, fontSize:13, fontWeight:500, cursor:'pointer' }}>Salvar</button>
            </div>
          </form>
        </div>
      )}

      {lista.length > 0 ? (<>
        {/* Filtros por tipo FROTA/MELI */}
        <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:10 }}>
          {['FROTA','MELI'].map(t => (
            <button key={t} onClick={()=>setTipoFiltro(tipoFiltro===t ? null : t)}
              style={{ padding:'6px 20px', borderRadius:20, fontSize:12, fontWeight:700, cursor:'pointer', border:'none',
                background: tipoFiltro===t ? (t==='FROTA' ? '#065f46' : '#1d4ed8') : '#f1f5f9',
                color: tipoFiltro===t ? '#fff' : '#64748b',
                boxShadow: tipoFiltro===t ? '0 2px 8px rgba(0,0,0,0.15)' : 'none' }}>
              {t}
            </button>
          ))}
        </div>

        {/* Filtros por ano e mês */}
        <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap', marginBottom:16 }}>
          <button onClick={()=>{ setAnoFiltro(null); setMesFiltro(null); setTipoFiltro(null); }}
            style={{ padding:'5px 14px', borderRadius:20, fontSize:12, fontWeight:600, cursor:'pointer', border:'none',
              background: !anoFiltro && !mesFiltro && !tipoFiltro ? '#EB3238' : '#f1f5f9', color: !anoFiltro && !mesFiltro && !tipoFiltro ? '#fff' : '#64748b' }}>
            Todos
          </button>
          {anos.map(ano => (
            <button key={ano} onClick={()=>{ setAnoFiltro(anoFiltro===ano ? null : ano); setMesFiltro(null); }}
              style={{ padding:'5px 14px', borderRadius:20, fontSize:12, fontWeight:600, cursor:'pointer', border:'none',
                background: anoFiltro===ano && !mesFiltro ? '#1e293b' : '#f1f5f9',
                color: anoFiltro===ano && !mesFiltro ? '#fff' : '#64748b',
                boxShadow: anoFiltro===ano && !mesFiltro ? '0 2px 8px rgba(0,0,0,0.15)' : 'none' }}>
              {ano}
            </button>
          ))}
          <span style={{ width:1, height:20, background:'#e2e8f0', margin:'0 4px' }}/>
          {[...new Set(lista.map(l => l.mes))].sort().map(mes => (
            <button key={mes} onClick={()=>setMesFiltro(mesFiltro===mes ? null : mes)}
              style={{ padding:'4px 12px', borderRadius:20, fontSize:11, fontWeight:500, cursor:'pointer',
                border: mesFiltro===mes ? '1px solid #EB3238' : '1px solid #e2e8f0',
                background: mesFiltro===mes ? '#EB3238' : '#fff',
                color: mesFiltro===mes ? '#fff' : '#475569' }}>
              {fmtMes(mes)}
            </button>
          ))}
        </div>

        {/* Cards resumo */}
        <div style={{ display:'grid', gridTemplateColumns:`repeat(${resumo.length},1fr)`, gap:10, marginBottom:12 }}>
          {resumo.map(r => (
            <div key={r.label} style={{ background:'#fff', borderRadius:12, padding:'16px 18px', border:'1px solid #e5e7eb', boxShadow:'0 1px 4px rgba(0,0,0,0.04)' }}>
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
                <div style={{ width:34, height:34, borderRadius:8, background:r.cor+'18', display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <i className={`ti ${r.icon}`} style={{ fontSize:18, color:r.cor }}></i>
                </div>
                <span style={{ fontSize:11, color:'#6b7280', fontWeight:500 }}>{r.label}</span>
              </div>
              <div style={{ fontSize:20, fontWeight:700, color:'#1a1a2e' }}>{r.valor}</div>
            </div>
          ))}
        </div>

        {/* Cards por tipo de importação motorista */}
        {importacoesMot.length > 0 && (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, marginBottom:16 }}>
            {TIPOS_MOT.map(t => (
              <div key={t.key} style={{ background:'#fff', borderRadius:12, padding:'16px 18px', border:'1px solid #e5e7eb', borderTop:`3px solid ${t.cor}`, boxShadow:'0 1px 4px rgba(0,0,0,0.04)' }}>
                <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
                  <div style={{ width:34, height:34, borderRadius:8, background:t.cor+'18', display:'flex', alignItems:'center', justifyContent:'center' }}>
                    <i className={`ti ${t.icon}`} style={{ fontSize:18, color:t.cor }}></i>
                  </div>
                  <span style={{ fontSize:11, color:'#6b7280', fontWeight:500 }}>{t.label}</span>
                </div>
                <div style={{ fontSize:20, fontWeight:700, color:t.cor }}>{fmt(totaisPorTipo[t.key])}</div>
              </div>
            ))}
          </div>
        )}

        {/* Gráfico */}
        <div style={{ background:'linear-gradient(135deg,#1e293b 0%,#0f172a 100%)', borderRadius:16, padding:'24px 20px 16px', boxShadow:'0 8px 32px rgba(0,0,0,0.18)' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
            <div>
              <div style={{ color:'#f1f5f9', fontSize:15, fontWeight:700 }}>Comparativo por mês</div>
              <div style={{ color:'#64748b', fontSize:12, marginTop:2 }}>Distribuição de gastos por categoria</div>
            </div>
            <div style={{ fontSize:11, color:'#64748b' }}>Total gasto por mês</div>
          </div>
          <ResponsiveContainer width="100%" height={380}>
            <ComposedChart data={chartData} margin={{ top:16, right:16, left:0, bottom:4 }} barCategoryGap="25%" barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e3a5f" vertical={false} />
              <XAxis dataKey="mes" tick={{ fontSize:12, fill:'#94a3b8', fontWeight:500 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize:11, fill:'#64748b' }} axisLine={false} tickLine={false} tickFormatter={fmtK} width={60} />
              <Tooltip content={<CustomTooltip fmtVal={fmt} />} cursor={{ fill:'rgba(255,255,255,0.04)' }} />
              {(!tipoFiltro || tipoFiltro === 'FROTA') && (
                <Bar dataKey="FROTA" fill="#10b981" radius={[6,6,0,0]} maxBarSize={50} name="FROTA">
                  <LabelList dataKey="FROTA" position="top" style={{ fontSize:10, fontWeight:700, fill:'#10b981' }} formatter={v => fmtK(v)} />
                  <LabelList dataKey="FROTA" position="insideBottom" style={{ fontSize:9, fontWeight:700, fill:'rgba(255,255,255,0.85)' }} formatter={() => 'FROTA'} />
                </Bar>
              )}
              {(!tipoFiltro || tipoFiltro === 'MELI') && (
                <Bar dataKey="MELI" fill="#3b82f6" radius={[6,6,0,0]} maxBarSize={50} name="MELI">
                  <LabelList dataKey="MELI" position="top" style={{ fontSize:10, fontWeight:700, fill:'#3b82f6' }} formatter={v => fmtK(v)} />
                  <LabelList dataKey="MELI" position="insideBottom" style={{ fontSize:9, fontWeight:700, fill:'rgba(255,255,255,0.85)' }} formatter={() => 'MELI'} />
                </Bar>
              )}
              {tipoFiltro && (
                <Line dataKey={tipoFiltro} type="monotone" stroke="#e2e8f0" strokeWidth={2}
                  dot={{ fill:'#fff', stroke:'#e2e8f0', strokeWidth:2, r:4 }}
                  activeDot={{ r:6, fill:'#fff' }} legendType="none" />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Gerenciar */}
        <div style={{ marginTop:12 }}>
          <button onClick={()=>setShowLista(v=>!v)}
            style={{ background:'none', border:'none', fontSize:12, color:'#6b7280', cursor:'pointer', padding:'4px 0', display:'flex', alignItems:'center', gap:4 }}>
            <i className={`ti ${showLista?'ti-chevron-up':'ti-chevron-down'}`}></i>
            {showLista ? 'Ocultar registros' : 'Gerenciar registros'}
          </button>
          {showLista && (
            <div style={{ background:'#fff', borderRadius:12, border:'1px solid #e5e7eb', overflow:'hidden', marginTop:8 }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
                <thead>
                  <tr style={{ background:'#f9fafb' }}>
                    {['Mês','Tipo','Motoristas','Saldo/Prévia','Custo Folha','Total',''].map(h=>(
                      <th key={h} style={{ padding:'8px 12px', textAlign:'left', fontSize:11, fontWeight:600, color:'#6b7280', textTransform:'uppercase', borderBottom:'1px solid #e5e7eb', whiteSpace:'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {listaFiltrada.map(l=>{
                    const editando = editandoInlineId === l.id;
                    const inpI = { width:'70px', padding:'3px 6px', border:'1px solid #d1d5db', borderRadius:6, fontSize:12, boxSizing:'border-box' };
                    return (
                      <tr key={l.id} style={{ borderBottom:'1px solid #f3f4f6', background: editando ? '#f9fafb' : '#fff' }}>
                        <td style={{ padding:'8px 12px', fontWeight:600 }}>{fmtMes(l.mes)}</td>
                        {editando ? <>
                          <td style={{ padding:'8px 12px' }}>
                            <span style={{ padding:'2px 10px', borderRadius:20, fontSize:11, fontWeight:700,
                              background: l.tipo==='MELI' ? '#dbeafe' : '#d1fae5',
                              color: l.tipo==='MELI' ? '#1d4ed8' : '#065f46' }}>{l.tipo||'FROTA'}</span>
                          </td>
                          <td style={{ padding:'4px 8px' }}><input type="number" min="0" value={inlineForm.motoristasFechados} onChange={e=>setInlineForm(f=>({...f,motoristasFechados:e.target.value}))} style={inpI}/></td>
                          <td style={{ padding:'4px 8px' }}><input type="number" step="0.01" value={inlineForm.saldo} onChange={e=>setInlineForm(f=>({...f,saldo:e.target.value}))} style={inpI}/></td>
                          <td style={{ padding:'4px 8px' }}><input type="number" step="0.01" value={inlineForm.custoFolha} onChange={e=>setInlineForm(f=>({...f,custoFolha:e.target.value}))} style={inpI}/></td>
                          <td style={{ padding:'4px 8px', color:'#EB3238', fontWeight:700 }}>{fmt(Object.values(inlineForm).slice(1).reduce((s,v)=>s+parseFloat(v||0),0))}</td>
                          <td style={{ padding:'4px 8px', whiteSpace:'nowrap' }}>
                            <button onClick={()=>salvarInline(l.id)} style={{ padding:'3px 10px', background:'#EB3238', border:'none', borderRadius:6, fontSize:12, color:'#fff', cursor:'pointer', marginRight:4 }}>Salvar</button>
                            <button onClick={()=>setEditandoInlineId(null)} style={{ padding:'3px 10px', background:'#fff', border:'1px solid #d1d5db', borderRadius:6, fontSize:12, color:'#374151', cursor:'pointer' }}>Cancelar</button>
                          </td>
                        </> : <>
                          <td style={{ padding:'8px 12px' }}>
                            <span style={{ padding:'2px 10px', borderRadius:20, fontSize:11, fontWeight:700,
                              background: l.tipo==='MELI' ? '#dbeafe' : '#d1fae5',
                              color: l.tipo==='MELI' ? '#1d4ed8' : '#065f46' }}>{l.tipo||'FROTA'}</span>
                          </td>
                          <td style={{ padding:'8px 12px' }}>{l.motoristasFechados}</td>
                          <td style={{ padding:'8px 12px' }}>{fmt(parseFloat(l.previa||0)+parseFloat(l.saldo||0))}</td>
                          <td style={{ padding:'8px 12px' }}>{fmt(l.custoFolha)}</td>
                          <td style={{ padding:'8px 12px', color:'#EB3238', fontWeight:700 }}>{fmt(total(l))}</td>
                          <td style={{ padding:'8px 12px', whiteSpace:'nowrap' }}>
                            <button onClick={()=>abrirInline(l)} style={{ padding:'3px 10px', background:'#fff', border:'1px solid #d1d5db', borderRadius:6, fontSize:12, color:'#374151', cursor:'pointer', marginRight:6 }}>Editar</button>
                            <button onClick={()=>excluir(l.id)} style={{ padding:'3px 10px', background:'#fff', border:'1px solid #EB3238', borderRadius:6, fontSize:12, color:'#EB3238', cursor:'pointer' }}>Excluir</button>
                          </td>
                        </>}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </>) : (
        <div style={{ background:'#fff', borderRadius:12, border:'1px solid #e5e7eb', padding:60, textAlign:'center', color:'#9ca3af' }}>
          Nenhum levantamento registrado
        </div>
      )}
      </>}

    </div>
  );
}

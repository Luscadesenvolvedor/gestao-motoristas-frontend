import { useState, useEffect, useMemo, useCallback } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';

const FORM_VAZIO = {
  data: '', hora: '', motorista: '', placa: '', modelo: '',
  kmInicial: '', kmFinal: '', distancia: '',
  documento: '', posto: '', cidade: '', uf: '',
  precoLitro: '', litros: '', produto: 'GASOLINA', valor: '',
  centroCusto: ''
};

const UFS = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];
const CENTROS = ['BUZIN', 'LBM'];

export default function FrotaApoio() {
  const [lista, setLista]           = useState([]);
  const [showForm, setShowForm]     = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [form, setForm]             = useState(FORM_VAZIO);
  const [salvando, setSalvando]     = useState(false);

  // veículos cadastrados
  const [veiculos, setVeiculos]         = useState([]);
  const [showVeiculos, setShowVeiculos] = useState(false);
  const [novoVeiculo, setNovoVeiculo]   = useState({ placa: '', modelo: '' });
  const [showSelectVeiculo, setShowSelectVeiculo] = useState(false);

  // filtros rápidos
  const hoje = new Date();
  const [mesFiltro, setMesFiltro] = useState('');
  const [anoFiltro, setAnoFiltro] = useState('');
  const [ccFiltro,      setCcFiltro]      = useState('');
  const [modeloFiltro,  setModeloFiltro]  = useState('');

  // períodos disponíveis (anos/meses com registros)
  const [periodos, setPeriodos] = useState([]);

  const anosDisponiveis = useMemo(() => {
    const set = [...new Set(periodos.map(p => p.ano))].sort().reverse();
    const anoAtual = String(hoje.getFullYear());
    if (!set.includes(anoAtual)) set.push(anoAtual);
    return set;
  }, [periodos]);

  // seleciona automaticamente o ano mais recente com dados
  useEffect(() => {
    if (periodos.length > 0 && !anoFiltro) {
      const maisRecente = [...new Set(periodos.map(p => p.ano))].sort().reverse()[0];
      if (maisRecente) setAnoFiltro(maisRecente);
    }
  }, [periodos]);

  const mesesDisponiveis = useMemo(() => {
    const filtrado = anoFiltro ? periodos.filter(p => p.ano === anoFiltro) : periodos;
    return [...new Set(filtrado.map(p => p.mes))].sort();
  }, [periodos, anoFiltro]);

  // se o mês selecionado não existe nos dados, limpa
  useEffect(() => {
    if (mesFiltro && mesesDisponiveis.length > 0 && !mesesDisponiveis.includes(mesFiltro)) {
      setMesFiltro('');
    }
  }, [mesesDisponiveis]);

  const fmt  = v => `R$ ${parseFloat(v||0).toLocaleString('pt-BR', { minimumFractionDigits:2, maximumFractionDigits:2 })}`;
  const fmtN = (v,d=2) => parseFloat(v||0).toLocaleString('pt-BR', { minimumFractionDigits:d, maximumFractionDigits:d });
  const fmtDt = s => {
    if (!s) return '—';
    const iso = s instanceof Date ? s.toISOString().slice(0,10) : String(s).slice(0,10);
    return new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR');
  };

  async function carregar() {
    try {
      const params = new URLSearchParams();
      if (anoFiltro) params.append('ano', anoFiltro);
      if (mesFiltro) params.append('mes', mesFiltro);
      if (ccFiltro)  params.append('centroCusto', ccFiltro);
      const r = await api.get(`/frota-apoio?${params}`);
      setLista(r.data);
    } catch { toast.error('Erro ao carregar registros'); }
  }

  useEffect(() => { carregar(); }, [mesFiltro, anoFiltro, ccFiltro]);

  async function carregarVeiculos() {
    try { const r = await api.get('/frota-apoio/veiculos'); setVeiculos(r.data); }
    catch {}
  }

  async function carregarPeriodos() {
    try { const r = await api.get('/frota-apoio/periodos'); setPeriodos(r.data); }
    catch {}
  }

  useEffect(() => { carregarVeiculos(); carregarPeriodos(); }, []);

  async function salvarVeiculo(e) {
    e.preventDefault();
    if (!novoVeiculo.placa) return;
    try {
      await api.post('/frota-apoio/veiculos', novoVeiculo);
      toast.success('Veículo cadastrado!');
      setNovoVeiculo({ placa: '', modelo: '' });
      carregarVeiculos();
    } catch { toast.error('Erro ao cadastrar veículo'); }
  }

  async function excluirVeiculo(id) {
    if (!confirm('Remover este veículo?')) return;
    try { await api.delete(`/frota-apoio/veiculos/${id}`); carregarVeiculos(); }
    catch { toast.error('Erro ao remover'); }
  }

  function selecionarVeiculo(v) {
    setForm(prev => ({ ...prev, placa: v.placa, modelo: v.modelo || '' }));
    setShowSelectVeiculo(false);
  }

  // auto-calcula distância e valor
  function handleForm(e) {
    const { name, value } = e.target;
    setForm(prev => {
      const next = { ...prev, [name]: value };
      if (name === 'kmInicial' || name === 'kmFinal') {
        const ini = parseFloat(name === 'kmInicial' ? value : prev.kmInicial) || 0;
        const fim = parseFloat(name === 'kmFinal'   ? value : prev.kmFinal)   || 0;
        next.distancia = fim > ini ? String((fim - ini).toFixed(2)) : '';
      }
      if (name === 'litros' || name === 'precoLitro') {
        const lit = parseFloat(name === 'litros'    ? value : prev.litros)    || 0;
        const prc = parseFloat(name === 'precoLitro'? value : prev.precoLitro)|| 0;
        next.valor = lit > 0 && prc > 0 ? String((lit * prc).toFixed(2)) : '';
      }
      return next;
    });
  }

  function abrirNovo() { setEditandoId(null); setForm(FORM_VAZIO); setShowForm(true); }

  function abrirEdicao(r) {
    setEditandoId(r.id);
    setForm({
      data:        r.data?.slice(0,10) || '',
      hora:        r.hora || '',
      motorista:   r.motorista || '',
      placa:       r.placa || '',
      modelo:      r.modelo || '',
      kmInicial:   r.kmInicial != null ? String(r.kmInicial) : '',
      kmFinal:     r.kmFinal   != null ? String(r.kmFinal)   : '',
      distancia:   r.distancia != null ? String(r.distancia) : '',
      documento:   r.documento || '',
      posto:       r.posto || '',
      cidade:      r.cidade || '',
      uf:          r.uf || '',
      precoLitro:  r.precoLitro != null ? String(r.precoLitro) : '',
      litros:      r.litros     != null ? String(r.litros)     : '',
      produto:     r.produto || 'GASOLINA',
      valor:       r.valor   != null ? String(r.valor)   : '',
      centroCusto: r.centroCusto || '',
    });
    setShowForm(true);
  }

  async function salvar(e) {
    e.preventDefault();
    setSalvando(true);
    try {
      if (editandoId) {
        await api.put(`/frota-apoio/${editandoId}`, form);
        toast.success('Atualizado!');
      } else {
        await api.post('/frota-apoio', form);
        toast.success('Registrado!');
      }
      setShowForm(false); setEditandoId(null); setForm(FORM_VAZIO);
      carregar();
      carregarPeriodos();
    } catch (err) {
      const detalhe = err?.response?.data?.detail || err?.response?.data?.error || 'Erro ao salvar';
      toast.error(detalhe);
    } finally { setSalvando(false); }
  }

  async function excluir(id) {
    if (!confirm('Excluir este registro?')) return;
    try { await api.delete(`/frota-apoio/${id}`); carregar(); }
    catch { toast.error('Erro ao excluir'); }
  }

  // modelos disponíveis nos registros atuais
  const modelosDisponiveis = useMemo(() =>
    [...new Set(lista.map(r => r.modelo).filter(Boolean))].sort()
  , [lista]);

  // limpa modelo se sumir dos disponíveis
  useEffect(() => {
    if (modeloFiltro && !modelosDisponiveis.includes(modeloFiltro)) setModeloFiltro('');
  }, [modelosDisponiveis]);

  // lista filtrada pelo modelo (client-side)
  const listaFiltrada = useMemo(() =>
    modeloFiltro ? lista.filter(r => r.modelo === modeloFiltro) : lista
  , [lista, modeloFiltro]);

  // cards
  const cards = useMemo(() => {
    const litragem   = listaFiltrada.reduce((s,r) => s + parseFloat(r.litros||0), 0);
    const percorrido = listaFiltrada.reduce((s,r) => s + parseFloat(r.distancia||0), 0);
    const valorTotal = listaFiltrada.reduce((s,r) => s + parseFloat(r.valor||0), 0);
    const consumoKm  = litragem > 0 && percorrido > 0 ? percorrido / litragem : 0;
    return { litragem, percorrido, valorTotal, consumoKm };
  }, [listaFiltrada]);

  const MESES = [
    {v:'01',l:'Janeiro'},{v:'02',l:'Fevereiro'},{v:'03',l:'Março'},
    {v:'04',l:'Abril'},{v:'05',l:'Maio'},{v:'06',l:'Junho'},
    {v:'07',l:'Julho'},{v:'08',l:'Agosto'},{v:'09',l:'Setembro'},
    {v:'10',l:'Outubro'},{v:'11',l:'Novembro'},{v:'12',l:'Dezembro'},
  ];

  const inp = { width:'100%', padding:'8px 10px', border:'1.5px solid #e5e7eb', borderRadius:8, fontSize:13, boxSizing:'border-box', outline:'none' };
  const lbl = { display:'block', fontSize:11, fontWeight:600, color:'#6b7280', marginBottom:4, textTransform:'uppercase' };

  return (
    <div>
      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <h2 style={{ fontSize:20, fontWeight:700, color:'#1a1a2e', margin:0 }}>Controle de Frota Apoio</h2>
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={() => setShowVeiculos(true)}
            style={{ display:'flex', alignItems:'center', gap:6, padding:'9px 16px', background:'#f1f5f9', color:'#374151', border:'1.5px solid #e5e7eb', borderRadius:8, fontSize:13, fontWeight:600, cursor:'pointer' }}>
            <i className="ti ti-car"></i> Veículos
          </button>
          <button onClick={abrirNovo}
            style={{ display:'flex', alignItems:'center', gap:8, padding:'9px 18px', background:'#EB3238', color:'#fff', border:'none', borderRadius:8, fontSize:13, fontWeight:600, cursor:'pointer', boxShadow:'0 2px 8px rgba(235,50,56,0.3)' }}>
            <i className="ti ti-plus"></i> Incluir
          </button>
        </div>
      </div>

      {/* Filtros Rápidos */}
      <div style={{ background:'#fff', border:'1px solid #e5e7eb', borderRadius:12, padding:'14px 20px', marginBottom:16 }}>
        {/* Anos */}
        <div style={{ display:'flex', gap:6, alignItems:'center', flexWrap:'wrap', marginBottom:10 }}>
          <span style={{ fontSize:11, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', marginRight:4 }}>Ano</span>
          {anosDisponiveis.map(a => (
            <button key={a} onClick={() => setAnoFiltro(a)}
              style={{ padding:'5px 14px', borderRadius:20, border:'none', fontSize:12, fontWeight:600, cursor:'pointer', transition:'all .15s',
                background: anoFiltro === a ? '#1e293b' : '#f1f5f9',
                color:      anoFiltro === a ? '#fff'    : '#64748b' }}>
              {a}
            </button>
          ))}
        </div>

        {/* Meses */}
        <div style={{ display:'flex', gap:6, alignItems:'center', flexWrap:'wrap', marginBottom:10 }}>
          <span style={{ fontSize:11, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', marginRight:4 }}>Mês</span>
          <button onClick={() => setMesFiltro('')}
            style={{ padding:'5px 14px', borderRadius:20, border:'none', fontSize:12, fontWeight:600, cursor:'pointer', transition:'all .15s',
              background: mesFiltro === '' ? '#EB3238' : '#f1f5f9',
              color:      mesFiltro === '' ? '#fff'    : '#64748b' }}>
            Todos
          </button>
          {MESES.filter(m => mesesDisponiveis.includes(m.v)).map(m => (
            <button key={m.v} onClick={() => setMesFiltro(mesFiltro === m.v ? '' : m.v)}
              style={{ padding:'5px 14px', borderRadius:20, border:'none', fontSize:12, fontWeight:600, cursor:'pointer', transition:'all .15s',
                background: mesFiltro === m.v ? '#EB3238' : '#f1f5f9',
                color:      mesFiltro === m.v ? '#fff'    : '#64748b' }}>
              {m.l.slice(0,3)}
            </button>
          ))}
          {mesesDisponiveis.length === 0 && (
            <span style={{ fontSize:12, color:'#9ca3af', fontStyle:'italic' }}>Nenhum registro para este ano</span>
          )}
        </div>

        {/* Centro de Custo */}
        <div style={{ display:'flex', gap:6, alignItems:'center', flexWrap:'wrap', marginBottom: modelosDisponiveis.length > 0 ? 10 : 0 }}>
          <span style={{ fontSize:11, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', marginRight:4 }}>Centro de Custo</span>
          <button onClick={() => setCcFiltro('')}
            style={{ padding:'5px 14px', borderRadius:20, border:'none', fontSize:12, fontWeight:600, cursor:'pointer', transition:'all .15s',
              background: ccFiltro === '' ? '#6366f1' : '#f1f5f9',
              color:      ccFiltro === '' ? '#fff'    : '#64748b' }}>
            Todos
          </button>
          {CENTROS.map(c => (
            <button key={c} onClick={() => setCcFiltro(ccFiltro === c ? '' : c)}
              style={{ padding:'5px 14px', borderRadius:20, border:'none', fontSize:12, fontWeight:600, cursor:'pointer', transition:'all .15s',
                background: ccFiltro === c ? '#6366f1' : '#f1f5f9',
                color:      ccFiltro === c ? '#fff'    : '#64748b' }}>
              {c}
            </button>
          ))}
        </div>

        {/* Modelo — só aparece se houver mais de um modelo nos registros */}
        {modelosDisponiveis.length > 1 && (
          <div style={{ display:'flex', gap:6, alignItems:'center', flexWrap:'wrap' }}>
            <span style={{ fontSize:11, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', marginRight:4 }}>Modelo</span>
            <button onClick={() => setModeloFiltro('')}
              style={{ padding:'5px 14px', borderRadius:20, border:'none', fontSize:12, fontWeight:600, cursor:'pointer', transition:'all .15s',
                background: modeloFiltro === '' ? '#0891b2' : '#f1f5f9',
                color:      modeloFiltro === '' ? '#fff'    : '#64748b' }}>
              Todos
            </button>
            {modelosDisponiveis.map(m => (
              <button key={m} onClick={() => setModeloFiltro(modeloFiltro === m ? '' : m)}
                style={{ padding:'5px 14px', borderRadius:20, border:'none', fontSize:12, fontWeight:600, cursor:'pointer', transition:'all .15s',
                  background: modeloFiltro === m ? '#0891b2' : '#f1f5f9',
                  color:      modeloFiltro === m ? '#fff'    : '#64748b' }}>
                {m}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Cards */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(200px,1fr))', gap:14, marginBottom:20 }}>
        {[
          { label:'Litragem Total no Mês', valor:`${fmtN(cards.litragem,2)} L`, cor:'#0ea5e9', icon:'ti-droplet' },
          { label:'Total Percorrido',      valor:`${fmtN(cards.percorrido,1)} km`, cor:'#16a34a', icon:'ti-route' },
          { label:'Consumo por KM',        valor:`${fmtN(cards.consumoKm,2)} km/L`, cor:'#f59e0b', icon:'ti-gauge' },
          { label:'Valor Total Abastecimento', valor: fmt(cards.valorTotal), cor:'#EB3238', icon:'ti-cash' },
        ].map(c => (
          <div key={c.label} style={{ background:'#fff', border:'1px solid #e5e7eb', borderRadius:14, padding:'18px 20px', boxShadow:'0 1px 4px rgba(0,0,0,0.05)' }}>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
              <div style={{ width:36, height:36, borderRadius:10, background:`${c.cor}18`, display:'flex', alignItems:'center', justifyContent:'center' }}>
                <i className={`ti ${c.icon}`} style={{ color:c.cor, fontSize:18 }}></i>
              </div>
              <span style={{ fontSize:11, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'0.5px' }}>{c.label}</span>
            </div>
            <div style={{ fontSize:22, fontWeight:800, color:c.cor }}>{c.valor}</div>
          </div>
        ))}
      </div>

      {/* Tabela */}
      <div style={{ background:'#fff', border:'1px solid #e5e7eb', borderRadius:12, overflow:'hidden' }}>
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
            <thead>
              <tr style={{ background:'#f8fafc' }}>
                {['Data','Hora','Motorista','Placa','Modelo','KM Ini.','KM Fim','Dist.(km)','Posto','Litros','Preço/L','Produto','Valor','C. Custo','Ações'].map(h => (
                  <th key={h} style={{ padding:'10px 12px', textAlign:'left', fontWeight:700, color:'#6b7280', fontSize:11, textTransform:'uppercase', whiteSpace:'nowrap', borderBottom:'1px solid #e5e7eb' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {listaFiltrada.length === 0 && (
                <tr><td colSpan={15} style={{ padding:32, textAlign:'center', color:'#9ca3af' }}>Nenhum registro encontrado</td></tr>
              )}
              {listaFiltrada.map((r, idx) => (
                <tr key={r.id} style={{ background: idx%2===0?'#fff':'#f9fafb', borderBottom:'1px solid #f1f5f9' }}>
                  <td style={{ padding:'8px 12px', whiteSpace:'nowrap' }}>{fmtDt(r.data)}</td>
                  <td style={{ padding:'8px 12px' }}>{r.hora || '—'}</td>
                  <td style={{ padding:'8px 12px', fontWeight:600 }}>{r.motorista}</td>
                  <td style={{ padding:'8px 12px' }}><span style={{ background:'#f1f5f9', padding:'2px 8px', borderRadius:6, fontWeight:700, fontSize:11 }}>{r.placa}</span></td>
                  <td style={{ padding:'8px 12px' }}>{r.modelo || '—'}</td>
                  <td style={{ padding:'8px 12px' }}>{r.kmInicial != null ? fmtN(r.kmInicial,0) : '—'}</td>
                  <td style={{ padding:'8px 12px' }}>{r.kmFinal   != null ? fmtN(r.kmFinal,0)   : '—'}</td>
                  <td style={{ padding:'8px 12px', fontWeight:600 }}>{r.distancia != null ? fmtN(r.distancia,1) : '—'}</td>
                  <td style={{ padding:'8px 12px' }}>{r.posto || '—'}</td>
                  <td style={{ padding:'8px 12px' }}>{r.litros != null ? fmtN(r.litros,2) : '—'}</td>
                  <td style={{ padding:'8px 12px' }}>{r.precoLitro != null ? `R$${fmtN(r.precoLitro,3)}` : '—'}</td>
                  <td style={{ padding:'8px 12px' }}>{r.produto || '—'}</td>
                  <td style={{ padding:'8px 12px', fontWeight:700, color:'#16a34a' }}>{r.valor != null ? fmt(r.valor) : '—'}</td>
                  <td style={{ padding:'8px 12px' }}>
                    {r.centroCusto ? <span style={{ background: r.centroCusto==='BUZIN'?'#dbeafe':'#dcfce7', color: r.centroCusto==='BUZIN'?'#1d4ed8':'#15803d', padding:'2px 8px', borderRadius:6, fontSize:11, fontWeight:700 }}>{r.centroCusto}</span> : '—'}
                  </td>
                  <td style={{ padding:'8px 12px', whiteSpace:'nowrap' }}>
                    <button onClick={() => abrirEdicao(r)} style={{ background:'none', border:'none', cursor:'pointer', color:'#6366f1', fontSize:15, marginRight:8 }} title="Editar"><i className="ti ti-pencil"></i></button>
                    <button onClick={() => excluir(r.id)} style={{ background:'none', border:'none', cursor:'pointer', color:'#ef4444', fontSize:15 }} title="Excluir"><i className="ti ti-trash"></i></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Veículos */}
      {showVeiculos && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
          <div style={{ background:'#fff', borderRadius:16, width:'100%', maxWidth:480, maxHeight:'80vh', overflowY:'auto', boxShadow:'0 20px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ padding:'18px 24px', borderBottom:'1px solid #e5e7eb', display:'flex', justifyContent:'space-between', alignItems:'center', position:'sticky', top:0, background:'#fff' }}>
              <h3 style={{ margin:0, fontSize:16, fontWeight:700 }}>Veículos Cadastrados</h3>
              <button onClick={() => setShowVeiculos(false)} style={{ background:'none', border:'none', fontSize:20, cursor:'pointer', color:'#9ca3af' }}>×</button>
            </div>
            <div style={{ padding:24 }}>
              {/* Formulário de novo veículo */}
              <form onSubmit={salvarVeiculo} style={{ display:'flex', gap:8, marginBottom:20, alignItems:'flex-end' }}>
                <div style={{ flex:1 }}>
                  <label style={lbl}>Placa</label>
                  <input value={novoVeiculo.placa} onChange={e => setNovoVeiculo(p => ({ ...p, placa: e.target.value.toUpperCase() }))}
                    required placeholder="ABC-1234" style={{ ...inp, textTransform:'uppercase' }} />
                </div>
                <div style={{ flex:2 }}>
                  <label style={lbl}>Modelo</label>
                  <input value={novoVeiculo.modelo} onChange={e => setNovoVeiculo(p => ({ ...p, modelo: e.target.value }))}
                    placeholder="Ex: Fiat Uno" style={inp} />
                </div>
                <button type="submit"
                  style={{ padding:'8px 16px', background:'#EB3238', color:'#fff', border:'none', borderRadius:8, fontSize:13, fontWeight:600, cursor:'pointer', whiteSpace:'nowrap' }}>
                  <i className="ti ti-plus"></i> Adicionar
                </button>
              </form>

              {/* Lista */}
              {veiculos.length === 0 && (
                <p style={{ color:'#9ca3af', fontSize:13, textAlign:'center' }}>Nenhum veículo cadastrado ainda.</p>
              )}
              {veiculos.map(v => (
                <div key={v.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 0', borderBottom:'1px solid #f1f5f9' }}>
                  <div>
                    <span style={{ fontWeight:700, fontSize:14, marginRight:10 }}>{v.placa}</span>
                    <span style={{ color:'#6b7280', fontSize:13 }}>{v.modelo || '—'}</span>
                  </div>
                  <button onClick={() => excluirVeiculo(v.id)}
                    style={{ background:'none', border:'none', cursor:'pointer', color:'#ef4444', fontSize:16 }}>
                    <i className="ti ti-trash"></i>
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Modal Formulário */}
      {showForm && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
          <div style={{ background:'#fff', borderRadius:16, width:'100%', maxWidth:760, maxHeight:'90vh', overflowY:'auto', boxShadow:'0 20px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ padding:'20px 24px', borderBottom:'1px solid #e5e7eb', display:'flex', justifyContent:'space-between', alignItems:'center', position:'sticky', top:0, background:'#fff', zIndex:1 }}>
              <h3 style={{ margin:0, fontSize:16, fontWeight:700, color:'#1a1a2e' }}>{editandoId ? 'Editar Abastecimento' : 'Novo Abastecimento'}</h3>
              <button onClick={() => setShowForm(false)} style={{ background:'none', border:'none', fontSize:20, cursor:'pointer', color:'#9ca3af' }}>×</button>
            </div>

            <form onSubmit={salvar} style={{ padding:24 }}>
              {/* Linha 1: Data, Hora, Motorista */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 2fr', gap:14, marginBottom:14 }}>
                <div>
                  <label style={lbl}>Data *</label>
                  <input type="date" name="data" value={form.data} onChange={handleForm} required style={inp} />
                </div>
                <div>
                  <label style={lbl}>Hora</label>
                  <input type="time" name="hora" value={form.hora} onChange={handleForm} style={inp} />
                </div>
                <div>
                  <label style={lbl}>Motorista *</label>
                  <input name="motorista" value={form.motorista} onChange={handleForm} required placeholder="Nome do motorista" style={inp} />
                </div>
              </div>

              {/* Linha 2: Placa, Modelo */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 2fr', gap:14, marginBottom:14 }}>
                <div>
                  <label style={lbl}>Placa *</label>
                  <div style={{ position:'relative' }}>
                    <input name="placa" value={form.placa} onChange={handleForm} required placeholder="ABC-1234"
                      style={{ ...inp, textTransform:'uppercase', paddingRight:36 }} />
                    <button type="button" onClick={() => setShowSelectVeiculo(v => !v)}
                      title="Selecionar veículo cadastrado"
                      style={{ position:'absolute', right:6, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'#6366f1', fontSize:16, padding:2 }}>
                      <i className="ti ti-list-search"></i>
                    </button>
                    {/* dropdown de veículos */}
                    {showSelectVeiculo && veiculos.length > 0 && (
                      <div style={{ position:'absolute', top:'100%', left:0, right:0, background:'#fff', border:'1.5px solid #e5e7eb', borderRadius:8, boxShadow:'0 8px 24px rgba(0,0,0,0.12)', zIndex:200, maxHeight:200, overflowY:'auto', marginTop:2 }}>
                        {veiculos.map(v => (
                          <button key={v.id} type="button" onClick={() => selecionarVeiculo(v)}
                            style={{ width:'100%', textAlign:'left', padding:'8px 12px', border:'none', background:'none', cursor:'pointer', fontSize:13, display:'flex', justifyContent:'space-between', alignItems:'center', borderBottom:'1px solid #f1f5f9' }}
                            onMouseEnter={e => e.currentTarget.style.background='#f1f5f9'}
                            onMouseLeave={e => e.currentTarget.style.background='none'}>
                            <span style={{ fontWeight:700 }}>{v.placa}</span>
                            <span style={{ color:'#6b7280', fontSize:12 }}>{v.modelo || '—'}</span>
                          </button>
                        ))}
                      </div>
                    )}
                    {showSelectVeiculo && veiculos.length === 0 && (
                      <div style={{ position:'absolute', top:'100%', left:0, right:0, background:'#fff', border:'1.5px solid #e5e7eb', borderRadius:8, padding:'10px 12px', fontSize:12, color:'#9ca3af', zIndex:200, marginTop:2 }}>
                        Nenhum veículo cadastrado. Use o botão <strong>Veículos</strong> no topo.
                      </div>
                    )}
                  </div>
                </div>
                <div>
                  <label style={lbl}>Modelo — auto</label>
                  <input name="modelo" value={form.modelo} readOnly tabIndex={-1} placeholder="Preenchido ao selecionar veículo" style={{ ...inp, background:'#f1f5f9', color:'#6b7280', cursor:'not-allowed' }} />
                </div>
              </div>

              {/* Linha 3: KM Inicial, KM Final, Distância */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:14, marginBottom:14 }}>
                <div>
                  <label style={lbl}>KM Inicial</label>
                  <input type="number" name="kmInicial" value={form.kmInicial} onChange={handleForm} placeholder="0" style={inp} />
                </div>
                <div>
                  <label style={lbl}>KM Final</label>
                  <input type="number" name="kmFinal" value={form.kmFinal} onChange={handleForm} placeholder="0" style={inp} />
                </div>
                <div>
                  <label style={lbl}>Distância (km) — auto</label>
                  <input type="number" name="distancia" value={form.distancia} readOnly tabIndex={-1} placeholder="Calculado automaticamente" style={{ ...inp, background:'#f1f5f9', color:'#6b7280', cursor:'not-allowed' }} />
                </div>
              </div>

              {/* Linha 4: Documento, Posto, Cidade, UF */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 2fr 2fr 80px', gap:14, marginBottom:14 }}>
                <div>
                  <label style={lbl}>Documento</label>
                  <input name="documento" value={form.documento} onChange={handleForm} placeholder="Nº doc." style={inp} />
                </div>
                <div>
                  <label style={lbl}>Posto</label>
                  <input name="posto" value={form.posto} onChange={handleForm} placeholder="Nome do posto" style={inp} />
                </div>
                <div>
                  <label style={lbl}>Cidade</label>
                  <input name="cidade" value={form.cidade} onChange={handleForm} placeholder="Cidade" style={inp} />
                </div>
                <div>
                  <label style={lbl}>UF</label>
                  <select name="uf" value={form.uf} onChange={handleForm} style={inp}>
                    <option value="">—</option>
                    {UFS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
              </div>

              {/* Linha 5: Preço/Litro, Litros, Produto, Valor, Centro de Custo */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr 1fr', gap:14, marginBottom:20 }}>
                <div>
                  <label style={lbl}>Preço/Litro</label>
                  <input type="number" step="0.001" name="precoLitro" value={form.precoLitro} onChange={handleForm} placeholder="0,000" style={inp} />
                </div>
                <div>
                  <label style={lbl}>Qtd. Litros</label>
                  <input type="number" step="0.01" name="litros" value={form.litros} onChange={handleForm} placeholder="0,00" style={inp} />
                </div>
                <div>
                  <label style={lbl}>Produto</label>
                  <select name="produto" value={form.produto} onChange={handleForm} style={inp}>
                    <option value="GASOLINA">GASOLINA</option>
                    <option value="ETANOL">ETANOL</option>
                    <option value="DIESEL">DIESEL</option>
                    <option value="GNV">GNV</option>
                  </select>
                </div>
                <div>
                  <label style={lbl}>Valor (R$) — auto</label>
                  <input type="number" step="0.01" name="valor" value={form.valor} readOnly tabIndex={-1} placeholder="Calculado automaticamente" style={{ ...inp, background:'#f1f5f9', color:'#6b7280', cursor:'not-allowed' }} />
                </div>
                <div>
                  <label style={lbl}>Centro de Custo</label>
                  <select name="centroCusto" value={form.centroCusto} onChange={handleForm} style={inp}>
                    <option value="">—</option>
                    {CENTROS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
                <button type="button" onClick={() => setShowForm(false)}
                  style={{ padding:'9px 20px', border:'1.5px solid #e5e7eb', borderRadius:8, background:'#fff', fontSize:13, cursor:'pointer', fontWeight:600 }}>
                  Cancelar
                </button>
                <button type="submit" disabled={salvando}
                  style={{ padding:'9px 24px', background:'#EB3238', color:'#fff', border:'none', borderRadius:8, fontSize:13, fontWeight:600, cursor:'pointer', opacity: salvando ? 0.7 : 1 }}>
                  {salvando ? 'Salvando...' : (editandoId ? 'Atualizar' : 'Salvar')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

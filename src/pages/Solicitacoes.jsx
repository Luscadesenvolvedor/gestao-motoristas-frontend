import { useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx-js-style';

const vazio = { motoristaId:'', tipoId:'', tipoValeId:'', tipoRefId:'', data: new Date().toISOString().split('T')[0], placa:'', valor:'' };

const FROTAS = [
  { key:'buzin', label:'BUZIN', cor:'#EB3238', bg:'#fff0f0' },
  { key:'lbm',   label:'LBM',   cor:'#1a1a2e', bg:'#f0f0ff' },
  { key:'meli',  label:'MELI',  cor:'#d97706', bg:'#fffbeb' },
];

const estiloCabecalho = {
  fill: { fgColor: { rgb: 'A6A6A6' } },
  font: { bold: true, color: { rgb: '000000' } },
  border: {
    top: { style:'thin', color:{ rgb:'000000' } },
    bottom: { style:'thin', color:{ rgb:'000000' } },
    left: { style:'thin', color:{ rgb:'000000' } },
    right: { style:'thin', color:{ rgb:'000000' } },
  },
  alignment: { horizontal:'center', vertical:'center' }
};

const estiloCelula = {
  border: {
    top: { style:'thin', color:{ rgb:'D1D5DB' } },
    bottom: { style:'thin', color:{ rgb:'D1D5DB' } },
    left: { style:'thin', color:{ rgb:'D1D5DB' } },
    right: { style:'thin', color:{ rgb:'D1D5DB' } },
  }
};

export default function Solicitacoes() {
  const { usuario, isAdmin, pode } = useAuth();
  const [lista, setLista] = useState([]);
  const [motoristas, setMotoristas] = useState([]);
  const [tipos, setTipos] = useState([]);
  const [tiposVale, setTiposVale] = useState([]);
  const [tiposRef, setTiposRef] = useState([]);
  const [form, setForm] = useState(vazio);
  const [showForm, setShowForm] = useState(false);
  const [novoTipo, setNovoTipo] = useState('');
  const [showNovoTipo, setShowNovoTipo] = useState(false);
  const [novoVale, setNovoVale] = useState('');
  const [showNovoVale, setShowNovoVale] = useState(false);
  const [novoRef, setNovoRef] = useState('');
  const [showNovoRef, setShowNovoRef] = useState(false);
  const [alertas, setAlertas] = useState({});
  const [pixMotorista, setPixMotorista] = useState('');
  const [contaMotorista, setContaMotorista] = useState('');
  const [filtroMotorista, setFiltroMotorista] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('');
  const [filtroVale, setFiltroVale] = useState('');
  const [filtroRef, setFiltroRef] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('');
  const [filtroMes, setFiltroMes] = useState('');
  const [filtroRapido, setFiltroRapido] = useState('');
  const [filtroFrota, setFiltroFrota] = useState('');
  const [selecionados, setSelecionados] = useState([]);

  useEffect(() => { carregar(); carregarSelects(); }, []);

  async function carregar() {
    const { data } = await api.get('/solicitacoes');
    setLista(data.solicitacoes);
    setSelecionados([]);
  }

  async function carregarSelects() {
    const [m, t, v, r] = await Promise.all([
      api.get('/motoristas'),
      api.get('/tipos/solicitacao'),
      api.get('/tipos/vale'),
      api.get('/tipos/ref'),
    ]);
    setMotoristas(m.data);
    setTipos(t.data);
    setTiposVale(v.data);
    setTiposRef(r.data);
  }

  async function verificarStatus(motoristaId) {
    if (!motoristaId) { setAlertas({}); setPixMotorista(''); setContaMotorista(''); return; }
    try {
      const { data } = await api.get(`/ferias/ativo/${motoristaId}`);
      setAlertas(data);
    } catch { setAlertas({}); }
    const m = motoristas.find(x => x.id === motoristaId);
    setPixMotorista(m?.pix || '');
    setContaMotorista(m?.conta || '');
  }

  function montarObservacao(formAtual) {
    const vale = tiposVale.find(t => t.id === formAtual.tipoValeId)?.nome || '';
    const tipo = tipos.find(t => t.id === formAtual.tipoId)?.nome || '';
    const ref = tiposRef.find(t => t.id === formAtual.tipoRefId)?.nome || '';
    const nomesTipo = tipo.toLowerCase();
    const usaConta = nomesTipo.includes('saldo') || nomesTipo.includes('folga');
    const pagamento = usaConta ? 'Dep em Conta' : (pixMotorista ? `Dep via PIX: ${pixMotorista}` : '');
    const data = formAtual.data ? new Date(formAtual.data + 'T00:00:00').toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit' }) : '';
    const partes = [];
    if (vale) partes.push(vale);
    if (tipo) partes.push(tipo);
    if (ref) partes.push(`Ref: ${ref}`);
    if (pagamento) partes.push(pagamento);
    if (data) partes.push(data);
    return partes.join(' - ');
  }

  async function salvar(e) {
    e.preventDefault();
    try {
      const observacao = montarObservacao(form);
      const { data } = await api.post('/solicitacoes', { ...form, observacao });
      if (data.alertaFerias) toast.error('🏖️ Este motorista está de FÉRIAS!', { duration: 6000 });
      if (data.alertaAtestado) toast.error('🏥 Este motorista está de ATESTADO!', { duration: 6000 });
      if (data.alertaAfastamento) toast.error('⚠️ Este motorista está AFASTADO!', { duration: 6000 });
      if (data.alertaAbandono) toast.error('🚪 Este motorista ABANDONOU o serviço!', { duration: 6000 });
      toast.success('Solicitação criada');
      setForm(vazio); setShowForm(false); setAlertas({}); setPixMotorista(''); setContaMotorista(''); carregar();
    } catch {}
  }

  async function excluir(id) {
    if (!confirm('Excluir esta solicitação?')) return;
    try {
      await api.delete(`/solicitacoes/${id}`);
      toast.success('Solicitação excluída');
      carregar();
    } catch {}
  }

  async function excluirTipo(categoria, id) {
    if (!confirm('Excluir este tipo?')) return;
    try {
      await api.delete(`/tipos/${categoria}/${id}`);
      toast.success('Tipo excluído');
      carregarSelects();
    } catch {}
  }

  async function salvarNovoTipo() {
    if (!novoTipo.trim()) return;
    await api.post('/tipos/solicitacao', { nome: novoTipo });
    toast.success('Tipo adicionado'); setNovoTipo(''); setShowNovoTipo(false); carregarSelects();
  }

  async function salvarNovoVale() {
    if (!novoVale.trim()) return;
    const { data } = await api.post('/tipos/vale', { nome: novoVale });
    toast.success('Vale adicionado'); setNovoVale(''); setShowNovoVale(false);
    carregarSelects();
    setForm(f => ({ ...f, tipoValeId: data.id }));
  }

  async function salvarNovoRef() {
    if (!novoRef.trim()) return;
    const { data } = await api.post('/tipos/ref', { nome: novoRef });
    toast.success('Ref adicionado'); setNovoRef(''); setShowNovoRef(false);
    carregarSelects();
    setForm(f => ({ ...f, tipoRefId: data.id }));
  }

  async function atualizarLiberado(id, liberado) {
    await api.patch(`/solicitacoes/${id}/liberado`, { liberado: parseFloat(liberado) });
    carregar();
  }

  function toggleSelecionado(id) {
    setSelecionados(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);
  }

  function toggleTodos() {
    if (selecionados.length === listaFiltrada.length) {
      setSelecionados([]);
    } else {
      setSelecionados(listaFiltrada.map(s => s.id));
    }
  }

  const FILTROS_RAPIDOS = [
    { key:'fluxos', label:'Fluxos Diários', nomes:['reembolso','vale pessoal','diarias','diária','diárias'] },
    { key:'saldos', label:'Saldos', nomes:['saldo'] },
    { key:'folgas', label:'Folgas', nomes:['folga'] },
  ];

  const listaFiltrada = lista.filter(s => {
    if (filtroFrota && s.motorista?.frota !== filtroFrota) return false;
    if (filtroRapido) {
      const fr = FILTROS_RAPIDOS.find(f => f.key === filtroRapido);
      if (fr) {
        const nomeAtual = (s.tipo?.nome || '').toLowerCase();
        const nomeVale = (s.tipoVale?.nome || '').toLowerCase();
        const nomeRef = (s.tipoRef?.nome || '').toLowerCase();
        if (!fr.nomes.some(n => nomeAtual.includes(n) || nomeVale.includes(n) || nomeRef.includes(n))) return false;
      }
    }
    if (filtroMotorista && s.motoristaId !== filtroMotorista) return false;
    if (filtroTipo && s.tipoId !== filtroTipo) return false;
    if (filtroVale && s.tipoValeId !== filtroVale) return false;
    if (filtroRef && s.tipoRefId !== filtroRef) return false;
    if (filtroStatus && s.status !== filtroStatus) return false;
    if (filtroMes) {
      const [ano, mes] = filtroMes.split('-').map(Number);
      const d = new Date(s.data);
      if (d.getFullYear() !== ano || d.getMonth() + 1 !== mes) return false;
    }
    return true;
  });

  const base = selecionados.length > 0
    ? listaFiltrada.filter(s => selecionados.includes(s.id))
    : listaFiltrada;

  const totalBase = base.reduce((s, x) => s + Number(x.valor), 0);
  const liberadoBase = base.reduce((s, x) => s + Number(x.liberado || 0), 0);
  const pendenteBase = totalBase - liberadoBase;

  function exportarExcel() {
    const exportBase = selecionados.length > 0
      ? listaFiltrada.filter(s => selecionados.includes(s.id))
      : listaFiltrada;

    const cabecalho = ['Motorista','Liberado','Vale','Placa','Banco','Agência','Conta','Tipo','Observação'];

    const linhas = exportBase.map(s => {
      const m = motoristas.find(x => x.id === s.motoristaId);
      return [
        { v: (s.motorista?.nome || '').toUpperCase(), s: estiloCelula },
        { v: Number(s.liberado || 0), s: estiloCelula },
        { v: s.tipoVale?.nome || '', s: estiloCelula },
        { v: s.placa || '', s: estiloCelula },
        { v: m?.banco || '', s: estiloCelula },
        { v: m?.agencia || '', s: estiloCelula },
        { v: m?.conta || '', s: estiloCelula },
        { v: s.tipo?.nome || '', s: estiloCelula },
        { v: s.observacao || '', s: estiloCelula },
      ];
    });

    // Linha de total
    const totalLiberado = exportBase.reduce((s, x) => s + Number(x.liberado || 0), 0);
    linhas.push([
      { v: '', s: estiloCelula },
      { v: totalLiberado, s: { ...estiloCelula, font: { bold: true } } },
      { v: '', s: estiloCelula },
      { v: '', s: estiloCelula },
      { v: '', s: estiloCelula },
      { v: '', s: estiloCelula },
      { v: '', s: estiloCelula },
      { v: '', s: estiloCelula },
      { v: '', s: estiloCelula },
    ]);

    const ws = XLSX.utils.aoa_to_sheet([
      cabecalho.map(c => ({ v: c, s: estiloCabecalho })),
      ...linhas
    ]);

    ws['!cols'] = [
      { wch: 35 }, { wch: 12 }, { wch: 15 }, { wch: 12 },
      { wch: 12 }, { wch: 10 }, { wch: 12 }, { wch: 15 }, { wch: 60 },
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Solicitações');
    XLSX.writeFile(wb, `solicitacoes_${new Date().toLocaleDateString('pt-BR').replace(/\//g,'-')}.xlsx`);
    toast.success('Excel exportado!');
  }

  const fmt = v => `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
  const inp = { width:'100%', padding:'8px 10px', border:'1px solid #d1d5db', borderRadius:8, fontSize:13, boxSizing:'border-box' };
  const lbl = { display:'block', fontSize:11, fontWeight:500, color:'#6b7280', marginBottom:4, textTransform:'uppercase' };
  const btn = (bg, color='#fff') => ({ padding:'8px 16px', background:bg, color, border:'none', borderRadius:8, fontSize:13, fontWeight:500, cursor:'pointer' });
  const previewObs = montarObservacao(form);
  const podeExcluir = usuario?.papel === 'admin' || usuario?.papel === 'financeiro';
  const todosSelecionados = selecionados.length === listaFiltrada.length && listaFiltrada.length > 0;

  return (
    <div>
      <div style={{ display:'flex', gap:10, marginBottom:16 }}>
        {FROTAS.map(f => {
          const total = lista.filter(s => s.motorista?.frota === f.key).length;
          const ativo = filtroFrota === f.key;
          return (
            <button key={f.key} onClick={() => setFiltroFrota(ativo ? '' : f.key)}
              style={{ flex:1, padding:'14px 10px', border:`2px solid ${ativo ? f.cor : '#e5e7eb'}`, borderRadius:12, cursor:'pointer', background: ativo ? f.cor : '#fff', color: ativo ? '#fff' : f.cor, fontWeight:700, fontSize:16, letterSpacing:1, transition:'all 0.15s', display:'flex', flexDirection:'column', alignItems:'center', gap:4 }}>
              {f.label}
              <span style={{ fontSize:11, fontWeight:400, opacity:0.8 }}>{total} solicitação(ões)</span>
            </button>
          );
        })}
      </div>

      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
        <div style={{ display:'flex', alignItems:'center', gap:12, flexWrap:'wrap' }}>
          <h2 style={{ fontSize:20, fontWeight:600, color:'#1a1a2e', margin:0 }}>Solicitações</h2>
          <div style={{ display:'flex', gap:6 }}>
            {FILTROS_RAPIDOS.map(f => (
              <button key={f.key} onClick={() => setFiltroRapido(filtroRapido === f.key ? '' : f.key)}
                style={{ padding:'4px 12px', border:'1px solid '+(filtroRapido===f.key?'#EB3238':'#d1d5db'), borderRadius:20, fontSize:12, cursor:'pointer', background:filtroRapido===f.key?'#EB3238':'#fff', color:filtroRapido===f.key?'#fff':'#374151', fontWeight:filtroRapido===f.key?500:400 }}>
                {f.label}
              </button>
            ))}
          </div>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={exportarExcel} style={btn('#16a34a')}>⬇ Exportar Excel</button>
          <button onClick={()=>setShowForm(v=>!v)} style={btn('#EB3238')}>+ Incluir solicitação</button>
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12, marginBottom:16 }}>
        {[
          ['Total solicitado', totalBase, '#1a1a2e'],
          ['Total liberado', liberadoBase, '#16a34a'],
          ['Pendente', pendenteBase, '#d97706']
        ].map(([l,v,c])=>(
          <div key={l} style={{ background:'#fff', borderRadius:12, padding:'14px 18px', border:'1px solid #e5e7eb' }}>
            <div style={{ fontSize:11, color:'#6b7280', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:6 }}>
              {l} {selecionados.length > 0 && <span style={{ color:'#EB3238', fontSize:10 }}>({selecionados.length} selecionados)</span>}
            </div>
            <div style={{ fontSize:22, fontWeight:600, color:c }}>{fmt(v||0)}</div>
          </div>
        ))}
      </div>

      {showForm && (
        <div style={{ background:'#fff', borderRadius:12, padding:20, marginBottom:16, border:'1px solid #e5e7eb' }}>
          <form onSubmit={salvar}>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              <div>
                <label style={lbl}>Solicitante</label>
                <input value={usuario?.nome} readOnly style={{ ...inp, background:'#f9fafb' }}/>
              </div>
              <div>
                <label style={lbl}>Data</label>
                <input type="date" value={form.data} onChange={e=>setForm(f=>({...f,data:e.target.value}))} style={inp}/>
              </div>
              <div>
                <label style={lbl}>Tipo</label>
                <div style={{ display:'flex', gap:8 }}>
                  <select value={form.tipoId} onChange={e=>setForm(f=>({...f,tipoId:e.target.value}))} required style={{ flex:1, padding:'8px 10px', border:'1px solid #d1d5db', borderRadius:8, fontSize:13 }}>
                    <option value="">Selecionar...</option>
                    {tipos.map(t=><option key={t.id} value={t.id}>{t.nome}</option>)}
                  </select>
                  <button type="button" onClick={()=>setShowNovoTipo(v=>!v)} style={{ padding:'8px 10px', border:'1px solid #d1d5db', borderRadius:8, fontSize:12, cursor:'pointer', background:'#fff' }}>+ Novo</button>
                </div>
                {showNovoTipo && (
                  <>
                    <div style={{ display:'flex', gap:8, marginTop:8 }}>
                      <input value={novoTipo} onChange={e=>setNovoTipo(e.target.value)} placeholder="Nome do novo tipo" style={{ flex:1, padding:'6px 10px', border:'1px solid #d1d5db', borderRadius:8, fontSize:13 }}/>
                      <button type="button" onClick={salvarNovoTipo} style={{ padding:'6px 12px', background:'#EB3238', color:'#fff', border:'none', borderRadius:8, fontSize:13, cursor:'pointer' }}>Salvar</button>
                    </div>
                    <div style={{ marginTop:8, display:'flex', flexWrap:'wrap', gap:6 }}>
                      {tipos.map(t => (
                        <span key={t.id} style={{ display:'flex', alignItems:'center', gap:4, background:'#f3f4f6', borderRadius:20, padding:'3px 10px', fontSize:12 }}>
                          {t.nome}
                          <button type="button" onClick={()=>excluirTipo('solicitacao', t.id)} style={{ background:'none', border:'none', cursor:'pointer', color:'#EB3238', fontSize:14, lineHeight:1, padding:0 }}>×</button>
                        </span>
                      ))}
                    </div>
                  </>
                )}
              </div>
              <div>
                <label style={lbl}>Motorista</label>
                <select value={form.motoristaId} onChange={e=>{ setForm(f=>({...f,motoristaId:e.target.value})); verificarStatus(e.target.value); }} required style={{ width:'100%', padding:'8px 10px', border:'1px solid #d1d5db', borderRadius:8, fontSize:13 }}>
                  <option value="">Selecionar...</option>
                  {motoristas.map(m=><option key={m.id} value={m.id}>{m.nome}</option>)}
                </select>
                {pixMotorista && <p style={{ fontSize:11, color:'#6b7280', marginTop:4 }}>PIX: {pixMotorista}</p>}
                {contaMotorista && <p style={{ fontSize:11, color:'#6b7280', marginTop:2 }}>Conta: {contaMotorista}</p>}
              </div>

              {alertas.emFerias && <div style={{ gridColumn:'1/-1', padding:'10px 14px', background:'#ede9fe', borderRadius:8, fontSize:13, color:'#6d28d9', fontWeight:500 }}>🏖️ Este motorista está de FÉRIAS!</div>}
              {alertas.emAtestado && <div style={{ gridColumn:'1/-1', padding:'10px 14px', background:'#fef3c7', borderRadius:8, fontSize:13, color:'#92400e', fontWeight:500 }}>🏥 Este motorista está de ATESTADO!</div>}
              {alertas.emAfastamento && <div style={{ gridColumn:'1/-1', padding:'10px 14px', background:'#fee2e2', borderRadius:8, fontSize:13, color:'#991b1b', fontWeight:500 }}>⚠️ Este motorista está AFASTADO!</div>}
              {alertas.abandonou && <div style={{ gridColumn:'1/-1', padding:'10px 14px', background:'#fef2f2', borderRadius:8, fontSize:13, color:'#7f1d1d', fontWeight:500 }}>🚪 Este motorista ABANDONOU o serviço!</div>}

              <div>
                <label style={lbl}>Vale</label>
                <div style={{ display:'flex', gap:8 }}>
                  <select value={form.tipoValeId} onChange={e=>setForm(f=>({...f,tipoValeId:e.target.value}))} style={{ flex:1, padding:'8px 10px', border:'1px solid #d1d5db', borderRadius:8, fontSize:13 }}>
                    <option value="">Selecionar...</option>
                    {tiposVale.map(t=><option key={t.id} value={t.id}>{t.nome}</option>)}
                  </select>
                  <button type="button" onClick={()=>setShowNovoVale(v=>!v)} style={{ padding:'8px 10px', border:'1px solid #d1d5db', borderRadius:8, fontSize:12, cursor:'pointer', background:'#fff' }}>+ Novo</button>
                </div>
                {showNovoVale && (
                  <>
                    <div style={{ display:'flex', gap:8, marginTop:8 }}>
                      <input value={novoVale} onChange={e=>setNovoVale(e.target.value)} placeholder="Nome do vale" style={{ flex:1, padding:'6px 10px', border:'1px solid #d1d5db', borderRadius:8, fontSize:13 }}/>
                      <button type="button" onClick={salvarNovoVale} style={{ padding:'6px 12px', background:'#EB3238', color:'#fff', border:'none', borderRadius:8, fontSize:13, cursor:'pointer' }}>Salvar</button>
                    </div>
                    <div style={{ marginTop:8, display:'flex', flexWrap:'wrap', gap:6 }}>
                      {tiposVale.map(t => (
                        <span key={t.id} style={{ display:'flex', alignItems:'center', gap:4, background:'#f3f4f6', borderRadius:20, padding:'3px 10px', fontSize:12 }}>
                          {t.nome}
                          <button type="button" onClick={()=>excluirTipo('vale', t.id)} style={{ background:'none', border:'none', cursor:'pointer', color:'#EB3238', fontSize:14, lineHeight:1, padding:0 }}>×</button>
                        </span>
                      ))}
                    </div>
                  </>
                )}
              </div>

              <div>
                <label style={lbl}>Ref</label>
                <div style={{ display:'flex', gap:8 }}>
                  <select value={form.tipoRefId} onChange={e=>setForm(f=>({...f,tipoRefId:e.target.value}))} style={{ flex:1, padding:'8px 10px', border:'1px solid #d1d5db', borderRadius:8, fontSize:13 }}>
                    <option value="">Selecionar...</option>
                    {tiposRef.map(t=><option key={t.id} value={t.id}>{t.nome}</option>)}
                  </select>
                  <button type="button" onClick={()=>setShowNovoRef(v=>!v)} style={{ padding:'8px 10px', border:'1px solid #d1d5db', borderRadius:8, fontSize:12, cursor:'pointer', background:'#fff' }}>+ Novo</button>
                </div>
                {showNovoRef && (
                  <>
                    <div style={{ display:'flex', gap:8, marginTop:8 }}>
                      <input value={novoRef} onChange={e=>setNovoRef(e.target.value)} placeholder="Nome da ref" style={{ flex:1, padding:'6px 10px', border:'1px solid #d1d5db', borderRadius:8, fontSize:13 }}/>
                      <button type="button" onClick={salvarNovoRef} style={{ padding:'6px 12px', background:'#EB3238', color:'#fff', border:'none', borderRadius:8, fontSize:13, cursor:'pointer' }}>Salvar</button>
                    </div>
                    <div style={{ marginTop:8, display:'flex', flexWrap:'wrap', gap:6 }}>
                      {tiposRef.map(t => (
                        <span key={t.id} style={{ display:'flex', alignItems:'center', gap:4, background:'#f3f4f6', borderRadius:20, padding:'3px 10px', fontSize:12 }}>
                          {t.nome}
                          <button type="button" onClick={()=>excluirTipo('ref', t.id)} style={{ background:'none', border:'none', cursor:'pointer', color:'#EB3238', fontSize:14, lineHeight:1, padding:0 }}>×</button>
                        </span>
                      ))}
                    </div>
                  </>
                )}
              </div>

              <div>
                <label style={lbl}>Placa</label>
                <input value={form.placa} onChange={e=>setForm(f=>({...f,placa:e.target.value}))} placeholder="ABC-1234" style={inp}/>
              </div>
              <div>
                <label style={lbl}>Valor (R$)</label>
                <input type="number" value={form.valor} onChange={e=>setForm(f=>({...f,valor:e.target.value}))} required placeholder="0.00" style={inp}/>
              </div>

              {previewObs && (
                <div style={{ gridColumn:'1/-1', padding:'10px 14px', background:'#f9fafb', borderRadius:8, fontSize:12, color:'#6b7280', border:'1px solid #e5e7eb' }}>
                  <span style={{ fontWeight:500, color:'#374151' }}>Observação: </span>{previewObs}
                </div>
              )}
            </div>
            <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:16 }}>
              <button type="button" onClick={()=>{ setShowForm(false); setAlertas({}); setPixMotorista(''); setContaMotorista(''); }} style={btn('#e5e7eb','#374151')}>Cancelar</button>
              <button type="submit" style={btn('#EB3238')}>Salvar</button>
            </div>
          </form>
        </div>
      )}

      <div style={{ background:'#fff', borderRadius:12, border:'1px solid #e5e7eb', padding:'12px 16px', marginBottom:12, display:'flex', gap:10, flexWrap:'wrap', alignItems:'flex-end' }}>
        <div>
          <label style={lbl}>Motorista</label>
          <select value={filtroMotorista} onChange={e=>setFiltroMotorista(e.target.value)} style={{ padding:'7px 10px', border:'1px solid #d1d5db', borderRadius:8, fontSize:13 }}>
            <option value="">Todos</option>
            {motoristas.map(m=><option key={m.id} value={m.id}>{m.nome}</option>)}
          </select>
        </div>
        <div>
          <label style={lbl}>Tipo</label>
          <select value={filtroTipo} onChange={e=>setFiltroTipo(e.target.value)} style={{ padding:'7px 10px', border:'1px solid #d1d5db', borderRadius:8, fontSize:13 }}>
            <option value="">Todos</option>
            {tipos.map(t=><option key={t.id} value={t.id}>{t.nome}</option>)}
          </select>
        </div>
        <div>
          <label style={lbl}>Vale</label>
          <select value={filtroVale} onChange={e=>setFiltroVale(e.target.value)} style={{ padding:'7px 10px', border:'1px solid #d1d5db', borderRadius:8, fontSize:13 }}>
            <option value="">Todos</option>
            {tiposVale.map(t=><option key={t.id} value={t.id}>{t.nome}</option>)}
          </select>
        </div>
        <div>
          <label style={lbl}>Ref</label>
          <select value={filtroRef} onChange={e=>setFiltroRef(e.target.value)} style={{ padding:'7px 10px', border:'1px solid #d1d5db', borderRadius:8, fontSize:13 }}>
            <option value="">Todos</option>
            {tiposRef.map(t=><option key={t.id} value={t.id}>{t.nome}</option>)}
          </select>
        </div>
        <div>
          <label style={lbl}>Status</label>
          <select value={filtroStatus} onChange={e=>setFiltroStatus(e.target.value)} style={{ padding:'7px 10px', border:'1px solid #d1d5db', borderRadius:8, fontSize:13 }}>
            <option value="">Todos</option>
            <option value="pendente">Pendente</option>
            <option value="pago">Pago</option>
          </select>
        </div>
        <div>
          <label style={lbl}>Mês</label>
          <input type="month" value={filtroMes} onChange={e=>setFiltroMes(e.target.value)} style={{ padding:'7px 10px', border:'1px solid #d1d5db', borderRadius:8, fontSize:13 }}/>
        </div>
        <button onClick={()=>{ setFiltroMotorista(''); setFiltroTipo(''); setFiltroVale(''); setFiltroRef(''); setFiltroStatus(''); setFiltroMes(''); setFiltroRapido(''); setFiltroFrota(''); setSelecionados([]); }}
          style={{ padding:'7px 14px', border:'1px solid #d1d5db', borderRadius:8, fontSize:13, cursor:'pointer', background:'#fff', color:'#6b7280' }}>
          Limpar
        </button>
        <span style={{ fontSize:12, color:'#6b7280', alignSelf:'center' }}>{listaFiltrada.length} registro(s)</span>
        {selecionados.length > 0 && (
          <button onClick={()=>setSelecionados([])} style={{ padding:'7px 14px', border:'1px solid #EB3238', borderRadius:8, fontSize:13, cursor:'pointer', background:'#fff', color:'#EB3238' }}>
            Limpar seleção ({selecionados.length})
          </button>
        )}
      </div>

      <div style={{ background:'#fff', borderRadius:12, border:'1px solid #e5e7eb', overflow:'hidden' }}>
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
            <thead>
              <tr style={{ background:'#f9fafb' }}>
                <th style={{ padding:'10px 14px', borderBottom:'1px solid #e5e7eb', width:40 }}>
                  <input type="checkbox" checked={todosSelecionados} onChange={toggleTodos} style={{ accentColor:'#EB3238', width:16, height:16, cursor:'pointer' }}/>
                </th>
                {['Motorista','Frota','Tipo','Vale','Ref','Placa','Valor','Liberado','Pendente','Status','Ações',...(isAdmin?['Alteração']:[])].map(h=>(
                  <th key={h} style={{ padding:'10px 14px', textAlign:'left', fontSize:11, fontWeight:600, color:'#6b7280', textTransform:'uppercase', borderBottom:'1px solid #e5e7eb', whiteSpace:'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {listaFiltrada.map(s=>{
                const frota = FROTAS.find(f => f.key === s.motorista?.frota);
                const sel = selecionados.includes(s.id);
                return (
                  <tr key={s.id} style={{ borderBottom:'1px solid #f3f4f6', background: sel ? '#fff8f8' : '#fff' }}>
                    <td style={{ padding:'10px 14px' }}>
  {isAdmin && s.status !== 'pago' ? (
    <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
      <span style={{ fontSize:12, color:'#6b7280' }}>{fmt(s.liberado||0)}</span>
      <input type="number" placeholder="+ valor" onBlur={e=>{ if(e.target.value) { atualizarLiberado(s.id,e.target.value); e.target.value=''; }}}
        style={{ width:90, padding:'4px 8px', border:'1px solid #d1d5db', borderRadius:6, fontSize:13 }}/>
    </div>
  ) : fmt(s.liberado||0)}
</td>
                    <td style={{ padding:'10px 14px', color:'#6b7280' }}>{s.tipo?.nome}</td>
                    <td style={{ padding:'10px 14px', color:'#6b7280' }}>{s.tipoVale?.nome || '—'}</td>
                    <td style={{ padding:'10px 14px', color:'#6b7280' }}>{s.tipoRef?.nome || '—'}</td>
                    <td style={{ padding:'10px 14px', color:'#6b7280' }}>{s.placa||'—'}</td>
                    <td style={{ padding:'10px 14px' }}>{fmt(s.valor)}</td>
                    <td style={{ padding:'10px 14px' }}>
                      {isAdmin ? (
                        <input type="number" defaultValue={s.liberado||''} onBlur={e=>atualizarLiberado(s.id,e.target.value)}
                          style={{ width:90, padding:'4px 8px', border:'1px solid #d1d5db', borderRadius:6, fontSize:13 }}/>
                      ) : fmt(s.liberado||0)}
                    </td>
                    <td style={{ padding:'10px 14px', fontWeight:500, color:'#d97706' }}>
                      {fmt(Math.max(0, Number(s.valor) - Number(s.liberado||0)))}
                    </td>
                    <td style={{ padding:'10px 14px' }}>
                      <span style={{ padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:500, background:s.status==='pago'?'#dcfce7':'#fef3c7', color:s.status==='pago'?'#166534':'#92400e' }}>{s.status}</span>
                    </td>
                    <td style={{ padding:'10px 14px' }}>
                      {podeExcluir && (
                        <button onClick={()=>excluir(s.id)} style={{ padding:'4px 12px', border:'1px solid #EB3238', borderRadius:6, fontSize:12, cursor:'pointer', background:'#fff', color:'#EB3238' }}>
                          Excluir
                        </button>
                      )}
                    </td>
                    {isAdmin && <td style={{ padding:'10px 14px', fontSize:11, color:'#9ca3af', whiteSpace:'nowrap' }}>{s.auditorias?.[0]?`${s.auditorias[0].usuario.nome} — ${new Date(s.auditorias[0].criadoEm).toLocaleString('pt-BR')}`:'—'}</td>}
                  </tr>
                );
              })}
              {listaFiltrada.length===0 && <tr><td colSpan={13} style={{ padding:40, textAlign:'center', color:'#9ca3af' }}>Nenhuma solicitação encontrada</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
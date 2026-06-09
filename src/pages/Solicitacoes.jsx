import { useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';

const vazio = { motoristaId:'', tipoId:'', tipoValeId:'', tipoRefId:'', data: new Date().toISOString().split('T')[0], placa:'', valor:'' };

export default function Solicitacoes() {
  const { usuario, isAdmin, pode } = useAuth();
  const [lista, setLista] = useState([]);
  const [totais, setTotais] = useState({});
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

  useEffect(() => { carregar(); carregarSelects(); }, []);

  async function carregar() {
    const { data } = await api.get('/solicitacoes');
    setLista(data.solicitacoes); setTotais(data.totais);
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
    if (!motoristaId) { setAlertas({}); setPixMotorista(''); return; }
    try {
      const { data } = await api.get(`/ferias/ativo/${motoristaId}`);
      setAlertas(data);
    } catch { setAlertas({}); }
    // Pega o PIX do motorista
    const m = motoristas.find(x => x.id === motoristaId);
    setPixMotorista(m?.pix || '');
  }

  function montarObservacao(formAtual) {
    const vale = tiposVale.find(t => t.id === formAtual.tipoValeId)?.nome || '';
    const ref = tiposRef.find(t => t.id === formAtual.tipoRefId)?.nome || '';
    const pix = pixMotorista || '';
    const data = formAtual.data ? new Date(formAtual.data + 'T00:00:00').toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit' }) : '';

    const partes = [];
    if (vale) partes.push(vale);
    if (ref) partes.push(`Ref: ${ref}`);
    if (pix) partes.push(`Dep via PIX: ${pix}`);
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
      setForm(vazio); setShowForm(false); setAlertas({}); setPixMotorista(''); carregar();
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

  const fmt = v => `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
  const inp = { width:'100%', padding:'8px 10px', border:'1px solid #d1d5db', borderRadius:8, fontSize:13, boxSizing:'border-box' };
  const lbl = { display:'block', fontSize:11, fontWeight:500, color:'#6b7280', marginBottom:4, textTransform:'uppercase' };
  const btn = (bg, color='#fff') => ({ padding:'8px 16px', background:bg, color, border:'none', borderRadius:8, fontSize:13, fontWeight:500, cursor:'pointer' });

  // Preview da observação
  const previewObs = montarObservacao(form);

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <h2 style={{ fontSize:20, fontWeight:600, color:'#1a1a2e' }}>Solicitações</h2>
        <button onClick={()=>setShowForm(v=>!v)} style={btn('#EB3238')}>+ Incluir solicitação</button>
      </div>

      {/* Totais */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12, marginBottom:16 }}>
        {[['Total solicitado', totais.totalSolicitado,'#1a1a2e'],['Total liberado', totais.totalLiberado,'#16a34a'],['Pendente', totais.pendente,'#d97706']].map(([l,v,c])=>(
          <div key={l} style={{ background:'#fff', borderRadius:12, padding:'14px 18px', border:'1px solid #e5e7eb' }}>
            <div style={{ fontSize:11, color:'#6b7280', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:6 }}>{l}</div>
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
                  <div style={{ display:'flex', gap:8, marginTop:8 }}>
                    <input value={novoTipo} onChange={e=>setNovoTipo(e.target.value)} placeholder="Nome do novo tipo" style={{ flex:1, padding:'6px 10px', border:'1px solid #d1d5db', borderRadius:8, fontSize:13 }}/>
                    <button type="button" onClick={salvarNovoTipo} style={{ padding:'6px 12px', background:'#EB3238', color:'#fff', border:'none', borderRadius:8, fontSize:13, cursor:'pointer' }}>Salvar</button>
                  </div>
                )}
              </div>
              <div>
                <label style={lbl}>Motorista</label>
                <select value={form.motoristaId} onChange={e=>{ setForm(f=>({...f,motoristaId:e.target.value})); verificarStatus(e.target.value); }} required style={{ width:'100%', padding:'8px 10px', border:'1px solid #d1d5db', borderRadius:8, fontSize:13 }}>
                  <option value="">Selecionar...</option>
                  {motoristas.map(m=><option key={m.id} value={m.id}>{m.nome}</option>)}
                </select>
                {pixMotorista && <p style={{ fontSize:11, color:'#6b7280', marginTop:4 }}>PIX: {pixMotorista}</p>}
              </div>

              {alertas.emFerias && <div style={{ gridColumn:'1/-1', padding:'10px 14px', background:'#ede9fe', borderRadius:8, fontSize:13, color:'#6d28d9', fontWeight:500 }}>🏖️ Este motorista está de FÉRIAS!</div>}
              {alertas.emAtestado && <div style={{ gridColumn:'1/-1', padding:'10px 14px', background:'#fef3c7', borderRadius:8, fontSize:13, color:'#92400e', fontWeight:500 }}>🏥 Este motorista está de ATESTADO!</div>}
              {alertas.emAfastamento && <div style={{ gridColumn:'1/-1', padding:'10px 14px', background:'#fee2e2', borderRadius:8, fontSize:13, color:'#991b1b', fontWeight:500 }}>⚠️ Este motorista está AFASTADO!</div>}
              {alertas.abandonou && <div style={{ gridColumn:'1/-1', padding:'10px 14px', background:'#fef2f2', borderRadius:8, fontSize:13, color:'#7f1d1d', fontWeight:500 }}>🚪 Este motorista ABANDONOU o serviço!</div>}

              {/* Vale */}
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
                  <div style={{ display:'flex', gap:8, marginTop:8 }}>
                    <input value={novoVale} onChange={e=>setNovoVale(e.target.value)} placeholder="Nome do vale" style={{ flex:1, padding:'6px 10px', border:'1px solid #d1d5db', borderRadius:8, fontSize:13 }}/>
                    <button type="button" onClick={salvarNovoVale} style={{ padding:'6px 12px', background:'#EB3238', color:'#fff', border:'none', borderRadius:8, fontSize:13, cursor:'pointer' }}>Salvar</button>
                  </div>
                )}
              </div>

              {/* Ref */}
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
                  <div style={{ display:'flex', gap:8, marginTop:8 }}>
                    <input value={novoRef} onChange={e=>setNovoRef(e.target.value)} placeholder="Nome da ref" style={{ flex:1, padding:'6px 10px', border:'1px solid #d1d5db', borderRadius:8, fontSize:13 }}/>
                    <button type="button" onClick={salvarNovoRef} style={{ padding:'6px 12px', background:'#EB3238', color:'#fff', border:'none', borderRadius:8, fontSize:13, cursor:'pointer' }}>Salvar</button>
                  </div>
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

              {/* Preview observação */}
              {previewObs && (
                <div style={{ gridColumn:'1/-1', padding:'10px 14px', background:'#f9fafb', borderRadius:8, fontSize:12, color:'#6b7280', border:'1px solid #e5e7eb' }}>
                  <span style={{ fontWeight:500, color:'#374151' }}>Observação: </span>{previewObs}
                </div>
              )}
            </div>
            <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:16 }}>
              <button type="button" onClick={()=>{ setShowForm(false); setAlertas({}); setPixMotorista(''); }} style={btn('#e5e7eb','#374151')}>Cancelar</button>
              <button type="submit" style={btn('#EB3238')}>Salvar</button>
            </div>
          </form>
        </div>
      )}

      <div style={{ background:'#fff', borderRadius:12, border:'1px solid #e5e7eb', overflow:'hidden' }}>
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
            <thead>
              <tr style={{ background:'#f9fafb' }}>
                {['Motorista','Tipo','Vale','Ref','Placa','Valor','Liberado','Pendente','Status',...(isAdmin?['Alteração']:[])].map(h=>(
                  <th key={h} style={{ padding:'10px 14px', textAlign:'left', fontSize:11, fontWeight:600, color:'#6b7280', textTransform:'uppercase', borderBottom:'1px solid #e5e7eb', whiteSpace:'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lista.map(s=>(
                <tr key={s.id} style={{ borderBottom:'1px solid #f3f4f6' }}>
                  <td style={{ padding:'10px 14px', fontWeight:500 }}>{s.motorista?.nome}</td>
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
                  {isAdmin && <td style={{ padding:'10px 14px', fontSize:11, color:'#9ca3af', whiteSpace:'nowrap' }}>{s.auditorias?.[0]?`${s.auditorias[0].usuario.nome} — ${new Date(s.auditorias[0].criadoEm).toLocaleString('pt-BR')}`:'—'}</td>}
                </tr>
              ))}
              {lista.length===0 && <tr><td colSpan={10} style={{ padding:40, textAlign:'center', color:'#9ca3af' }}>Nenhuma solicitação</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
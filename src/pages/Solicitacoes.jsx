// frontend/src/pages/Solicitacoes.jsx
import { useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';

const vazio = { motoristaId:'', tipoId:'', data: new Date().toISOString().split('T')[0], placa:'', valor:'' };

export default function Solicitacoes() {
  const { usuario, isAdmin, pode } = useAuth();
  const [lista, setLista] = useState([]);
  const [totais, setTotais] = useState({});
  const [motoristas, setMotoristas] = useState([]);
  const [tipos, setTipos] = useState([]);
  const [form, setForm] = useState(vazio);
  const [showForm, setShowForm] = useState(false);
  const [alertaFerias, setAlertaFerias] = useState(false);
  const [novoTipo, setNovoTipo] = useState('');
  const [showNovoTipo, setShowNovoTipo] = useState(false);
  const [anexo, setAnexo] = useState(null);

  useEffect(() => { carregar(); carregarSelects(); }, []);

  async function carregar() {
    const { data } = await api.get('/solicitacoes');
    setLista(data.solicitacoes); setTotais(data.totais);
  }

  async function carregarSelects() {
    const [m, t] = await Promise.all([api.get('/motoristas'), api.get('/tipos/solicitacao')]);
    setMotoristas(m.data); setTipos(t.data);
  }

  async function salvar(e) {
    e.preventDefault();
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k,v]) => fd.append(k, v));
      if (anexo) fd.append('anexo', anexo);
      const { data } = await api.post('/solicitacoes', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      if (data.alertaFerias) toast.error('⚠️ Este motorista está de férias!', { duration: 5000 });
      toast.success('Solicitação criada');
      setForm(vazio); setShowForm(false); carregar();
    } catch {}
  }

  async function salvarNovoTipo() {
    if (!novoTipo.trim()) return;
    await api.post('/tipos/solicitacao', { nome: novoTipo });
    toast.success('Tipo adicionado'); setNovoTipo(''); setShowNovoTipo(false); carregarSelects();
  }

  async function atualizarLiberado(id, liberado) {
    await api.patch(`/solicitacoes/${id}/liberado`, { liberado: parseFloat(liberado) });
    carregar();
  }

  const fmt = v => `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

  return (
    <div>
      <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20 }}>
        <h2 style={{ fontSize:20,fontWeight:600,color:'#1a1a2e' }}>Solicitações</h2>
        <button onClick={() => setShowForm(v=>!v)} style={{ display:'flex',alignItems:'center',gap:8,padding:'9px 16px',background:'#7c3aed',color:'#fff',border:'none',borderRadius:8,fontSize:13,fontWeight:500,cursor:'pointer' }}>
          <i className="ti ti-plus"></i> Incluir solicitação
        </button>
      </div>

      {/* Totais */}
      <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12,marginBottom:16 }}>
        {[['Total solicitado', totais.totalSolicitado, '#1a1a2e'],['Total liberado', totais.totalLiberado,'#16a34a'],['Pendente', totais.pendente,'#d97706']].map(([l,v,c])=>(
          <div key={l} style={{ background:'#fff',borderRadius:12,padding:'14px 18px',border:'1px solid #e5e7eb' }}>
            <div style={{ fontSize:11,color:'#6b7280',textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:6 }}>{l}</div>
            <div style={{ fontSize:22,fontWeight:600,color:c }}>{fmt(v||0)}</div>
          </div>
        ))}
      </div>

      {showForm && (
        <div style={{ background:'#fff',borderRadius:12,padding:20,marginBottom:16,border:'1px solid #e5e7eb' }}>
          <form onSubmit={salvar}>
            <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:12 }}>
              <div>
                <label style={{ display:'block',fontSize:11,fontWeight:500,color:'#6b7280',marginBottom:4,textTransform:'uppercase' }}>Solicitante</label>
                <input value={usuario?.nome} readOnly style={{ width:'100%',padding:'8px 10px',border:'1px solid #e5e7eb',borderRadius:8,fontSize:13,background:'#f9fafb',boxSizing:'border-box' }} />
              </div>
              <div>
                <label style={{ display:'block',fontSize:11,fontWeight:500,color:'#6b7280',marginBottom:4,textTransform:'uppercase' }}>Data</label>
                <input type="date" value={form.data} onChange={e=>setForm(f=>({...f,data:e.target.value}))} style={{ width:'100%',padding:'8px 10px',border:'1px solid #d1d5db',borderRadius:8,fontSize:13,boxSizing:'border-box' }} />
              </div>
              <div>
                <label style={{ display:'block',fontSize:11,fontWeight:500,color:'#6b7280',marginBottom:4,textTransform:'uppercase' }}>Tipo</label>
                <div style={{ display:'flex',gap:8 }}>
                  <select value={form.tipoId} onChange={e=>setForm(f=>({...f,tipoId:e.target.value}))} required style={{ flex:1,padding:'8px 10px',border:'1px solid #d1d5db',borderRadius:8,fontSize:13 }}>
                    <option value="">Selecionar...</option>
                    {tipos.map(t=><option key={t.id} value={t.id}>{t.nome}</option>)}
                  </select>
                  <button type="button" onClick={()=>setShowNovoTipo(v=>!v)} style={{ padding:'8px 10px',border:'1px solid #d1d5db',borderRadius:8,fontSize:12,cursor:'pointer',background:'#fff' }}>+ Novo</button>
                </div>
                {showNovoTipo && (
                  <div style={{ display:'flex',gap:8,marginTop:8 }}>
                    <input value={novoTipo} onChange={e=>setNovoTipo(e.target.value)} placeholder="Nome do novo tipo" style={{ flex:1,padding:'6px 10px',border:'1px solid #d1d5db',borderRadius:8,fontSize:13 }} />
                    <button type="button" onClick={salvarNovoTipo} style={{ padding:'6px 12px',background:'#7c3aed',color:'#fff',border:'none',borderRadius:8,fontSize:13,cursor:'pointer' }}>Salvar</button>
                  </div>
                )}
              </div>
              <div>
                <label style={{ display:'block',fontSize:11,fontWeight:500,color:'#6b7280',marginBottom:4,textTransform:'uppercase' }}>Motorista</label>
                <select value={form.motoristaId} onChange={e=>setForm(f=>({...f,motoristaId:e.target.value}))} required style={{ width:'100%',padding:'8px 10px',border:'1px solid #d1d5db',borderRadius:8,fontSize:13 }}>
                  <option value="">Selecionar...</option>
                  {motoristas.map(m=><option key={m.id} value={m.id}>{m.nome}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display:'block',fontSize:11,fontWeight:500,color:'#6b7280',marginBottom:4,textTransform:'uppercase' }}>Placa</label>
                <input value={form.placa} onChange={e=>setForm(f=>({...f,placa:e.target.value}))} placeholder="ABC-1234" style={{ width:'100%',padding:'8px 10px',border:'1px solid #d1d5db',borderRadius:8,fontSize:13,boxSizing:'border-box' }} />
              </div>
              <div>
                <label style={{ display:'block',fontSize:11,fontWeight:500,color:'#6b7280',marginBottom:4,textTransform:'uppercase' }}>Valor (R$)</label>
                <input type="number" value={form.valor} onChange={e=>setForm(f=>({...f,valor:e.target.value}))} required placeholder="0.00" style={{ width:'100%',padding:'8px 10px',border:'1px solid #d1d5db',borderRadius:8,fontSize:13,boxSizing:'border-box' }} />
              </div>
              <div style={{ gridColumn:'1/-1' }}>
                <label style={{ display:'block',fontSize:11,fontWeight:500,color:'#6b7280',marginBottom:4,textTransform:'uppercase' }}>Anexo</label>
                <input type="file" onChange={e=>setAnexo(e.target.files[0])} style={{ fontSize:13 }} />
              </div>
            </div>
            <div style={{ display:'flex',gap:8,justifyContent:'flex-end',marginTop:16 }}>
              <button type="button" onClick={()=>setShowForm(false)} style={{ padding:'8px 16px',border:'1px solid #d1d5db',borderRadius:8,fontSize:13,cursor:'pointer',background:'#fff' }}>Cancelar</button>
              <button type="submit" style={{ padding:'8px 20px',background:'#7c3aed',color:'#fff',border:'none',borderRadius:8,fontSize:13,fontWeight:500,cursor:'pointer' }}>Salvar</button>
            </div>
          </form>
        </div>
      )}

      <div style={{ background:'#fff',borderRadius:12,border:'1px solid #e5e7eb',overflow:'hidden' }}>
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%',borderCollapse:'collapse',fontSize:13 }}>
            <thead>
              <tr style={{ background:'#f9fafb' }}>
                {['Motorista','Tipo','Placa','Valor','Liberado','Status','Anexo',...(isAdmin?['Alteração']:[])].map(h=>(
                  <th key={h} style={{ padding:'10px 14px',textAlign:'left',fontSize:11,fontWeight:600,color:'#6b7280',textTransform:'uppercase',borderBottom:'1px solid #e5e7eb' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lista.map(s=>(
                <tr key={s.id} style={{ borderBottom:'1px solid #f3f4f6' }}>
                  <td style={{ padding:'10px 14px',fontWeight:500 }}>
                    {s.motorista?.nome}
                    {s.motorista?.ferias?.some(f=>new Date(f.inicio)<=new Date()&&new Date(f.fim)>=new Date()) && (
                      <span style={{ marginLeft:6,fontSize:10,padding:'2px 6px',background:'#ede9fe',color:'#6d28d9',borderRadius:20 }}>férias</span>
                    )}
                  </td>
                  <td style={{ padding:'10px 14px',color:'#6b7280' }}>{s.tipo?.nome}</td>
                  <td style={{ padding:'10px 14px',color:'#6b7280' }}>{s.placa||'—'}</td>
                  <td style={{ padding:'10px 14px' }}>{fmt(s.valor)}</td>
                  <td style={{ padding:'10px 14px' }}>
                    {isAdmin ? (
                      <input type="number" defaultValue={s.liberado||''} onBlur={e=>atualizarLiberado(s.id,e.target.value)}
                        style={{ width:90,padding:'4px 8px',border:'1px solid #d1d5db',borderRadius:6,fontSize:13 }} />
                    ) : fmt(s.liberado||0)}
                  </td>
                  <td style={{ padding:'10px 14px' }}>
                    <span style={{ padding:'3px 10px',borderRadius:20,fontSize:11,fontWeight:500,background:s.status==='pago'?'#dcfce7':'#fef3c7',color:s.status==='pago'?'#166534':'#92400e' }}>{s.status}</span>
                  </td>
                  <td style={{ padding:'10px 14px' }}>
                    {s.anexoUrl ? <a href={s.anexoUrl} target="_blank" rel="noreferrer" style={{ color:'#7c3aed',fontSize:12 }}>Ver</a> : '—'}
                  </td>
                  {isAdmin && <td style={{ padding:'10px 14px',fontSize:11,color:'#9ca3af' }}>{s.auditorias?.[0]?`${s.auditorias[0].usuario.nome} — ${new Date(s.auditorias[0].criadoEm).toLocaleString('pt-BR')}`:'—'}</td>}
                </tr>
              ))}
              {lista.length===0 && <tr><td colSpan={8} style={{ padding:40,textAlign:'center',color:'#9ca3af' }}>Nenhuma solicitação</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

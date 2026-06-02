// frontend/src/pages/Financeiro.jsx
import { useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';

const vazio = { motoristaId:'', tipoDescontoId:'', valor:'', valorDescontado:'', numeroAcerto:'', mesDesconto:'', observacao:'' };

export default function Financeiro() {
  const { isAdmin } = useAuth();
  const [lista, setLista] = useState([]);
  const [motoristas, setMotoristas] = useState([]);
  const [tipos, setTipos] = useState([]);
  const [form, setForm] = useState(vazio);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [novoTipo, setNovoTipo] = useState('');
  const [showNovoTipo, setShowNovoTipo] = useState(false);

  useEffect(() => { carregar(); api.get('/motoristas').then(r=>setMotoristas(r.data)); api.get('/tipos/desconto').then(r=>setTipos(r.data)); }, []);

  async function carregar() { const { data } = await api.get('/financeiro'); setLista(data); }

  async function salvar(e) {
    e.preventDefault();
    try {
      if (editId) { await api.put(`/financeiro/${editId}`, form); toast.success('Atualizado'); }
      else { await api.post('/financeiro', form); toast.success('Registrado'); }
      setForm(vazio); setEditId(null); setShowForm(false); carregar();
    } catch {}
  }

  async function salvarNovoTipo() {
    if (!novoTipo.trim()) return;
    const { data } = await api.post('/tipos/desconto', { nome: novoTipo });
    toast.success('Tipo adicionado'); setNovoTipo(''); setShowNovoTipo(false);
    api.get('/tipos/desconto').then(r=>setTipos(r.data));
    setForm(f=>({...f,tipoDescontoId:data.id}));
  }

  const fmt = v => `R$ ${Number(v).toLocaleString('pt-BR',{minimumFractionDigits:2})}`;

  return (
    <div>
      <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20 }}>
        <h2 style={{ fontSize:20,fontWeight:600,color:'#1a1a2e' }}>Controle Financeiro</h2>
        <button onClick={()=>{ setForm(vazio); setEditId(null); setShowForm(v=>!v); }} style={{ display:'flex',alignItems:'center',gap:8,padding:'9px 16px',background:'#7c3aed',color:'#fff',border:'none',borderRadius:8,fontSize:13,fontWeight:500,cursor:'pointer' }}><i className="ti ti-plus"></i> Incluir</button>
      </div>

      {showForm && (
        <div style={{ background:'#fff',borderRadius:12,padding:20,marginBottom:16,border:'1px solid #e5e7eb' }}>
          <form onSubmit={salvar}>
            <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12 }}>
              <div><label style={{ display:'block',fontSize:11,fontWeight:500,color:'#6b7280',marginBottom:4 }}>MOTORISTA</label><select value={form.motoristaId} onChange={e=>setForm(f=>({...f,motoristaId:e.target.value}))} required style={{ width:'100%',padding:'8px 10px',border:'1px solid #d1d5db',borderRadius:8,fontSize:13 }}><option value="">Selecionar...</option>{motoristas.map(m=><option key={m.id} value={m.id}>{m.nome}</option>)}</select></div>
              <div>
                <label style={{ display:'block',fontSize:11,fontWeight:500,color:'#6b7280',marginBottom:4 }}>TIPO DE DESCONTO</label>
                <div style={{ display:'flex',gap:8 }}>
                  <select value={form.tipoDescontoId} onChange={e=>setForm(f=>({...f,tipoDescontoId:e.target.value}))} required style={{ flex:1,padding:'8px 10px',border:'1px solid #d1d5db',borderRadius:8,fontSize:13 }}><option value="">Selecionar...</option>{tipos.map(t=><option key={t.id} value={t.id}>{t.nome}</option>)}</select>
                  <button type="button" onClick={()=>setShowNovoTipo(v=>!v)} style={{ padding:'8px 10px',border:'1px solid #d1d5db',borderRadius:8,fontSize:12,cursor:'pointer',background:'#fff' }}>+ Novo</button>
                </div>
                {showNovoTipo && <div style={{ display:'flex',gap:8,marginTop:8 }}><input value={novoTipo} onChange={e=>setNovoTipo(e.target.value)} placeholder="Nome do tipo" style={{ flex:1,padding:'6px 10px',border:'1px solid #d1d5db',borderRadius:8,fontSize:13 }}/><button type="button" onClick={salvarNovoTipo} style={{ padding:'6px 12px',background:'#7c3aed',color:'#fff',border:'none',borderRadius:8,fontSize:13,cursor:'pointer' }}>Salvar</button></div>}
              </div>
              <div><label style={{ display:'block',fontSize:11,fontWeight:500,color:'#6b7280',marginBottom:4 }}>VALOR (R$)</label><input type="number" value={form.valor} onChange={e=>setForm(f=>({...f,valor:e.target.value,valorDescontado:e.target.value}))} required style={{ width:'100%',padding:'8px 10px',border:'1px solid #d1d5db',borderRadius:8,fontSize:13,boxSizing:'border-box' }}/></div>
              <div><label style={{ display:'block',fontSize:11,fontWeight:500,color:'#6b7280',marginBottom:4 }}>VALOR DESCONTADO (R$)</label><input type="number" value={form.valorDescontado} onChange={e=>setForm(f=>({...f,valorDescontado:e.target.value}))} required style={{ width:'100%',padding:'8px 10px',border:'1px solid #d1d5db',borderRadius:8,fontSize:13,boxSizing:'border-box' }}/></div>
              <div><label style={{ display:'block',fontSize:11,fontWeight:500,color:'#6b7280',marginBottom:4 }}>Nº ACERTO</label><input value={form.numeroAcerto} onChange={e=>setForm(f=>({...f,numeroAcerto:e.target.value}))} required placeholder="ACT-0001" style={{ width:'100%',padding:'8px 10px',border:'1px solid #d1d5db',borderRadius:8,fontSize:13,boxSizing:'border-box' }}/></div>
              <div><label style={{ display:'block',fontSize:11,fontWeight:500,color:'#6b7280',marginBottom:4 }}>MÊS DO DESCONTO</label><input type="month" value={form.mesDesconto} onChange={e=>setForm(f=>({...f,mesDesconto:e.target.value}))} required style={{ width:'100%',padding:'8px 10px',border:'1px solid #d1d5db',borderRadius:8,fontSize:13,boxSizing:'border-box' }}/></div>
              <div style={{ gridColumn:'1/-1' }}><label style={{ display:'block',fontSize:11,fontWeight:500,color:'#6b7280',marginBottom:4 }}>OBSERVAÇÃO</label><textarea value={form.observacao} onChange={e=>setForm(f=>({...f,observacao:e.target.value}))} rows={2} style={{ width:'100%',padding:'8px 10px',border:'1px solid #d1d5db',borderRadius:8,fontSize:13,resize:'vertical',boxSizing:'border-box' }}/></div>
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
            <thead><tr style={{ background:'#f9fafb' }}>{['Motorista','Tipo','Valor','Descontado','Nº Acerto','Mês','Obs',...(isAdmin?['Alteração']:[])].map(h=><th key={h} style={{ padding:'10px 14px',textAlign:'left',fontSize:11,fontWeight:600,color:'#6b7280',textTransform:'uppercase',borderBottom:'1px solid #e5e7eb' }}>{h}</th>)}</tr></thead>
            <tbody>
              {lista.map(item=>(
                <tr key={item.id} style={{ borderBottom:'1px solid #f3f4f6' }}>
                  <td style={{ padding:'10px 14px',fontWeight:500 }}>{item.motorista?.nome}</td>
                  <td style={{ padding:'10px 14px',color:'#6b7280' }}>{item.tipoDesconto?.nome}</td>
                  <td style={{ padding:'10px 14px' }}>{fmt(item.valor)}</td>
                  <td style={{ padding:'10px 14px',color:'#7c3aed',fontWeight:500 }}>{fmt(item.valorDescontado)}</td>
                  <td style={{ padding:'10px 14px',fontFamily:'monospace',fontSize:12 }}>{item.numeroAcerto}</td>
                  <td style={{ padding:'10px 14px',color:'#6b7280' }}>{item.mesDesconto}</td>
                  <td style={{ padding:'10px 14px',color:'#6b7280',fontSize:12 }}>{item.observacao||'—'}</td>
                  {isAdmin && <td style={{ padding:'10px 14px',fontSize:11,color:'#9ca3af' }}>{item.auditorias?.[0]?`${item.auditorias[0].usuario.nome} — ${new Date(item.auditorias[0].criadoEm).toLocaleString('pt-BR')}`:'—'}</td>}
                </tr>
              ))}
              {lista.length===0&&<tr><td colSpan={8} style={{ padding:40,textAlign:'center',color:'#9ca3af' }}>Nenhum registro financeiro</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

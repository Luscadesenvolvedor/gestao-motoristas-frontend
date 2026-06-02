// frontend/src/pages/Ferias.jsx
import { useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';

export default function Ferias() {
  const { isAdmin, pode } = useAuth();
  const [lista, setLista] = useState([]);
  const [motoristas, setMotoristas] = useState([]);
  const [form, setForm] = useState({ motoristaId:'', inicio:'', fim:'', quantidadeDias:'' });
  const [showForm, setShowForm] = useState(false);
  const canEdit = pode('ferias', 'escrita');

  useEffect(() => { api.get('/ferias').then(r=>setLista(r.data)); api.get('/motoristas').then(r=>setMotoristas(r.data)); }, []);

  async function salvar(e) {
    e.preventDefault();
    try { await api.post('/ferias', form); toast.success('Férias registradas'); setShowForm(false); setForm({ motoristaId:'', inicio:'', fim:'', quantidadeDias:'' }); api.get('/ferias').then(r=>setLista(r.data)); } catch {}
  }

  const hoje = new Date();
  const emFerias = f => new Date(f.inicio) <= hoje && new Date(f.fim) >= hoje;

  return (
    <div>
      <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20 }}>
        <h2 style={{ fontSize:20,fontWeight:600,color:'#1a1a2e' }}>Férias</h2>
        {canEdit && <button onClick={()=>setShowForm(v=>!v)} style={{ display:'flex',alignItems:'center',gap:8,padding:'9px 16px',background:'#7c3aed',color:'#fff',border:'none',borderRadius:8,fontSize:13,fontWeight:500,cursor:'pointer' }}><i className="ti ti-plus"></i> Incluir</button>}
      </div>
      {showForm && canEdit && (
        <div style={{ background:'#fff',borderRadius:12,padding:20,marginBottom:16,border:'1px solid #e5e7eb' }}>
          <form onSubmit={salvar}>
            <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr 1fr 1fr',gap:12 }}>
              <div><label style={{ display:'block',fontSize:11,fontWeight:500,color:'#6b7280',marginBottom:4 }}>MOTORISTA</label><select value={form.motoristaId} onChange={e=>setForm(f=>({...f,motoristaId:e.target.value}))} required style={{ width:'100%',padding:'8px 10px',border:'1px solid #d1d5db',borderRadius:8,fontSize:13 }}><option value="">Selecionar...</option>{motoristas.map(m=><option key={m.id} value={m.id}>{m.nome}</option>)}</select></div>
              <div><label style={{ display:'block',fontSize:11,fontWeight:500,color:'#6b7280',marginBottom:4 }}>INÍCIO</label><input type="date" value={form.inicio} onChange={e=>setForm(f=>({...f,inicio:e.target.value}))} required style={{ width:'100%',padding:'8px 10px',border:'1px solid #d1d5db',borderRadius:8,fontSize:13,boxSizing:'border-box' }}/></div>
              <div><label style={{ display:'block',fontSize:11,fontWeight:500,color:'#6b7280',marginBottom:4 }}>FIM</label><input type="date" value={form.fim} onChange={e=>setForm(f=>({...f,fim:e.target.value}))} required style={{ width:'100%',padding:'8px 10px',border:'1px solid #d1d5db',borderRadius:8,fontSize:13,boxSizing:'border-box' }}/></div>
              <div><label style={{ display:'block',fontSize:11,fontWeight:500,color:'#6b7280',marginBottom:4 }}>DIAS</label><input type="number" min="1" value={form.quantidadeDias} onChange={e=>setForm(f=>({...f,quantidadeDias:e.target.value}))} required style={{ width:'100%',padding:'8px 10px',border:'1px solid #d1d5db',borderRadius:8,fontSize:13,boxSizing:'border-box' }}/></div>
            </div>
            <div style={{ display:'flex',gap:8,justifyContent:'flex-end',marginTop:16 }}>
              <button type="button" onClick={()=>setShowForm(false)} style={{ padding:'8px 16px',border:'1px solid #d1d5db',borderRadius:8,fontSize:13,cursor:'pointer',background:'#fff' }}>Cancelar</button>
              <button type="submit" style={{ padding:'8px 20px',background:'#7c3aed',color:'#fff',border:'none',borderRadius:8,fontSize:13,fontWeight:500,cursor:'pointer' }}>Salvar</button>
            </div>
          </form>
        </div>
      )}
      <div style={{ background:'#fff',borderRadius:12,border:'1px solid #e5e7eb',overflow:'hidden' }}>
        <table style={{ width:'100%',borderCollapse:'collapse',fontSize:13 }}>
          <thead><tr style={{ background:'#f9fafb' }}>{['Motorista','Início','Fim','Dias','Status',...(isAdmin?['Alteração']:[])].map(h=><th key={h} style={{ padding:'10px 14px',textAlign:'left',fontSize:11,fontWeight:600,color:'#6b7280',textTransform:'uppercase',borderBottom:'1px solid #e5e7eb' }}>{h}</th>)}</tr></thead>
          <tbody>
            {lista.map(f=>(
              <tr key={f.id} style={{ borderBottom:'1px solid #f3f4f6' }}>
                <td style={{ padding:'10px 14px',fontWeight:500 }}>{f.motorista?.nome}</td>
                <td style={{ padding:'10px 14px',color:'#6b7280' }}>{new Date(f.inicio).toLocaleDateString('pt-BR')}</td>
                <td style={{ padding:'10px 14px',color:'#6b7280' }}>{new Date(f.fim).toLocaleDateString('pt-BR')}</td>
                <td style={{ padding:'10px 14px' }}>{f.quantidadeDias}</td>
                <td style={{ padding:'10px 14px' }}>
                  <span style={{ padding:'3px 10px',borderRadius:20,fontSize:11,fontWeight:500,background:emFerias(f)?'#ede9fe':'#f3f4f6',color:emFerias(f)?'#6d28d9':'#6b7280' }}>{emFerias(f)?'De férias':'Agendado'}</span>
                </td>
                {isAdmin && <td style={{ padding:'10px 14px',fontSize:11,color:'#9ca3af' }}>{f.auditorias?.[0]?`${f.auditorias[0].usuario.nome} — ${new Date(f.auditorias[0].criadoEm).toLocaleString('pt-BR')}`:'—'}</td>}
              </tr>
            ))}
            {lista.length===0&&<tr><td colSpan={6} style={{ padding:40,textAlign:'center',color:'#9ca3af' }}>Nenhuma férias registrada</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

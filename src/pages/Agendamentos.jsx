// frontend/src/pages/Agendamentos.jsx
import { useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';

export default function Agendamentos() {
  const { isAdmin } = useAuth();
  const [perfil, setPerfil] = useState(1);
  const [lista, setLista] = useState([]);
  const [motoristas, setMotoristas] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ motoristaId:'', mesesAcerto:1, dataHora:'', perfil:1 });

  useEffect(() => { carregar(); api.get('/motoristas').then(r=>setMotoristas(r.data)); }, [perfil]);

  async function carregar() { const { data } = await api.get('/agendamentos', { params: { perfil } }); setLista(data); }

  async function salvar(e) {
    e.preventDefault();
    try { await api.post('/agendamentos', { ...form, perfil }); toast.success('Agendamento criado'); setShowForm(false); carregar(); } catch {}
  }

  async function excluir(id) {
    if (!confirm('Remover este agendamento?')) return;
    await api.delete(`/agendamentos/${id}`); toast.success('Removido'); carregar();
  }

  return (
    <div>
      <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20 }}>
        <h2 style={{ fontSize:20,fontWeight:600,color:'#1a1a2e' }}>Agendamentos</h2>
        <button onClick={()=>setShowForm(v=>!v)} style={{ display:'flex',alignItems:'center',gap:8,padding:'9px 16px',background:'#7c3aed',color:'#fff',border:'none',borderRadius:8,fontSize:13,fontWeight:500,cursor:'pointer' }}><i className="ti ti-plus"></i> Incluir</button>
      </div>

      <div style={{ display:'flex',gap:8,marginBottom:16 }}>
        {[1,2].map(p=>(
          <button key={p} onClick={()=>setPerfil(p)} style={{ padding:'8px 20px',border:'1px solid '+(perfil===p?'#7c3aed':'#d1d5db'),borderRadius:8,fontSize:13,cursor:'pointer',background:perfil===p?'#7c3aed':'#fff',color:perfil===p?'#fff':'#374151',fontWeight:perfil===p?500:400 }}>
            Perfil {p}
          </button>
        ))}
      </div>

      {showForm && (
        <div style={{ background:'#fff',borderRadius:12,padding:20,marginBottom:16,border:'1px solid #e5e7eb' }}>
          <form onSubmit={salvar}>
            <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12 }}>
              <div><label style={{ display:'block',fontSize:11,fontWeight:500,color:'#6b7280',marginBottom:4 }}>MOTORISTA</label><select value={form.motoristaId} onChange={e=>setForm(f=>({...f,motoristaId:e.target.value}))} required style={{ width:'100%',padding:'8px 10px',border:'1px solid #d1d5db',borderRadius:8,fontSize:13 }}><option value="">Selecionar...</option>{motoristas.map(m=><option key={m.id} value={m.id}>{m.nome}</option>)}</select></div>
              <div><label style={{ display:'block',fontSize:11,fontWeight:500,color:'#6b7280',marginBottom:4 }}>MESES DE ACERTO</label><input type="number" min="1" value={form.mesesAcerto} onChange={e=>setForm(f=>({...f,mesesAcerto:e.target.value}))} required style={{ width:'100%',padding:'8px 10px',border:'1px solid #d1d5db',borderRadius:8,fontSize:13,boxSizing:'border-box' }}/></div>
              <div><label style={{ display:'block',fontSize:11,fontWeight:500,color:'#6b7280',marginBottom:4 }}>DATA E HORA</label><input type="datetime-local" value={form.dataHora} onChange={e=>setForm(f=>({...f,dataHora:e.target.value}))} required style={{ width:'100%',padding:'8px 10px',border:'1px solid #d1d5db',borderRadius:8,fontSize:13,boxSizing:'border-box' }}/></div>
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
          <thead><tr style={{ background:'#f9fafb' }}>{['Motorista','Data/Hora','Meses de acerto','Ações'].map(h=><th key={h} style={{ padding:'10px 14px',textAlign:'left',fontSize:11,fontWeight:600,color:'#6b7280',textTransform:'uppercase',borderBottom:'1px solid #e5e7eb' }}>{h}</th>)}</tr></thead>
          <tbody>
            {lista.map(a=>(
              <tr key={a.id} style={{ borderBottom:'1px solid #f3f4f6' }}>
                <td style={{ padding:'10px 14px',fontWeight:500 }}>{a.motorista?.nome}</td>
                <td style={{ padding:'10px 14px',color:'#6b7280' }}>{new Date(a.dataHora).toLocaleString('pt-BR')}</td>
                <td style={{ padding:'10px 14px' }}>{a.mesesAcerto} {a.mesesAcerto===1?'mês':'meses'}</td>
                <td style={{ padding:'10px 14px' }}><button onClick={()=>excluir(a.id)} style={{ padding:'4px 12px',border:'1px solid #fca5a5',borderRadius:6,fontSize:12,cursor:'pointer',background:'#fff',color:'#dc2626' }}>Remover</button></td>
              </tr>
            ))}
            {lista.length===0&&<tr><td colSpan={4} style={{ padding:40,textAlign:'center',color:'#9ca3af' }}>Nenhum agendamento no Perfil {perfil}</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// frontend/src/pages/ExclusaoVales.jsx
import { useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';

export default function ExclusaoVales() {
  const { usuario, isAdmin } = useAuth();
  const [lista, setLista] = useState([]);
  const [motoristas, setMotoristas] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ numeroVale:'', dataVale:'', motoristaId:'', motivo:'' });

  useEffect(() => { carregar(); api.get('/motoristas').then(r=>setMotoristas(r.data)); }, []);

  async function carregar() { const { data } = await api.get('/exclusoes'); setLista(data); }

  async function salvar(e) {
    e.preventDefault();
    try { await api.post('/exclusoes', form); toast.success('Exclusão registrada'); setShowForm(false); setForm({ numeroVale:'', dataVale:'', motoristaId:'', motivo:'' }); carregar(); } catch {}
  }

  async function marcarFeito(id, feito) {
    await api.patch(`/exclusoes/${id}/feito`, { feito });
    setLista(l => l.map(x => x.id === id ? { ...x, feito } : x));
  }

  return (
    <div>
      <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20 }}>
        <h2 style={{ fontSize:20,fontWeight:600,color:'#1a1a2e' }}>Exclusão de Vales</h2>
        <button onClick={()=>setShowForm(v=>!v)} style={{ display:'flex',alignItems:'center',gap:8,padding:'9px 16px',background:'#7c3aed',color:'#fff',border:'none',borderRadius:8,fontSize:13,fontWeight:500,cursor:'pointer' }}>
          <i className="ti ti-plus"></i> Incluir
        </button>
      </div>

      {showForm && (
        <div style={{ background:'#fff',borderRadius:12,padding:20,marginBottom:16,border:'1px solid #e5e7eb' }}>
          <form onSubmit={salvar}>
            <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:12 }}>
              <div><label style={{ display:'block',fontSize:11,fontWeight:500,color:'#6b7280',marginBottom:4 }}>SOLICITANTE</label><input value={usuario?.nome} readOnly style={{ width:'100%',padding:'8px 10px',border:'1px solid #e5e7eb',borderRadius:8,fontSize:13,background:'#f9fafb',boxSizing:'border-box' }}/></div>
              <div><label style={{ display:'block',fontSize:11,fontWeight:500,color:'#6b7280',marginBottom:4 }}>NÚMERO DO VALE</label><input value={form.numeroVale} onChange={e=>setForm(f=>({...f,numeroVale:e.target.value}))} required style={{ width:'100%',padding:'8px 10px',border:'1px solid #d1d5db',borderRadius:8,fontSize:13,boxSizing:'border-box' }}/></div>
              <div><label style={{ display:'block',fontSize:11,fontWeight:500,color:'#6b7280',marginBottom:4 }}>DATA DO VALE</label><input type="date" value={form.dataVale} onChange={e=>setForm(f=>({...f,dataVale:e.target.value}))} required style={{ width:'100%',padding:'8px 10px',border:'1px solid #d1d5db',borderRadius:8,fontSize:13,boxSizing:'border-box' }}/></div>
              <div><label style={{ display:'block',fontSize:11,fontWeight:500,color:'#6b7280',marginBottom:4 }}>MOTORISTA</label><select value={form.motoristaId} onChange={e=>setForm(f=>({...f,motoristaId:e.target.value}))} required style={{ width:'100%',padding:'8px 10px',border:'1px solid #d1d5db',borderRadius:8,fontSize:13 }}><option value="">Selecionar...</option>{motoristas.map(m=><option key={m.id} value={m.id}>{m.nome}</option>)}</select></div>
              <div style={{ gridColumn:'1/-1' }}><label style={{ display:'block',fontSize:11,fontWeight:500,color:'#6b7280',marginBottom:4 }}>MOTIVO</label><textarea value={form.motivo} onChange={e=>setForm(f=>({...f,motivo:e.target.value}))} required rows={3} style={{ width:'100%',padding:'8px 10px',border:'1px solid #d1d5db',borderRadius:8,fontSize:13,resize:'vertical',boxSizing:'border-box' }}/></div>
            </div>
            <div style={{ display:'flex',gap:8,justifyContent:'flex-end',marginTop:16 }}>
              <button type="button" onClick={()=>setShowForm(false)} style={{ padding:'8px 16px',border:'1px solid #d1d5db',borderRadius:8,fontSize:13,cursor:'pointer',background:'#fff' }}>Cancelar</button>
              <button type="submit" style={{ padding:'8px 20px',background:'#7c3aed',color:'#fff',border:'none',borderRadius:8,fontSize:13,fontWeight:500,cursor:'pointer' }}>Salvar</button>
            </div>
          </form>
        </div>
      )}

      <div style={{ display:'flex',flexDirection:'column',gap:10 }}>
        {lista.map(item => (
          <div key={item.id} style={{ background:'#fff',borderRadius:12,padding:16,border:'1px solid #e5e7eb',display:'flex',alignItems:'flex-start',gap:14 }}>
            <input type="checkbox" checked={item.feito} onChange={e=>marcarFeito(item.id,e.target.checked)} style={{ width:18,height:18,marginTop:2,accentColor:'#7c3aed',flexShrink:0 }} />
            <div style={{ flex:1 }}>
              <div style={{ fontWeight:500,fontSize:14,textDecoration:item.feito?'line-through':'none',color:item.feito?'#9ca3af':'#1a1a2e' }}>
                Vale #{item.numeroVale} — {item.motorista?.nome}
              </div>
              <div style={{ fontSize:12,color:'#6b7280',marginTop:4 }}>
                Motivo: {item.motivo} · {new Date(item.dataVale).toLocaleDateString('pt-BR')} · Solicitante: {item.solicitante?.nome}
              </div>
              {isAdmin && item.auditorias?.[0] && (
                <div style={{ fontSize:11,color:'#9ca3af',marginTop:3 }}>{item.auditorias[0].usuario.nome} — {new Date(item.auditorias[0].criadoEm).toLocaleString('pt-BR')}</div>
              )}
            </div>
            {item.feito && <span style={{ fontSize:11,padding:'3px 10px',background:'#dcfce7',color:'#166534',borderRadius:20,fontWeight:500 }}>Feito</span>}
          </div>
        ))}
        {lista.length===0 && <div style={{ textAlign:'center',padding:40,color:'#9ca3af' }}>Nenhuma exclusão registrada</div>}
      </div>
    </div>
  );
}

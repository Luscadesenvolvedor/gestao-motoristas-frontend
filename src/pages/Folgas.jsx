// frontend/src/pages/Folgas.jsx
import { useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';

export default function Folgas() {
  const { isAdmin, pode } = useAuth();
  const [lista, setLista] = useState([]);
  const [motoristas, setMotoristas] = useState([]);
  const [form, setForm] = useState({ motoristaId:'', periodo:'', quantidadeDias:'' });
  const [showForm, setShowForm] = useState(false);
  const canEdit = pode('folgas', 'escrita');

  function carregar() {
    api.get('/folgas').then(r => setLista(r.data));
  }

  useEffect(() => {
    carregar();
    api.get('/motoristas').then(r => setMotoristas(r.data));
  }, []);

  async function excluir(id) {
    if (!confirm('Excluir esta folga?')) return;
    try {
      await api.delete(`/folgas/${id}`);
      carregar();
    } catch { toast.error('Erro ao excluir folga'); }
  }

  async function salvar(e) {
    e.preventDefault();
    try {
      await api.post('/folgas', form);
      toast.success('Folga registrada');
      setShowForm(false);
      setForm({ motoristaId:'', periodo:'', quantidadeDias:'' });
      carregar();
    } catch {}
  }

  const valor = dias => `R$ ${(dias*150).toLocaleString('pt-BR', { minimumFractionDigits:2 })}`;

  const lbl = { display:'block', fontSize:11, fontWeight:500, color:'#6b7280', marginBottom:4, textTransform:'uppercase' };
  const inp = { width:'100%', padding:'8px 10px', border:'1px solid #d1d5db', borderRadius:8, fontSize:13, boxSizing:'border-box' };

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <h2 style={{ fontSize:20, fontWeight:600, color:'#1a1a2e' }}>Folgas</h2>
        {canEdit && (
          <button onClick={()=>setShowForm(v=>!v)}
            style={{ display:'flex', alignItems:'center', gap:8, padding:'9px 16px', background:'#EB3238', color:'#fff', border:'none', borderRadius:8, fontSize:13, fontWeight:500, cursor:'pointer' }}>
            <i className="ti ti-plus"></i> Incluir
          </button>
        )}
      </div>

      {showForm && canEdit && (
        <div style={{ background:'#fff', borderRadius:12, padding:20, marginBottom:16, border:'1px solid #e5e7eb' }}>
          <form onSubmit={salvar}>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12 }}>
              <div>
                <label style={lbl}>Motorista</label>
                <select value={form.motoristaId} onChange={e=>setForm(f=>({...f,motoristaId:e.target.value}))} required style={inp}>
                  <option value="">Selecionar...</option>
                  {motoristas.map(m=><option key={m.id} value={m.id}>{m.nome}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Período</label>
                <input type="text" value={form.periodo} onChange={e=>setForm(f=>({...f,periodo:e.target.value}))} required placeholder="Ex: Janeiro/2026" style={inp}/>
              </div>
              <div>
                <label style={lbl}>Dias</label>
                <input type="number" min="1" value={form.quantidadeDias} onChange={e=>setForm(f=>({...f,quantidadeDias:e.target.value}))} required style={inp}/>
              </div>
            </div>
            {form.quantidadeDias && (
              <div style={{ margin:'12px 0', padding:'10px 14px', background:'#fff0f0', borderRadius:8, fontSize:14, color:'#EB3238', fontWeight:600 }}>
                {form.quantidadeDias} dias × R$ 150,00 = {valor(form.quantidadeDias)}
              </div>
            )}
            <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:12 }}>
              <button type="button" onClick={()=>setShowForm(false)} style={{ padding:'8px 16px', border:'1px solid #d1d5db', borderRadius:8, fontSize:13, cursor:'pointer', background:'#fff' }}>Cancelar</button>
              <button type="submit" style={{ padding:'8px 20px', background:'#EB3238', color:'#fff', border:'none', borderRadius:8, fontSize:13, fontWeight:500, cursor:'pointer' }}>Salvar</button>
            </div>
          </form>
        </div>
      )}

      <div style={{ background:'#fff', borderRadius:12, border:'1px solid #e5e7eb', overflow:'hidden' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
          <thead>
            <tr style={{ background:'#f9fafb' }}>
              {['Motorista','Período','Dias','Valor',...(isAdmin?['Alteração','']:[])].map(h=>(
                <th key={h} style={{ padding:'10px 14px', textAlign:'left', fontSize:11, fontWeight:600, color:'#6b7280', textTransform:'uppercase', borderBottom:'1px solid #e5e7eb' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lista.map(f=>(
              <tr key={f.id} style={{ borderBottom:'1px solid #f3f4f6' }}>
                <td style={{ padding:'10px 14px', fontWeight:500 }}>{f.motorista?.nome}</td>
                <td style={{ padding:'10px 14px', color:'#6b7280' }}>{f.periodo}</td>
                <td style={{ padding:'10px 14px' }}>{f.quantidadeDias}</td>
                <td style={{ padding:'10px 14px', color:'#EB3238', fontWeight:500 }}>{valor(f.quantidadeDias)}</td>
                {isAdmin && <td style={{ padding:'10px 14px', fontSize:11, color:'#9ca3af' }}>{f.auditorias?.[0]?`${f.auditorias[0].usuario?.nome} — ${new Date(f.auditorias[0].criadoEm).toLocaleString('pt-BR')}`:'—'}</td>}
                {isAdmin && <td style={{ padding:'10px 14px' }}><button onClick={()=>excluir(f.id)} style={{ padding:'3px 10px', background:'#fff', border:'1px solid #EB3238', borderRadius:6, fontSize:12, color:'#EB3238', cursor:'pointer' }}>Excluir</button></td>}
              </tr>
            ))}
            {lista.length===0 && <tr><td colSpan={isAdmin?6:4} style={{ padding:40, textAlign:'center', color:'#9ca3af' }}>Nenhuma folga</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
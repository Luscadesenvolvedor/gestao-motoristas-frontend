// frontend/src/pages/Usuarios.jsx
import { useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';

const vazio = { nome:'', email:'', senha:'', papel:'guiche' };
const PAPEIS = ['admin','guiche','acertador','dgp','financeiro'];

export default function Usuarios() {
  const { isAdmin } = useAuth();
  const [lista, setLista] = useState([]);
  const [form, setForm] = useState(vazio);
  const [editId, setEditId] = useState(null);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => { carregar(); }, []);

  async function carregar() {
    const { data } = await api.get('/usuarios');
    setLista(data);
  }

  async function salvar(e) {
    e.preventDefault();
    try {
      if (editId) { await api.put(`/usuarios/${editId}`, form); toast.success('Usuário atualizado'); }
      else { await api.post('/usuarios', form); toast.success('Usuário criado'); }
      setForm(vazio); setEditId(null); setShowForm(false); carregar();
    } catch {}
  }

  const PILL_CORES = { admin:'#7c3aed', guiche:'#0891b2', acertador:'#d97706', dgp:'#dc2626', financeiro:'#16a34a' };

  return (
    <div>
      <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20 }}>
        <h2 style={{ fontSize:20,fontWeight:600,color:'#1a1a2e' }}>Usuários</h2>
        <button onClick={() => { setForm(vazio); setEditId(null); setShowForm(v=>!v); }}
          style={{ display:'flex',alignItems:'center',gap:8,padding:'9px 16px',background:'#7c3aed',color:'#fff',border:'none',borderRadius:8,fontSize:13,fontWeight:500,cursor:'pointer' }}>
          <i className="ti ti-plus"></i> Incluir usuário
        </button>
      </div>

      {showForm && (
        <div style={{ background:'#fff',borderRadius:12,padding:20,marginBottom:16,border:'1px solid #e5e7eb' }}>
          <form onSubmit={salvar}>
            <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:12 }}>
              {[['nome','Nome *','text'],['email','E-mail *','email'],['senha',editId?'Nova senha (opcional)':'Senha *','password']].map(([k,l,t])=>(
                <div key={k}>
                  <label style={{ display:'block',fontSize:11,fontWeight:500,color:'#6b7280',marginBottom:4,textTransform:'uppercase' }}>{l}</label>
                  <input type={t} value={form[k]||''} onChange={e=>setForm(f=>({...f,[k]:e.target.value}))} required={!editId||k==='nome'||k==='email'}
                    style={{ width:'100%',padding:'8px 10px',border:'1px solid #d1d5db',borderRadius:8,fontSize:13,boxSizing:'border-box' }} />
                </div>
              ))}
              <div>
                <label style={{ display:'block',fontSize:11,fontWeight:500,color:'#6b7280',marginBottom:4,textTransform:'uppercase' }}>Papel</label>
                <select value={form.papel} onChange={e=>setForm(f=>({...f,papel:e.target.value}))} style={{ width:'100%',padding:'8px 10px',border:'1px solid #d1d5db',borderRadius:8,fontSize:13 }}>
                  {PAPEIS.map(p=><option key={p} value={p}>{p}</option>)}
                </select>
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
        <table style={{ width:'100%',borderCollapse:'collapse',fontSize:13 }}>
          <thead>
            <tr style={{ background:'#f9fafb' }}>
              {['Nome','E-mail','Papel','Ações',...(isAdmin?['Última alteração']:[])].map(h=>(
                <th key={h} style={{ padding:'10px 14px',textAlign:'left',fontSize:11,fontWeight:600,color:'#6b7280',textTransform:'uppercase',borderBottom:'1px solid #e5e7eb' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lista.map(u=>(
              <tr key={u.id} style={{ borderBottom:'1px solid #f3f4f6' }}>
                <td style={{ padding:'10px 14px',fontWeight:500 }}>{u.nome}</td>
                <td style={{ padding:'10px 14px',color:'#6b7280' }}>{u.email}</td>
                <td style={{ padding:'10px 14px' }}>
                  <span style={{ padding:'3px 10px',borderRadius:20,fontSize:11,fontWeight:500,background:PILL_CORES[u.papel]+'22',color:PILL_CORES[u.papel] }}>{u.papel}</span>
                </td>
                <td style={{ padding:'10px 14px' }}>
                  <button onClick={()=>{ setForm({...u,senha:''}); setEditId(u.id); setShowForm(true); }} style={{ padding:'4px 12px',border:'1px solid #d1d5db',borderRadius:6,fontSize:12,cursor:'pointer',background:'#fff' }}>Editar</button>
                </td>
                {isAdmin && <td style={{ padding:'10px 14px',fontSize:11,color:'#9ca3af' }}>{u.auditorias?.[0]?`${u.auditorias[0].usuario.nome} — ${new Date(u.auditorias[0].criadoEm).toLocaleString('pt-BR')}`:'—'}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

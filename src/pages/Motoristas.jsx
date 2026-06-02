// frontend/src/pages/Motoristas.jsx
import { useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';

const CATEGORIAS = ['frota', 'dedicado_usiminas', 'dedicado_arcelormittal', 'patio', 'tirador_ferias'];
const CATEGORIAS_LABEL = { frota: 'Frota', dedicado_usiminas: 'Ded. Usiminas', dedicado_arcelormittal: 'Ded. ArcelorMittal', patio: 'Pátio', tirador_ferias: 'Tirador Férias' };
const FROTAS = ['buzin', 'lbm', 'meli'];

const vazio = { nome:'', cpf:'', contato:'', banco:'', agencia:'', pix:'', destinatario:'', frota:'buzin', status:'ativo', categoria:'frota' };

export default function Motoristas() {
  const { pode, isAdmin } = useAuth();
  const [motoristas, setMotoristas] = useState([]);
  const [form, setForm] = useState(vazio);
  const [editId, setEditId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [busca, setBusca] = useState('');

  useEffect(() => { carregar(); }, []);

  async function carregar() {
    const { data } = await api.get('/motoristas', { params: { busca } });
    setMotoristas(data);
  }

  function editar(m) {
    setForm(m);
    setEditId(m.id);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function salvar(e) {
    e.preventDefault();
    try {
      if (editId) {
        await api.put(`/motoristas/${editId}`, form);
        toast.success('Motorista atualizado');
      } else {
        await api.post('/motoristas', form);
        toast.success('Motorista cadastrado');
      }
      setForm(vazio); setEditId(null); setShowForm(false);
      carregar();
    } catch {}
  }

  const canEdit = pode('motoristas', 'escrita');

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <div>
          <h2 style={{ fontSize:20, fontWeight:600, color:'#1a1a2e' }}>Motoristas</h2>
          <p style={{ fontSize:13, color:'#6b7280', marginTop:2 }}>{motoristas.length} cadastrados</p>
        </div>
        {canEdit && (
          <button onClick={() => { setForm(vazio); setEditId(null); setShowForm(v => !v); }}
            style={{ display:'flex', alignItems:'center', gap:8, padding:'9px 16px', background:'#7c3aed', color:'#fff', border:'none', borderRadius:8, fontSize:13, fontWeight:500, cursor:'pointer' }}>
            <i className="ti ti-plus"></i> Incluir motorista
          </button>
        )}
      </div>

      {showForm && canEdit && (
        <div style={{ background:'#fff', borderRadius:12, padding:20, marginBottom:16, border:'1px solid #e5e7eb' }}>
          <h3 style={{ fontSize:15, fontWeight:600, marginBottom:16 }}>{editId ? 'Editar' : 'Novo'} motorista</h3>
          <form onSubmit={salvar}>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12 }}>
              {[['nome','Nome *','text'],['cpf','CPF *','text'],['contato','Contato *','text'],['banco','Banco','text'],['agencia','Agência','text'],['pix','PIX','text'],['destinatario','Destinatário (opcional)','text']].map(([k,l,t]) => (
                <div key={k}>
                  <label style={{ display:'block',fontSize:11,fontWeight:500,color:'#6b7280',marginBottom:4,textTransform:'uppercase',letterSpacing:'0.5px' }}>{l}</label>
                  <input type={t} value={form[k]||''} onChange={e=>setForm(f=>({...f,[k]:e.target.value}))} required={['nome','cpf','contato'].includes(k)}
                    style={{ width:'100%',padding:'8px 10px',border:'1px solid #d1d5db',borderRadius:8,fontSize:13,boxSizing:'border-box' }} />
                </div>
              ))}
              <div>
                <label style={{ display:'block',fontSize:11,fontWeight:500,color:'#6b7280',marginBottom:4,textTransform:'uppercase',letterSpacing:'0.5px' }}>Frota</label>
                <select value={form.frota} onChange={e=>setForm(f=>({...f,frota:e.target.value}))} style={{ width:'100%',padding:'8px 10px',border:'1px solid #d1d5db',borderRadius:8,fontSize:13 }}>
                  {FROTAS.map(x=><option key={x} value={x}>{x.toUpperCase()}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display:'block',fontSize:11,fontWeight:500,color:'#6b7280',marginBottom:4,textTransform:'uppercase',letterSpacing:'0.5px' }}>Status</label>
                <select value={form.status} onChange={e=>setForm(f=>({...f,status:e.target.value}))} style={{ width:'100%',padding:'8px 10px',border:'1px solid #d1d5db',borderRadius:8,fontSize:13 }}>
                  <option value="ativo">Ativo</option>
                  <option value="desligado">Desligado</option>
                </select>
              </div>
              <div>
                <label style={{ display:'block',fontSize:11,fontWeight:500,color:'#6b7280',marginBottom:4,textTransform:'uppercase',letterSpacing:'0.5px' }}>Categoria</label>
                <select value={form.categoria} onChange={e=>setForm(f=>({...f,categoria:e.target.value}))} style={{ width:'100%',padding:'8px 10px',border:'1px solid #d1d5db',borderRadius:8,fontSize:13 }}>
                  {CATEGORIAS.map(x=><option key={x} value={x}>{CATEGORIAS_LABEL[x]}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:16 }}>
              <button type="button" onClick={() => setShowForm(false)} style={{ padding:'8px 16px',border:'1px solid #d1d5db',borderRadius:8,fontSize:13,cursor:'pointer',background:'#fff' }}>Cancelar</button>
              <button type="submit" style={{ padding:'8px 20px',background:'#7c3aed',color:'#fff',border:'none',borderRadius:8,fontSize:13,fontWeight:500,cursor:'pointer' }}>Salvar</button>
            </div>
          </form>
        </div>
      )}

      <div style={{ background:'#fff', borderRadius:12, border:'1px solid #e5e7eb', overflow:'hidden' }}>
        <div style={{ padding:'14px 16px', borderBottom:'1px solid #e5e7eb' }}>
          <input placeholder="Buscar motorista..." value={busca} onChange={e=>setBusca(e.target.value)} onKeyDown={e=>e.key==='Enter'&&carregar()}
            style={{ padding:'8px 12px',border:'1px solid #d1d5db',borderRadius:8,fontSize:13,width:260 }} />
        </div>
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
            <thead>
              <tr style={{ background:'#f9fafb' }}>
                {['Nome','CPF','Frota','Categoria','Status','Ações', ...(isAdmin?['Alteração']:[])].map(h=>(
                  <th key={h} style={{ padding:'10px 14px',textAlign:'left',fontSize:11,fontWeight:600,color:'#6b7280',textTransform:'uppercase',letterSpacing:'0.5px',borderBottom:'1px solid #e5e7eb' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {motoristas.map(m => (
                <tr key={m.id} style={{ borderBottom:'1px solid #f3f4f6' }}>
                  <td style={{ padding:'10px 14px',fontWeight:500 }}>{m.nome}</td>
                  <td style={{ padding:'10px 14px',color:'#6b7280' }}>{m.cpf}</td>
                  <td style={{ padding:'10px 14px',textTransform:'uppercase',fontSize:12 }}>{m.frota}</td>
                  <td style={{ padding:'10px 14px' }}>{CATEGORIAS_LABEL[m.categoria]}</td>
                  <td style={{ padding:'10px 14px' }}>
                    <span style={{ padding:'3px 10px',borderRadius:20,fontSize:11,fontWeight:500,background:m.status==='ativo'?'#dcfce7':'#fee2e2',color:m.status==='ativo'?'#166534':'#991b1b' }}>
                      {m.status}
                    </span>
                  </td>
                  <td style={{ padding:'10px 14px' }}>
                    {canEdit && <button onClick={()=>editar(m)} style={{ padding:'4px 12px',border:'1px solid #d1d5db',borderRadius:6,fontSize:12,cursor:'pointer',background:'#fff' }}>Editar</button>}
                  </td>
                  {isAdmin && (
                    <td style={{ padding:'10px 14px',fontSize:11,color:'#9ca3af' }}>
                      {m.auditorias?.[0] ? `${m.auditorias[0].usuario.nome} — ${new Date(m.auditorias[0].criadoEm).toLocaleString('pt-BR')}` : '—'}
                    </td>
                  )}
                </tr>
              ))}
              {motoristas.length === 0 && (
                <tr><td colSpan={7} style={{ padding:40, textAlign:'center', color:'#9ca3af' }}>Nenhum motorista encontrado</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';

const CATEGORIAS = ['frota', 'dedicado_usiminas', 'dedicado_arcelormittal', 'patio', 'tirador_ferias'];
const CATEGORIAS_LABEL = { frota: 'Frota', dedicado_usiminas: 'Ded. Usiminas', dedicado_arcelormittal: 'Ded. ArcelorMittal', patio: 'Pátio', tirador_ferias: 'Tirador Férias' };
const FROTAS = ['buzin', 'lbm', 'meli_buzin', 'meli_lbm'];
const FROTAS_LABEL = { buzin: 'BUZIN', lbm: 'LBM', meli_buzin: 'MELI BUZIN', meli_lbm: 'MELI LBM' };

const vazio = { nome:'', cpf:'', contato:'', banco:'', agencia:'', conta:'', pix:'', destinatario:'', frota:'buzin', status:'ativo', categoria:'frota' };

function formatarCPF(valor) {
  return valor.replace(/\D/g, '').slice(0, 11)
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

function formatarContato(valor) {
  const nums = valor.replace(/\D/g, '').slice(0, 11);
  if (nums.length <= 2) return nums.replace(/(\d{0,2})/, '($1');
  if (nums.length <= 3) return `(${nums.slice(0,2)}) ${nums.slice(2)}`;
  if (nums.length <= 7) return `(${nums.slice(0,2)}) ${nums.slice(2,3)} ${nums.slice(3)}`;
  return `(${nums.slice(0,2)}) ${nums.slice(2,3)} ${nums.slice(3,7)}-${nums.slice(7)}`;
}

export default function Motoristas() {
  const { pode, isAdmin } = useAuth();
  const [motoristas, setMotoristas] = useState([]);
  const [form, setForm] = useState(vazio);
  const [editId, setEditId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [busca, setBusca] = useState('');
  const [mostrarDesligados, setMostrarDesligados] = useState(false);
  const [filtroFrota, setFiltroFrota] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);

  const carregar = useCallback(async (termo = busca) => {
    const { data } = await api.get('/motoristas', { params: {
      busca: termo,
      status: mostrarDesligados ? 'desligado' : 'ativo',
      frota: filtroFrota || undefined,
      categoria: filtroCategoria || undefined
    }});
    setMotoristas(data);
  }, [busca, mostrarDesligados, filtroFrota, filtroCategoria]);

  useEffect(() => { carregar(); }, [mostrarDesligados, filtroFrota, filtroCategoria]);

  useEffect(() => {
    const timer = setTimeout(() => { carregar(busca); }, 300);
    return () => clearTimeout(timer);
  }, [busca]);

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

  async function excluir(id) {
    try {
      await api.delete(`/motoristas/${id}`);
      toast.success('Motorista excluído');
      setConfirmDelete(null);
      carregar();
    } catch {}
  }

  function handleCPF(e) { setForm(f => ({ ...f, cpf: formatarCPF(e.target.value) })); }
  function handleContato(e) { setForm(f => ({ ...f, contato: formatarContato(e.target.value) })); }

  const canEdit = pode('motoristas', 'escrita');

  return (
    <div>
      {confirmDelete && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.4)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <div style={{ background:'#fff', borderRadius:12, padding:28, width:340, boxShadow:'0 8px 32px rgba(0,0,0,0.15)' }}>
            <h3 style={{ fontSize:16, fontWeight:600, marginBottom:8 }}>Confirmar exclusão</h3>
            <p style={{ fontSize:13, color:'#6b7280', marginBottom:20 }}>
              Tem certeza que deseja excluir <strong>{confirmDelete.nome}</strong>? Esta ação não pode ser desfeita.
            </p>
            <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
              <button onClick={() => setConfirmDelete(null)} style={{ padding:'8px 16px', border:'1px solid #d1d5db', borderRadius:8, fontSize:13, cursor:'pointer', background:'#fff' }}>Cancelar</button>
              <button onClick={() => excluir(confirmDelete.id)} style={{ padding:'8px 16px', background:'#EB3238', color:'#fff', border:'none', borderRadius:8, fontSize:13, fontWeight:500, cursor:'pointer' }}>Excluir</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <div>
          <h2 style={{ fontSize:20, fontWeight:600, color:'#1a1a2e' }}>Motoristas</h2>
          <p style={{ fontSize:13, color:'#6b7280', marginTop:2 }}>{motoristas.length} {mostrarDesligados ? 'desligados' : 'ativos'}</p>
        </div>
        {canEdit && (
          <button onClick={() => { setForm(vazio); setEditId(null); setShowForm(v => !v); }}
            style={{ display:'flex', alignItems:'center', gap:8, padding:'9px 16px', background:'#EB3238', color:'#fff', border:'none', borderRadius:8, fontSize:13, fontWeight:500, cursor:'pointer' }}>
            <i className="ti ti-plus"></i> Incluir motorista
          </button>
        )}
      </div>

      {showForm && canEdit && (
        <div style={{ background:'#fff', borderRadius:12, padding:20, marginBottom:16, border:'1px solid #e5e7eb' }}>
          <h3 style={{ fontSize:15, fontWeight:600, marginBottom:16 }}>{editId ? 'Editar' : 'Novo'} motorista</h3>
          <form onSubmit={salvar}>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12 }}>
              <div><label style={labelStyle}>Nome *</label><input type="text" value={form.nome||''} onChange={e=>setForm(f=>({...f,nome:e.target.value}))} required style={inputStyle} /></div>
              <div><label style={labelStyle}>CPF *</label><input type="text" value={form.cpf||''} onChange={handleCPF} required placeholder="000.000.000-00" style={inputStyle} /></div>
              <div><label style={labelStyle}>Contato *</label><input type="text" value={form.contato||''} onChange={handleContato} required placeholder="(00) 0 0000-0000" style={inputStyle} /></div>
              <div><label style={labelStyle}>Banco</label><input type="text" value={form.banco||''} onChange={e=>setForm(f=>({...f,banco:e.target.value}))} style={inputStyle} /></div>
              <div><label style={labelStyle}>Agência</label><input type="text" value={form.agencia||''} onChange={e=>setForm(f=>({...f,agencia:e.target.value}))} style={inputStyle} /></div>
              <div><label style={labelStyle}>Conta</label><input type="text" value={form.conta||''} onChange={e=>setForm(f=>({...f,conta:e.target.value}))} style={inputStyle} /></div>
              <div><label style={labelStyle}>PIX</label><input type="text" value={form.pix||''} onChange={e=>setForm(f=>({...f,pix:e.target.value}))} style={inputStyle} /></div>
              <div><label style={labelStyle}>Destinatário (opcional)</label><input type="text" value={form.destinatario||''} onChange={e=>setForm(f=>({...f,destinatario:e.target.value}))} style={inputStyle} /></div>
              <div>
                <label style={labelStyle}>Frota</label>
                <select value={form.frota} onChange={e=>setForm(f=>({...f,frota:e.target.value}))} style={inputStyle}>
                  {FROTAS.map(x=><option key={x} value={x}>{FROTAS_LABEL[x]}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Status</label>
                <select value={form.status} onChange={e=>setForm(f=>({...f,status:e.target.value}))} style={inputStyle}>
                  <option value="ativo">Ativo</option>
                  <option value="desligado">Desligado</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>Categoria</label>
                <select value={form.categoria} onChange={e=>setForm(f=>({...f,categoria:e.target.value}))} style={inputStyle}>
                  {CATEGORIAS.map(x=><option key={x} value={x}>{CATEGORIAS_LABEL[x]}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:16 }}>
              <button type="button" onClick={() => setShowForm(false)} style={{ padding:'8px 16px', border:'1px solid #d1d5db', borderRadius:8, fontSize:13, cursor:'pointer', background:'#fff' }}>Cancelar</button>
              <button type="submit" style={{ padding:'8px 20px', background:'#EB3238', color:'#fff', border:'none', borderRadius:8, fontSize:13, fontWeight:500, cursor:'pointer' }}>Salvar</button>
            </div>
          </form>
        </div>
      )}

      <div style={{ background:'#fff', borderRadius:12, border:'1px solid #e5e7eb', overflow:'hidden' }}>
        <div style={{ padding:'14px 16px', borderBottom:'1px solid #e5e7eb', display:'flex', gap:10, alignItems:'center', flexWrap:'wrap' }}>
          <input placeholder="Buscar motorista..." value={busca} onChange={e => setBusca(e.target.value)}
            style={{ padding:'8px 12px', border:'1px solid #d1d5db', borderRadius:8, fontSize:13, width:220 }} />
          <select value={filtroFrota} onChange={e=>setFiltroFrota(e.target.value)}
            style={{ padding:'8px 10px', border:'1px solid #d1d5db', borderRadius:8, fontSize:13 }}>
            <option value="">Todas as frotas</option>
            {FROTAS.map(x=><option key={x} value={x}>{FROTAS_LABEL[x]}</option>)}
          </select>
          <select value={filtroCategoria} onChange={e=>setFiltroCategoria(e.target.value)}
            style={{ padding:'8px 10px', border:'1px solid #d1d5db', borderRadius:8, fontSize:13 }}>
            <option value="">Todas as categorias</option>
            {CATEGORIAS.map(x=><option key={x} value={x}>{CATEGORIAS_LABEL[x]}</option>)}
          </select>
          <button onClick={()=>setMostrarDesligados(v=>!v)}
            style={{ padding:'8px 14px', border:'1px solid '+(mostrarDesligados?'#EB3238':'#d1d5db'), borderRadius:8, fontSize:13, cursor:'pointer', background:mostrarDesligados?'#EB3238':'#fff', color:mostrarDesligados?'#fff':'#374151', fontWeight:mostrarDesligados?500:400 }}>
            {mostrarDesligados ? '● Desligados' : 'Desligados'}
          </button>
          <button onClick={()=>{ setBusca(''); setFiltroFrota(''); setFiltroCategoria(''); setMostrarDesligados(false); }}
            style={{ padding:'8px 12px', border:'1px solid #d1d5db', borderRadius:8, fontSize:13, cursor:'pointer', background:'#fff', color:'#6b7280' }}>
            Limpar
          </button>
        </div>
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
            <thead>
              <tr style={{ background:'#f9fafb' }}>
                {['Nome','CPF','Contato','Frota','Categoria','Status','Ações',...(isAdmin?['Alteração']:[])].map(h=>(
                  <th key={h} style={{ padding:'10px 14px', textAlign:'left', fontSize:11, fontWeight:600, color:'#6b7280', textTransform:'uppercase', letterSpacing:'0.5px', borderBottom:'1px solid #e5e7eb' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {motoristas.map(m => (
                <tr key={m.id} style={{ borderBottom:'1px solid #f3f4f6' }}>
                  <td style={{ padding:'10px 14px', fontWeight:500 }}>{m.nome}</td>
                  <td style={{ padding:'10px 14px', color:'#6b7280' }}>{m.cpf}</td>
                  <td style={{ padding:'10px 14px', color:'#6b7280' }}>{m.contato}</td>
                  <td style={{ padding:'10px 14px', fontSize:12 }}>{FROTAS_LABEL[m.frota] || m.frota?.toUpperCase()}</td>
                  <td style={{ padding:'10px 14px' }}>{CATEGORIAS_LABEL[m.categoria]}</td>
                  <td style={{ padding:'10px 14px' }}>
                    <span style={{ padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:500, background:m.status==='ativo'?'#dcfce7':'#fee2e2', color:m.status==='ativo'?'#166534':'#991b1b' }}>
                      {m.status}
                    </span>
                  </td>
                  <td style={{ padding:'10px 14px', display:'flex', gap:6 }}>
                    {canEdit && (
                      <button onClick={()=>editar(m)} style={{ padding:'4px 12px', border:'1px solid #d1d5db', borderRadius:6, fontSize:12, cursor:'pointer', background:'#fff' }}>Editar</button>
                    )}
                    {isAdmin && (
                      <button onClick={()=>setConfirmDelete(m)} style={{ padding:'4px 12px', border:'1px solid #EB3238', borderRadius:6, fontSize:12, cursor:'pointer', background:'#fff', color:'#EB3238' }}>Excluir</button>
                    )}
                  </td>
                  {isAdmin && (
                    <td style={{ padding:'10px 14px', fontSize:11, color:'#9ca3af' }}>
                      {m.auditorias?.[0] ? `${m.auditorias[0].usuario.nome} — ${new Date(m.auditorias[0].criadoEm).toLocaleString('pt-BR')}` : '—'}
                    </td>
                  )}
                </tr>
              ))}
              {motoristas.length === 0 && (
                <tr><td colSpan={8} style={{ padding:40, textAlign:'center', color:'#9ca3af' }}>Nenhum motorista encontrado</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

const labelStyle = { display:'block', fontSize:11, fontWeight:500, color:'#6b7280', marginBottom:4, textTransform:'uppercase', letterSpacing:'0.5px' };
const inputStyle = { width:'100%', padding:'8px 10px', border:'1px solid #d1d5db', borderRadius:8, fontSize:13, boxSizing:'border-box' };
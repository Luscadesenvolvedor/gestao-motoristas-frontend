import { useState, useEffect } from 'react';
import api from '../../services/api';
import toast from 'react-hot-toast';

const fmt = v => `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

const TIPOS = [
  { val: 'lavagem',       label: 'Lavagem',       cor: '#0891b2', bg: '#f0f9ff', icone: 'ti-wash' },
  { val: 'estacionamento', label: 'Estacionamento', cor: '#7c3aed', bg: '#f5f3ff', icone: 'ti-parking' },
];

function mascaraCNPJ(v) {
  return v.replace(/\D/g,'').slice(0,14)
    .replace(/^(\d{2})(\d)/,'$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/,'$1.$2.$3')
    .replace(/\.(\d{3})(\d)/,'.$1/$2')
    .replace(/(\d{4})(\d)/,'$1-$2');
}

const vazio = { razaoSocial:'', cnpj:'', responsavel:'', contato:'', tipoServico:'lavagem', chavePix:'' };

export default function Fornecedores() {
  const [lista, setLista] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(vazio);
  const [editId, setEditId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [filtroTipo, setFiltroTipo] = useState('todos');
  const [busca, setBusca] = useState('');

  useEffect(() => { carregar(); }, []);

  async function carregar() {
    setLoading(true);
    try {
      const { data } = await api.get('/fornecedores-abastecimento');
      setLista(data);
    } catch { toast.error('Erro ao carregar fornecedores'); }
    finally { setLoading(false); }
  }

  const listaFiltrada = lista.filter(f => {
    if (filtroTipo !== 'todos' && f.tipoServico !== filtroTipo) return false;
    if (busca && !f.razaoSocial.toLowerCase().includes(busca.toLowerCase()) && !f.cnpj.includes(busca)) return false;
    return true;
  });

  async function salvar(e) {
    e.preventDefault();
    if (salvando) return;
    setSalvando(true);
    try {
      const payload = { ...form, cnpj: form.cnpj.replace(/\D/g,'') };
      if (editId) { await api.put(`/fornecedores-abastecimento/${editId}`, payload); toast.success('Fornecedor atualizado'); }
      else        { await api.post('/fornecedores-abastecimento', payload);          toast.success('Fornecedor criado'); }
      setForm(vazio); setEditId(null); setShowForm(false); carregar();
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Erro ao salvar');
    } finally { setSalvando(false); }
  }

  async function excluir(id, nome) {
    if (!confirm(`Excluir o fornecedor "${nome}"?`)) return;
    try { await api.delete(`/fornecedores-abastecimento/${id}`); toast.success('Excluído'); carregar(); }
    catch { toast.error('Erro ao excluir'); }
  }

  function abrirEditar(f) {
    setForm({ razaoSocial: f.razaoSocial, cnpj: mascaraCNPJ(f.cnpj), responsavel: f.responsavel, contato: f.contato, tipoServico: f.tipoServico, chavePix: f.chavePix || '' });
    setEditId(f.id); setShowForm(true);
  }

  const inp = { width:'100%', padding:'8px 12px', border:'1px solid #d1d5db', borderRadius:8, fontSize:13, outline:'none', boxSizing:'border-box' };
  const lbl = { fontSize:12, fontWeight:600, color:'#374151', display:'block', marginBottom:4 };

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <div>
          <h2 style={{ fontSize:20, fontWeight:600, color:'#1a1a2e', margin:0 }}>Fornecedores</h2>
          <p style={{ fontSize:13, color:'#6b7280', marginTop:2 }}>Lavagens e estacionamentos cadastrados</p>
        </div>
        <button onClick={() => { setForm(vazio); setEditId(null); setShowForm(true); }}
          style={{ display:'flex', alignItems:'center', gap:6, padding:'9px 18px', background:'#EB3238', color:'#fff', border:'none', borderRadius:9, fontSize:13, fontWeight:500, cursor:'pointer' }}>
          <i className="ti ti-plus" style={{ fontSize:16 }}></i> Novo Fornecedor
        </button>
      </div>

      {/* Filtros */}
      <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:16, flexWrap:'wrap' }}>
        {['todos', 'lavagem', 'estacionamento'].map(t => {
          const tp = TIPOS.find(x => x.val === t);
          return (
            <button key={t} onClick={() => setFiltroTipo(t)}
              style={{ padding:'5px 16px', borderRadius:20, border:`1px solid ${filtroTipo===t ? '#EB3238' : '#d1d5db'}`,
                background: filtroTipo===t ? '#EB3238' : '#fff', color: filtroTipo===t ? '#fff' : '#374151', fontSize:12, cursor:'pointer', fontWeight:500 }}>
              {t === 'todos' ? 'Todos' : tp?.label}
            </button>
          );
        })}
        <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar razão social ou CNPJ..."
          style={{ marginLeft:'auto', padding:'6px 12px', border:'1px solid #d1d5db', borderRadius:8, fontSize:13, outline:'none', width:240 }} />
      </div>

      {/* Lista */}
      {loading ? (
        <div style={{ textAlign:'center', padding:60, color:'#9ca3af' }}>Carregando...</div>
      ) : listaFiltrada.length === 0 ? (
        <div style={{ textAlign:'center', padding:60, color:'#9ca3af', background:'#fff', borderRadius:12, border:'1px solid #e5e7eb' }}>
          <i className="ti ti-building-off" style={{ fontSize:40, display:'block', marginBottom:8 }}></i>
          Nenhum fornecedor encontrado
        </div>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(320px, 1fr))', gap:14 }}>
          {listaFiltrada.map(f => {
            const tp = TIPOS.find(t => t.val === f.tipoServico);
            const totalFaturas  = (f.faturas || []).reduce((s,fa) => s + Number(fa.valor), 0);
            const pendentes     = (f.faturas || []).filter(fa => fa.status !== 'pago').length;
            return (
              <div key={f.id} style={{ background:'#fff', borderRadius:12, border:'1px solid #e5e7eb', padding:'18px 20px', display:'flex', flexDirection:'column', gap:12 }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                  <div>
                    <div style={{ fontSize:14, fontWeight:600, color:'#1a1a2e' }}>{f.razaoSocial}</div>
                    <div style={{ fontSize:12, color:'#6b7280', marginTop:2 }}>{mascaraCNPJ(f.cnpj)}</div>
                  </div>
                  <span style={{ padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:600, background:tp?.bg, color:tp?.cor, flexShrink:0 }}>
                    <i className={`ti ${tp?.icone}`} style={{ marginRight:4 }}></i>{tp?.label}
                  </span>
                </div>

                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, fontSize:12 }}>
                  <div><span style={{ color:'#9ca3af' }}>Responsável</span><div style={{ fontWeight:500, color:'#374151' }}>{f.responsavel}</div></div>
                  <div><span style={{ color:'#9ca3af' }}>Contato</span><div style={{ fontWeight:500, color:'#374151' }}>{f.contato}</div></div>
                  {f.chavePix && <div style={{ gridColumn:'1/-1' }}><span style={{ color:'#9ca3af' }}>Chave PIX</span><div style={{ fontWeight:500, color:'#374151', wordBreak:'break-all' }}>{f.chavePix}</div></div>}
                </div>

                {f.faturas?.length > 0 && (
                  <div style={{ background:'#f9fafb', borderRadius:8, padding:'8px 12px', fontSize:12, display:'flex', gap:16 }}>
                    <span style={{ color:'#6b7280' }}>{f.faturas.length} fatura(s)</span>
                    <span style={{ color:'#374151', fontWeight:500 }}>{fmt(totalFaturas)} total</span>
                    {pendentes > 0 && <span style={{ color:'#d97706', fontWeight:500 }}>{pendentes} pendente(s)</span>}
                  </div>
                )}

                <div style={{ display:'flex', gap:8, marginTop:2 }}>
                  <button onClick={() => abrirEditar(f)}
                    style={{ flex:1, padding:'7px', border:'1px solid #d1d5db', borderRadius:8, background:'#fff', fontSize:12, cursor:'pointer', color:'#374151' }}>
                    <i className="ti ti-pencil" style={{ marginRight:4 }}></i>Editar
                  </button>
                  <button onClick={() => excluir(f.id, f.razaoSocial)}
                    style={{ padding:'7px 14px', border:'1px solid #fee2e2', borderRadius:8, background:'#fff5f5', fontSize:12, cursor:'pointer', color:'#dc2626' }}>
                    <i className="ti ti-trash"></i>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      {showForm && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:2000, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
          <div style={{ background:'#fff', borderRadius:14, padding:28, width:'100%', maxWidth:520, boxShadow:'0 8px 32px rgba(0,0,0,0.18)', maxHeight:'90vh', overflowY:'auto' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
              <h3 style={{ fontSize:16, fontWeight:600, margin:0 }}>{editId ? 'Editar' : 'Novo'} Fornecedor</h3>
              <button onClick={() => setShowForm(false)} style={{ background:'none', border:'none', fontSize:22, cursor:'pointer', color:'#9ca3af' }}>×</button>
            </div>
            <form onSubmit={salvar}>
              <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
                <div>
                  <label style={lbl}>Razão Social *</label>
                  <input value={form.razaoSocial} onChange={e => setForm(f=>({...f, razaoSocial:e.target.value}))} style={inp} required />
                </div>
                <div>
                  <label style={lbl}>CNPJ *</label>
                  <input value={form.cnpj} onChange={e => setForm(f=>({...f, cnpj:mascaraCNPJ(e.target.value)}))} placeholder="00.000.000/0000-00" style={inp} required />
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
                  <div>
                    <label style={lbl}>Responsável *</label>
                    <input value={form.responsavel} onChange={e => setForm(f=>({...f, responsavel:e.target.value}))} style={inp} required />
                  </div>
                  <div>
                    <label style={lbl}>Contato *</label>
                    <input value={form.contato} onChange={e => setForm(f=>({...f, contato:e.target.value}))} style={inp} required />
                  </div>
                </div>
                <div>
                  <label style={lbl}>Tipo de Serviço *</label>
                  <div style={{ display:'flex', gap:10 }}>
                    {TIPOS.map(t => (
                      <button key={t.val} type="button" onClick={() => setForm(f=>({...f,tipoServico:t.val}))}
                        style={{ flex:1, padding:'10px', border:`2px solid ${form.tipoServico===t.val ? t.cor : '#e5e7eb'}`,
                          borderRadius:9, background: form.tipoServico===t.val ? t.bg : '#fff', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8,
                          color: form.tipoServico===t.val ? t.cor : '#6b7280', fontWeight: form.tipoServico===t.val ? 600 : 400, fontSize:13 }}>
                        <i className={`ti ${t.icone}`} style={{ fontSize:18 }}></i> {t.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label style={lbl}>Chave PIX</label>
                  <input value={form.chavePix} onChange={e => setForm(f=>({...f, chavePix:e.target.value}))} placeholder="CPF, CNPJ, e-mail, telefone ou chave aleatória" style={inp} />
                </div>
              </div>
              <div style={{ display:'flex', justifyContent:'flex-end', gap:10, marginTop:20 }}>
                <button type="button" onClick={() => setShowForm(false)}
                  style={{ padding:'8px 20px', border:'1px solid #d1d5db', borderRadius:8, background:'#fff', fontSize:13, cursor:'pointer' }}>Cancelar</button>
                <button type="submit" disabled={salvando}
                  style={{ padding:'8px 20px', border:'none', borderRadius:8, background:'#EB3238', color:'#fff', fontSize:13, fontWeight:500, cursor:'pointer' }}>
                  {salvando ? 'Salvando...' : (editId ? 'Salvar' : 'Criar')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

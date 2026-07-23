import { useState, useEffect, useMemo } from 'react';
import api from '../../services/api';
import toast from 'react-hot-toast';

const fmt = v => `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
const fmtData = d => d ? new Date(d + 'T12:00:00').toLocaleDateString('pt-BR') : '—';
const hoje = () => { const d = new Date(); d.setHours(0,0,0,0); return d; };
const emDias = d => Math.ceil((new Date(d + 'T12:00:00') - hoje()) / 86400000);

const STATUS_COR = {
  pendente: { bg: '#fef9c3', cor: '#854d0e', label: 'Pendente' },
  vencido:  { bg: '#fee2e2', cor: '#991b1b', label: 'Vencido'  },
  pago:     { bg: '#dcfce7', cor: '#166534', label: 'Pago'     },
};

const TIPO_COR = {
  nota:    { bg: '#eff6ff', cor: '#1d4ed8', label: 'Nota'    },
  remessa: { bg: '#f5f3ff', cor: '#6d28d9', label: 'Remessa' },
};

const vazio = { tipo:'nota', numero:'', fornecedor:'', descricao:'', valor:'', dataEmissao:'', dataVencimento:'', observacao:'' };

function dataHoje() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

export default function Notas() {
  const [lista, setLista] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ ...vazio, dataEmissao: dataHoje() });
  const [editId, setEditId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [filtroTipo, setFiltroTipo] = useState('todos');
  const [filtroStatus, setFiltroStatus] = useState('todos');
  const [busca, setBusca] = useState('');
  const [showPagarModal, setShowPagarModal] = useState(null);
  const [dataPagamento, setDataPagamento] = useState(dataHoje());

  useEffect(() => { carregar(); }, []);

  async function carregar() {
    setLoading(true);
    try {
      const { data } = await api.get('/notas-abastecimento');
      setLista(data);
    } catch { toast.error('Erro ao carregar notas'); }
    finally { setLoading(false); }
  }

  const listaFiltrada = useMemo(() => {
    return lista.filter(i => {
      if (filtroTipo !== 'todos' && i.tipo !== filtroTipo) return false;
      if (filtroStatus !== 'todos' && i.status !== filtroStatus) return false;
      if (busca) {
        const b = busca.toLowerCase();
        if (!i.fornecedor.toLowerCase().includes(b) && !i.numero.toLowerCase().includes(b)) return false;
      }
      return true;
    });
  }, [lista, filtroTipo, filtroStatus, busca]);

  // Cards
  const pendentes     = lista.filter(i => i.status === 'pendente');
  const vencidos      = lista.filter(i => i.status === 'vencido');
  const aVencer7d     = lista.filter(i => i.status === 'pendente' && emDias(i.dataVencimento) >= 0 && emDias(i.dataVencimento) <= 7);
  const pagosMes      = lista.filter(i => {
    if (i.status !== 'pago' || !i.dataPagamento) return false;
    const d = new Date(i.dataPagamento);
    const n = new Date();
    return d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear();
  });

  const cards = [
    { label: 'Pendentes',      count: pendentes.length,  valor: pendentes.reduce((s,i) => s + Number(i.valor), 0),  cor: '#d97706', bg: '#fffbeb', icone: 'ti-clock', clickStatus: 'pendente' },
    { label: 'Vencidos',       count: vencidos.length,   valor: vencidos.reduce((s,i) => s + Number(i.valor), 0),   cor: '#dc2626', bg: '#fff5f5', icone: 'ti-alert-triangle', clickStatus: 'vencido' },
    { label: 'A vencer (7d)', count: aVencer7d.length,  valor: aVencer7d.reduce((s,i) => s + Number(i.valor), 0),  cor: '#7c3aed', bg: '#f5f3ff', icone: 'ti-calendar-exclamation', clickStatus: null },
    { label: 'Pagos este mês', count: pagosMes.length,   valor: pagosMes.reduce((s,i) => s + Number(i.valor), 0),   cor: '#16a34a', bg: '#f0fdf4', icone: 'ti-circle-check', clickStatus: 'pago' },
  ];

  async function salvar(e) {
    e.preventDefault();
    if (salvando) return;
    setSalvando(true);
    try {
      if (editId) {
        await api.put(`/notas-abastecimento/${editId}`, form);
        toast.success('Nota atualizada');
      } else {
        await api.post('/notas-abastecimento', form);
        toast.success('Nota criada');
      }
      setForm({ ...vazio, dataEmissao: dataHoje() });
      setEditId(null); setShowForm(false);
      carregar();
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Erro ao salvar');
    } finally { setSalvando(false); }
  }

  async function excluir(id) {
    if (!confirm('Excluir esta nota/remessa?')) return;
    try {
      await api.delete(`/notas-abastecimento/${id}`);
      toast.success('Excluída'); carregar();
    } catch { toast.error('Erro ao excluir'); }
  }

  async function confirmarPagamento() {
    try {
      await api.patch(`/notas-abastecimento/${showPagarModal}/pagar`, { dataPagamento });
      toast.success('Marcado como pago');
      setShowPagarModal(null); carregar();
    } catch { toast.error('Erro ao marcar como pago'); }
  }

  async function reabrir(id) {
    try {
      await api.patch(`/notas-abastecimento/${id}/reabrir`);
      toast.success('Reaberta'); carregar();
    } catch { toast.error('Erro ao reabrir'); }
  }

  function abrirEditar(item) {
    setForm({
      tipo: item.tipo, numero: item.numero, fornecedor: item.fornecedor,
      descricao: item.descricao || '', valor: String(item.valor),
      dataEmissao: item.dataEmissao?.slice(0, 10) || '',
      dataVencimento: item.dataVencimento?.slice(0, 10) || '',
      observacao: item.observacao || '',
    });
    setEditId(item.id); setShowForm(true);
  }

  const inp = { width:'100%', padding:'8px 12px', border:'1px solid #d1d5db', borderRadius:8, fontSize:13, outline:'none', boxSizing:'border-box' };
  const lbl = { fontSize:12, fontWeight:600, color:'#374151', display:'block', marginBottom:4 };

  return (
    <div>
      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <div>
          <h2 style={{ fontSize:20, fontWeight:600, color:'#1a1a2e', margin:0 }}>Notas & Remessas</h2>
          <p style={{ fontSize:13, color:'#6b7280', marginTop:2 }}>Controle de vencimentos e pagamentos</p>
        </div>
        <button onClick={() => { setForm({ ...vazio, dataEmissao: dataHoje() }); setEditId(null); setShowForm(true); }}
          style={{ display:'flex', alignItems:'center', gap:6, padding:'9px 18px', background:'#EB3238', color:'#fff', border:'none', borderRadius:9, fontSize:13, fontWeight:500, cursor:'pointer' }}>
          <i className="ti ti-plus" style={{ fontSize:16 }}></i> Nova
        </button>
      </div>

      {/* Cards */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14, marginBottom:20 }}>
        {cards.map(c => (
          <div key={c.label}
            onClick={() => c.clickStatus && setFiltroStatus(filtroStatus === c.clickStatus ? 'todos' : c.clickStatus)}
            style={{ background:c.bg, border:`1px solid ${c.cor}22`, borderRadius:12, padding:'18px 20px', cursor: c.clickStatus ? 'pointer' : 'default',
              outline: c.clickStatus && filtroStatus === c.clickStatus ? `2px solid ${c.cor}` : 'none' }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
              <div style={{ width:34, height:34, borderRadius:8, background:`${c.cor}18`, display:'flex', alignItems:'center', justifyContent:'center' }}>
                <i className={`ti ${c.icone}`} style={{ fontSize:17, color:c.cor }}></i>
              </div>
              <span style={{ fontSize:11, fontWeight:600, color:'#6b7280', textTransform:'uppercase', letterSpacing:'0.4px' }}>{c.label}</span>
            </div>
            <div style={{ fontSize:22, fontWeight:700, color:c.cor }}>{c.count}</div>
            <div style={{ fontSize:12, color:'#6b7280', marginTop:2 }}>{fmt(c.valor)}</div>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div style={{ background:'#fff', border:'1px solid #e5e7eb', borderRadius:10, padding:'12px 16px', marginBottom:16, display:'flex', gap:16, alignItems:'center', flexWrap:'wrap' }}>
        <div style={{ display:'flex', gap:6, alignItems:'center' }}>
          <span style={{ fontSize:12, color:'#6b7280', fontWeight:500 }}>Tipo:</span>
          {['todos','nota','remessa'].map(t => (
            <button key={t} onClick={() => setFiltroTipo(t)}
              style={{ padding:'4px 14px', borderRadius:20, border:`1px solid ${filtroTipo===t ? '#1d4ed8' : '#d1d5db'}`,
                background: filtroTipo===t ? '#1d4ed8' : '#fff', color: filtroTipo===t ? '#fff' : '#374151', fontSize:12, cursor:'pointer', textTransform:'capitalize' }}>
              {t === 'todos' ? 'Todos' : TIPO_COR[t]?.label}
            </button>
          ))}
        </div>
        <div style={{ display:'flex', gap:6, alignItems:'center' }}>
          <span style={{ fontSize:12, color:'#6b7280', fontWeight:500 }}>Status:</span>
          {['todos','pendente','vencido','pago'].map(s => (
            <button key={s} onClick={() => setFiltroStatus(s)}
              style={{ padding:'4px 14px', borderRadius:20, border:`1px solid ${filtroStatus===s ? (STATUS_COR[s]?.cor||'#374151') : '#d1d5db'}`,
                background: filtroStatus===s ? (STATUS_COR[s]?.cor||'#374151') : '#fff', color: filtroStatus===s ? '#fff' : '#374151', fontSize:12, cursor:'pointer' }}>
              {s === 'todos' ? 'Todos' : STATUS_COR[s]?.label}
            </button>
          ))}
        </div>
        <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar fornecedor ou número..."
          style={{ marginLeft:'auto', padding:'6px 12px', border:'1px solid #d1d5db', borderRadius:8, fontSize:13, outline:'none', width:220 }} />
      </div>

      {/* Tabela */}
      {loading ? (
        <div style={{ textAlign:'center', padding:60, color:'#9ca3af' }}>Carregando...</div>
      ) : listaFiltrada.length === 0 ? (
        <div style={{ textAlign:'center', padding:60, color:'#9ca3af', background:'#fff', borderRadius:10, border:'1px solid #e5e7eb' }}>
          <i className="ti ti-file-off" style={{ fontSize:40, display:'block', marginBottom:8 }}></i>
          Nenhuma nota encontrada
        </div>
      ) : (
        <div style={{ background:'#fff', borderRadius:10, border:'1px solid #e5e7eb', overflow:'hidden' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
            <thead>
              <tr style={{ background:'#f9fafb', borderBottom:'1px solid #e5e7eb' }}>
                {['Tipo','Número','Fornecedor','Descrição','Valor','Emissão','Vencimento','Status',''].map(h => (
                  <th key={h} style={{ padding:'10px 14px', textAlign:'left', fontWeight:600, color:'#374151', fontSize:12, whiteSpace:'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {listaFiltrada.map((item, i) => {
                const diasRestantes = emDias(item.dataVencimento);
                const vencendoHoje = item.status === 'pendente' && diasRestantes === 0;
                const vencendoBreve = item.status === 'pendente' && diasRestantes > 0 && diasRestantes <= 7;
                const sc = STATUS_COR[item.status] || STATUS_COR.pendente;
                const tc = TIPO_COR[item.tipo] || TIPO_COR.nota;
                return (
                  <tr key={item.id} style={{ borderBottom: i < listaFiltrada.length-1 ? '1px solid #f3f4f6' : 'none',
                    background: vencendoHoje ? '#fffbeb' : 'transparent' }}>
                    <td style={{ padding:'10px 14px' }}>
                      <span style={{ padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:600, background:tc.bg, color:tc.cor }}>{tc.label}</span>
                    </td>
                    <td style={{ padding:'10px 14px', fontWeight:500 }}>{item.numero}</td>
                    <td style={{ padding:'10px 14px', fontWeight:500 }}>{item.fornecedor}</td>
                    <td style={{ padding:'10px 14px', color:'#6b7280', maxWidth:160, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{item.descricao || '—'}</td>
                    <td style={{ padding:'10px 14px', fontWeight:600 }}>{fmt(item.valor)}</td>
                    <td style={{ padding:'10px 14px', color:'#6b7280' }}>{fmtData(item.dataEmissao?.slice?.(0,10))}</td>
                    <td style={{ padding:'10px 14px' }}>
                      <span style={{ color: item.status === 'vencido' ? '#dc2626' : vencendoHoje ? '#d97706' : vencendoBreve ? '#7c3aed' : '#374151', fontWeight: (item.status==='vencido'||vencendoHoje) ? 600 : 400 }}>
                        {fmtData(item.dataVencimento?.slice?.(0,10))}
                      </span>
                      {item.status === 'pendente' && (
                        <div style={{ fontSize:11, color: item.status==='vencido' ? '#dc2626' : diasRestantes <= 7 ? '#d97706' : '#9ca3af' }}>
                          {diasRestantes < 0 ? `${Math.abs(diasRestantes)}d atrasado` : diasRestantes === 0 ? 'Vence hoje' : `${diasRestantes}d restantes`}
                        </div>
                      )}
                      {item.status === 'pago' && item.dataPagamento && (
                        <div style={{ fontSize:11, color:'#16a34a' }}>Pago em {fmtData(item.dataPagamento?.slice?.(0,10))}</div>
                      )}
                    </td>
                    <td style={{ padding:'10px 14px' }}>
                      <span style={{ padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:600, background:sc.bg, color:sc.cor }}>{sc.label}</span>
                    </td>
                    <td style={{ padding:'10px 14px' }}>
                      <div style={{ display:'flex', gap:6 }}>
                        {item.status !== 'pago' ? (
                          <button onClick={() => { setShowPagarModal(item.id); setDataPagamento(dataHoje()); }} title="Marcar como pago"
                            style={{ padding:'5px 10px', border:'1px solid #16a34a', borderRadius:6, background:'#f0fdf4', color:'#16a34a', fontSize:12, cursor:'pointer' }}>
                            <i className="ti ti-check"></i>
                          </button>
                        ) : (
                          <button onClick={() => reabrir(item.id)} title="Reabrir"
                            style={{ padding:'5px 10px', border:'1px solid #d1d5db', borderRadius:6, background:'#f9fafb', color:'#6b7280', fontSize:12, cursor:'pointer' }}>
                            <i className="ti ti-rotate-clockwise"></i>
                          </button>
                        )}
                        <button onClick={() => abrirEditar(item)} title="Editar"
                          style={{ padding:'5px 10px', border:'1px solid #d1d5db', borderRadius:6, background:'#f9fafb', color:'#374151', fontSize:12, cursor:'pointer' }}>
                          <i className="ti ti-pencil"></i>
                        </button>
                        <button onClick={() => excluir(item.id)} title="Excluir"
                          style={{ padding:'5px 10px', border:'1px solid #fee2e2', borderRadius:6, background:'#fff5f5', color:'#dc2626', fontSize:12, cursor:'pointer' }}>
                          <i className="ti ti-trash"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Nova/Editar */}
      {showForm && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:2000, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
          <div style={{ background:'#fff', borderRadius:14, padding:28, width:'100%', maxWidth:540, boxShadow:'0 8px 32px rgba(0,0,0,0.18)', maxHeight:'90vh', overflowY:'auto' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
              <h3 style={{ fontSize:16, fontWeight:600, margin:0 }}>{editId ? 'Editar' : 'Nova'} Nota / Remessa</h3>
              <button onClick={() => setShowForm(false)} style={{ background:'none', border:'none', fontSize:22, cursor:'pointer', color:'#9ca3af' }}>×</button>
            </div>
            <form onSubmit={salvar}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
                <div>
                  <label style={lbl}>Tipo *</label>
                  <select value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))} style={inp} required>
                    <option value="nota">Nota</option>
                    <option value="remessa">Remessa</option>
                  </select>
                </div>
                <div>
                  <label style={lbl}>Número *</label>
                  <input value={form.numero} onChange={e => setForm(f => ({ ...f, numero: e.target.value }))} style={inp} required />
                </div>
                <div style={{ gridColumn:'1/-1' }}>
                  <label style={lbl}>Fornecedor *</label>
                  <input value={form.fornecedor} onChange={e => setForm(f => ({ ...f, fornecedor: e.target.value }))} style={inp} required />
                </div>
                <div style={{ gridColumn:'1/-1' }}>
                  <label style={lbl}>Descrição</label>
                  <input value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} style={inp} />
                </div>
                <div>
                  <label style={lbl}>Valor (R$) *</label>
                  <input type="number" step="0.01" min="0" value={form.valor} onChange={e => setForm(f => ({ ...f, valor: e.target.value }))} style={inp} required />
                </div>
                <div>
                  <label style={lbl}>Data Emissão *</label>
                  <input type="date" value={form.dataEmissao} onChange={e => setForm(f => ({ ...f, dataEmissao: e.target.value }))} style={inp} required />
                </div>
                <div>
                  <label style={lbl}>Data Vencimento *</label>
                  <input type="date" value={form.dataVencimento} onChange={e => setForm(f => ({ ...f, dataVencimento: e.target.value }))} style={inp} required />
                </div>
                <div style={{ gridColumn:'1/-1' }}>
                  <label style={lbl}>Observação</label>
                  <textarea value={form.observacao} onChange={e => setForm(f => ({ ...f, observacao: e.target.value }))}
                    style={{ ...inp, height:70, resize:'vertical' }} />
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

      {/* Modal Confirmar Pagamento */}
      {showPagarModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:2000, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
          <div style={{ background:'#fff', borderRadius:14, padding:28, width:'100%', maxWidth:360, boxShadow:'0 8px 32px rgba(0,0,0,0.18)' }}>
            <h3 style={{ fontSize:15, fontWeight:600, margin:'0 0 16px' }}>Confirmar Pagamento</h3>
            <label style={lbl}>Data do pagamento</label>
            <input type="date" value={dataPagamento} onChange={e => setDataPagamento(e.target.value)}
              style={{ ...inp, marginBottom:20 }} />
            <div style={{ display:'flex', justifyContent:'flex-end', gap:10 }}>
              <button onClick={() => setShowPagarModal(null)}
                style={{ padding:'8px 20px', border:'1px solid #d1d5db', borderRadius:8, background:'#fff', fontSize:13, cursor:'pointer' }}>Cancelar</button>
              <button onClick={confirmarPagamento}
                style={{ padding:'8px 20px', border:'none', borderRadius:8, background:'#16a34a', color:'#fff', fontSize:13, fontWeight:500, cursor:'pointer' }}>
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

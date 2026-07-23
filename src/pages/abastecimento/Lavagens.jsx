import { useState, useEffect, useMemo } from 'react';
import api from '../../services/api';
import toast from 'react-hot-toast';

const fmt        = v => `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits:2 })}`;
const fmtDt      = d => d ? new Date(d.slice(0,10)+'T12:00:00').toLocaleDateString('pt-BR') : '—';
const parseMoeda = v => parseFloat(String(v||'').trim().replace(/\./g,'').replace(',','.'));

const FROTAS = [
  { val:'buzin', label:'BUZIN', cor:'#7c3aed', bg:'#f5f3ff' },
  { val:'lbm',   label:'LBM',   cor:'#b45309', bg:'#fffbeb' },
];

const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

const inp = { width:'100%', padding:'9px 12px', border:'1px solid #d1d5db', borderRadius:8, fontSize:13, outline:'none', boxSizing:'border-box' };
const lbl = { fontSize:12, fontWeight:600, color:'#374151', display:'block', marginBottom:5 };

const vazioForm = { placa:'', frota:'buzin', tipoServicoId:'', tipoCaminhaoId:'', fornecedorId:'', valor:'', data:'', observacao:'' };

export default function Lavagens() {
  const hoje  = new Date();
  const [mes, setMes] = useState(hoje.getMonth() + 1);
  const [ano, setAno] = useState(hoje.getFullYear());

  const [lavagens,     setLavagens]     = useState([]);
  const [resumo,       setResumo]       = useState([]);
  const [tiposServico, setTiposServico] = useState([]);
  const [tiposCaminhao,setTiposCaminhao]= useState([]);
  const [fornecedores, setFornecedores] = useState([]);
  const [loading,      setLoading]      = useState(true);

  const [showModal, setShowModal] = useState(false);
  const [form,      setForm]      = useState(vazioForm);
  const [salvando,  setSalvando]  = useState(false);

  const [filtroFrota, setFiltroFrota] = useState('todos');
  const [filtroBusca, setFiltroBusca] = useState('');
  const [aba,         setAba]         = useState('historico');

  useEffect(() => { carregarAux(); }, []);
  useEffect(() => { carregarLavagens(); }, [mes, ano]);

  async function carregarAux() {
    try {
      const [rs, rc, rf] = await Promise.all([
        api.get('/tipos-servico-lavagem'),
        api.get('/tipos-caminhao-lavagem'),
        api.get('/fornecedores-lavagem'),
      ]);
      setTiposServico(rs.data);
      setTiposCaminhao(rc.data);
      setFornecedores(rf.data);
    } catch { toast.error('Erro ao carregar configurações'); }
  }

  async function carregarLavagens() {
    setLoading(true);
    try {
      const [rl, rr] = await Promise.all([
        api.get('/lavagens', { params: { mes, ano } }),
        api.get('/lavagens/resumo', { params: { mes, ano } }),
      ]);
      setLavagens(rl.data);
      setResumo(rr.data);
    } catch { toast.error('Erro ao carregar registros'); }
    finally { setLoading(false); }
  }

  // Tipo de serviço selecionado
  const tipoServicoAtual = tiposServico.find(ts => ts.id === form.tipoServicoId);
  const requerCaminhao   = tipoServicoAtual?.requerTipoCaminhao ?? false;

  // Preço automático ao selecionar fornecedor + serviço (+ caminhão se necessário)
  useEffect(() => {
    if (!form.fornecedorId || !form.tipoServicoId) return;
    if (requerCaminhao && !form.tipoCaminhaoId) return;

    const forn = fornecedores.find(f => f.id === form.fornecedorId);
    if (!forn) return;

    const preco = forn.precos.find(p =>
      p.tipoServicoId === form.tipoServicoId &&
      (requerCaminhao ? p.tipoCaminhaoId === form.tipoCaminhaoId : !p.tipoCaminhaoId)
    );
    if (preco) {
      setForm(s => ({ ...s, valor: String(Number(preco.valor)).replace('.', ',') }));
    } else {
      setForm(s => ({ ...s, valor: '' }));
    }
  }, [form.fornecedorId, form.tipoServicoId, form.tipoCaminhaoId, fornecedores]);

  async function registrar(e) {
    e.preventDefault();
    if (salvando) return;
    const valorNum = parseMoeda(form.valor);
    if (!valorNum || valorNum <= 0) { toast.error('Valor inválido'); return; }
    if (requerCaminhao && !form.tipoCaminhaoId) { toast.error('Selecione o tipo de caminhão'); return; }
    setSalvando(true);
    try {
      await api.post('/lavagens', {
        placa:          form.placa.toUpperCase().trim(),
        frota:          form.frota,
        tipoServicoId:  form.tipoServicoId,
        tipoCaminhaoId: requerCaminhao ? form.tipoCaminhaoId : null,
        fornecedorId:   form.fornecedorId,
        valor:          valorNum,
        data:           form.data,
        observacao:     form.observacao || null,
      });
      toast.success('Registrado com sucesso');
      setShowModal(false);
      setForm(vazioForm);
      carregarLavagens();
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Erro ao registrar');
    } finally { setSalvando(false); }
  }

  async function excluir(id) {
    if (!confirm('Excluir este registro?')) return;
    try {
      await api.delete(`/lavagens/${id}`);
      toast.success('Removido');
      carregarLavagens();
    } catch { toast.error('Erro ao excluir'); }
  }

  const lista = useMemo(() => lavagens.filter(l => {
    if (filtroFrota !== 'todos' && l.frota !== filtroFrota) return false;
    if (filtroBusca && !l.placa.includes(filtroBusca.toUpperCase())) return false;
    return true;
  }), [lavagens, filtroFrota, filtroBusca]);

  const totalMes   = lavagens.reduce((s, l) => s + Number(l.valor), 0);
  const totalBuzin = lavagens.filter(l => l.frota === 'buzin').reduce((s,l) => s + Number(l.valor), 0);
  const totalLbm   = lavagens.filter(l => l.frota === 'lbm').reduce((s,l) => s + Number(l.valor), 0);
  const qtdMes     = lavagens.length;

  const anos = Array.from({ length:5 }, (_,i) => hoje.getFullYear() - i);

  return (
    <div>
      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <div>
          <h2 style={{ fontSize:20, fontWeight:600, color:'#1a1a2e', margin:0 }}>Lavagens e Serviços</h2>
          <p style={{ fontSize:13, color:'#6b7280', marginTop:2 }}>Histórico e resumo mensal por caminhão</p>
        </div>
        <button onClick={() => { setForm(vazioForm); setShowModal(true); }}
          style={{ display:'flex', alignItems:'center', gap:6, padding:'9px 20px', background:'#EB3238', color:'#fff', border:'none', borderRadius:9, fontSize:13, fontWeight:500, cursor:'pointer' }}>
          <i className="ti ti-plus" style={{ fontSize:16 }}></i> Registrar Serviço
        </button>
      </div>

      {/* Filtro mês/ano */}
      <div style={{ display:'flex', gap:10, alignItems:'center', marginBottom:16 }}>
        <select value={mes} onChange={e => setMes(Number(e.target.value))}
          style={{ padding:'7px 12px', border:'1px solid #d1d5db', borderRadius:8, fontSize:13, background:'#fff', cursor:'pointer' }}>
          {MESES.map((m,i) => <option key={i+1} value={i+1}>{m}</option>)}
        </select>
        <select value={ano} onChange={e => setAno(Number(e.target.value))}
          style={{ padding:'7px 12px', border:'1px solid #d1d5db', borderRadius:8, fontSize:13, background:'#fff', cursor:'pointer' }}>
          {anos.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <span style={{ fontSize:13, color:'#6b7280', fontWeight:500 }}>{MESES[mes-1]} {ano}</span>
      </div>

      {/* Cards */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:20 }}>
        {[
          { label:'Serviços no Mês', valor:qtdMes,    fn: v => v,  cor:'#1a1a2e', bg:'#f8fafc', icone:'ti-wash' },
          { label:'Total Gasto',     valor:totalMes,  fn: fmt,     cor:'#EB3238', bg:'#fff5f5', icone:'ti-currency-dollar' },
          { label:'BUZIN',           valor:totalBuzin,fn: fmt,     cor:'#7c3aed', bg:'#f5f3ff', icone:'ti-truck' },
          { label:'LBM',             valor:totalLbm,  fn: fmt,     cor:'#b45309', bg:'#fffbeb', icone:'ti-truck' },
        ].map(c => (
          <div key={c.label} style={{ background:c.bg, border:`1px solid ${c.cor}22`, borderRadius:12, padding:'16px 18px' }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
              <i className={`ti ${c.icone}`} style={{ fontSize:16, color:c.cor }}></i>
              <span style={{ fontSize:11, fontWeight:600, color:'#6b7280', textTransform:'uppercase', letterSpacing:'0.4px' }}>{c.label}</span>
            </div>
            <div style={{ fontSize:22, fontWeight:700, color:c.cor }}>{c.fn(c.valor)}</div>
          </div>
        ))}
      </div>

      {/* Abas */}
      <div style={{ display:'flex', gap:4, marginBottom:14, background:'#f3f4f6', borderRadius:10, padding:4, width:'fit-content' }}>
        {[{ k:'historico', label:'Histórico' }, { k:'resumo', label:'Resumo por Placa' }].map(a => (
          <button key={a.k} onClick={() => setAba(a.k)}
            style={{ padding:'7px 20px', border:'none', borderRadius:8, fontSize:13, cursor:'pointer', fontWeight: aba===a.k ? 600 : 400,
              background: aba===a.k ? '#fff' : 'transparent', color: aba===a.k ? '#1a1a2e' : '#6b7280',
              boxShadow: aba===a.k ? '0 1px 4px rgba(0,0,0,0.1)' : 'none' }}>
            {a.label}
          </button>
        ))}
      </div>

      {/* ── ABA Histórico ── */}
      {aba === 'historico' && (
        <>
          <div style={{ display:'flex', gap:10, marginBottom:12, flexWrap:'wrap', alignItems:'center' }}>
            <input value={filtroBusca} onChange={e => setFiltroBusca(e.target.value)}
              placeholder="Buscar placa..." style={{ ...inp, width:180 }} />
            <span style={{ fontSize:12, color:'#6b7280' }}>Frota:</span>
            {['todos', ...FROTAS.map(f => f.val)].map(v => {
              const fr = FROTAS.find(f => f.val === v);
              return (
                <button key={v} onClick={() => setFiltroFrota(v)}
                  style={{ padding:'5px 14px', borderRadius:20,
                    border:`1px solid ${filtroFrota===v ? (fr?.cor||'#374151') : '#d1d5db'}`,
                    background: filtroFrota===v ? (fr?.cor||'#374151') : '#fff',
                    color: filtroFrota===v ? '#fff' : '#374151', fontSize:12, cursor:'pointer' }}>
                  {v === 'todos' ? 'Todas' : fr?.label}
                </button>
              );
            })}
            <span style={{ marginLeft:'auto', fontSize:12, color:'#9ca3af' }}>{lista.length} registro(s)</span>
          </div>

          {loading ? (
            <div style={{ textAlign:'center', padding:60, color:'#9ca3af' }}>Carregando...</div>
          ) : lista.length === 0 ? (
            <div style={{ textAlign:'center', padding:60, color:'#9ca3af', background:'#fff', borderRadius:12, border:'1px solid #e5e7eb' }}>
              <i className="ti ti-wash" style={{ fontSize:40, display:'block', marginBottom:8 }}></i>
              Nenhum registro no período.
            </div>
          ) : (
            <div style={{ background:'#fff', border:'1px solid #e5e7eb', borderRadius:12, overflow:'hidden' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
                <thead>
                  <tr style={{ background:'#f8fafc', borderBottom:'1px solid #e5e7eb' }}>
                    {['Data','Placa','Frota','Serviço','Caminhão','Fornecedor','Valor',''].map(h => (
                      <th key={h} style={{ padding:'10px 14px', textAlign:'left', fontSize:11, fontWeight:600, color:'#6b7280', textTransform:'uppercase', letterSpacing:'0.4px' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {lista.map((l, i) => {
                    const fr = FROTAS.find(f => f.val === l.frota);
                    return (
                      <tr key={l.id} style={{ borderBottom:'1px solid #f3f4f6', background: i%2===0 ? '#fff' : '#fafafa' }}>
                        <td style={{ padding:'10px 14px', color:'#374151' }}>{fmtDt(l.data)}</td>
                        <td style={{ padding:'10px 14px', fontWeight:600, color:'#1a1a2e', fontFamily:'monospace', letterSpacing:'0.5px' }}>{l.placa}</td>
                        <td style={{ padding:'10px 14px' }}>
                          <span style={{ padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:600, background: fr?.bg||'#f3f4f6', color: fr?.cor||'#374151' }}>
                            {fr?.label || l.frota}
                          </span>
                        </td>
                        <td style={{ padding:'10px 14px', color:'#374151' }}>{l.tipoServico?.nome}</td>
                        <td style={{ padding:'10px 14px', color:'#6b7280' }}>{l.tipoCaminhao?.nome || '—'}</td>
                        <td style={{ padding:'10px 14px', color:'#374151' }}>{l.fornecedor?.razaoSocial}</td>
                        <td style={{ padding:'10px 14px', fontWeight:600, color:'#16a34a' }}>{fmt(l.valor)}</td>
                        <td style={{ padding:'10px 14px' }}>
                          <button onClick={() => excluir(l.id)}
                            style={{ padding:'4px 8px', border:'1px solid #fee2e2', borderRadius:6, background:'#fff5f5', fontSize:12, cursor:'pointer', color:'#dc2626' }}>
                            <i className="ti ti-trash"></i>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ── ABA Resumo ── */}
      {aba === 'resumo' && (
        loading ? (
          <div style={{ textAlign:'center', padding:60, color:'#9ca3af' }}>Carregando...</div>
        ) : resumo.length === 0 ? (
          <div style={{ textAlign:'center', padding:60, color:'#9ca3af', background:'#fff', borderRadius:12, border:'1px solid #e5e7eb' }}>
            Nenhum registro no período.
          </div>
        ) : (
          <div style={{ background:'#fff', border:'1px solid #e5e7eb', borderRadius:12, overflow:'hidden' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
              <thead>
                <tr style={{ background:'#f8fafc', borderBottom:'1px solid #e5e7eb' }}>
                  {['Placa','Frota','Qtd.','Total Gasto'].map(h => (
                    <th key={h} style={{ padding:'10px 14px', textAlign:'left', fontSize:11, fontWeight:600, color:'#6b7280', textTransform:'uppercase', letterSpacing:'0.4px' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {resumo.map((r, i) => {
                  const fr = FROTAS.find(f => f.val === r.frota);
                  return (
                    <tr key={r.placa} style={{ borderBottom:'1px solid #f3f4f6', background: i%2===0 ? '#fff' : '#fafafa' }}>
                      <td style={{ padding:'10px 14px', fontWeight:700, color:'#1a1a2e', fontFamily:'monospace', letterSpacing:'0.5px' }}>{r.placa}</td>
                      <td style={{ padding:'10px 14px' }}>
                        <span style={{ padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:600, background: fr?.bg||'#f3f4f6', color: fr?.cor||'#374151' }}>
                          {fr?.label || r.frota}
                        </span>
                      </td>
                      <td style={{ padding:'10px 14px', fontWeight:600, color:'#374151' }}>{r.quantidade}×</td>
                      <td style={{ padding:'10px 14px', fontWeight:700, color:'#16a34a', fontSize:14 }}>{fmt(r.total)}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr style={{ background:'#f8fafc', borderTop:'2px solid #e5e7eb' }}>
                  <td colSpan={2} style={{ padding:'10px 14px', fontWeight:700, fontSize:13, color:'#1a1a2e' }}>TOTAL</td>
                  <td style={{ padding:'10px 14px', fontWeight:700, color:'#374151' }}>{resumo.reduce((s,r) => s+r.quantidade,0)}×</td>
                  <td style={{ padding:'10px 14px', fontWeight:700, color:'#16a34a', fontSize:14 }}>{fmt(resumo.reduce((s,r) => s+r.total,0))}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )
      )}

      {/* ══ Modal Registrar ══ */}
      {showModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:2000, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
          <div style={{ background:'#fff', borderRadius:16, width:'100%', maxWidth:480, maxHeight:'90vh', overflowY:'auto', boxShadow:'0 12px 40px rgba(0,0,0,0.2)' }}>
            <div style={{ padding:'22px 28px 0', display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
              <h3 style={{ fontSize:16, fontWeight:700, margin:0, color:'#1a1a2e' }}>Registrar Serviço</h3>
              <button onClick={() => setShowModal(false)} style={{ background:'none', border:'none', fontSize:24, cursor:'pointer', color:'#9ca3af' }}>×</button>
            </div>

            <form onSubmit={registrar} style={{ padding:'0 28px 28px' }}>
              <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
                {/* Placa + Data */}
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
                  <div>
                    <label style={lbl}>Placa *</label>
                    <input
                      value={form.placa}
                      onChange={e => setForm(s=>({...s,placa:e.target.value.toUpperCase()}))}
                      style={{ ...inp, fontFamily:'monospace', letterSpacing:'1px', textTransform:'uppercase' }}
                      required placeholder="ABC1234"
                    />
                  </div>
                  <div>
                    <label style={lbl}>Data *</label>
                    <input type="date" value={form.data} onChange={e => setForm(s=>({...s,data:e.target.value}))} style={inp} required />
                  </div>
                </div>

                {/* Frota */}
                <div>
                  <label style={lbl}>Frota *</label>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                    {FROTAS.map(fr => (
                      <button key={fr.val} type="button" onClick={() => setForm(s=>({...s,frota:fr.val}))}
                        style={{ padding:'10px', border:`2px solid ${form.frota===fr.val ? fr.cor : '#e5e7eb'}`,
                          borderRadius:10, background: form.frota===fr.val ? fr.bg : '#fff', cursor:'pointer',
                          display:'flex', alignItems:'center', justifyContent:'center', gap:8,
                          color: form.frota===fr.val ? fr.cor : '#6b7280',
                          fontWeight: form.frota===fr.val ? 700 : 400, fontSize:13 }}>
                        <i className="ti ti-truck" style={{ fontSize:16 }}></i> {fr.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Fornecedor */}
                <div>
                  <label style={lbl}>Fornecedor *</label>
                  <select value={form.fornecedorId}
                    onChange={e => setForm(s=>({...s,fornecedorId:e.target.value,tipoServicoId:'',tipoCaminhaoId:'',valor:''}))}
                    style={inp} required>
                    <option value="">Selecione...</option>
                    {fornecedores.map(f => <option key={f.id} value={f.id}>{f.razaoSocial}</option>)}
                  </select>
                </div>

                {/* Tipo de serviço (filtrado para o fornecedor selecionado) */}
                {form.fornecedorId && (
                  <div>
                    <label style={lbl}>Tipo de Serviço *</label>
                    <select value={form.tipoServicoId}
                      onChange={e => setForm(s=>({...s,tipoServicoId:e.target.value,tipoCaminhaoId:'',valor:''}))}
                      style={inp} required>
                      <option value="">Selecione...</option>
                      {(() => {
                        const forn = fornecedores.find(f => f.id === form.fornecedorId);
                        const idsDisponiveis = new Set((forn?.precos||[]).map(p => p.tipoServicoId));
                        return tiposServico.filter(ts => idsDisponiveis.has(ts.id)).map(ts => (
                          <option key={ts.id} value={ts.id}>{ts.nome}</option>
                        ));
                      })()}
                    </select>
                  </div>
                )}

                {/* Tipo de caminhão (só se o serviço requerer) */}
                {requerCaminhao && form.tipoServicoId && (
                  <div>
                    <label style={lbl}>Tipo de Caminhão *</label>
                    <select value={form.tipoCaminhaoId}
                      onChange={e => setForm(s=>({...s,tipoCaminhaoId:e.target.value}))}
                      style={inp} required>
                      <option value="">Selecione...</option>
                      {tiposCaminhao.map(tc => <option key={tc.id} value={tc.id}>{tc.nome}</option>)}
                    </select>
                  </div>
                )}

                {/* Valor (auto ou manual) */}
                {form.tipoServicoId && (
                  <div>
                    <label style={lbl}>
                      Valor (R$) *
                      {form.valor && (
                        <span style={{ fontWeight:400, color:'#16a34a', marginLeft:6, fontSize:11 }}>
                          <i className="ti ti-sparkles" style={{ fontSize:11 }}></i> preenchido automaticamente
                        </span>
                      )}
                    </label>
                    <input
                      type="text" inputMode="decimal"
                      value={form.valor} onChange={e => setForm(s=>({...s,valor:e.target.value}))}
                      style={inp} required placeholder="Ex: 80,00"
                    />
                  </div>
                )}

                <div>
                  <label style={lbl}>Observação</label>
                  <textarea value={form.observacao} onChange={e => setForm(s=>({...s,observacao:e.target.value}))}
                    style={{ ...inp, height:60, resize:'vertical' }} placeholder="Opcional" />
                </div>
              </div>

              <div style={{ display:'flex', justifyContent:'flex-end', gap:10, marginTop:20 }}>
                <button type="button" onClick={() => setShowModal(false)}
                  style={{ padding:'9px 20px', border:'1px solid #d1d5db', borderRadius:8, background:'#fff', fontSize:13, cursor:'pointer' }}>
                  Cancelar
                </button>
                <button type="submit" disabled={salvando}
                  style={{ padding:'9px 24px', border:'none', borderRadius:8, background:'#EB3238', color:'#fff', fontSize:13, fontWeight:600, cursor:'pointer' }}>
                  {salvando ? 'Registrando...' : 'Registrar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

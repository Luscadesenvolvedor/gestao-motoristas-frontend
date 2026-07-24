import { useState, useEffect } from 'react';
import api from '../../services/api';
import toast from 'react-hot-toast';

const inp = { width:'100%', padding:'9px 12px', border:'1px solid #d1d5db', borderRadius:8, fontSize:13, outline:'none', boxSizing:'border-box' };
const sel = { ...inp, cursor:'pointer', background:'#fff' };
const lbl = { fontSize:12, fontWeight:600, color:'#374151', display:'block', marginBottom:5 };
const fmt = v => `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits:2 })}`;
const uid = () => Math.random().toString(36).slice(2);

export default function FornecedoresLavagem() {
  const [tiposServico,   setTiposServico]   = useState([]);
  const [partesCaminhao, setPartesCaminhao] = useState([]);
  const [fornecedores,   setFornecedores]   = useState([]);
  const [loading,        setLoading]        = useState(true);

  // Cadastro lateral — Tipos de Serviço
  const [novoServico,       setNovoServico]       = useState('');
  const [novoServicoRequer, setNovoServicoRequer] = useState(false);
  const [salvandoServico,   setSalvandoServico]   = useState(false);

  // Cadastro lateral — Partes do Caminhão
  const [novaParte,     setNovaParte]     = useState('');
  const [salvandoParte, setSalvandoParte] = useState(false);

  // Modal fornecedor
  const [showModal, setShowModal] = useState(false);
  const [editando,  setEditando]  = useState(null);
  const [forn,      setForn]      = useState({ razaoSocial:'', cnpj:'', contato:'' });
  // linhas: [{ _id, tipoServicoId, tipoCaminhaoId, valor }]
  const [linhas,    setLinhas]    = useState([]);
  const [salvando,  setSalvando]  = useState(false);

  useEffect(() => { carregar(); }, []);

  async function carregar() {
    setLoading(true);
    try {
      const [rs, rc, rf] = await Promise.all([
        api.get('/tipos-servico-lavagem'),
        api.get('/tipos-caminhao-lavagem'),
        api.get('/fornecedores-lavagem'),
      ]);
      setTiposServico(rs.data);
      setPartesCaminhao(rc.data);
      setFornecedores(rf.data);
    } catch { toast.error('Erro ao carregar dados'); }
    finally { setLoading(false); }
  }

  // ── Tipos de serviço ──
  async function adicionarServico(e) {
    e.preventDefault();
    if (!novoServico.trim()) return;
    setSalvandoServico(true);
    try {
      const { data } = await api.post('/tipos-servico-lavagem', {
        nome: novoServico.trim(), requerTipoCaminhao: novoServicoRequer,
      });
      setTiposServico(p => [...p, data].sort((a,b) => a.nome.localeCompare(b.nome)));
      setNovoServico(''); setNovoServicoRequer(false);
      toast.success('Tipo de serviço adicionado');
    } catch (err) { toast.error(err?.response?.data?.error || 'Erro ao adicionar'); }
    finally { setSalvandoServico(false); }
  }

  async function removerServico(id) {
    if (!confirm('Remover este tipo de serviço?')) return;
    try {
      await api.delete(`/tipos-servico-lavagem/${id}`);
      setTiposServico(p => p.filter(t => t.id !== id));
      toast.success('Removido');
    } catch { toast.error('Erro ao remover'); }
  }

  // ── Partes do caminhão ──
  async function adicionarParte(e) {
    e.preventDefault();
    if (!novaParte.trim()) return;
    setSalvandoParte(true);
    try {
      const { data } = await api.post('/tipos-caminhao-lavagem', { nome: novaParte.trim() });
      setPartesCaminhao(p => [...p, data].sort((a,b) => a.nome.localeCompare(b.nome)));
      setNovaParte('');
      toast.success('Parte adicionada');
    } catch (err) { toast.error(err?.response?.data?.error || 'Erro ao adicionar'); }
    finally { setSalvandoParte(false); }
  }

  async function removerParte(id) {
    if (!confirm('Remover esta parte?')) return;
    try {
      await api.delete(`/tipos-caminhao-lavagem/${id}`);
      setPartesCaminhao(p => p.filter(t => t.id !== id));
      toast.success('Removido');
    } catch { toast.error('Erro ao remover'); }
  }

  // ── Modal helpers ──
  function novaLinha() {
    return { _id: uid(), tipoServicoId: '', tipoCaminhaoId: '', valor: '' };
  }

  function abrirNovo() {
    setEditando(null);
    setForn({ razaoSocial:'', cnpj:'', contato:'' });
    setLinhas([novaLinha()]);
    setShowModal(true);
  }

  function abrirEditar(f) {
    setEditando(f.id);
    setForn({ razaoSocial: f.razaoSocial, cnpj: f.cnpj||'', contato: f.contato||'' });
    const ls = f.precos.map(p => ({
      _id: uid(),
      tipoServicoId:  p.tipoServicoId,
      tipoCaminhaoId: p.tipoCaminhaoId || '',
      valor: String(Number(p.valor)),
    }));
    setLinhas(ls.length ? ls : [novaLinha()]);
    setShowModal(true);
  }

  function setLinha(id, campo, valor) {
    setLinhas(prev => prev.map(l => l._id === id
      ? { ...l, [campo]: valor, ...(campo === 'tipoServicoId' ? { tipoCaminhaoId: '' } : {}) }
      : l
    ));
  }

  function addLinha() { setLinhas(p => [...p, novaLinha()]); }
  function removeLinha(id) { setLinhas(p => p.filter(l => l._id !== id)); }

  async function salvar(e) {
    e.preventDefault();
    if (salvando) return;

    // valida linhas preenchidas
    const precos = linhas
      .filter(l => l.tipoServicoId && l.valor !== '')
      .map(l => ({
        tipoServicoId:  l.tipoServicoId,
        tipoCaminhaoId: l.tipoCaminhaoId || null,
        valor: parseFloat(String(l.valor).replace(',', '.')),
      }));

    setSalvando(true);
    try {
      const payload = { ...forn, precos };
      if (editando) {
        const { data } = await api.put(`/fornecedores-lavagem/${editando}`, payload);
        setFornecedores(p => p.map(f => f.id === editando ? data : f));
        toast.success('Fornecedor atualizado');
      } else {
        const { data } = await api.post('/fornecedores-lavagem', payload);
        setFornecedores(p => [...p, data].sort((a,b) => a.razaoSocial.localeCompare(b.razaoSocial)));
        toast.success('Fornecedor cadastrado');
      }
      setShowModal(false);
    } catch (err) { toast.error(err?.response?.data?.error || 'Erro ao salvar'); }
    finally { setSalvando(false); }
  }

  async function excluir(id) {
    if (!confirm('Excluir este fornecedor?')) return;
    try {
      await api.delete(`/fornecedores-lavagem/${id}`);
      setFornecedores(p => p.filter(f => f.id !== id));
      toast.success('Removido');
    } catch { toast.error('Erro ao excluir'); }
  }

  return (
    <div>
      <div style={{ marginBottom:24 }}>
        <h2 style={{ fontSize:20, fontWeight:600, color:'#1a1a2e', margin:0 }}>Fornecedores de Serviços</h2>
        <p style={{ fontSize:13, color:'#6b7280', marginTop:2 }}>Cadastre os tipos de serviço, partes do caminhão e fornecedores com preços</p>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'260px 1fr', gap:20, alignItems:'start' }}>

        {/* ── Coluna esquerda ── */}
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>

          {/* Tipos de serviço */}
          <div style={{ background:'#fff', border:'1px solid #e5e7eb', borderRadius:12, padding:16 }}>
            <h3 style={{ fontSize:13, fontWeight:700, color:'#1a1a2e', margin:'0 0 12px', display:'flex', alignItems:'center', gap:6 }}>
              <i className="ti ti-tools" style={{ color:'#EB3238' }}></i> Tipos de Serviço
            </h3>
            <form onSubmit={adicionarServico} style={{ marginBottom:10 }}>
              <input value={novoServico} onChange={e => setNovoServico(e.target.value)}
                placeholder="Ex: Lavagem, Polimento..." style={{ ...inp, marginBottom:8 }} />
              <label style={{ display:'flex', alignItems:'center', gap:8, fontSize:12, color:'#374151', marginBottom:8, cursor:'pointer' }}>
                <input type="checkbox" checked={novoServicoRequer} onChange={e => setNovoServicoRequer(e.target.checked)} />
                Preço varia por parte do caminhão
              </label>
              <button type="submit" disabled={salvandoServico}
                style={{ width:'100%', padding:'7px', background:'#EB3238', color:'#fff', border:'none', borderRadius:8, fontSize:12, cursor:'pointer', fontWeight:500 }}>
                + Adicionar
              </button>
            </form>
            <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
              {tiposServico.length === 0 && <p style={{ fontSize:12, color:'#9ca3af', textAlign:'center' }}>Nenhum serviço</p>}
              {tiposServico.map(t => (
                <div key={t.id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'6px 10px', background:'#f8fafc', borderRadius:7, border:'1px solid #e5e7eb' }}>
                  <div>
                    <span style={{ fontSize:12, fontWeight:600, color:'#374151' }}>{t.nome}</span>
                    {t.requerTipoCaminhao && <span style={{ fontSize:10, color:'#7c3aed', marginLeft:6 }}>por parte</span>}
                  </div>
                  <button onClick={() => removerServico(t.id)} style={{ background:'none', border:'none', cursor:'pointer', color:'#dc2626', fontSize:13 }}>
                    <i className="ti ti-trash"></i>
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Partes do caminhão */}
          <div style={{ background:'#fff', border:'1px solid #e5e7eb', borderRadius:12, padding:16 }}>
            <h3 style={{ fontSize:13, fontWeight:700, color:'#1a1a2e', margin:'0 0 6px', display:'flex', alignItems:'center', gap:6 }}>
              <i className="ti ti-car" style={{ color:'#EB3238' }}></i> Partes do Caminhão
            </h3>
            <p style={{ fontSize:11, color:'#9ca3af', marginBottom:10 }}>Para serviços com preço por parte (Cabine, Baú, Completo…)</p>
            <form onSubmit={adicionarParte} style={{ display:'flex', gap:6, marginBottom:10 }}>
              <input value={novaParte} onChange={e => setNovaParte(e.target.value)}
                placeholder="Ex: Cabine, Baú..." style={{ ...inp, flex:1 }} />
              <button type="submit" disabled={salvandoParte}
                style={{ padding:'9px 12px', background:'#EB3238', color:'#fff', border:'none', borderRadius:8, fontSize:13, cursor:'pointer' }}>
                <i className="ti ti-plus"></i>
              </button>
            </form>
            <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
              {partesCaminhao.length === 0 && <p style={{ fontSize:12, color:'#9ca3af', textAlign:'center' }}>Nenhuma parte</p>}
              {partesCaminhao.map(t => (
                <div key={t.id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'6px 10px', background:'#f8fafc', borderRadius:7, border:'1px solid #e5e7eb' }}>
                  <span style={{ fontSize:12, fontWeight:600, color:'#374151' }}>{t.nome}</span>
                  <button onClick={() => removerParte(t.id)} style={{ background:'none', border:'none', cursor:'pointer', color:'#dc2626', fontSize:13 }}>
                    <i className="ti ti-trash"></i>
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Coluna direita: fornecedores ── */}
        <div>
          <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:12 }}>
            <button onClick={abrirNovo}
              style={{ display:'flex', alignItems:'center', gap:6, padding:'9px 20px', background:'#EB3238', color:'#fff', border:'none', borderRadius:9, fontSize:13, fontWeight:500, cursor:'pointer' }}>
              <i className="ti ti-plus"></i> Novo Fornecedor
            </button>
          </div>

          {loading ? (
            <div style={{ textAlign:'center', padding:60, color:'#9ca3af' }}>Carregando...</div>
          ) : fornecedores.length === 0 ? (
            <div style={{ textAlign:'center', padding:60, color:'#9ca3af', background:'#fff', borderRadius:12, border:'1px solid #e5e7eb' }}>
              <i className="ti ti-building-store" style={{ fontSize:40, display:'block', marginBottom:8 }}></i>
              Nenhum fornecedor cadastrado.
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {fornecedores.map(f => {
                const grupos = {};
                for (const p of f.precos) {
                  const k = p.tipoServicoId;
                  if (!grupos[k]) grupos[k] = { nome: p.tipoServico?.nome, itens: [] };
                  grupos[k].itens.push(p);
                }
                return (
                  <div key={f.id} style={{ background:'#fff', border:'1px solid #e5e7eb', borderRadius:12, padding:'16px 18px' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:10 }}>
                      <div>
                        <div style={{ fontSize:15, fontWeight:600, color:'#1a1a2e' }}>{f.razaoSocial}</div>
                        {(f.cnpj || f.contato) && (
                          <div style={{ fontSize:12, color:'#6b7280', marginTop:2 }}>
                            {f.cnpj && <span>CNPJ: {f.cnpj}</span>}
                            {f.cnpj && f.contato && <span> · </span>}
                            {f.contato && <span>{f.contato}</span>}
                          </div>
                        )}
                      </div>
                      <div style={{ display:'flex', gap:6 }}>
                        <button onClick={() => abrirEditar(f)}
                          style={{ padding:'5px 10px', border:'1px solid #dbeafe', borderRadius:6, background:'#eff6ff', fontSize:12, cursor:'pointer', color:'#1d4ed8' }}>
                          <i className="ti ti-pencil"></i>
                        </button>
                        <button onClick={() => excluir(f.id)}
                          style={{ padding:'5px 10px', border:'1px solid #fee2e2', borderRadius:6, background:'#fff5f5', fontSize:12, cursor:'pointer', color:'#dc2626' }}>
                          <i className="ti ti-trash"></i>
                        </button>
                      </div>
                    </div>
                    {Object.values(grupos).length === 0 ? (
                      <p style={{ fontSize:12, color:'#9ca3af', margin:0 }}>Sem preços cadastrados</p>
                    ) : (
                      <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
                        {Object.values(grupos).map((g, gi) => (
                          <div key={gi} style={{ background:'#f8fafc', borderRadius:8, padding:'8px 12px', border:'1px solid #e5e7eb', minWidth:140 }}>
                            <div style={{ fontSize:11, fontWeight:700, color:'#374151', textTransform:'uppercase', letterSpacing:'0.4px', marginBottom:5 }}>{g.nome}</div>
                            {g.itens.map((p, pi) => (
                              <div key={pi} style={{ display:'flex', justifyContent:'space-between', gap:12 }}>
                                {p.tipoCaminhao && <span style={{ fontSize:11, color:'#6b7280' }}>{p.tipoCaminhao.nome}</span>}
                                <span style={{ fontSize:13, fontWeight:600, color:'#16a34a', marginLeft:'auto' }}>{fmt(p.valor)}</span>
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ══ Modal Fornecedor ══ */}
      {showModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:2000, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
          <div style={{ background:'#fff', borderRadius:16, width:'100%', maxWidth:560, maxHeight:'90vh', overflowY:'auto', boxShadow:'0 12px 40px rgba(0,0,0,0.2)' }}>

            {/* Header */}
            <div style={{ padding:'22px 28px 0', display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
              <h3 style={{ fontSize:16, fontWeight:700, margin:0, color:'#1a1a2e' }}>
                {editando ? 'Editar Fornecedor' : 'Novo Fornecedor'}
              </h3>
              <button onClick={() => setShowModal(false)} style={{ background:'none', border:'none', fontSize:24, cursor:'pointer', color:'#9ca3af' }}>×</button>
            </div>

            <form onSubmit={salvar} style={{ padding:'0 28px 28px' }}>
              <div style={{ display:'flex', flexDirection:'column', gap:14 }}>

                {/* Dados do fornecedor */}
                <div>
                  <label style={lbl}>Razão Social *</label>
                  <input value={forn.razaoSocial} onChange={e => setForn(s=>({...s,razaoSocial:e.target.value}))}
                    style={inp} required placeholder="Nome da empresa" />
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                  <div>
                    <label style={lbl}>CNPJ</label>
                    <input value={forn.cnpj} onChange={e => setForn(s=>({...s,cnpj:e.target.value}))}
                      style={inp} placeholder="Opcional" />
                  </div>
                  <div>
                    <label style={lbl}>Contato</label>
                    <input value={forn.contato} onChange={e => setForn(s=>({...s,contato:e.target.value}))}
                      style={inp} placeholder="Tel. ou e-mail" />
                  </div>
                </div>

                {/* Serviços */}
                <div>
                  <label style={{ ...lbl, marginBottom:10 }}>Serviços e Valores</label>

                  {tiposServico.length === 0 ? (
                    <div style={{ padding:12, background:'#fffbeb', border:'1px solid #fde68a', borderRadius:8, fontSize:12, color:'#92400e' }}>
                      <i className="ti ti-alert-triangle" style={{ marginRight:6 }}></i>
                      Cadastre os tipos de serviço na coluna esquerda primeiro.
                    </div>
                  ) : (
                    <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                      {linhas.map((linha) => {
                        const ts = tiposServico.find(t => t.id === linha.tipoServicoId);
                        const requerParte = ts?.requerTipoCaminhao;
                        return (
                          <div key={linha._id} style={{ display:'grid', gap:8, background:'#f8fafc', borderRadius:10, padding:'12px 14px', border:'1px solid #e5e7eb',
                            gridTemplateColumns: requerParte ? '1fr 1fr 120px 32px' : '1fr 140px 32px' }}>

                            {/* Tipo de serviço */}
                            <div>
                              <label style={{ fontSize:11, color:'#6b7280', display:'block', marginBottom:4 }}>Tipo de serviço</label>
                              <select value={linha.tipoServicoId}
                                onChange={e => setLinha(linha._id, 'tipoServicoId', e.target.value)}
                                style={sel}>
                                <option value="">Selecionar…</option>
                                {tiposServico.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
                              </select>
                            </div>

                            {/* Parte do caminhão (só se requerTipoCaminhao) */}
                            {requerParte && (
                              <div>
                                <label style={{ fontSize:11, color:'#6b7280', display:'block', marginBottom:4 }}>Parte do caminhão</label>
                                {partesCaminhao.length === 0 ? (
                                  <div style={{ fontSize:11, color:'#dc2626', padding:'9px 0' }}>Cadastre partes primeiro</div>
                                ) : (
                                  <select value={linha.tipoCaminhaoId}
                                    onChange={e => setLinha(linha._id, 'tipoCaminhaoId', e.target.value)}
                                    style={sel}>
                                    <option value="">Selecionar…</option>
                                    {partesCaminhao.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                                  </select>
                                )}
                              </div>
                            )}

                            {/* Valor */}
                            <div>
                              <label style={{ fontSize:11, color:'#6b7280', display:'block', marginBottom:4 }}>Valor (R$)</label>
                              <input type="text" inputMode="decimal"
                                value={linha.valor}
                                onChange={e => setLinha(linha._id, 'valor', e.target.value)}
                                placeholder="0,00" style={inp} />
                            </div>

                            {/* Remover */}
                            <div style={{ display:'flex', alignItems:'flex-end', paddingBottom:1 }}>
                              <button type="button" onClick={() => removeLinha(linha._id)}
                                style={{ width:32, height:36, border:'1px solid #fee2e2', borderRadius:7, background:'#fff5f5', color:'#dc2626', cursor:'pointer', fontSize:14, display:'flex', alignItems:'center', justifyContent:'center' }}>
                                <i className="ti ti-trash"></i>
                              </button>
                            </div>
                          </div>
                        );
                      })}

                      <button type="button" onClick={addLinha}
                        style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 14px', border:'1px dashed #d1d5db', borderRadius:8, background:'transparent', fontSize:12, color:'#6b7280', cursor:'pointer', width:'fit-content' }}>
                        <i className="ti ti-plus"></i> Adicionar serviço
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Botões */}
              <div style={{ display:'flex', justifyContent:'flex-end', gap:10, marginTop:22 }}>
                <button type="button" onClick={() => setShowModal(false)}
                  style={{ padding:'9px 20px', border:'1px solid #d1d5db', borderRadius:8, background:'#fff', fontSize:13, cursor:'pointer' }}>
                  Cancelar
                </button>
                <button type="submit" disabled={salvando}
                  style={{ padding:'9px 24px', border:'none', borderRadius:8, background:'#EB3238', color:'#fff', fontSize:13, fontWeight:600, cursor:'pointer' }}>
                  {salvando ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

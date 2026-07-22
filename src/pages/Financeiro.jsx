// frontend/src/pages/Financeiro.jsx
import { useState, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import StickyScrollTable from '../components/StickyScrollTable';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';

const vazio = { motoristaId:'', tipoDescontoId:'', valor:'', valorDescontado:'', numeroAcerto:'', numeroVale:'', mesDesconto:'', observacao:'' };

export default function Financeiro() {
  const { isAdmin, usuario } = useAuth();
  const [lista, setLista] = useState([]);
  const [motoristas, setMotoristas] = useState([]);
  const [tipos, setTipos] = useState([]);
  const [form, setForm] = useState(vazio);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [novoTipo, setNovoTipo] = useState('');
  const [showNovoTipo, setShowNovoTipo] = useState(false);
  const [busca, setBusca] = useState('');
  const [perfilVisto, setPerfilVisto] = useState(1);
  const [acertadores, setAcertadores] = useState({});
  const [expandidos, setExpandidos] = useState({});
  const [importando, setImportando] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    api.get('/motoristas').then(r => setMotoristas(r.data));
    api.get('/tipos/desconto').then(r => setTipos(r.data));
    if (isAdmin) {
      api.get('/usuarios').then(r => {
        const mapa = {};
        r.data.forEach(u => {
          if (u.papel === 'acertador' && u.perfilFinanceiro) {
            mapa[u.perfilFinanceiro] = u.nome;
          }
        });
        setAcertadores(mapa);
      });
    }
  }, [isAdmin]);

  useEffect(() => { carregar(); }, [perfilVisto]);

  async function carregar() {
    const params = isAdmin ? { perfil: perfilVisto } : {};
    const { data } = await api.get('/financeiro', { params });
    setLista(data);
  }

  const listaFiltrada = lista.filter(item =>
    item.motorista?.nome.toLowerCase().includes(busca.toLowerCase()) ||
    item.tipoDesconto?.nome.toLowerCase().includes(busca.toLowerCase()) ||
    item.numeroAcerto?.toLowerCase().includes(busca.toLowerCase())
  );

  const agrupado = listaFiltrada.reduce((acc, item) => {
    const id = item.motoristaId;
    if (!acc[id]) acc[id] = { nome: item.motorista?.nome, itens: [] };
    acc[id].itens.push(item);
    return acc;
  }, {});

  function toggleExpandir(id) {
    setExpandidos(e => ({ ...e, [id]: !e[id] }));
  }

  async function salvar(e) {
    e.preventDefault();
    try {
      const payload = isAdmin ? { ...form, perfilAlvo: perfilVisto } : form;
      if (editId) { await api.put(`/financeiro/${editId}`, payload); toast.success('Atualizado'); }
      else { await api.post('/financeiro', payload); toast.success('Registrado'); }
      setForm(vazio); setEditId(null); setShowForm(false); carregar();
    } catch (err) {
      console.error('Erro ao salvar financeiro:', err);
      toast.error(err?.response?.data?.error || 'Erro ao salvar. Verifique os campos.');
    }
  }

  async function salvarNovoTipo() {
    if (!novoTipo.trim()) return;
    const { data } = await api.post('/tipos/desconto', { nome: novoTipo });
    toast.success('Tipo adicionado'); setNovoTipo(''); setShowNovoTipo(false);
    api.get('/tipos/desconto').then(r => setTipos(r.data));
    setForm(f => ({ ...f, tipoDescontoId: data.id }));
  }

  async function atualizarDescontado(id, valorDescontado) {
    await api.patch(`/financeiro/${id}/descontado`, { valorDescontado: parseFloat(valorDescontado) });
    carregar();
  }

  async function excluirItem(id) {
    if (!confirm('Excluir este registro?')) return;
    try {
      await api.delete(`/financeiro/${id}`);
      toast.success('Registro excluído');
      carregar();
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Erro ao excluir');
    }
  }

  const fmt = v => `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
  const lbl = { display:'block', fontSize:11, fontWeight:500, color:'#6b7280', marginBottom:4, textTransform:'uppercase', letterSpacing:'0.5px' };
  const inp = { width:'100%', padding:'8px 10px', border:'1px solid #d1d5db', borderRadius:8, fontSize:13, boxSizing:'border-box' };

  const totalValor = listaFiltrada.reduce((s, i) => s + Number(i.valor), 0);
  const totalDescontado = listaFiltrada.reduce((s, i) => s + Number(i.valorDescontado), 0);
  const totalSaldo = totalValor - totalDescontado;

  const nomeAtual = isAdmin ? (acertadores[perfilVisto] || `Perfil ${perfilVisto}`) : usuario?.nome;

  function parseBRL(v) {
    if (v === '' || v === null || v === undefined) return null;
    // Se XLSX já leu como número, usar direto
    if (typeof v === 'number') return v;
    // Caso venha como texto no formato "R$ 1.234,56"
    const s = String(v).replace(/R\$\s*/g, '').trim()
      .replace(/\./g, '')   // remove separador de milhar
      .replace(',', '.');   // vírgula decimal → ponto
    const n = parseFloat(s);
    return isNaN(n) ? null : n;
  }

  async function importarExcel(e) {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = '';
    setImportando(true);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });

      // Função para encontrar chave do row de forma flexível (sem acento, sem case)
      function normalizar(s) {
        return String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
      }
      function getCol(row, ...termos) {
        const chaves = Object.keys(row);
        for (const termo of termos) {
          const termNorm = normalizar(termo);
          const chave = chaves.find(k => normalizar(k) === termNorm || normalizar(k).includes(termNorm));
          if (chave !== undefined) return row[chave];
        }
        return '';
      }

      let ok = 0, pulados = 0, falhou = 0, erros = [];
      for (const row of rows) {
        try {
          const nomeMot = String(getCol(row, 'motoristas', 'motorista') || '').trim();
          const nomeTipo = String(getCol(row, 'tipo') || '').trim();
          const valorRaw = getCol(row, 'valor') ?? '';
          const desconRaw = getCol(row, 'descontado') ?? '';
          const vale = String(getCol(row, 'vale') || '').trim();
          const acerto = String(getCol(row, 'data') || '').trim();
          const mes = String(getCol(row, 'mes do desconto', 'mes desconto', 'mes_desconto') || '').trim();

          if (!nomeMot) { falhou++; erros.push('Linha sem motorista'); continue; }

          const mot = motoristas.find(m => m.nome.toLowerCase() === nomeMot.toLowerCase());
          if (!mot) { falhou++; erros.push(`Motorista não encontrado: "${nomeMot}"`); continue; }

          const tipo = tipos.find(t => t.nome.toLowerCase() === nomeTipo.toLowerCase());
          if (!tipo) { falhou++; erros.push(`Tipo não encontrado: "${nomeTipo}"`); continue; }

          const valorParsed = parseBRL(valorRaw) ?? 0;
          const desconParsed = parseBRL(desconRaw) ?? 0;

          const payload = {
            motoristaId: mot.id,
            tipoDescontoId: tipo.id,
            valor: valorParsed,
            valorDescontado: desconParsed,
            numeroVale: vale || null,
            numeroAcerto: acerto || null,
            mesDesconto: mes || null,
            observacao: '',
            ...(isAdmin ? { perfilAlvo: perfilVisto } : {})
          };

          await api.post('/financeiro', payload);
          ok++;
        } catch (err) {
          if (err?.response?.status === 409) {
            pulados++;
          } else {
            falhou++;
            const detalhe = err?.response?.data?.error || err?.message || 'Erro desconhecido';
            const status = err?.response?.status || 'sem resposta';
            erros.push(`[${status}] ${detalhe} (mot: ${nomeMot})`);
          }
        }
      }

      if (ok > 0) {
        toast.success(`${ok} registro(s) importado(s) com sucesso`);
        carregar();
      }
      if (pulados > 0) {
        toast(`${pulados} vale(s) já existiam e foram ignorados`, { icon: '⚠️' });
      }
      if (falhou > 0) {
        console.error('Erros de importação:', erros);
        toast.error(`${falhou} erro(s): ${erros.slice(0,2).join(' | ')}${erros.length > 2 ? ` (+${erros.length-2})` : ''}`, { duration: 8000 });
      }
    } catch (err) {
      toast.error('Erro ao ler arquivo Excel');
    } finally {
      setImportando(false);
    }
  }

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <div>
          <h2 style={{ fontSize:20, fontWeight:600, color:'#1a1a2e' }}>Controle Financeiro</h2>
          <p style={{ fontSize:13, color:'#6b7280', marginTop:2 }}>{nomeAtual}</p>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <input ref={fileInputRef} type="file" accept=".xlsx,.xls" style={{ display:'none' }} onChange={importarExcel}/>
          <button onClick={() => fileInputRef.current?.click()} disabled={importando}
            style={{ display:'flex', alignItems:'center', gap:8, padding:'9px 16px', background:'#fff', color:'#374151', border:'1px solid #d1d5db', borderRadius:8, fontSize:13, fontWeight:500, cursor:'pointer', opacity: importando ? 0.6 : 1 }}>
            <i className="ti ti-file-spreadsheet"></i> {importando ? 'Importando...' : 'Importar Excel'}
          </button>
          <button onClick={() => { setForm(vazio); setEditId(null); setShowForm(v => !v); }}
            style={{ display:'flex', alignItems:'center', gap:8, padding:'9px 16px', background:'#EB3238', color:'#fff', border:'none', borderRadius:8, fontSize:13, fontWeight:500, cursor:'pointer' }}>
            <i className="ti ti-plus"></i> Incluir
          </button>
        </div>
      </div>

      {/* Abas acertadores — só admin */}
      {isAdmin && Object.keys(acertadores).length > 0 && (
        <div style={{ display:'flex', gap:8, marginBottom:16, flexWrap:'wrap' }}>
          {Object.entries(acertadores).map(([perfil, nome]) => (
            <button key={perfil} onClick={() => setPerfilVisto(parseInt(perfil))}
              style={{ padding:'8px 20px', border:'1px solid '+(perfilVisto===parseInt(perfil)?'#EB3238':'#d1d5db'), borderRadius:8, fontSize:13, cursor:'pointer', background:perfilVisto===parseInt(perfil)?'#EB3238':'#fff', color:perfilVisto===parseInt(perfil)?'#fff':'#374151', fontWeight:perfilVisto===parseInt(perfil)?600:400 }}>
              {nome}
            </button>
          ))}
        </div>
      )}

      {/* Totais */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12, marginBottom:16 }}>
        {[['Total valor', totalValor,'#1a1a2e'],['Total descontado', totalDescontado,'#16a34a'],['Saldo pendente', totalSaldo,'#d97706']].map(([l,v,c])=>(
          <div key={l} style={{ background:'#fff', borderRadius:12, padding:'14px 18px', border:'1px solid #e5e7eb' }}>
            <div style={{ fontSize:11, color:'#6b7280', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:6 }}>{l}</div>
            <div style={{ fontSize:22, fontWeight:600, color:c }}>{fmt(v)}</div>
          </div>
        ))}
      </div>

      {/* Formulário */}
      {showForm && (
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
                <label style={lbl}>Tipo de desconto</label>
                <div style={{ display:'flex', gap:8 }}>
                  <select value={form.tipoDescontoId} onChange={e=>setForm(f=>({...f,tipoDescontoId:e.target.value}))} required style={{ flex:1, padding:'8px 10px', border:'1px solid #d1d5db', borderRadius:8, fontSize:13 }}>
                    <option value="">Selecionar...</option>
                    {tipos.map(t=><option key={t.id} value={t.id}>{t.nome}</option>)}
                  </select>
                  <button type="button" onClick={()=>setShowNovoTipo(v=>!v)} style={{ padding:'8px 10px', border:'1px solid #d1d5db', borderRadius:8, fontSize:12, cursor:'pointer', background:'#fff' }}>+ Novo</button>
                </div>
                {showNovoTipo && (
                  <div style={{ display:'flex', gap:8, marginTop:8 }}>
                    <input value={novoTipo} onChange={e=>setNovoTipo(e.target.value)} placeholder="Nome do tipo" style={{ flex:1, padding:'6px 10px', border:'1px solid #d1d5db', borderRadius:8, fontSize:13 }}/>
                    <button type="button" onClick={salvarNovoTipo} style={{ padding:'6px 12px', background:'#EB3238', color:'#fff', border:'none', borderRadius:8, fontSize:13, cursor:'pointer' }}>Salvar</button>
                  </div>
                )}
              </div>
              <div>
                <label style={lbl}>Valor (R$)</label>
                <input type="number" value={form.valor} onChange={e=>setForm(f=>({...f,valor:e.target.value,valorDescontado:e.target.value}))} required style={inp}/>
              </div>
              <div>
                <label style={lbl}>Valor descontado (R$)</label>
                <input type="number" value={form.valorDescontado} onChange={e=>setForm(f=>({...f,valorDescontado:e.target.value}))} required style={inp}/>
              </div>
              <div>
                <label style={lbl}>Nº Acerto</label>
                <input value={form.numeroAcerto} onChange={e=>setForm(f=>({...f,numeroAcerto:e.target.value}))} placeholder="ACT-0001" style={inp}/>
              </div>
              <div>
                <label style={lbl}>Nº Vale</label>
                <input value={form.numeroVale||''} onChange={e=>setForm(f=>({...f,numeroVale:e.target.value}))} placeholder="Ex: 12345" style={inp}/>
              </div>
              <div>
                <label style={lbl}>Mês do desconto <span style={{fontWeight:400,color:'#9ca3af'}}>(opcional)</span></label>
                <input type="month" value={form.mesDesconto||''} onChange={e=>setForm(f=>({...f,mesDesconto:e.target.value}))} style={inp}/>
              </div>
              <div style={{ gridColumn:'1/-1' }}>
                <label style={lbl}>Observação</label>
                <textarea value={form.observacao} onChange={e=>setForm(f=>({...f,observacao:e.target.value}))} rows={2} style={{ ...inp, resize:'vertical' }}/>
              </div>
            </div>
            <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:16 }}>
              <button type="button" onClick={()=>setShowForm(false)} style={{ padding:'8px 16px', border:'1px solid #d1d5db', borderRadius:8, fontSize:13, cursor:'pointer', background:'#fff' }}>Cancelar</button>
              <button type="submit" style={{ padding:'8px 20px', background:'#EB3238', color:'#fff', border:'none', borderRadius:8, fontSize:13, fontWeight:500, cursor:'pointer' }}>Salvar</button>
            </div>
          </form>
        </div>
      )}

      {/* Busca */}
      <div style={{ background:'#fff', borderRadius:12, border:'1px solid #e5e7eb', marginBottom:16, padding:'12px 16px' }}>
        <input placeholder="Buscar por motorista, tipo ou nº acerto..."
          value={busca} onChange={e => setBusca(e.target.value)}
          style={{ padding:'8px 12px', border:'1px solid #d1d5db', borderRadius:8, fontSize:13, width:320 }}/>
      </div>

      {/* Lista agrupada */}
      <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
        {Object.entries(agrupado).map(([motoristaId, grupo]) => {
          const totalV = grupo.itens.reduce((s,i) => s + Number(i.valor), 0);
          const totalD = grupo.itens.reduce((s,i) => s + Number(i.valorDescontado), 0);
          const saldo = totalV - totalD;
          const expandido = expandidos[motoristaId];

          return (
            <div key={motoristaId} style={{ background:'#fff', borderRadius:12, border:'1px solid #e5e7eb', overflow:'hidden' }}>
              <div onClick={() => toggleExpandir(motoristaId)}
                style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'12px 16px', cursor:'pointer', background: expandido ? '#fff0f0' : '#fff' }}
                onMouseEnter={e => e.currentTarget.style.background='#f9fafb'}
                onMouseLeave={e => e.currentTarget.style.background=expandido?'#fff0f0':'#fff'}>
                <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                  <span style={{ fontSize:14, fontWeight:600, color:'#1a1a2e' }}>{grupo.nome}</span>
                  <span style={{ fontSize:11, color:'#6b7280', background:'#f3f4f6', padding:'2px 8px', borderRadius:20 }}>{grupo.itens.length} registro(s)</span>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:20 }}>
                  <div style={{ textAlign:'right' }}>
                    <div style={{ fontSize:10, color:'#6b7280', textTransform:'uppercase' }}>Valor</div>
                    <div style={{ fontSize:13, fontWeight:500 }}>{fmt(totalV)}</div>
                  </div>
                  <div style={{ textAlign:'right' }}>
                    <div style={{ fontSize:10, color:'#6b7280', textTransform:'uppercase' }}>Descontado</div>
                    <div style={{ fontSize:13, fontWeight:500, color:'#16a34a' }}>{fmt(totalD)}</div>
                  </div>
                  <div style={{ textAlign:'right' }}>
                    <div style={{ fontSize:10, color:'#6b7280', textTransform:'uppercase' }}>Saldo</div>
                    <div style={{ fontSize:13, fontWeight:600, color: saldo > 0 ? '#d97706' : '#16a34a' }}>{fmt(saldo)}</div>
                  </div>
                  <span style={{ fontSize:18, color:'#EB3238', transform: expandido ? 'rotate(180deg)' : 'rotate(0deg)', transition:'transform 0.2s' }}>▾</span>
                </div>
              </div>

              {expandido && (
                <StickyScrollTable deps={[expandidos]}>
                  <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
                    <thead>
                      <tr style={{ background:'#f9fafb' }}>
                        {['Tipo','Valor','Descontado','Nº Acerto','Nº Vale','Mês','Obs',...(isAdmin?['Alteração','']:[])].map(h=>(
                          <th key={h} style={{ padding:'8px 14px', textAlign:'left', fontSize:11, fontWeight:600, color:'#6b7280', textTransform:'uppercase', borderBottom:'1px solid #e5e7eb' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {grupo.itens.map(item => (
                        <tr key={item.id} style={{ borderBottom:'1px solid #f3f4f6' }}>
                          <td style={{ padding:'8px 14px', color:'#6b7280' }}>{item.tipoDesconto?.nome}</td>
                          <td style={{ padding:'8px 14px' }}>{fmt(item.valor)}</td>
                          <td style={{ padding:'8px 14px' }}>
                            <input type="number" defaultValue={Number(item.valorDescontado)}
                              onBlur={e => atualizarDescontado(item.id, e.target.value)}
                              style={{ width:100, padding:'4px 8px', border:'1px solid #d1d5db', borderRadius:6, fontSize:13 }}/>
                          </td>
                          <td style={{ padding:'8px 14px', fontFamily:'monospace', fontSize:12 }}>{item.numeroAcerto}</td>
                          <td style={{ padding:'8px 14px', fontFamily:'monospace', fontSize:12 }}>{item.numeroVale||'—'}</td>
                          <td style={{ padding:'8px 14px', color:'#6b7280' }}>{item.mesDesconto||'—'}</td>
                          <td style={{ padding:'8px 14px', color:'#6b7280', fontSize:12 }}>{item.observacao||'—'}</td>
                          {isAdmin && (
                            <td style={{ padding:'8px 14px', fontSize:11, color:'#9ca3af' }}>
                              {item.auditorias?.[0] ? `${item.auditorias[0].usuario.nome} — ${new Date(item.auditorias[0].criadoEm).toLocaleString('pt-BR')}` : '—'}
                            </td>
                          )}
                          {isAdmin && (
                            <td style={{ padding:'8px 14px' }}>
                              <button onClick={() => excluirItem(item.id)}
                                style={{ padding:'4px 12px', border:'1px solid #EB3238', borderRadius:6, fontSize:12, cursor:'pointer', background:'#fff', color:'#EB3238' }}>
                                Excluir
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </StickyScrollTable>
              )}
            </div>
          );
        })}
        {Object.keys(agrupado).length === 0 && (
          <div style={{ background:'#fff', borderRadius:12, border:'1px solid #e5e7eb', padding:40, textAlign:'center', color:'#9ca3af' }}>
            Nenhum registro financeiro
          </div>
        )}
      </div>
    </div>
  );
}
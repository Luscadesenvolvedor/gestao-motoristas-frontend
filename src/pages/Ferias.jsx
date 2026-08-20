import { useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';

const TABS = [
  { key: 'ferias', label: '🏖️ Férias / Atestado' },
  { key: 'afastamentos', label: '🏥 Afastamentos' },
  { key: 'abandonos', label: '🚪 Abandonos' },
];

function fmtData(str) {
  if (!str) return '—';
  const [a, m, d] = str.split('T')[0].split('-');
  return `${d}/${m}/${a}`;
}

export default function Ferias() {
  const { isAdmin, pode } = useAuth();
  const [tab, setTab] = useState('ferias');
  const [lista, setLista] = useState([]);
  const [afastamentos, setAfastamentos] = useState([]);
  const [abandonos, setAbandonos] = useState([]);
  const [motoristas, setMotoristas] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ motoristaId:'', tipo:'ferias', inicio:'', fim:'', observacao:'' });
  const [formAfast, setFormAfast] = useState({ motoristaId:'', dataInicio:'', dataRetorno:'', indeterminado:false, observacao:'' });
  const [formAband, setFormAband] = useState({ motoristaId:'', data:'', observacao:'' });
  const [filtroMotorista, setFiltroMotorista] = useState('');
  const [filtroTipo, setFiltroTipo]           = useState('');
  const [filtroStatus, setFiltroStatus]       = useState('');
  const [filtroFrota, setFiltroFrota]         = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState('');
  const [filtroBusca, setFiltroBusca]         = useState('');
  const canEdit = pode('ferias', 'escrita');

  useEffect(() => { carregarTudo(); }, []);

  async function carregarTudo() {
    try {
      const [m, f, a, ab] = await Promise.all([
        api.get('/motoristas'),
        api.get('/ferias'),
        api.get('/ferias/afastamentos'),
        api.get('/ferias/abandonos'),
      ]);
      setMotoristas(m.data);
      setLista(f.data);
      setAfastamentos(a.data);
      setAbandonos(ab.data);
    } catch {}
  }

  async function salvarFerias(e) {
    e.preventDefault();
    try {
      await api.post('/ferias', form);
      toast.success('Registrado com sucesso!');
      setShowForm(false);
      setForm({ motoristaId:'', tipo:'ferias', inicio:'', fim:'', observacao:'' });
      carregarTudo();
    } catch {}
  }

  async function salvarAfastamento(e) {
    e.preventDefault();
    try {
      await api.post('/ferias/afastamentos', formAfast);
      toast.success('Afastamento registrado!');
      setShowForm(false);
      setFormAfast({ motoristaId:'', dataInicio:'', dataRetorno:'', indeterminado:false, observacao:'' });
      carregarTudo();
    } catch {}
  }

  async function salvarAbandono(e) {
    e.preventDefault();
    try {
      await api.post('/ferias/abandonos', formAband);
      toast.success('Abandono registrado!');
      setShowForm(false);
      setFormAband({ motoristaId:'', data:'', observacao:'' });
      carregarTudo();
    } catch {}
  }

  async function marcarRetornou(id) {
    if (!confirm('Confirmar retorno ao trabalho?')) return;
    await api.patch(`/ferias/afastamentos/${id}/retornou`, {});
    toast.success('Retorno registrado!');
    carregarTudo();
  }

  async function excluir(tipo, id) {
    const msgs = { ferias:'este registro', afastamento:'este afastamento', abandono:'este abandono' };
    if (!confirm(`Excluir ${msgs[tipo]}?`)) return;
    try {
      if (tipo === 'ferias') await api.delete(`/ferias/${id}`);
      if (tipo === 'afastamento') await api.delete(`/ferias/afastamentos/${id}`);
      if (tipo === 'abandono') await api.delete(`/ferias/abandonos/${id}`);
      toast.success('Excluído!');
      carregarTudo();
    } catch { toast.error('Erro ao excluir'); }
  }

  const hoje = new Date();
  const emFerias   = f => new Date(f.inicio) <= hoje && (!f.fim || new Date(f.fim) >= hoje);
  const isPendente = f => new Date(f.inicio) > hoje;
  const isEncerrado = f => !emFerias(f) && !isPendente(f);

  function statusFerias(f) {
    if (emFerias(f))   return { label: 'Ativo',    bg: '#dcfce7', cor: '#166534' };
    if (isPendente(f)) return { label: 'Pendente', bg: '#fef9c3', cor: '#854d0e' };
    return               { label: 'Encerrado', bg: '#f3f4f6', cor: '#6b7280' };
  }

  const calcDias = (inicio, fim) => {
    if (!inicio || !fim) return '—';
    const d = Math.ceil((new Date(fim) - new Date(inicio)) / (1000*60*60*24)) + 1;
    return `${d} dia${d!==1?'s':''}`;
  };

  const [mostrarEncerradas, setMostrarEncerradas] = useState(false);

  const listaFiltrada = lista.filter(f => {
    if (filtroMotorista && f.motoristaId !== filtroMotorista) return false;
    if (filtroTipo      && f.tipo !== filtroTipo) return false;
    if (filtroFrota     && f.motorista?.frota !== filtroFrota) return false;
    if (filtroCategoria && f.motorista?.categoria !== filtroCategoria) return false;
    if (filtroBusca     && !f.motorista?.nome?.toLowerCase().includes(filtroBusca.toLowerCase())) return false;
    if (filtroStatus === 'ativo'     && !emFerias(f))    return false;
    if (filtroStatus === 'pendente'  && !isPendente(f))  return false;
    if (filtroStatus === 'encerrado' && !isEncerrado(f)) return false;
    return true;
  });

  function limparFiltros() {
    setFiltroMotorista(''); setFiltroTipo(''); setFiltroStatus('');
    setFiltroFrota(''); setFiltroCategoria(''); setFiltroBusca('');
  }

  const feriasAtivas     = listaFiltrada.filter(f => emFerias(f) || isPendente(f));
  const feriasEncerradas = listaFiltrada.filter(f => isEncerrado(f));

  const afastFiltrados = afastamentos.filter(a => {
    if (filtroMotorista && a.motoristaId !== filtroMotorista) return false;
    if (filtroStatus === 'afastado' && a.retornou) return false;
    if (filtroStatus === 'retornou' && !a.retornou) return false;
    return true;
  });

  const abandFiltrados = abandonos.filter(a => {
    if (filtroMotorista && a.motoristaId !== filtroMotorista) return false;
    return true;
  });

  const inp = { padding:'7px 10px', border:'1px solid #d1d5db', borderRadius:8, fontSize:13, background:'#fff' };
  const inpFull = { ...inp, width:'100%', boxSizing:'border-box' };
  const lbl = { display:'block', fontSize:11, fontWeight:500, color:'#6b7280', marginBottom:4, textTransform:'uppercase' };
  const btn = (bg, color='#fff') => ({ padding:'8px 16px', background:bg, color, border:'none', borderRadius:8, fontSize:13, fontWeight:500, cursor:'pointer' });

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <h2 style={{ fontSize:20, fontWeight:600, color:'#1a1a2e' }}>Férias e Ocorrências</h2>
        {canEdit && (
          <button onClick={()=>setShowForm(v=>!v)} style={btn('#EB3238')}>+ Incluir</button>
        )}
      </div>

      <div style={{ display:'flex', gap:4, marginBottom:16, background:'#f3f4f6', borderRadius:10, padding:4 }}>
        {TABS.map(t => (
          <button key={t.key} onClick={()=>{ setTab(t.key); setShowForm(false); limparFiltros(); }}
            style={{ flex:1, padding:'8px 12px', border:'none', borderRadius:8, fontSize:13, fontWeight:tab===t.key?500:400, cursor:'pointer', background:tab===t.key?'#fff':'transparent', color:tab===t.key?'#EB3238':'#6b7280', boxShadow:tab===t.key?'0 1px 4px rgba(0,0,0,0.1)':'none' }}>
            {t.label}
          </button>
        ))}
      </div>

      {(filtroMotorista || filtroTipo || filtroStatus || filtroFrota || filtroCategoria || filtroBusca) && (
        <div style={{ marginBottom:8, display:'flex', justifyContent:'flex-end' }}>
          <button onClick={limparFiltros} style={{ ...btn('#f3f4f6','#374151'), fontSize:12, display:'flex', alignItems:'center', gap:5 }}>
            <i className="ti ti-x" style={{ fontSize:12 }}></i> Limpar filtros
          </button>
        </div>
      )}

      {showForm && tab === 'ferias' && canEdit && (
        <div style={{ background:'#fff', borderRadius:12, padding:20, marginBottom:16, border:'1px solid #e5e7eb' }}>
          <h3 style={{ fontSize:14, fontWeight:600, marginBottom:14 }}>Novo registro</h3>
          <form onSubmit={salvarFerias}>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              <div>
                <label style={lbl}>Motorista</label>
                <select value={form.motoristaId} onChange={e=>setForm(f=>({...f,motoristaId:e.target.value}))} required style={inpFull}>
                  <option value="">Selecionar...</option>
                  {motoristas.map(m=><option key={m.id} value={m.id}>{m.nome}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Tipo</label>
                <select value={form.tipo} onChange={e=>setForm(f=>({...f,tipo:e.target.value}))} style={inpFull}>
                  <option value="ferias">Férias</option>
                  <option value="atestado">Atestado</option>
                </select>
              </div>
              <div>
                <label style={lbl}>Data início</label>
                <input type="date" value={form.inicio} onChange={e=>setForm(f=>({...f,inicio:e.target.value}))} required style={inpFull}/>
              </div>
              <div>
                <label style={lbl}>Data fim (opcional)</label>
                <input type="date" value={form.fim} onChange={e=>setForm(f=>({...f,fim:e.target.value}))} style={inpFull}/>
              </div>
              {form.inicio && form.fim && (
                <div style={{ gridColumn:'1/-1', background:'#fff0f0', borderRadius:8, padding:'10px 14px', fontSize:13, color:'#EB3238', fontWeight:500 }}>
                  📅 Total: {calcDias(form.inicio, form.fim)}
                </div>
              )}
              <div style={{ gridColumn:'1/-1' }}>
                <label style={lbl}>Observação</label>
                <textarea value={form.observacao} onChange={e=>setForm(f=>({...f,observacao:e.target.value}))} rows={2} style={{ ...inpFull, resize:'vertical' }}/>
              </div>
            </div>
            <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:16 }}>
              <button type="button" onClick={()=>setShowForm(false)} style={btn('#e5e7eb','#374151')}>Cancelar</button>
              <button type="submit" style={btn('#EB3238')}>Salvar</button>
            </div>
          </form>
        </div>
      )}

      {showForm && tab === 'afastamentos' && canEdit && (
        <div style={{ background:'#fff', borderRadius:12, padding:20, marginBottom:16, border:'1px solid #e5e7eb' }}>
          <h3 style={{ fontSize:14, fontWeight:600, marginBottom:14 }}>Novo afastamento</h3>
          <form onSubmit={salvarAfastamento}>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              <div>
                <label style={lbl}>Motorista</label>
                <select value={formAfast.motoristaId} onChange={e=>setFormAfast(f=>({...f,motoristaId:e.target.value}))} required style={inpFull}>
                  <option value="">Selecionar...</option>
                  {motoristas.map(m=><option key={m.id} value={m.id}>{m.nome}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Data início</label>
                <input type="date" value={formAfast.dataInicio} onChange={e=>setFormAfast(f=>({...f,dataInicio:e.target.value}))} required style={inpFull}/>
              </div>
              <div>
                <label style={lbl}>Data retorno</label>
                <input type="date" value={formAfast.dataRetorno} onChange={e=>setFormAfast(f=>({...f,dataRetorno:e.target.value}))} disabled={formAfast.indeterminado} style={{ ...inpFull, opacity:formAfast.indeterminado?0.5:1 }}/>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:8, paddingTop:20 }}>
                <input type="checkbox" id="indet" checked={formAfast.indeterminado} onChange={e=>setFormAfast(f=>({...f,indeterminado:e.target.checked,dataRetorno:''}))} style={{ width:18, height:18, accentColor:'#EB3238' }}/>
                <label htmlFor="indet" style={{ fontSize:13, cursor:'pointer' }}>Prazo indeterminado</label>
              </div>
              <div style={{ gridColumn:'1/-1' }}>
                <label style={lbl}>Observação</label>
                <textarea value={formAfast.observacao} onChange={e=>setFormAfast(f=>({...f,observacao:e.target.value}))} rows={2} style={{ ...inpFull, resize:'vertical' }}/>
              </div>
            </div>
            <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:16 }}>
              <button type="button" onClick={()=>setShowForm(false)} style={btn('#e5e7eb','#374151')}>Cancelar</button>
              <button type="submit" style={btn('#EB3238')}>Salvar</button>
            </div>
          </form>
        </div>
      )}

      {showForm && tab === 'abandonos' && canEdit && (
        <div style={{ background:'#fff', borderRadius:12, padding:20, marginBottom:16, border:'1px solid #e5e7eb' }}>
          <h3 style={{ fontSize:14, fontWeight:600, marginBottom:14 }}>Registrar abandono</h3>
          <form onSubmit={salvarAbandono}>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              <div>
                <label style={lbl}>Motorista</label>
                <select value={formAband.motoristaId} onChange={e=>setFormAband(f=>({...f,motoristaId:e.target.value}))} required style={inpFull}>
                  <option value="">Selecionar...</option>
                  {motoristas.map(m=><option key={m.id} value={m.id}>{m.nome}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Data</label>
                <input type="date" value={formAband.data} onChange={e=>setFormAband(f=>({...f,data:e.target.value}))} required style={inpFull}/>
              </div>
              <div style={{ gridColumn:'1/-1' }}>
                <label style={lbl}>Observação</label>
                <textarea value={formAband.observacao} onChange={e=>setFormAband(f=>({...f,observacao:e.target.value}))} rows={2} style={{ ...inpFull, resize:'vertical' }}/>
              </div>
            </div>
            <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:16 }}>
              <button type="button" onClick={()=>setShowForm(false)} style={btn('#e5e7eb','#374151')}>Cancelar</button>
              <button type="submit" style={btn('#EB3238')}>Registrar abandono</button>
            </div>
          </form>
        </div>
      )}

      {tab === 'ferias' && (() => {
        const FROTA_LABEL = { buzin:'BUZIN', meli:'OP. BAÚ', lbm:'LBM', meli_buzin:'OP. BAÚ/BUZIN', meli_lbm:'OP. BAÚ/LBM' };
        const FROTA_COR   = { buzin:'#7c3aed', meli:'#0891b2', lbm:'#b45309', meli_buzin:'#0891b2', meli_lbm:'#0891b2' };
        const CATEG_LABEL = { frota:'Frota', dedicado_usiminas:'Ded. Usiminas', dedicado_arcelormittal:'Ded. Arcelormittal', patio:'Pátio', tirador_ferias:'Tirador Férias' };

        const thFiltro = (children) => ({
          padding:'8px 10px', textAlign:'left', fontSize:11, fontWeight:600,
          color:'#6b7280', textTransform:'uppercase', borderBottom:'1px solid #e5e7eb',
          verticalAlign:'top', background:'#f9fafb',
          children,
        });

        const selFiltro = { width:'100%', marginTop:4, padding:'3px 6px', border:'1px solid #d1d5db', borderRadius:6, fontSize:11, background:'#fff', color:'#374151', cursor:'pointer' };
        const inpFiltro = { ...selFiltro, fontWeight:400 };

        const frotasDisponiveis = [...new Set(lista.map(f => f.motorista?.frota).filter(Boolean))].sort();
        const categDisponiveis  = [...new Set(lista.map(f => f.motorista?.categoria).filter(Boolean))].sort();

        const renderLinhas = (itens) => itens.map(f=>(
          <tr key={f.id} style={{ borderBottom:'1px solid #f3f4f6' }}>
            <td style={{ padding:'10px 14px', fontWeight:500 }}>{f.motorista?.nome}</td>
            <td style={{ padding:'10px 14px' }}>
              {f.motorista?.frota ? (
                <span style={{ padding:'2px 9px', borderRadius:20, fontSize:11, fontWeight:600, background: (FROTA_COR[f.motorista.frota]||'#6b7280')+'18', color: FROTA_COR[f.motorista.frota]||'#6b7280' }}>
                  {FROTA_LABEL[f.motorista.frota] || f.motorista.frota}
                </span>
              ) : '—'}
            </td>
            <td style={{ padding:'10px 14px', fontSize:12, color:'#6b7280' }}>
              <div>{f.motorista?.categoria ? CATEG_LABEL[f.motorista.categoria] || f.motorista.categoria : '—'}</div>
              {f.motorista?.descricao && <div style={{ fontSize:11, color:'#9ca3af', marginTop:2 }}>{f.motorista.descricao}</div>}
            </td>
            <td style={{ padding:'10px 14px' }}>
              <span style={{ padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:500, background:f.tipo==='ferias'?'#fff0f0':'#fef3c7', color:f.tipo==='ferias'?'#EB3238':'#92400e' }}>
                {f.tipo === 'ferias' ? '🏖️ Férias' : '🏥 Atestado'}
              </span>
            </td>
            <td style={{ padding:'10px 14px', color:'#6b7280' }}>{fmtData(f.inicio)}</td>
            <td style={{ padding:'10px 14px', color:'#6b7280' }}>{f.fim ? fmtData(f.fim) : '—'}</td>
            <td style={{ padding:'10px 14px' }}>{calcDias(f.inicio, f.fim)}</td>
            <td style={{ padding:'10px 14px' }}>
              {(() => { const s = statusFerias(f); return (
                <span style={{ padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:500, background:s.bg, color:s.cor }}>{s.label}</span>
              ); })()}
            </td>
            <td style={{ padding:'10px 14px', color:'#6b7280', fontSize:12 }}>{f.observacao || '—'}</td>
            <td style={{ padding:'10px 14px' }}>
              {canEdit && (
                <button onClick={()=>excluir('ferias', f.id)} style={{ padding:'4px 10px', border:'1px solid #EB3238', borderRadius:6, fontSize:12, cursor:'pointer', background:'#fff', color:'#EB3238' }}>Excluir</button>
              )}
            </td>
            {isAdmin && <td style={{ padding:'10px 14px', fontSize:11, color:'#9ca3af' }}>{f.auditorias?.[0]?`${f.auditorias[0].usuario?.nome} — ${new Date(f.auditorias[0].criadoEm).toLocaleString('pt-BR')}`:'—'}</td>}
          </tr>
        ));
        return (
          <>
            {/* Ativos */}
            <div style={{ background:'#fff', borderRadius:12, border:'1px solid #e5e7eb', overflow:'hidden', marginBottom:12 }}>
              <div style={{ padding:'10px 14px', borderBottom:'1px solid #e5e7eb', fontSize:12, color:'#6b7280' }}>
                {feriasAtivas.length} registro{feriasAtivas.length!==1?'s':''}
              </div>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
                <thead>
                  <tr style={{ background:'#f9fafb' }}>
                    <th style={{ padding:'8px 10px', textAlign:'left', fontSize:11, fontWeight:600, color:'#6b7280', textTransform:'uppercase', borderBottom:'1px solid #e5e7eb', verticalAlign:'top', minWidth:140 }}>
                      Motorista
                      <input value={filtroBusca} onChange={e=>setFiltroBusca(e.target.value)} placeholder="Buscar..." style={inpFiltro} />
                    </th>
                    <th style={{ padding:'8px 10px', textAlign:'left', fontSize:11, fontWeight:600, color:'#6b7280', textTransform:'uppercase', borderBottom:'1px solid #e5e7eb', verticalAlign:'top', minWidth:110 }}>
                      Frota
                      <select value={filtroFrota} onChange={e=>setFiltroFrota(e.target.value)} style={selFiltro}>
                        <option value="">Todas</option>
                        {frotasDisponiveis.map(f=><option key={f} value={f}>{FROTA_LABEL[f]||f}</option>)}
                      </select>
                    </th>
                    <th style={{ padding:'8px 10px', textAlign:'left', fontSize:11, fontWeight:600, color:'#6b7280', textTransform:'uppercase', borderBottom:'1px solid #e5e7eb', verticalAlign:'top', minWidth:130 }}>
                      Categoria
                      <select value={filtroCategoria} onChange={e=>setFiltroCategoria(e.target.value)} style={selFiltro}>
                        <option value="">Todas</option>
                        {categDisponiveis.map(c=><option key={c} value={c}>{CATEG_LABEL[c]||c}</option>)}
                      </select>
                    </th>
                    <th style={{ padding:'8px 10px', textAlign:'left', fontSize:11, fontWeight:600, color:'#6b7280', textTransform:'uppercase', borderBottom:'1px solid #e5e7eb', verticalAlign:'top', minWidth:100 }}>
                      Tipo
                      <select value={filtroTipo} onChange={e=>setFiltroTipo(e.target.value)} style={selFiltro}>
                        <option value="">Todos</option>
                        <option value="ferias">Férias</option>
                        <option value="atestado">Atestado</option>
                      </select>
                    </th>
                    {['Início','Fim','Dias'].map(h=>(
                      <th key={h} style={{ padding:'8px 10px', textAlign:'left', fontSize:11, fontWeight:600, color:'#6b7280', textTransform:'uppercase', borderBottom:'1px solid #e5e7eb', verticalAlign:'top' }}>{h}</th>
                    ))}
                    <th style={{ padding:'8px 10px', textAlign:'left', fontSize:11, fontWeight:600, color:'#6b7280', textTransform:'uppercase', borderBottom:'1px solid #e5e7eb', verticalAlign:'top', minWidth:100 }}>
                      Status
                      <select value={filtroStatus} onChange={e=>setFiltroStatus(e.target.value)} style={selFiltro}>
                        <option value="">Todos</option>
                        <option value="ativo">Ativo</option>
                        <option value="pendente">Pendente</option>
                        <option value="encerrado">Encerrado</option>
                      </select>
                    </th>
                    {['Observação','Ações',...(isAdmin?['Alteração']:[])].map(h=>(
                      <th key={h} style={{ padding:'8px 10px', textAlign:'left', fontSize:11, fontWeight:600, color:'#6b7280', textTransform:'uppercase', borderBottom:'1px solid #e5e7eb', verticalAlign:'top' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {renderLinhas(feriasAtivas)}
                  {feriasAtivas.length===0 && <tr><td colSpan={10+(isAdmin?1:0)} style={{ padding:40, textAlign:'center', color:'#9ca3af' }}>Nenhum registro ativo</td></tr>}
                </tbody>
              </table>
            </div>

            {/* Encerrados — recolhidos por padrão */}
            {feriasEncerradas.length > 0 && (
              <div style={{ background:'#fff', borderRadius:12, border:'1px solid #e5e7eb', overflow:'hidden' }}>
                <div onClick={()=>setMostrarEncerradas(v=>!v)}
                  style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'12px 16px', cursor:'pointer', background:'#f9fafb' }}>
                  <span style={{ fontSize:13, fontWeight:600, color:'#6b7280' }}>
                    Encerrados ({feriasEncerradas.length})
                  </span>
                  <span style={{ fontSize:16, color:'#9ca3af', transform: mostrarEncerradas?'rotate(180deg)':'rotate(0deg)', transition:'transform 0.2s' }}>▾</span>
                </div>
                {mostrarEncerradas && (
                  <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
                    <thead>
                      <tr style={{ background:'#f9fafb' }}>
                        {['Motorista','Frota','Categoria','Tipo','Início','Fim','Dias','Status','Observação','Ações',...(isAdmin?['Alteração']:[])].map(h=>(
                          <th key={h} style={{ padding:'8px 10px', textAlign:'left', fontSize:11, fontWeight:600, color:'#6b7280', textTransform:'uppercase', borderBottom:'1px solid #e5e7eb' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {renderLinhas(feriasEncerradas)}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </>
        );
      })()}

      {tab === 'afastamentos' && (
        <div style={{ background:'#fff', borderRadius:12, border:'1px solid #e5e7eb', overflow:'hidden' }}>
          <div style={{ padding:'10px 14px', borderBottom:'1px solid #e5e7eb', fontSize:12, color:'#6b7280' }}>
            {afastFiltrados.length} registro{afastFiltrados.length!==1?'s':''}
          </div>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
            <thead>
              <tr style={{ background:'#f9fafb' }}>
                {['Motorista','Início','Retorno','Status','Observação','Ações'].map(h=>(
                  <th key={h} style={{ padding:'10px 14px', textAlign:'left', fontSize:11, fontWeight:600, color:'#6b7280', textTransform:'uppercase', borderBottom:'1px solid #e5e7eb' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {afastFiltrados.map(a=>(
                <tr key={a.id} style={{ borderBottom:'1px solid #f3f4f6' }}>
                  <td style={{ padding:'10px 14px', fontWeight:500 }}>{a.motorista?.nome}</td>
                  <td style={{ padding:'10px 14px', color:'#6b7280' }}>{fmtData(a.dataInicio)}</td>
                  <td style={{ padding:'10px 14px', color:'#6b7280' }}>
                    {a.indeterminado ? <span style={{ color:'#d97706', fontSize:12 }}>Indeterminado</span> : a.dataRetorno ? fmtData(a.dataRetorno) : '—'}
                  </td>
                  <td style={{ padding:'10px 14px' }}>
                    <span style={{ padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:500, background:a.retornou?'#dcfce7':'#fee2e2', color:a.retornou?'#166534':'#991b1b' }}>
                      {a.retornou ? '✓ Retornou' : '⚠️ Afastado'}
                    </span>
                  </td>
                  <td style={{ padding:'10px 14px', color:'#6b7280', fontSize:12 }}>{a.observacao || '—'}</td>
                  <td style={{ padding:'10px 14px' }}>
                    <div style={{ display:'flex', gap:6 }}>
                      {!a.retornou && canEdit && (
                        <button onClick={()=>marcarRetornou(a.id)} style={{ padding:'4px 10px', border:'1px solid #86efac', borderRadius:6, fontSize:12, cursor:'pointer', background:'#dcfce7', color:'#166534' }}>✓ Retornou</button>
                      )}
                      {canEdit && (
                        <button onClick={()=>excluir('afastamento', a.id)} style={{ padding:'4px 10px', border:'1px solid #EB3238', borderRadius:6, fontSize:12, cursor:'pointer', background:'#fff', color:'#EB3238' }}>Excluir</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {afastFiltrados.length===0 && <tr><td colSpan={6} style={{ padding:40, textAlign:'center', color:'#9ca3af' }}>Nenhum afastamento encontrado</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'abandonos' && (
        <div style={{ background:'#fff', borderRadius:12, border:'1px solid #e5e7eb', overflow:'hidden' }}>
          <div style={{ padding:'10px 14px', borderBottom:'1px solid #e5e7eb', fontSize:12, color:'#6b7280' }}>
            {abandFiltrados.length} registro{abandFiltrados.length!==1?'s':''}
          </div>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
            <thead>
              <tr style={{ background:'#f9fafb' }}>
                {['Motorista','Data','Observação','Ações'].map(h=>(
                  <th key={h} style={{ padding:'10px 14px', textAlign:'left', fontSize:11, fontWeight:600, color:'#6b7280', textTransform:'uppercase', borderBottom:'1px solid #e5e7eb' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {abandFiltrados.map(a=>(
                <tr key={a.id} style={{ borderBottom:'1px solid #f3f4f6' }}>
                  <td style={{ padding:'10px 14px', fontWeight:500 }}>{a.motorista?.nome}</td>
                  <td style={{ padding:'10px 14px', color:'#6b7280' }}>{fmtData(a.data)}</td>
                  <td style={{ padding:'10px 14px', color:'#6b7280' }}>{a.observacao || '—'}</td>
                  <td style={{ padding:'10px 14px' }}>
                    {canEdit && (
                      <button onClick={()=>excluir('abandono', a.id)} style={{ padding:'4px 10px', border:'1px solid #EB3238', borderRadius:6, fontSize:12, cursor:'pointer', background:'#fff', color:'#EB3238' }}>Excluir</button>
                    )}
                  </td>
                </tr>
              ))}
              {abandFiltrados.length===0 && <tr><td colSpan={4} style={{ padding:40, textAlign:'center', color:'#9ca3af' }}>Nenhum abandono encontrado</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
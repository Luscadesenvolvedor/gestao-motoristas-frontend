import { useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';

const TABS = [
  { key: 'ferias', label: '🏖️ Férias / Atestado' },
  { key: 'afastamentos', label: '🏥 Afastamentos' },
  { key: 'abandonos', label: '🚪 Abandonos' },
];

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
  const canEdit = pode('ferias', 'escrita');

  useEffect(() => { carregarTudo(); }, []);

  async function carregarTudo() {
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

  const hoje = new Date();
  const emFerias = f => new Date(f.inicio) <= hoje && (!f.fim || new Date(f.fim) >= hoje);

  const inp = { width:'100%', padding:'8px 10px', border:'1px solid #d1d5db', borderRadius:8, fontSize:13, boxSizing:'border-box' };
  const lbl = { display:'block', fontSize:11, fontWeight:500, color:'#6b7280', marginBottom:4, textTransform:'uppercase' };
  const btn = (bg, color='#fff') => ({ padding:'8px 16px', background:bg, color, border:'none', borderRadius:8, fontSize:13, fontWeight:500, cursor:'pointer' });

  const calcDias = (inicio, fim) => {
    if (!inicio || !fim) return '—';
    const d = Math.ceil((new Date(fim) - new Date(inicio)) / (1000*60*60*24)) + 1;
    return `${d} dia${d!==1?'s':''}`;
  };

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <h2 style={{ fontSize:20, fontWeight:600, color:'#1a1a2e' }}>Férias e Ocorrências</h2>
        {canEdit && (
          <button onClick={()=>setShowForm(v=>!v)} style={btn('#7c3aed')}>+ Incluir</button>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', gap:4, marginBottom:16, background:'#f3f4f6', borderRadius:10, padding:4 }}>
        {TABS.map(t => (
          <button key={t.key} onClick={()=>{ setTab(t.key); setShowForm(false); }}
            style={{ flex:1, padding:'8px 12px', border:'none', borderRadius:8, fontSize:13, fontWeight:tab===t.key?500:400, cursor:'pointer', background:tab===t.key?'#fff':'transparent', color:tab===t.key?'#7c3aed':'#6b7280', boxShadow:tab===t.key?'0 1px 4px rgba(0,0,0,0.1)':'none' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Form Férias/Atestado */}
      {showForm && tab === 'ferias' && canEdit && (
        <div style={{ background:'#fff', borderRadius:12, padding:20, marginBottom:16, border:'1px solid #e5e7eb' }}>
          <h3 style={{ fontSize:14, fontWeight:600, marginBottom:14 }}>Novo registro</h3>
          <form onSubmit={salvarFerias}>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              <div>
                <label style={lbl}>Motorista</label>
                <select value={form.motoristaId} onChange={e=>setForm(f=>({...f,motoristaId:e.target.value}))} required style={inp}>
                  <option value="">Selecionar...</option>
                  {motoristas.map(m=><option key={m.id} value={m.id}>{m.nome}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Tipo</label>
                <select value={form.tipo} onChange={e=>setForm(f=>({...f,tipo:e.target.value}))} style={inp}>
                  <option value="ferias">Férias</option>
                  <option value="atestado">Atestado</option>
                </select>
              </div>
              <div>
                <label style={lbl}>Data início</label>
                <input type="date" value={form.inicio} onChange={e=>setForm(f=>({...f,inicio:e.target.value}))} required style={inp}/>
              </div>
              <div>
                <label style={lbl}>Data fim (opcional)</label>
                <input type="date" value={form.fim} onChange={e=>setForm(f=>({...f,fim:e.target.value}))} style={inp}/>
              </div>
              {form.inicio && form.fim && (
                <div style={{ gridColumn:'1/-1', background:'#f5f3ff', borderRadius:8, padding:'10px 14px', fontSize:13, color:'#7c3aed', fontWeight:500 }}>
                  📅 Total: {calcDias(form.inicio, form.fim)}
                </div>
              )}
              <div style={{ gridColumn:'1/-1' }}>
                <label style={lbl}>Observação</label>
                <textarea value={form.observacao} onChange={e=>setForm(f=>({...f,observacao:e.target.value}))} rows={2} style={{ ...inp, resize:'vertical' }}/>
              </div>
            </div>
            <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:16 }}>
              <button type="button" onClick={()=>setShowForm(false)} style={btn('#e5e7eb','#374151')}>Cancelar</button>
              <button type="submit" style={btn('#7c3aed')}>Salvar</button>
            </div>
          </form>
        </div>
      )}

      {/* Form Afastamento */}
      {showForm && tab === 'afastamentos' && canEdit && (
        <div style={{ background:'#fff', borderRadius:12, padding:20, marginBottom:16, border:'1px solid #e5e7eb' }}>
          <h3 style={{ fontSize:14, fontWeight:600, marginBottom:14 }}>Novo afastamento</h3>
          <form onSubmit={salvarAfastamento}>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              <div>
                <label style={lbl}>Motorista</label>
                <select value={formAfast.motoristaId} onChange={e=>setFormAfast(f=>({...f,motoristaId:e.target.value}))} required style={inp}>
                  <option value="">Selecionar...</option>
                  {motoristas.map(m=><option key={m.id} value={m.id}>{m.nome}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Data início</label>
                <input type="date" value={formAfast.dataInicio} onChange={e=>setFormAfast(f=>({...f,dataInicio:e.target.value}))} required style={inp}/>
              </div>
              <div>
                <label style={lbl}>Data retorno</label>
                <input type="date" value={formAfast.dataRetorno} onChange={e=>setFormAfast(f=>({...f,dataRetorno:e.target.value}))} disabled={formAfast.indeterminado} style={{ ...inp, opacity:formAfast.indeterminado?0.5:1 }}/>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:8, paddingTop:20 }}>
                <input type="checkbox" id="indet" checked={formAfast.indeterminado} onChange={e=>setFormAfast(f=>({...f,indeterminado:e.target.checked,dataRetorno:''}))} style={{ width:18, height:18, accentColor:'#7c3aed' }}/>
                <label htmlFor="indet" style={{ fontSize:13, cursor:'pointer' }}>Prazo indeterminado</label>
              </div>
              <div style={{ gridColumn:'1/-1' }}>
                <label style={lbl}>Observação</label>
                <textarea value={formAfast.observacao} onChange={e=>setFormAfast(f=>({...f,observacao:e.target.value}))} rows={2} style={{ ...inp, resize:'vertical' }}/>
              </div>
            </div>
            <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:16 }}>
              <button type="button" onClick={()=>setShowForm(false)} style={btn('#e5e7eb','#374151')}>Cancelar</button>
              <button type="submit" style={btn('#7c3aed')}>Salvar</button>
            </div>
          </form>
        </div>
      )}

      {/* Form Abandono */}
      {showForm && tab === 'abandonos' && canEdit && (
        <div style={{ background:'#fff', borderRadius:12, padding:20, marginBottom:16, border:'1px solid #e5e7eb' }}>
          <h3 style={{ fontSize:14, fontWeight:600, marginBottom:14 }}>Registrar abandono</h3>
          <form onSubmit={salvarAbandono}>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              <div>
                <label style={lbl}>Motorista</label>
                <select value={formAband.motoristaId} onChange={e=>setFormAband(f=>({...f,motoristaId:e.target.value}))} required style={inp}>
                  <option value="">Selecionar...</option>
                  {motoristas.map(m=><option key={m.id} value={m.id}>{m.nome}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Data</label>
                <input type="date" value={formAband.data} onChange={e=>setFormAband(f=>({...f,data:e.target.value}))} required style={inp}/>
              </div>
              <div style={{ gridColumn:'1/-1' }}>
                <label style={lbl}>Observação</label>
                <textarea value={formAband.observacao} onChange={e=>setFormAband(f=>({...f,observacao:e.target.value}))} rows={2} style={{ ...inp, resize:'vertical' }}/>
              </div>
            </div>
            <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:16 }}>
              <button type="button" onClick={()=>setShowForm(false)} style={btn('#e5e7eb','#374151')}>Cancelar</button>
              <button type="submit" style={btn('#dc2626')}>Registrar abandono</button>
            </div>
          </form>
        </div>
      )}

      {/* Tabela Férias/Atestado */}
      {tab === 'ferias' && (
        <div style={{ background:'#fff', borderRadius:12, border:'1px solid #e5e7eb', overflow:'hidden' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
            <thead>
              <tr style={{ background:'#f9fafb' }}>
                {['Motorista','Tipo','Início','Fim','Dias','Status','Observação',...(isAdmin?['Alteração']:[])].map(h=>(
                  <th key={h} style={{ padding:'10px 14px', textAlign:'left', fontSize:11, fontWeight:600, color:'#6b7280', textTransform:'uppercase', borderBottom:'1px solid #e5e7eb' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lista.map(f=>(
                <tr key={f.id} style={{ borderBottom:'1px solid #f3f4f6' }}>
                  <td style={{ padding:'10px 14px', fontWeight:500 }}>{f.motorista?.nome}</td>
                  <td style={{ padding:'10px 14px' }}>
                    <span style={{ padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:500, background:f.tipo==='ferias'?'#ede9fe':'#fef3c7', color:f.tipo==='ferias'?'#6d28d9':'#92400e' }}>
                      {f.tipo === 'ferias' ? '🏖️ Férias' : '🏥 Atestado'}
                    </span>
                  </td>
                  <td style={{ padding:'10px 14px', color:'#6b7280' }}>{new Date(f.inicio).toLocaleDateString('pt-BR')}</td>
                  <td style={{ padding:'10px 14px', color:'#6b7280' }}>{f.fim ? new Date(f.fim).toLocaleDateString('pt-BR') : '—'}</td>
                  <td style={{ padding:'10px 14px' }}>{calcDias(f.inicio, f.fim)}</td>
                  <td style={{ padding:'10px 14px' }}>
                    <span style={{ padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:500, background:emFerias(f)?'#dcfce7':'#f3f4f6', color:emFerias(f)?'#166534':'#6b7280' }}>
                      {emFerias(f) ? 'Ativo' : 'Encerrado'}
                    </span>
                  </td>
                  <td style={{ padding:'10px 14px', color:'#6b7280', fontSize:12 }}>{f.observacao || '—'}</td>
                  {isAdmin && <td style={{ padding:'10px 14px', fontSize:11, color:'#9ca3af' }}>{f.auditorias?.[0]?`${f.auditorias[0].usuario?.nome} — ${new Date(f.auditorias[0].criadoEm).toLocaleString('pt-BR')}`:'—'}</td>}
                </tr>
              ))}
              {lista.length===0 && <tr><td colSpan={8} style={{ padding:40, textAlign:'center', color:'#9ca3af' }}>Nenhum registro</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {/* Tabela Afastamentos */}
      {tab === 'afastamentos' && (
        <div style={{ background:'#fff', borderRadius:12, border:'1px solid #e5e7eb', overflow:'hidden' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
            <thead>
              <tr style={{ background:'#f9fafb' }}>
                {['Motorista','Início','Retorno','Status','Observação','Ações'].map(h=>(
                  <th key={h} style={{ padding:'10px 14px', textAlign:'left', fontSize:11, fontWeight:600, color:'#6b7280', textTransform:'uppercase', borderBottom:'1px solid #e5e7eb' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {afastamentos.map(a=>(
                <tr key={a.id} style={{ borderBottom:'1px solid #f3f4f6' }}>
                  <td style={{ padding:'10px 14px', fontWeight:500 }}>{a.motorista?.nome}</td>
                  <td style={{ padding:'10px 14px', color:'#6b7280' }}>{new Date(a.dataInicio).toLocaleDateString('pt-BR')}</td>
                  <td style={{ padding:'10px 14px', color:'#6b7280' }}>
                    {a.indeterminado ? <span style={{ color:'#d97706', fontSize:12 }}>Indeterminado</span> : a.dataRetorno ? new Date(a.dataRetorno).toLocaleDateString('pt-BR') : '—'}
                  </td>
                  <td style={{ padding:'10px 14px' }}>
                    <span style={{ padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:500, background:a.retornou?'#dcfce7':'#fee2e2', color:a.retornou?'#166534':'#991b1b' }}>
                      {a.retornou ? 'Retornou' : 'Afastado'}
                    </span>
                  </td>
                  <td style={{ padding:'10px 14px', color:'#6b7280', fontSize:12 }}>{a.observacao || '—'}</td>
                  <td style={{ padding:'10px 14px' }}>
                    {!a.retornou && canEdit && (
                      <button onClick={()=>marcarRetornou(a.id)} style={{ padding:'4px 12px', border:'1px solid #86efac', borderRadius:6, fontSize:12, cursor:'pointer', background:'#dcfce7', color:'#166534' }}>
                        ✓ Retornou
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {afastamentos.length===0 && <tr><td colSpan={6} style={{ padding:40, textAlign:'center', color:'#9ca3af' }}>Nenhum afastamento</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {/* Tabela Abandonos */}
      {tab === 'abandonos' && (
        <div style={{ background:'#fff', borderRadius:12, border:'1px solid #e5e7eb', overflow:'hidden' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
            <thead>
              <tr style={{ background:'#f9fafb' }}>
                {['Motorista','Data','Observação'].map(h=>(
                  <th key={h} style={{ padding:'10px 14px', textAlign:'left', fontSize:11, fontWeight:600, color:'#6b7280', textTransform:'uppercase', borderBottom:'1px solid #e5e7eb' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {abandonos.map(a=>(
                <tr key={a.id} style={{ borderBottom:'1px solid #f3f4f6' }}>
                  <td style={{ padding:'10px 14px', fontWeight:500 }}>{a.motorista?.nome}</td>
                  <td style={{ padding:'10px 14px', color:'#6b7280' }}>{new Date(a.data).toLocaleDateString('pt-BR')}</td>
                  <td style={{ padding:'10px 14px', color:'#6b7280' }}>{a.observacao || '—'}</td>
                </tr>
              ))}
              {abandonos.length===0 && <tr><td colSpan={3} style={{ padding:40, textAlign:'center', color:'#9ca3af' }}>Nenhum abandono registrado</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
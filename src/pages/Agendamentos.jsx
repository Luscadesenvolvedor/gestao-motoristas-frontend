import { useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';

const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

export default function Agendamentos() {
  const { usuario, isAdmin } = useAuth();
  const [perfilVisto, setPerfilVisto] = useState(1);
  const [lista, setLista] = useState([]);
  const [listaP2, setListaP2] = useState([]);
  const [listaP3, setListaP3] = useState([]);
  const [motoristas, setMotoristas] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [guiches, setGuiches] = useState({ 1: 'Perfil 1', 2: 'Perfil 2', 3: 'Perfil 3' });
  const [vincularModal, setVincularModal] = useState(null); // perfil número
  const [vincularUserId, setVincularUserId] = useState('');
  const [mesAtual, setMesAtual] = useState(() => { const h = new Date(); return `${h.getFullYear()}-${String(h.getMonth()+1).padStart(2,'0')}`; });
  const [diaSelecionado, setDiaSelecionado] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ motoristaId:'', hora:'08:00', meses:[] });

  useEffect(() => {
    api.get('/motoristas').then(r => setMotoristas(r.data));
    if (isAdmin) carregarUsuarios();
  }, [isAdmin]);

  async function carregarUsuarios() {
    const r = await api.get('/usuarios');
    setUsuarios(r.data);
    const mapa = { 1: 'Perfil 1', 2: 'Perfil 2', 3: 'Perfil 3' };
    r.data.forEach(u => {
      if (u.papel === 'guiche' && u.perfilAgendamento) {
        mapa[u.perfilAgendamento] = u.nome;
      }
    });
    setGuiches(mapa);
  }

  async function salvarVinculo() {
    if (!vincularModal || !vincularUserId) return;
    try {
      // desvincula qualquer usuário que já tenha esse perfil
      const atual = usuarios.find(u => u.perfilAgendamento === vincularModal);
      if (atual && atual.id !== vincularUserId) {
        await api.patch(`/usuarios/${atual.id}/perfil-agendamento`, { perfilAgendamento: null });
      }
      await api.patch(`/usuarios/${vincularUserId}/perfil-agendamento`, { perfilAgendamento: vincularModal });
      toast.success('Usuário vinculado!');
      setVincularModal(null);
      setVincularUserId('');
      carregarUsuarios();
    } catch { toast.error('Erro ao vincular'); }
  }

  useEffect(() => { carregar(); }, [mesAtual, perfilVisto]);

  async function carregar() {
    try {
      if (isAdmin) {
        const [r1, r2, r3] = await Promise.all([
          api.get('/agendamentos', { params: { perfil: 1, mes: mesAtual } }),
          api.get('/agendamentos', { params: { perfil: 2, mes: mesAtual } }),
          api.get('/agendamentos', { params: { perfil: 3, mes: mesAtual } })
        ]);
        setLista(r1.data);
        setListaP2(r2.data);
        setListaP3(r3.data);
      } else {
        const { data } = await api.get('/agendamentos', { params: { mes: mesAtual } });
        setLista(data);
      }
    } catch {}
  }

  function diasDoMes() {
    const [ano, mes] = mesAtual.split('-').map(Number);
    const total = new Date(ano, mes, 0).getDate();
    const primeiroDia = new Date(ano, mes - 1, 1).getDay();
    return { total, primeiroDia };
  }

  function agendamentosDoDia(listaRef, dia) {
    const [ano, mes] = mesAtual.split('-').map(Number);
    return listaRef.filter(a => {
      const d = new Date(a.dataHora);
      return d.getDate() === dia && d.getMonth() === mes - 1 && d.getFullYear() === ano;
    });
  }

  function clicarDia(dia) {
    setDiaSelecionado(dia === diaSelecionado ? null : dia);
    setForm({ motoristaId:'', hora:'08:00', meses:[] });
    setShowForm(false);
  }

  async function salvar(e) {
    e.preventDefault();
    try {
      const [ano, mes] = mesAtual.split('-').map(Number);
      const dataHora = new Date(ano, mes - 1, diaSelecionado, ...form.hora.split(':').map(Number));
      await api.post('/agendamentos', {
        motoristaId: form.motoristaId,
        dataHora: dataHora.toISOString(),
        meses: form.meses,
        perfil: isAdmin ? perfilVisto : usuario.perfilAgendamento
      });
      toast.success('Agendamento criado!');
      setShowForm(false);
      carregar();
    } catch {}
  }

  async function excluir(id) {
    if (!confirm('Remover este agendamento?')) return;
    await api.delete(`/agendamentos/${id}`);
    toast.success('Removido');
    carregar();
  }

  function toggleMes(m) {
    setForm(f => ({
      ...f,
      meses: f.meses.includes(m) ? f.meses.filter(x => x !== m) : [...f.meses, m]
    }));
  }

  const { total, primeiroDia } = diasDoMes();
  const [anoAtual, mesAtualNum] = mesAtual.split('-').map(Number);
  const listaExibida = isAdmin ? (perfilVisto === 1 ? lista : perfilVisto === 2 ? listaP2 : listaP3) : lista;
  const agsDiaSelecionado = diaSelecionado ? agendamentosDoDia(listaExibida, diaSelecionado) : [];

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <div>
          <h2 style={{ fontSize:20, fontWeight:600, color:'#1a1a2e' }}>Agendamentos</h2>
          <p style={{ fontSize:13, color:'#6b7280', marginTop:2 }}>
            {isAdmin ? guiches[perfilVisto] : (usuario?.nome ?? '—')}
          </p>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <button onClick={() => {
            const d = new Date(anoAtual, mesAtualNum - 2, 1);
            setMesAtual(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`);
          }} style={{ padding:'6px 12px', border:'1px solid #d1d5db', borderRadius:8, cursor:'pointer', background:'#fff', fontSize:16 }}>‹</button>
          <span style={{ fontWeight:600, fontSize:14 }}>{MESES[mesAtualNum-1]} {anoAtual}</span>
          <button onClick={() => {
            const d = new Date(anoAtual, mesAtualNum, 1);
            setMesAtual(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`);
          }} style={{ padding:'6px 12px', border:'1px solid #d1d5db', borderRadius:8, cursor:'pointer', background:'#fff', fontSize:16 }}>›</button>
        </div>
      </div>

      {isAdmin && (
        <div style={{ display:'flex', gap:8, marginBottom:16, flexWrap:'wrap' }}>
          {[1,2,3].map(p => (
            <div key={p} style={{ display:'flex', alignItems:'center', gap:0 }}>
              <button onClick={() => setPerfilVisto(p)}
                style={{ padding:'8px 20px', border:'1px solid '+(perfilVisto===p?'#EB3238':'#d1d5db'), borderRadius:'8px 0 0 8px', fontSize:13, cursor:'pointer', background:perfilVisto===p?'#EB3238':'#fff', color:perfilVisto===p?'#fff':'#374151', fontWeight:perfilVisto===p?600:400 }}>
                {guiches[p]}
              </button>
              <button onClick={() => { setVincularModal(p); setVincularUserId(String(usuarios.find(u => u.perfilAgendamento === p)?.id || '')); }}
                title="Vincular usuário"
                style={{ padding:'8px 10px', border:'1px solid '+(perfilVisto===p?'#EB3238':'#d1d5db'), borderLeft:'none', borderRadius:'0 8px 8px 0', fontSize:12, cursor:'pointer', background:perfilVisto===p?'#c81d22':'#f9fafb', color:perfilVisto===p?'#fff':'#6b7280' }}>
                <i className="ti ti-user-plus"></i>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Calendário */}
      <div style={{ background:'#fff', borderRadius:12, border:'1px solid #e5e7eb', padding:16, marginBottom:16 }}>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:4, marginBottom:8 }}>
          {['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'].map(d => (
            <div key={d} style={{ textAlign:'center', fontSize:11, fontWeight:600, color:'#6b7280', padding:'4px 0' }}>{d}</div>
          ))}
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:4 }}>
          {Array.from({ length: primeiroDia }).map((_, i) => <div key={`e${i}`} />)}
          {Array.from({ length: total }).map((_, i) => {
            const dia = i + 1;
            const ags = agendamentosDoDia(listaExibida, dia);
            const hoje = new Date();
            const ehHoje = dia === hoje.getDate() && mesAtualNum === hoje.getMonth()+1 && anoAtual === hoje.getFullYear();
            const selecionado = dia === diaSelecionado;
            return (
              <div key={dia} onClick={() => clicarDia(dia)}
                style={{ minHeight:60, padding:6, border:'1px solid '+(selecionado?'#EB3238':ehHoje?'#EB3238':'#e5e7eb'), borderRadius:8, cursor:'pointer', background:selecionado?'#fff0f0':ehHoje?'#fff0f0':'#fafafa', transition:'background 0.15s', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:4 }}
                onMouseEnter={e => e.currentTarget.style.background='#ffe4e4'}
                onMouseLeave={e => e.currentTarget.style.background=selecionado?'#fff0f0':ehHoje?'#fff0f0':'#fafafa'}>
                <div style={{ fontSize:13, fontWeight:ehHoje||selecionado?700:400, color:ehHoje||selecionado?'#EB3238':'#374151' }}>{dia}</div>
                {ags.length > 0 && (
                  <div style={{ fontSize:10, background:'#EB3238', color:'#fff', borderRadius:20, padding:'2px 8px', fontWeight:600 }}>
                    {ags.length}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Lista do dia selecionado */}
      {diaSelecionado && (
        <div style={{ background:'#fff', borderRadius:12, border:'1px solid #e5e7eb', padding:16, marginBottom:16 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
            <h3 style={{ fontSize:14, fontWeight:600, color:'#1a1a2e' }}>
              Dia {diaSelecionado}/{mesAtualNum}/{anoAtual} — {agsDiaSelecionado.length} agendamento(s)
            </h3>
            <button onClick={() => setShowForm(v=>!v)}
              style={{ padding:'6px 14px', background:'#EB3238', color:'#fff', border:'none', borderRadius:8, fontSize:12, fontWeight:500, cursor:'pointer' }}>
              + Novo
            </button>
          </div>

          {agsDiaSelecionado.length === 0 && !showForm && (
            <p style={{ fontSize:13, color:'#9ca3af' }}>Nenhum agendamento neste dia.</p>
          )}

          {agsDiaSelecionado.map(a => (
            <div key={a.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 12px', borderRadius:8, border:'1px solid #f3f4f6', marginBottom:6, background:'#fafafa' }}>
              <div>
                <span style={{ fontWeight:500, fontSize:13 }}>{a.motorista?.nome}</span>
                <span style={{ fontSize:12, color:'#6b7280', marginLeft:10 }}>
                  {new Date(a.dataHora).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}
                </span>
                {a.meses?.length > 0 && (
                  <span style={{ fontSize:11, color:'#9ca3af', marginLeft:8 }}>({a.meses.join(', ')})</span>
                )}
              </div>
              <button onClick={() => excluir(a.id)}
                style={{ padding:'3px 10px', border:'1px solid #EB3238', borderRadius:6, fontSize:11, cursor:'pointer', background:'#fff', color:'#EB3238' }}>
                Excluir
              </button>
            </div>
          ))}

          {/* Formulário inline */}
          {showForm && (
            <div style={{ marginTop:12, padding:16, border:'1px solid #e5e7eb', borderRadius:8, background:'#f9fafb' }}>
              <form onSubmit={salvar}>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}>
                  <div>
                    <label style={lbl}>Motorista</label>
                    <select value={form.motoristaId} onChange={e=>setForm(f=>({...f,motoristaId:e.target.value}))} required style={inp}>
                      <option value="">Selecionar...</option>
                      {motoristas.map(m=><option key={m.id} value={m.id}>{m.nome}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={lbl}>Hora</label>
                    <input type="time" value={form.hora} onChange={e=>setForm(f=>({...f,hora:e.target.value}))} required style={inp}/>
                  </div>
                </div>
                <div style={{ marginBottom:12 }}>
                  <label style={lbl}>Meses de acerto</label>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:6, marginTop:4 }}>
                    {MESES.map(m => (
                      <button type="button" key={m} onClick={()=>toggleMes(m)}
                        style={{ padding:'5px 4px', border:'1px solid '+(form.meses.includes(m)?'#EB3238':'#d1d5db'), borderRadius:6, fontSize:11, cursor:'pointer', background:form.meses.includes(m)?'#EB3238':'#fff', color:form.meses.includes(m)?'#fff':'#374151' }}>
                        {m}
                      </button>
                    ))}
                  </div>
                </div>
                <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
                  <button type="button" onClick={()=>setShowForm(false)} style={{ padding:'7px 14px', border:'1px solid #d1d5db', borderRadius:8, fontSize:13, cursor:'pointer', background:'#fff' }}>Cancelar</button>
                  <button type="submit" style={{ padding:'7px 16px', background:'#EB3238', color:'#fff', border:'none', borderRadius:8, fontSize:13, fontWeight:500, cursor:'pointer' }}>Salvar</button>
                </div>
              </form>
            </div>
          )}
        </div>
      )}

      {/* Resumo admin */}
      {isAdmin && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:16 }}>
          {[{perfil:1, dados: lista},{perfil:2, dados: listaP2},{perfil:3, dados: listaP3}].map(({perfil, dados}) => (
            <div key={perfil} style={{ background:'#fff', borderRadius:12, border:'1px solid #e5e7eb', padding:16 }}>
              <h3 style={{ fontSize:13, fontWeight:600, color:'#EB3238', marginBottom:10 }}>{guiches[perfil]} — {dados.length} agendamento(s)</h3>
              {dados.length === 0 && <p style={{ fontSize:12, color:'#9ca3af' }}>Nenhum agendamento neste mês</p>}
              {dados.map(a => (
                <div key={a.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'6px 0', borderBottom:'1px solid #f3f4f6', fontSize:12 }}>
                  <span style={{ fontWeight:500 }}>{a.motorista?.nome}</span>
                  <span style={{ color:'#6b7280' }}>{new Date(a.dataHora).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Modal vincular usuário ao perfil */}
      {vincularModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.4)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <div style={{ background:'#fff', borderRadius:12, padding:28, width:340, boxShadow:'0 8px 32px rgba(0,0,0,0.15)' }}>
            <h3 style={{ fontSize:15, fontWeight:600, marginBottom:4 }}>Vincular usuário</h3>
            <p style={{ fontSize:12, color:'#9ca3af', marginBottom:16 }}>Perfil {vincularModal} — {guiches[vincularModal]}</p>
            <div style={{ marginBottom:20 }}>
              <label style={{ fontSize:12, fontWeight:600, color:'#374151', display:'block', marginBottom:5 }}>Usuário (guichê)</label>
              <select value={vincularUserId} onChange={e => setVincularUserId(e.target.value)}
                style={{ width:'100%', padding:'9px 12px', border:'1px solid #d1d5db', borderRadius:8, fontSize:13, outline:'none' }}>
                <option value="">Selecione...</option>
                {usuarios.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.nome} {u.perfilAgendamento ? `(Perfil ${u.perfilAgendamento})` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
              <button onClick={() => setVincularModal(null)}
                style={{ padding:'8px 16px', border:'1px solid #e5e7eb', borderRadius:8, background:'#f9fafb', cursor:'pointer', fontSize:13 }}>
                Cancelar
              </button>
              <button onClick={salvarVinculo} disabled={!vincularUserId}
                style={{ padding:'8px 16px', border:'none', borderRadius:8, background: vincularUserId ? '#EB3238' : '#9ca3af', color:'#fff', cursor: vincularUserId ? 'pointer' : 'not-allowed', fontSize:13, fontWeight:600 }}>
                Vincular
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const lbl = { display:'block', fontSize:11, fontWeight:500, color:'#6b7280', marginBottom:4, textTransform:'uppercase', letterSpacing:'0.5px' };
const inp = { width:'100%', padding:'8px 10px', border:'1px solid #d1d5db', borderRadius:8, fontSize:13, boxSizing:'border-box' };
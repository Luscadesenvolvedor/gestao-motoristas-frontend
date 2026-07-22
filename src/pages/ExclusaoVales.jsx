import { useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';

export default function ExclusaoVales() {
  const { usuario, isAdmin } = useAuth();
  const [lista, setLista] = useState([]);
  const [motoristas, setMotoristas] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [showFeitos, setShowFeitos] = useState(false);
  const [form, setForm] = useState({ numeroVale:'', dataVale:'', motoristaId:'', motivo:'' });

  useEffect(() => { carregar(); api.get('/motoristas').then(r=>setMotoristas(r.data)); }, []);

  async function carregar() { try { const { data } = await api.get('/exclusoes'); setLista(data); } catch {} }

  async function salvar(e) {
    e.preventDefault();
    try {
      await api.post('/exclusoes', form);
      toast.success('Exclusão registrada');
      setShowForm(false);
      setForm({ numeroVale:'', dataVale:'', motoristaId:'', motivo:'' });
      carregar();
    } catch {}
  }

  async function marcarFeito(id, feito) {
    try {
      await api.patch(`/exclusoes/${id}/feito`, { feito });
      setLista(l => l.map(x => x.id === id ? { ...x, feito } : x));
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Sem permissão');
    }
  }

  async function excluir(id) {
    if (!window.confirm('Excluir esta solicitação de exclusão de vale?')) return;
    try {
      await api.delete(`/exclusoes/${id}`);
      toast.success('Excluído com sucesso');
      carregar();
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Erro ao excluir');
    }
  }

  const pendentes = lista.filter(x => !x.feito);
  const feitos = lista.filter(x => x.feito);

  const inp = { width:'100%', padding:'8px 10px', border:'1px solid #d1d5db', borderRadius:8, fontSize:13, boxSizing:'border-box' };
  const lbl = { display:'block', fontSize:11, fontWeight:500, color:'#6b7280', marginBottom:4, textTransform:'uppercase' };
  const btn = (bg, color='#fff') => ({ padding:'8px 16px', background:bg, color, border:'none', borderRadius:8, fontSize:13, fontWeight:500, cursor:'pointer' });

  const ItemCard = ({ item }) => (
    <div style={{ background: item.feito ? '#f9fafb' : '#fff', borderRadius:12, padding:16, border:'1px solid #e5e7eb', display:'flex', alignItems:'flex-start', gap:14 }}>
      {isAdmin
        ? <input type="checkbox" checked={item.feito} onChange={e=>marcarFeito(item.id, e.target.checked)}
            style={{ width:18, height:18, marginTop:2, accentColor:'#EB3238', flexShrink:0, cursor:'pointer' }}/>
        : <div style={{ width:18, height:18, marginTop:2, flexShrink:0, border:'1px solid #d1d5db', borderRadius:3, background: item.feito ? '#EB3238' : '#fff', display:'flex', alignItems:'center', justifyContent:'center' }}>
            {item.feito && <span style={{ color:'#fff', fontSize:12, lineHeight:1 }}>✓</span>}
          </div>
      }
      <div style={{ flex:1 }}>
        <div style={{ fontWeight:500, fontSize:14, textDecoration:item.feito?'line-through':'none', color:item.feito?'#9ca3af':'#1a1a2e' }}>
          Vale #{item.numeroVale} — {item.motorista?.nome}
        </div>
        <div style={{ fontSize:12, color:'#6b7280', marginTop:4 }}>
          Motivo: {item.motivo} · {new Date(item.dataVale).toLocaleDateString('pt-BR')} · Solicitante: {item.solicitante?.nome}
        </div>
        {isAdmin && item.auditorias?.[0] && (
          <div style={{ fontSize:11, color:'#9ca3af', marginTop:3 }}>
            {item.auditorias[0].usuario.nome} — {new Date(item.auditorias[0].criadoEm).toLocaleString('pt-BR')}
          </div>
        )}
      </div>
      <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:6, flexShrink:0 }}>
        {item.feito && <span style={{ fontSize:11, padding:'3px 10px', background:'#dcfce7', color:'#166534', borderRadius:20, fontWeight:500 }}>✓ Feito</span>}
        {isAdmin && <button onClick={()=>excluir(item.id)} style={{ padding:'3px 10px', background:'#fee2e2', color:'#dc2626', border:'none', borderRadius:20, fontSize:11, fontWeight:500, cursor:'pointer' }}>Excluir</button>}
      </div>
    </div>
  );

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <h2 style={{ fontSize:20, fontWeight:600, color:'#1a1a2e' }}>Exclusão de Vales</h2>
        <button onClick={()=>setShowForm(v=>!v)} style={btn('#EB3238')}>+ Incluir</button>
      </div>

      {showForm && (
        <div style={{ background:'#fff', borderRadius:12, padding:20, marginBottom:16, border:'1px solid #e5e7eb' }}>
          <form onSubmit={salvar}>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              <div><label style={lbl}>Solicitante</label><input value={usuario?.nome} readOnly style={{ ...inp, background:'#f9fafb' }}/></div>
              <div><label style={lbl}>Número do vale</label><input value={form.numeroVale} onChange={e=>setForm(f=>({...f,numeroVale:e.target.value}))} required style={inp}/></div>
              <div><label style={lbl}>Data do vale</label><input type="date" value={form.dataVale} onChange={e=>setForm(f=>({...f,dataVale:e.target.value}))} required style={inp}/></div>
              <div>
                <label style={lbl}>Motorista</label>
                <select value={form.motoristaId} onChange={e=>setForm(f=>({...f,motoristaId:e.target.value}))} required style={inp}>
                  <option value="">Selecionar...</option>
                  {motoristas.map(m=><option key={m.id} value={m.id}>{m.nome}</option>)}
                </select>
              </div>
              <div style={{ gridColumn:'1/-1' }}>
                <label style={lbl}>Motivo</label>
                <textarea value={form.motivo} onChange={e=>setForm(f=>({...f,motivo:e.target.value}))} required rows={3} style={{ ...inp, resize:'vertical' }}/>
              </div>
            </div>
            <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:16 }}>
              <button type="button" onClick={()=>setShowForm(false)} style={btn('#e5e7eb','#374151')}>Cancelar</button>
              <button type="submit" style={btn('#EB3238')}>Salvar</button>
            </div>
          </form>
        </div>
      )}

      {/* Pendentes */}
      <div style={{ marginBottom:16 }}>
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12 }}>
          <span style={{ fontSize:14, fontWeight:600, color:'#1a1a2e' }}>Pendentes</span>
          <span style={{ background:'#fef3c7', color:'#92400e', borderRadius:20, padding:'2px 10px', fontSize:12, fontWeight:500 }}>{pendentes.length}</span>
        </div>
        {pendentes.length === 0 ? (
          <div style={{ textAlign:'center', padding:30, color:'#9ca3af', fontSize:13, background:'#fff', borderRadius:12, border:'1px solid #e5e7eb' }}>
            Nenhum vale pendente 🎉
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {pendentes.map(item => <ItemCard key={item.id} item={item} />)}
          </div>
        )}
      </div>

      {/* Feitos */}
      <div>
        <button onClick={()=>setShowFeitos(v=>!v)}
          style={{ display:'flex', alignItems:'center', gap:8, background:'none', border:'none', cursor:'pointer', padding:'8px 0', marginBottom: showFeitos ? 12 : 0 }}>
          <span style={{ fontSize:14, fontWeight:600, color:'#6b7280' }}>
            {showFeitos ? '▼' : '▶'} Concluídos
          </span>
          <span style={{ background:'#dcfce7', color:'#166534', borderRadius:20, padding:'2px 10px', fontSize:12, fontWeight:500 }}>{feitos.length}</span>
        </button>

        {showFeitos && (
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {feitos.length === 0 ? (
              <div style={{ textAlign:'center', padding:30, color:'#9ca3af', fontSize:13, background:'#fff', borderRadius:12, border:'1px solid #e5e7eb' }}>
                Nenhum vale concluído ainda
              </div>
            ) : (
              feitos.map(item => <ItemCard key={item.id} item={item} />)
            )}
          </div>
        )}
      </div>
    </div>
  );
}
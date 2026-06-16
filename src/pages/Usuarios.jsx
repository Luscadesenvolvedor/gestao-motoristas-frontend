import { useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';

const vazio = { nome:'', email:'', senha:'', papel:'guiche' };
const PAPEIS = ['admin','guiche','acertador','dgp','financeiro'];
const PILL_CORES = { admin:'#EB3238', guiche:'#0891b2', acertador:'#d97706', dgp:'#dc2626', financeiro:'#16a34a' };

const ABAS = [
  { key:'usuarios',     label:'Usuários' },
  { key:'motoristas',   label:'Motoristas' },
  { key:'solicitacoes', label:'Solicitações' },
  { key:'exclusoes',    label:'Exclusão de Vales' },
  { key:'folgas',       label:'Folgas' },
  { key:'ferias',       label:'Férias' },
  { key:'agendamentos', label:'Agendamento' },
  { key:'financeiro',   label:'Controle Financeiro' },
];

const PERMISSOES_PADRAO = {
  admin:      { leitura: ['usuarios','motoristas','solicitacoes','exclusoes','folgas','ferias','agendamentos','financeiro'], escrita: ['usuarios','motoristas','solicitacoes','exclusoes','folgas','ferias','agendamentos','financeiro'] },
  guiche:     { leitura: ['motoristas','solicitacoes','agendamentos'], escrita: ['motoristas','solicitacoes','agendamentos'] },
  acertador:  { leitura: ['motoristas','solicitacoes','exclusoes','financeiro'], escrita: ['motoristas','solicitacoes','exclusoes','financeiro'] },
  dgp:        { leitura: ['motoristas','solicitacoes','ferias'], escrita: ['motoristas','solicitacoes','ferias'] },
  financeiro: { leitura: ['motoristas','solicitacoes','exclusoes','folgas','ferias','financeiro'], escrita: ['motoristas','solicitacoes','folgas'] },
};

export default function Usuarios() {
  const { isAdmin, usuario: eu } = useAuth();
  const [lista, setLista] = useState([]);
  const [form, setForm] = useState(vazio);
  const [editId, setEditId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [showSenha, setShowSenha] = useState(false);
  const [showTrocarSenha, setShowTrocarSenha] = useState(false);
  const [senhaAtual, setSenhaAtual] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [verSenha, setVerSenha] = useState(false);
  const [permEdit, setPermEdit] = useState(null);
  const [permissoes, setPermissoes] = useState({ leitura:[], escrita:[] });
  const [salvandoPerm, setSalvandoPerm] = useState(false);
  const [perfilEdit, setPerfilEdit] = useState(null);
  const [perfilSelecionado, setPerfilSelecionado] = useState('');
  const [perfilFinEdit, setPerfilFinEdit] = useState(null);
  const [perfilFinSelecionado, setPerfilFinSelecionado] = useState('');

  useEffect(() => { carregar(); }, []);

  async function carregar() {
    const { data } = await api.get('/usuarios');
    setLista(data);
  }

  async function salvar(e) {
    e.preventDefault();
    try {
      const payload = { nome: form.nome, email: form.email, papel: form.papel, senha: form.senha };
      if (editId) { await api.put(`/usuarios/${editId}`, payload); toast.success('Usuário atualizado'); }
      else { await api.post('/usuarios', payload); toast.success('Usuário criado'); }
      setForm(vazio); setEditId(null); setShowForm(false); carregar();
    } catch (err) {
      const msg = err?.response?.data?.error || 'Erro ao salvar usuário';
      toast.error(msg);
    }
  }

  async function excluir(id, nome) {
    if (!confirm(`Excluir o usuário ${nome}?`)) return;
    try {
      await api.delete(`/usuarios/${id}`);
      toast.success('Usuário excluído'); carregar();
    } catch {}
  }

  async function trocarSenha(e) {
    e.preventDefault();
    try {
      await api.patch('/usuarios/trocar-senha', { senhaAtual, novaSenha });
      toast.success('Senha alterada com sucesso!');
      setShowTrocarSenha(false); setSenhaAtual(''); setNovaSenha('');
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Erro ao trocar senha');
    }
  }

  function abrirPermissoes(u) {
    const padrao = PERMISSOES_PADRAO[u.papel] || { leitura:[], escrita:[] };
    const atual = u.permissoes || padrao;
    setPermissoes({ leitura: atual.leitura || [], escrita: atual.escrita || [] });
    setPermEdit(u);
  }

  function togglePerm(tipo, key) {
    setPermissoes(p => {
      const lista = p[tipo].includes(key) ? p[tipo].filter(x=>x!==key) : [...p[tipo], key];
      if (tipo === 'leitura' && !lista.includes(key)) {
        return { leitura: lista, escrita: p.escrita.filter(x=>x!==key) };
      }
      if (tipo === 'escrita' && lista.includes(key)) {
        return { escrita: lista, leitura: p.leitura.includes(key) ? p.leitura : [...p.leitura, key] };
      }
      return { ...p, [tipo]: lista };
    });
  }

  async function salvarPermissoes() {
    setSalvandoPerm(true);
    try {
      await api.patch(`/usuarios/${permEdit.id}/permissoes`, { permissoes });
      toast.success('Permissões salvas!');
      setPermEdit(null); carregar();
    } catch {
      toast.error('Erro ao salvar permissões');
    } finally {
      setSalvandoPerm(false);
    }
  }

  function abrirPerfilAgendamento(u) {
    setPerfilEdit(u);
    setPerfilSelecionado(u.perfilAgendamento ? String(u.perfilAgendamento) : '');
  }

  async function salvarPerfil() {
    try {
      await api.patch(`/usuarios/${perfilEdit.id}/perfil-agendamento`, {
        perfilAgendamento: perfilSelecionado ? parseInt(perfilSelecionado) : null
      });
      toast.success('Perfil de agendamento salvo!');
      setPerfilEdit(null); carregar();
    } catch { toast.error('Erro ao salvar perfil'); }
  }

  function abrirPerfilFinanceiro(u) {
    setPerfilFinEdit(u);
    setPerfilFinSelecionado(u.perfilFinanceiro ? String(u.perfilFinanceiro) : '');
  }

  async function salvarPerfilFinanceiro() {
    try {
      await api.patch(`/usuarios/${perfilFinEdit.id}/perfil-financeiro`, {
        perfilFinanceiro: perfilFinSelecionado ? parseInt(perfilFinSelecionado) : null
      });
      toast.success('Perfil financeiro salvo!');
      setPerfilFinEdit(null); carregar();
    } catch { toast.error('Erro ao salvar perfil financeiro'); }
  }

  const inp = { width:'100%', padding:'8px 10px', border:'1px solid #d1d5db', borderRadius:8, fontSize:13, boxSizing:'border-box' };
  const lbl = { display:'block', fontSize:11, fontWeight:500, color:'#6b7280', marginBottom:4, textTransform:'uppercase' };
  const btn = (bg, color='#fff') => ({ padding:'8px 20px', background:bg, color, border:'none', borderRadius:8, fontSize:13, fontWeight:500, cursor:'pointer' });

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <h2 style={{ fontSize:20, fontWeight:600, color:'#1a1a2e' }}>Usuários</h2>
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={()=>setShowTrocarSenha(v=>!v)} style={{ ...btn('#e5e7eb','#374151'), fontSize:12 }}>🔑 Trocar minha senha</button>
          <button onClick={()=>{ setForm(vazio); setEditId(null); setShowForm(v=>!v); }} style={btn('#EB3238')}>+ Incluir usuário</button>
        </div>
      </div>

      {showTrocarSenha && (
        <div style={{ background:'#fff', borderRadius:12, padding:20, marginBottom:16, border:'1px solid #e5e7eb' }}>
          <h3 style={{ fontSize:14, fontWeight:600, marginBottom:14 }}>Trocar minha senha</h3>
          <form onSubmit={trocarSenha}>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              <div>
                <label style={lbl}>Senha atual</label>
                <div style={{ position:'relative' }}>
                  <input type={verSenha?'text':'password'} value={senhaAtual} onChange={e=>setSenhaAtual(e.target.value)} required style={inp}/>
                  <button type="button" onClick={()=>setVerSenha(v=>!v)} style={{ position:'absolute', right:8, top:8, background:'none', border:'none', cursor:'pointer', fontSize:16 }}>{verSenha?'🙈':'👁️'}</button>
                </div>
              </div>
              <div>
                <label style={lbl}>Nova senha</label>
                <input type="password" value={novaSenha} onChange={e=>setNovaSenha(e.target.value)} required style={inp}/>
              </div>
            </div>
            <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:12 }}>
              <button type="button" onClick={()=>setShowTrocarSenha(false)} style={btn('#e5e7eb','#374151')}>Cancelar</button>
              <button type="submit" style={btn('#EB3238')}>Salvar nova senha</button>
            </div>
          </form>
        </div>
      )}

      {showForm && (
        <div style={{ background:'#fff', borderRadius:12, padding:20, marginBottom:16, border:'1px solid #e5e7eb' }}>
          <h3 style={{ fontSize:14, fontWeight:600, marginBottom:14 }}>{editId?'Editar':'Novo'} usuário</h3>
          <form onSubmit={salvar}>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              <div><label style={lbl}>Nome</label><input value={form.nome} onChange={e=>setForm(f=>({...f,nome:e.target.value}))} required style={inp}/></div>
              <div><label style={lbl}>E-mail</label><input type="email" value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))} required style={inp}/></div>
              <div>
                <label style={lbl}>{editId?'Nova senha (opcional)':'Senha'}</label>
                <div style={{ position:'relative' }}>
                  <input type={showSenha?'text':'password'} value={form.senha} onChange={e=>setForm(f=>({...f,senha:e.target.value}))} required={!editId} style={inp}/>
                  <button type="button" onClick={()=>setShowSenha(v=>!v)} style={{ position:'absolute', right:8, top:8, background:'none', border:'none', cursor:'pointer', fontSize:16 }}>{showSenha?'🙈':'👁️'}</button>
                </div>
              </div>
              <div>
                <label style={lbl}>Papel</label>
                <select value={form.papel} onChange={e=>setForm(f=>({...f,papel:e.target.value}))} style={inp}>
                  {PAPEIS.map(p=><option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:16 }}>
              <button type="button" onClick={()=>setShowForm(false)} style={btn('#e5e7eb','#374151')}>Cancelar</button>
              <button type="submit" style={btn('#EB3238')}>Salvar</button>
            </div>
          </form>
        </div>
      )}

      {permEdit && (
        <div style={{ background:'#fff', borderRadius:12, padding:20, marginBottom:16, border:'1px solid #e5e7eb' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
            <h3 style={{ fontSize:14, fontWeight:600 }}>
              Permissões — {permEdit.nome}
              <span style={{ fontSize:12, color:'#EB3238', marginLeft:8 }}>({permEdit.papel})</span>
            </h3>
            <button onClick={()=>setPermEdit(null)} style={btn('#e5e7eb','#374151')}>Fechar</button>
          </div>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
            <thead>
              <tr style={{ background:'#f9fafb' }}>
                <th style={{ padding:'8px 12px', textAlign:'left', fontSize:11, color:'#6b7280', borderBottom:'1px solid #e5e7eb' }}>Aba</th>
                <th style={{ padding:'8px 12px', textAlign:'center', fontSize:11, color:'#6b7280', borderBottom:'1px solid #e5e7eb' }}>Visualizar</th>
                <th style={{ padding:'8px 12px', textAlign:'center', fontSize:11, color:'#6b7280', borderBottom:'1px solid #e5e7eb' }}>Editar</th>
              </tr>
            </thead>
            <tbody>
              {ABAS.map(({ key, label }) => (
                <tr key={key} style={{ borderBottom:'1px solid #f3f4f6' }}>
                  <td style={{ padding:'10px 12px', fontWeight:500 }}>{label}</td>
                  <td style={{ padding:'10px 12px', textAlign:'center' }}>
                    <input type="checkbox" checked={permissoes.leitura.includes(key)} onChange={()=>togglePerm('leitura', key)} style={{ width:18, height:18, accentColor:'#EB3238', cursor:'pointer' }}/>
                  </td>
                  <td style={{ padding:'10px 12px', textAlign:'center' }}>
                    <input type="checkbox" checked={permissoes.escrita.includes(key)} onChange={()=>togglePerm('escrita', key)} style={{ width:18, height:18, accentColor:'#EB3238', cursor:'pointer' }}/>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ display:'flex', justifyContent:'flex-end', marginTop:16, gap:8 }}>
            <button onClick={()=>setPermEdit(null)} style={btn('#e5e7eb','#374151')}>Cancelar</button>
            <button onClick={salvarPermissoes} disabled={salvandoPerm} style={btn('#EB3238')}>
              {salvandoPerm ? 'Salvando...' : '✓ Salvar permissões'}
            </button>
          </div>
        </div>
      )}

      {perfilEdit && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.4)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <div style={{ background:'#fff', borderRadius:12, padding:28, width:340, boxShadow:'0 8px 32px rgba(0,0,0,0.15)' }}>
            <h3 style={{ fontSize:15, fontWeight:600, marginBottom:16 }}>Perfil de agendamento — {perfilEdit.nome}</h3>
            <div style={{ marginBottom:20 }}>
              <label style={lbl}>Perfil</label>
              <select value={perfilSelecionado} onChange={e=>setPerfilSelecionado(e.target.value)} style={inp}>
                <option value="">Nenhum</option>
                <option value="1">Perfil 1</option>
                <option value="2">Perfil 2</option>
              </select>
            </div>
            <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
              <button onClick={()=>setPerfilEdit(null)} style={btn('#e5e7eb','#374151')}>Cancelar</button>
              <button onClick={salvarPerfil} style={btn('#EB3238')}>Salvar</button>
            </div>
          </div>
        </div>
      )}

      {perfilFinEdit && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.4)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <div style={{ background:'#fff', borderRadius:12, padding:28, width:340, boxShadow:'0 8px 32px rgba(0,0,0,0.15)' }}>
            <h3 style={{ fontSize:15, fontWeight:600, marginBottom:16 }}>Perfil financeiro — {perfilFinEdit.nome}</h3>
            <div style={{ marginBottom:20 }}>
              <label style={lbl}>Perfil</label>
              <select value={perfilFinSelecionado} onChange={e=>setPerfilFinSelecionado(e.target.value)} style={inp}>
                <option value="">Nenhum</option>
                <option value="1">Perfil 1</option>
                <option value="2">Perfil 2</option>
                <option value="3">Perfil 3</option>
                <option value="4">Perfil 4</option>
              </select>
            </div>
            <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
              <button onClick={()=>setPerfilFinEdit(null)} style={btn('#e5e7eb','#374151')}>Cancelar</button>
              <button onClick={salvarPerfilFinanceiro} style={btn('#EB3238')}>Salvar</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ background:'#fff', borderRadius:12, border:'1px solid #e5e7eb', overflow:'hidden' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
          <thead>
            <tr style={{ background:'#f9fafb' }}>
              {['Nome','E-mail','Papel','Perfil Agend.','Perfil Financ.','Permissões','Ações',...(isAdmin?['Última alteração']:[])].map(h=>(
                <th key={h} style={{ padding:'10px 14px', textAlign:'left', fontSize:11, fontWeight:600, color:'#6b7280', textTransform:'uppercase', borderBottom:'1px solid #e5e7eb' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lista.filter(u=>u.ativo).map(u=>(
              <tr key={u.id} style={{ borderBottom:'1px solid #f3f4f6' }}>
                <td style={{ padding:'10px 14px', fontWeight:500 }}>{u.nome}</td>
                <td style={{ padding:'10px 14px', color:'#6b7280' }}>{u.email}</td>
                <td style={{ padding:'10px 14px' }}>
                  <span style={{ padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:500, background:PILL_CORES[u.papel]+'22', color:PILL_CORES[u.papel] }}>{u.papel}</span>
                </td>
                <td style={{ padding:'10px 14px' }}>
                  {u.papel === 'guiche' ? (
                    <button onClick={()=>abrirPerfilAgendamento(u)}
                      style={{ padding:'4px 10px', border:'1px solid #EB3238', borderRadius:6, fontSize:12, cursor:'pointer', background: u.perfilAgendamento ? '#EB3238' : '#fff', color: u.perfilAgendamento ? '#fff' : '#EB3238' }}>
                      {u.perfilAgendamento ? `Perfil ${u.perfilAgendamento}` : 'Vincular'}
                    </button>
                  ) : <span style={{ color:'#d1d5db', fontSize:12 }}>—</span>}
                </td>
                <td style={{ padding:'10px 14px' }}>
                  {u.papel === 'acertador' ? (
                    <button onClick={()=>abrirPerfilFinanceiro(u)}
                      style={{ padding:'4px 10px', border:'1px solid #EB3238', borderRadius:6, fontSize:12, cursor:'pointer', background: u.perfilFinanceiro ? '#EB3238' : '#fff', color: u.perfilFinanceiro ? '#fff' : '#EB3238' }}>
                      {u.perfilFinanceiro ? `Perfil ${u.perfilFinanceiro}` : 'Vincular'}
                    </button>
                  ) : <span style={{ color:'#d1d5db', fontSize:12 }}>—</span>}
                </td>
                <td style={{ padding:'10px 14px' }}>
                  <button onClick={()=>abrirPermissoes(u)} style={{ padding:'4px 10px', border:'1px solid #EB3238', borderRadius:6, fontSize:12, cursor:'pointer', background:'#fff', color:'#EB3238' }}>
                    ⚙️ Editar permissões
                  </button>
                </td>
                <td style={{ padding:'10px 14px' }}>
                  <div style={{ display:'flex', gap:6 }}>
                    <button onClick={()=>{ setForm({...u,senha:''}); setEditId(u.id); setShowForm(true); }} style={{ padding:'4px 12px', border:'1px solid #d1d5db', borderRadius:6, fontSize:12, cursor:'pointer', background:'#fff' }}>Editar</button>
                    {u.id !== eu?.id && (
                      <button onClick={()=>excluir(u.id, u.nome)} style={{ padding:'4px 12px', border:'1px solid #EB3238', borderRadius:6, fontSize:12, cursor:'pointer', background:'#fff', color:'#EB3238' }}>Excluir</button>
                    )}
                  </div>
                </td>
                {isAdmin && <td style={{ padding:'10px 14px', fontSize:11, color:'#9ca3af' }}>{u.auditoriasFeitas?.[0]?`${u.auditoriasFeitas[0].usuario.nome} — ${new Date(u.auditoriasFeitas[0].criadoEm).toLocaleString('pt-BR')}`:'—'}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
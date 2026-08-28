import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Notificacoes from './Notificacoes';
import SinoAbastecimento from './SinoAbastecimento';
import toast from 'react-hot-toast';
import { useState } from 'react';

const menusAcerto = [
  { path: 'usuarios',     label: 'Usuários',            icon: 'ti-users',          recurso: 'usuarios' },
  { path: 'motoristas',   label: 'Motoristas',          icon: 'ti-id-badge',       recurso: 'motoristas' },
  { path: 'solicitacoes', label: 'Solicitações',        icon: 'ti-file-plus',      recurso: 'solicitacoes' },
  { path: 'exclusoes',    label: 'Exclusão de Vales',   icon: 'ti-trash',          recurso: 'exclusoes' },
  { path: 'folgas',       label: 'Folgas',              icon: 'ti-calendar-off',   recurso: 'folgas' },
  { path: 'ferias',       label: 'Férias',              icon: 'ti-beach',          recurso: 'ferias' },
  { path: 'agendamentos', label: 'Agendamento',         icon: 'ti-calendar-event', recurso: 'agendamentos' },
  { path: 'financeiro',   label: 'Controle Financeiro', icon: 'ti-coin',           recurso: 'financeiro' },
  { path: 'vales-fixos',  label: 'Vales Fixos',         icon: 'ti-credit-card',    recurso: 'solicitacoes' },
  { path: 'levantamentos',             label: 'Levantamentos',        icon: 'ti-report-money',   recurso: 'levantamentos' },
  { path: 'levantamentos-importacoes', label: 'Importações Motoristas', icon: 'ti-file-import',    recurso: 'levantamentos', adminOnly: true },
  { path: 'ab-medias-consumo', label: 'Médias de Consumo',   icon: 'ti-gauge',          recurso: 'levantamentos' },
  { path: 'mapa-ineficiencia', label: 'Mapa de Ineficiência', icon: 'ti-map-pin', recurso: 'financeiro' },
];

const menusAbastecimento = [
  { path: 'ab-faturas',      label: 'Faturas',             icon: 'ti-file-invoice',   recurso: null },
  { path: 'ab-lavagens',     label: 'Lavagens',            icon: 'ti-wash',           recurso: null },
  { path: 'ab-forn-lavagem',     label: 'Fornec. Lavagem',     icon: 'ti-building-store', recurso: null },
  { path: 'ab-medias-consumo',     label: 'Médias de Consumo',   icon: 'ti-gauge',          recurso: null },
  { path: 'ab-medias-importacoes', label: 'Importações Consumo', icon: 'ti-file-import',    recurso: null, adminOnly: true },
  { path: 'ab-preco-combustivel',  label: 'Preço Combustível',   icon: 'ti-map-pin',        recurso: null },
  { path: 'frota-apoio',         label: 'Frota Apoio',          icon: 'ti-car',            recurso: null },
  { path: 'ab-fechamentos',      label: 'Fechamentos',         icon: 'ti-file-report',    recurso: null },
  { path: 'ab-relatorios',       label: 'Relatórios',          icon: 'ti-chart-bar',      recurso: null },
];

// Item fixo no rodapé da sidebar (sem restrição de recurso)
const menuConfiguracao = { path: 'configuracoes', label: 'Configurações', icon: 'ti-settings' };

const SISTEMAS = {
  acerto:        { label: 'Acerto de Contas', icone: 'ti-truck',       primeiraRota: '/solicitacoes' },
  abastecimento: { label: 'Abastecimento',    icone: 'ti-gas-station', primeiraRota: '/notas-abastecimento' },
};

export default function Layout() {
  const { usuario, logout, pode, isAdmin } = useAuth();
  const navigate = useNavigate();

  // Admins podem trocar de sistema; demais usuários ficam no seu setor
  const [setorAtivo, setSetorAtivo] = useState(usuario?.setor || 'acerto');

  function trocarSistema() {
    const proximo = setorAtivo === 'acerto' ? 'abastecimento' : 'acerto';
    setSetorAtivo(proximo);
    navigate(proximo === 'abastecimento' ? '/ab-faturas' : '/solicitacoes');
  }

  function handleLogout() {
    logout();
    navigate('/login');
    toast.success('Até logo!');
  }

  const sistemaAtual = SISTEMAS[setorAtivo] || SISTEMAS.acerto;

  return (
    <div style={{ display:'flex', height:'100vh', fontFamily:'Inter, sans-serif' }}>
      {/* Sidebar */}
      <aside style={{ width:220, background:'#EB3238', display:'flex', flexDirection:'column', flexShrink:0 }}>
        <div style={{ padding:'16px 16px 12px', borderBottom:'1px solid rgba(255,255,255,0.15)' }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ width:28, height:28, background:'rgba(0,0,0,0.2)', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              <i className={`ti ${sistemaAtual.icone}`} style={{ fontSize:15, color:'#fff' }}></i>
            </div>
            <span style={{ color:'#fff', fontWeight:500, fontSize:13, lineHeight:1.2 }}>{sistemaAtual.label}</span>
          </div>
          {/* Botão trocar sistema — só para admin */}
          {isAdmin && (
            <button onClick={trocarSistema}
              style={{ marginTop:10, width:'100%', padding:'5px 0', background:'rgba(0,0,0,0.18)', border:'1px solid rgba(255,255,255,0.25)', borderRadius:6, color:'rgba(255,255,255,0.85)', fontSize:11, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:5 }}>
              <i className={`ti ${setorAtivo === 'acerto' ? 'ti-gas-station' : 'ti-truck'}`} style={{ fontSize:13 }}></i>
              Ir para {setorAtivo === 'acerto' ? 'Abastecimento' : 'Acerto'}
            </button>
          )}
        </div>

        <nav style={{ flex:1, padding:'8px 10px', overflowY:'auto' }}>
          <NavLink to="/"
            end
            style={({ isActive }) => ({
              display:'flex', alignItems:'center', gap:10,
              padding:'9px 12px', margin:'1px 0',
              borderRadius:9,
              color: isActive ? '#EB3238' : 'rgba(255,255,255,0.75)',
              background: isActive ? '#fff' : 'transparent',
              textDecoration:'none', fontSize:13, fontWeight: isActive ? 600 : 400,
              boxShadow: isActive ? '0 1px 4px rgba(0,0,0,0.12)' : 'none',
              transition:'all 0.15s'
            })}>
            <i className="ti ti-home" style={{ fontSize:17 }}></i>
            Início
          </NavLink>
          {(setorAtivo === 'abastecimento' ? menusAbastecimento : menusAcerto).map(m => {
            if (m.recurso && !pode(m.recurso, 'leitura')) return null;
            if (m.adminOnly && !isAdmin) return null;
            return (
              <NavLink key={m.path} to={`/${m.path}`}
                style={({ isActive }) => ({
                  display:'flex', alignItems:'center', gap:10,
                  padding:'9px 12px', margin:'1px 0',
                  borderRadius:9,
                  color: isActive ? '#EB3238' : 'rgba(255,255,255,0.75)',
                  background: isActive ? '#fff' : 'transparent',
                  textDecoration:'none', fontSize:13, fontWeight: isActive ? 600 : 400,
                  boxShadow: isActive ? '0 1px 4px rgba(0,0,0,0.12)' : 'none',
                  transition:'all 0.15s'
                })}>
                <i className={`ti ${m.icon}`} style={{ fontSize:17 }}></i>
                {m.label}
              </NavLink>
            );
          })}
        </nav>

        <div style={{ padding:'12px 16px', borderTop:'1px solid rgba(255,255,255,0.15)' }}>
          {/* Link de Configurações acima do usuário */}
          <NavLink to={`/${menuConfiguracao.path}`}
            style={({ isActive }) => ({
              display:'flex', alignItems:'center', gap:10, padding:'8px 10px',
              borderRadius:9,
              color: isActive ? '#EB3238' : 'rgba(255,255,255,0.75)',
              background: isActive ? '#fff' : 'transparent',
              textDecoration:'none', fontSize:13,
              fontWeight: isActive ? 600 : 400,
              boxShadow: isActive ? '0 1px 4px rgba(0,0,0,0.12)' : 'none',
              marginBottom: 8,
              transition:'all 0.15s',
            })}>
            <i className={`ti ${menuConfiguracao.icon}`} style={{ fontSize:17 }}></i>
            {menuConfiguracao.label}
          </NavLink>
          <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:8 }}>
            {setorAtivo === 'abastecimento' ? <SinoAbastecimento /> : <Notificacoes />}
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
            <div style={{ width:32, height:32, borderRadius:'50%', background:'rgba(0,0,0,0.2)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:500, color:'#fff', flexShrink:0 }}>
              {usuario?.nome?.charAt(0).toUpperCase()}
            </div>
            <div style={{ overflow:'hidden' }}>
              <div style={{ color:'#fff', fontSize:12, fontWeight:500, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{usuario?.nome}</div>
              <div style={{ fontSize:11, color:'rgba(255,255,255,0.7)' }}>{usuario?.papel}</div>
            </div>
          </div>
          <button onClick={handleLogout} style={{ width:'100%', padding:'6px', background:'rgba(0,0,0,0.15)', border:'1px solid rgba(255,255,255,0.2)', borderRadius:6, color:'rgba(255,255,255,0.8)', fontSize:12, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
            <i className="ti ti-logout" style={{ fontSize:15 }}></i> Sair
          </button>
        </div>
      </aside>

      {/* Conteúdo */}
      <main id="main-content" style={{ flex:1, overflow:'auto', background:'#f5f5f7', padding:0, display:'flex', flexDirection:'column' }}>
        <Outlet />
      </main>
    </div>
  );
}
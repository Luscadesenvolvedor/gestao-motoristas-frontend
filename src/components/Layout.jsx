// frontend/src/components/Layout.jsx
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';

const menus = [
  { path: 'usuarios',     label: 'Usuários',           icon: 'ti-users',          recurso: 'usuarios' },
  { path: 'motoristas',   label: 'Motoristas',         icon: 'ti-id-badge',       recurso: 'motoristas' },
  { path: 'solicitacoes', label: 'Solicitações',       icon: 'ti-file-plus',      recurso: 'solicitacoes' },
  { path: 'exclusoes',    label: 'Exclusão de Vales',  icon: 'ti-trash',          recurso: 'exclusoes' },
  { path: 'folgas',       label: 'Folgas',             icon: 'ti-calendar-off',   recurso: 'folgas' },
  { path: 'ferias',       label: 'Férias',             icon: 'ti-beach',          recurso: 'ferias' },
  { path: 'agendamentos', label: 'Agendamento',        icon: 'ti-calendar-event', recurso: 'agendamentos' },
  { path: 'financeiro',   label: 'Controle Financeiro',icon: 'ti-coin',           recurso: 'financeiro' },
];

const pilhaPapel = {
  admin: 'role-admin', guiche: 'role-guiche', acertador: 'role-acertador', dgp: 'role-dgp', financeiro: 'role-financeiro'
};

export default function Layout() {
  const { usuario, logout, pode } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login');
    toast.success('Até logo!');
  }

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: 'Inter, sans-serif' }}>
      {/* Sidebar */}
      <aside style={{ width: 220, background: '#1a1a2e', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <div style={{ padding: '20px 16px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <i className="ti ti-truck" style={{ fontSize: 22, color: '#a78bfa' }}></i>
            <span style={{ color: '#fff', fontWeight: 600, fontSize: 14 }}>Gestão Motoristas</span>
          </div>
        </div>

        <nav style={{ flex: 1, padding: '8px 0', overflowY: 'auto' }}>
          {menus.map(m => {
            if (!pode(m.recurso, 'leitura')) return null;
            return (
              <NavLink key={m.path} to={`/${m.path}`}
                style={({ isActive }) => ({
                  display: 'flex', alignItems: 'center', gap: 10, padding: '9px 16px',
                  color: isActive ? '#a78bfa' : 'rgba(255,255,255,0.65)',
                  background: isActive ? 'rgba(167,139,250,0.1)' : 'transparent',
                  textDecoration: 'none', fontSize: 13, fontWeight: isActive ? 500 : 400,
                  borderLeft: isActive ? '2px solid #a78bfa' : '2px solid transparent',
                  transition: 'all 0.15s'
                })}>
                <i className={`ti ${m.icon}`} style={{ fontSize: 17 }}></i>
                {m.label}
              </NavLink>
            );
          })}
        </nav>

        <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, color: '#fff', flexShrink: 0 }}>
              {usuario?.nome?.charAt(0).toUpperCase()}
            </div>
            <div style={{ overflow: 'hidden' }}>
              <div style={{ color: '#fff', fontSize: 12, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{usuario?.nome}</div>
              <div style={{ fontSize: 11, color: '#a78bfa' }}>{usuario?.papel}</div>
            </div>
          </div>
          <button onClick={handleLogout} style={{ width: '100%', padding: '6px', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: 'rgba(255,255,255,0.6)', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <i className="ti ti-logout" style={{ fontSize: 15 }}></i> Sair
          </button>
        </div>
      </aside>

      {/* Conteúdo */}
      <main style={{ flex: 1, overflow: 'auto', background: '#f5f5f7', padding: 24 }}>
        <Outlet />
      </main>
    </div>
  );
}

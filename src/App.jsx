import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './pages/Login';
import Layout from './components/Layout';
import Usuarios from './pages/Usuarios';
import Motoristas from './pages/Motoristas';
import Solicitacoes from './pages/Solicitacoes';
import ExclusaoVales from './pages/ExclusaoVales';
import Folgas from './pages/Folgas';
import Ferias from './pages/Ferias';
import Agendamentos from './pages/Agendamentos';
import Financeiro from './pages/Financeiro';
import Indicadores from './pages/Indicadores';
import ValesFixos from './pages/ValesFixos';
import Levantamentos from './pages/Levantamentos';
import MapaIneficiencia from './pages/MapaIneficiencia';
import { Component } from 'react';

class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(e) { return { error: e }; }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 40, fontFamily: 'monospace', color: '#991b1b', background: '#fef2f2', minHeight: '100vh' }}>
          <h2>Erro na aplicação</h2>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: 13 }}>{String(this.state.error)}</pre>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: 11, color: '#6b7280' }}>{this.state.error?.stack}</pre>
          <button onClick={() => this.setState({ error: null })} style={{ marginTop: 16, padding: '8px 16px', cursor: 'pointer' }}>Tentar novamente</button>
        </div>
      );
    }
    return this.props.children;
  }
}

function Privada({ children, recurso }) {
  const { usuario, loading, pode } = useAuth();
  if (loading) return <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh' }}>Carregando...</div>;
  if (!usuario) return <Navigate to="/login" />;
  if (recurso && !pode(recurso, 'leitura')) return <Navigate to="/" />;
  return children;
}

function AppRoutes() {
  const { usuario, pode } = useAuth();
  const primeiraRota = () => {
    if (!usuario) return '/login';
    const rotas = [
      { path: '/usuarios',      recurso: 'usuarios' },
      { path: '/motoristas',    recurso: 'motoristas' },
      { path: '/solicitacoes',  recurso: 'solicitacoes' },
      { path: '/folgas',        recurso: 'folgas' },
      { path: '/ferias',        recurso: 'ferias' },
      { path: '/agendamentos',  recurso: 'agendamentos' },
      { path: '/exclusoes',     recurso: 'exclusoes' },
      { path: '/financeiro',    recurso: 'financeiro' },
      { path: '/levantamentos', recurso: 'levantamentos' },
    ];
    const primeira = rotas.find(r => pode(r.recurso, 'leitura'));
    return primeira ? primeira.path : '/login';
  };
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<Privada><Layout /></Privada>}>
        <Route index element={<Navigate to={primeiraRota()} />} />
        <Route path="usuarios"     element={<Privada recurso="usuarios"><ErrorBoundary><Usuarios /></ErrorBoundary></Privada>} />
        <Route path="motoristas"   element={<Privada recurso="motoristas"><ErrorBoundary><Motoristas /></ErrorBoundary></Privada>} />
        <Route path="solicitacoes" element={<Privada recurso="solicitacoes"><ErrorBoundary><Solicitacoes /></ErrorBoundary></Privada>} />
        <Route path="exclusoes"    element={<Privada recurso="exclusoes"><ErrorBoundary><ExclusaoVales /></ErrorBoundary></Privada>} />
        <Route path="folgas"       element={<Privada recurso="folgas"><ErrorBoundary><Folgas /></ErrorBoundary></Privada>} />
        <Route path="ferias"       element={<Privada recurso="ferias"><ErrorBoundary><Ferias /></ErrorBoundary></Privada>} />
        <Route path="agendamentos" element={<Privada recurso="agendamentos"><ErrorBoundary><Agendamentos /></ErrorBoundary></Privada>} />
        <Route path="financeiro"   element={<Privada recurso="financeiro"><ErrorBoundary><Financeiro /></ErrorBoundary></Privada>} />
        <Route path="indicadores"  element={<Privada recurso="solicitacoes"><ErrorBoundary><Indicadores /></ErrorBoundary></Privada>} />
        <Route path="vales-fixos"  element={<Privada recurso="solicitacoes"><ErrorBoundary><ValesFixos /></ErrorBoundary></Privada>} />
        <Route path="levantamentos"     element={<Privada recurso="levantamentos"><ErrorBoundary><Levantamentos /></ErrorBoundary></Privada>} />
        <Route path="mapa-ineficiencia" element={<Privada recurso="financeiro"><ErrorBoundary><MapaIneficiencia /></ErrorBoundary></Privada>} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster position="top-right" />
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}

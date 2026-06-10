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
    if (pode('usuarios', 'leitura')) return '/usuarios';
    return '/motoristas';
  };
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<Privada><Layout /></Privada>}>
        <Route index element={<Navigate to={primeiraRota()} />} />
        <Route path="usuarios"     element={<Privada recurso="usuarios"><Usuarios /></Privada>} />
        <Route path="motoristas"   element={<Privada recurso="motoristas"><Motoristas /></Privada>} />
        <Route path="solicitacoes" element={<Privada recurso="solicitacoes"><Solicitacoes /></Privada>} />
        <Route path="exclusoes"    element={<Privada recurso="exclusoes"><ExclusaoVales /></Privada>} />
        <Route path="folgas"       element={<Privada recurso="folgas"><Folgas /></Privada>} />
        <Route path="ferias"       element={<Privada recurso="ferias"><Ferias /></Privada>} />
        <Route path="agendamentos" element={<Privada recurso="agendamentos"><Agendamentos /></Privada>} />
        <Route path="financeiro"   element={<Privada recurso="financeiro"><Financeiro /></Privada>} />
        <Route path="indicadores"  element={<Privada recurso="solicitacoes"><Indicadores /></Privada>} />
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
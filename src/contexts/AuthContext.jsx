// frontend/src/contexts/AuthContext.jsx
import { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      api.defaults.headers.Authorization = `Bearer ${token}`;
      api.get('/auth/me')
        .then(r => setUsuario(r.data))
        .catch(() => localStorage.removeItem('token'))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  async function login(email, senha) {
    const { data } = await api.post('/auth/login', { email, senha });
    localStorage.setItem('token', data.token);
    api.defaults.headers.Authorization = `Bearer ${data.token}`;
    setUsuario(data.usuario);
    return data.usuario;
  }

  function logout() {
    localStorage.removeItem('token');
    delete api.defaults.headers.Authorization;
    setUsuario(null);
  }

  const pode = (recurso, tipo = 'leitura') => {
    // Admin sempre tem acesso total
    if (usuario?.papel === 'admin') return true;
    // Permissões customizadas só valem se tiverem conteúdo real
    const perms = usuario?.permissoes;
    if (perms && perms.leitura?.length > 0) {
      return perms[tipo]?.includes(recurso) ?? false;
    }
    const mapa = {
      usuarios:   { leitura: ['admin'], escrita: ['admin'] },
      motoristas: { leitura: ['admin','guiche','acertador','dgp','financeiro'], escrita: ['admin','guiche','acertador','dgp','financeiro'] },
      solicitacoes:{ leitura: ['admin','guiche','acertador','dgp','financeiro'], escrita: ['admin','guiche','acertador','dgp','financeiro'] },
      exclusoes:  { leitura: ['admin','acertador','financeiro'], escrita: ['admin','acertador','financeiro'] },
      folgas:     { leitura: ['admin','guiche','acertador','dgp','financeiro'], escrita: ['admin','financeiro'] },
      ferias:     { leitura: ['admin','guiche','acertador','dgp','financeiro'], escrita: ['admin','dgp'] },
      agendamentos:{ leitura: ['admin','guiche'], escrita: ['admin','guiche'] },
      financeiro: { leitura: ['admin','acertador'], escrita: ['admin','acertador'] },
      levantamentos: { leitura: ['admin','guiche','acertador','dgp','financeiro','levantamentos'], escrita: ['admin','financeiro'] },
    };
    return mapa[recurso]?.[tipo]?.includes(usuario?.papel) ?? false;
  };

  return (
    <AuthContext.Provider value={{ usuario, login, logout, loading, pode, isAdmin: usuario?.papel === 'admin' }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

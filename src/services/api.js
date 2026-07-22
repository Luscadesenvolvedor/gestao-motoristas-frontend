// frontend/src/services/api.js
import axios from 'axios';
import toast from 'react-hot-toast';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL
    ? `${import.meta.env.VITE_API_URL}/api`
    : '/api',
});

api.interceptors.response.use(
  res => res,
  err => {
    const status = err.response?.status;
    const msg = err.response?.data?.error || 'Erro inesperado';

    if (status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    } else if (status === 403) {
      toast.error('Acesso negado para este perfil');
    } else if (status === 429) {
      toast.error('Muitas requisições. Aguarde alguns segundos e tente novamente.');
    } else if (err.response && status !== 404) {
      toast.error(msg);
    } else if (err.request) {
      toast.error('Sem resposta do servidor. Verifique sua conexão.');
    }
    return Promise.reject(err);
  }
);

export default api;

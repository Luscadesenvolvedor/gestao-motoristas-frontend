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
    const msg = err.response?.data?.error || 'Erro inesperado';
    if (err.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    } else if (err.response?.status === 403) {
      toast.error('Acesso negado para este perfil');
    } else {
      toast.error(msg);
    }
    return Promise.reject(err);
  }
);

export default api;

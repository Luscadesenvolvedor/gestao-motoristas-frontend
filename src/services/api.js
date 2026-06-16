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
  async err => {
    const status = err.response?.status;
    const msg = err.response?.data?.error || 'Erro inesperado';

    if (status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    } else if (status === 403) {
      toast.error('Acesso negado para este perfil');
    } else if (status === 429) {
      const config = err.config;
      if (!config._retryCount) config._retryCount = 0;
      if (config._retryCount < 3) {
        config._retryCount++;
        const delay = config._retryCount * 1500;
        await new Promise(r => setTimeout(r, delay));
        return api(config);
      }
      toast.error('Servidor sobrecarregado. Tente novamente em instantes.');
    } else {
      toast.error(msg);
    }
    return Promise.reject(err);
  }
);

export default api;

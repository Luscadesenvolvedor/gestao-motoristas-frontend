import { useState, useEffect, useRef } from 'react';
import api from '../services/api';

const fmt = v => Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const tempoAtras = (data) => {
  const diff = Math.floor((new Date() - new Date(data)) / 1000);
  if (diff < 60) return 'agora';
  if (diff < 3600) return `${Math.floor(diff / 60)}min atrás`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h atrás`;
  return `${Math.floor(diff / 86400)}d atrás`;
};

export default function SinoAbastecimento() {
  const [lista, setLista]   = useState([]);
  const [aberto, setAberto] = useState(false);
  const ref = useRef(null);

  const carregar = async () => {
    try {
      const { data } = await api.get('/notificacoes/abastecimento');
      setLista(data);
    } catch {}
  };

  useEffect(() => {
    carregar();
    const intervalo = setInterval(carregar, 30000);
    return () => clearInterval(intervalo);
  }, []);

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setAberto(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const marcarLida = async (id, lida) => {
    try {
      await api.patch(`/notificacoes/${id}/${lida ? 'lida' : 'nao-lida'}`);
      carregar();
    } catch {}
  };

  const marcarTodasLidas = async () => {
    try {
      await Promise.all(lista.filter(n => !n.lida).map(n => api.patch(`/notificacoes/${n.id}/lida`)));
      carregar();
    } catch {}
  };

  const naoLidas = lista.filter(n => !n.lida).length;

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setAberto(v => !v)}
        title="Notificações de Abastecimento"
        style={{
          position: 'relative',
          background: aberto ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.15)',
          border: '1px solid rgba(255,255,255,0.35)',
          cursor: 'pointer', padding: '5px 9px', borderRadius: 8, fontSize: 16,
          transition: 'all 0.15s',
        }}
      >
        ⛽
        {naoLidas > 0 && (
          <span style={{
            position: 'absolute', top: -4, right: -4,
            background: '#f59e0b', color: '#fff', borderRadius: '50%',
            width: 17, height: 17, fontSize: 10, fontWeight: 800,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {naoLidas > 9 ? '9+' : naoLidas}
          </span>
        )}
      </button>

      {aberto && (
        <div style={{
          position: 'fixed', left: 230, bottom: 80, width: 380,
          background: '#161b27', borderRadius: 14,
          boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
          border: '1px solid rgba(255,255,255,0.08)', zIndex: 9999,
        }}>
          {/* Header */}
          <div style={{
            padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <span style={{ fontWeight: 700, fontSize: 13, color: '#e2e8f0' }}>
              ⛽ Preços Diesel
              {naoLidas > 0 && (
                <span style={{ background: '#f59e0b', color: '#fff', borderRadius: 20, padding: '1px 7px', fontSize: 10, marginLeft: 6 }}>
                  {naoLidas}
                </span>
              )}
            </span>
            {naoLidas > 0 && (
              <button onClick={marcarTodasLidas} style={{ fontSize: 11, color: '#60a5fa', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                Marcar todas como lidas
              </button>
            )}
          </div>

          {/* Lista */}
          <div style={{ maxHeight: 380, overflowY: 'auto' }}>
            {lista.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#4b5563', fontSize: 13 }}>
                Nenhuma atualização de preço
              </div>
            ) : lista.map(n => (
              <div key={n.id} style={{
                padding: '11px 16px', borderBottom: '1px solid rgba(255,255,255,0.05)',
                background: n.lida ? 'transparent' : 'rgba(235,50,56,0.06)',
                display: 'flex', gap: 10, alignItems: 'flex-start',
              }}>
                <span style={{ fontSize: 18, flexShrink: 0 }}>⛽</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: n.lida ? 400 : 700, color: '#e2e8f0', marginBottom: 2 }}>
                    {n.titulo}
                  </div>
                  <div style={{ fontSize: 12, color: '#9ca3af', lineHeight: 1.5 }}>{n.mensagem}</div>
                  <div style={{ fontSize: 10, color: '#4b5563', marginTop: 4 }}>{tempoAtras(n.criadoEm)}</div>
                </div>
                <button
                  onClick={() => marcarLida(n.id, !n.lida)}
                  style={{
                    flexShrink: 0, background: 'none',
                    border: `1px solid ${n.lida ? 'rgba(255,255,255,0.1)' : '#f59e0b'}`,
                    borderRadius: 6, padding: '3px 8px', fontSize: 10, cursor: 'pointer',
                    color: n.lida ? '#6b7280' : '#f59e0b', whiteSpace: 'nowrap',
                  }}
                >
                  {n.lida ? '↩' : '✓ Lida'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

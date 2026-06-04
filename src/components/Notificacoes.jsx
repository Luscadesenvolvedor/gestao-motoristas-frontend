import { useState, useEffect, useRef } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';

const ICONES = {
  ferias: '🏖️',
  atestado: '🏥',
  afastamento: '⚠️',
  abandono: '🚪'
};

export default function Notificacoes() {
  const [lista, setLista] = useState([]);
  const [aberto, setAberto] = useState(false);
  const ref = useRef(null);

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

  async function carregar() {
    try {
      const { data } = await api.get('/notificacoes');
      setLista(data);
    } catch {}
  }

  async function marcarLida(id, lida) {
    try {
      await api.patch(`/notificacoes/${id}/${lida ? 'lida' : 'nao-lida'}`);
      carregar();
    } catch {}
  }

  async function marcarTodasLidas() {
    try {
      await api.patch('/notificacoes/todas/lidas');
      toast.success('Todas marcadas como lidas!');
      carregar();
    } catch {}
  }

  const naoLidas = lista.filter(n => !n.lida).length;

  const tempoAtras = (data) => {
    const diff = Math.floor((new Date() - new Date(data)) / 1000);
    if (diff < 60) return 'agora';
    if (diff < 3600) return `${Math.floor(diff/60)}min atrás`;
    if (diff < 86400) return `${Math.floor(diff/3600)}h atrás`;
    return `${Math.floor(diff/86400)}d atrás`;
  };

  return (
    <div ref={ref} style={{ position:'relative' }}>
      <button onClick={()=>setAberto(v=>!v)}
        style={{ position:'relative', background:'none', border:'none', cursor:'pointer', padding:'4px 8px', borderRadius:8, fontSize:20 }}>
        🔔
        {naoLidas > 0 && (
          <span style={{ position:'absolute', top:0, right:0, background:'#dc2626', color:'#fff', borderRadius:'50%', width:18, height:18, fontSize:11, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center' }}>
            {naoLidas > 9 ? '9+' : naoLidas}
          </span>
        )}
      </button>

      {aberto && (
        <div style={{ position:'fixed', left:230, bottom:80, width:380, background:'#fff', borderRadius:12, boxShadow:'0 8px 30px rgba(0,0,0,0.15)', border:'1px solid #e5e7eb', zIndex:9999 }}>
          <div style={{ padding:'12px 16px', borderBottom:'1px solid #e5e7eb', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <span style={{ fontWeight:600, fontSize:14 }}>
              🔔 Notificações
              {naoLidas > 0 && <span style={{ background:'#dc2626', color:'#fff', borderRadius:20, padding:'1px 7px', fontSize:11, marginLeft:6 }}>{naoLidas}</span>}
            </span>
            {naoLidas > 0 && (
              <button onClick={marcarTodasLidas} style={{ fontSize:11, color:'#7c3aed', background:'none', border:'none', cursor:'pointer', fontWeight:500 }}>
                Marcar todas como lidas
              </button>
            )}
          </div>

          <div style={{ maxHeight:400, overflowY:'auto' }}>
            {lista.length === 0 && (
              <div style={{ padding:40, textAlign:'center', color:'#9ca3af', fontSize:13 }}>
                Nenhuma notificação
              </div>
            )}
            {lista.map(n => (
              <div key={n.id} style={{ padding:'12px 16px', borderBottom:'1px solid #f3f4f6', background:n.lida?'#fff':'#f5f3ff', display:'flex', gap:10, alignItems:'flex-start' }}>
                <span style={{ fontSize:20, flexShrink:0 }}>{ICONES[n.tipo] || '🔔'}</span>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:13, fontWeight:n.lida?400:600, color:'#1a1a2e', marginBottom:2 }}>{n.titulo}</div>
                  <div style={{ fontSize:12, color:'#6b7280', lineHeight:1.5 }}>{n.mensagem}</div>
                  <div style={{ fontSize:11, color:'#9ca3af', marginTop:4 }}>{tempoAtras(n.criadoEm)}</div>
                </div>
                <button onClick={()=>marcarLida(n.id, !n.lida)}
                  style={{ flexShrink:0, background:'none', border:'1px solid #e5e7eb', borderRadius:6, padding:'3px 8px', fontSize:11, cursor:'pointer', color:n.lida?'#6b7280':'#7c3aed', whiteSpace:'nowrap' }}>
                  {n.lida ? '↩ Não lida' : '✓ Lida'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
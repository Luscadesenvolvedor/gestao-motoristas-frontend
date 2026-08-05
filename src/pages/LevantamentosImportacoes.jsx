// v2
import { useState, useEffect } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';

const TIPOS = [
  { key: 'saldo',       label: 'Saldo/Prévia',      color: '#EB3238' },
  { key: 'diarias',     label: 'Diárias dedicados', color: '#0ea5e9' },
  { key: 'bonificacao', label: 'Bonificações',       color: '#16a34a' },
];

const fmtDt = s => s ? new Date(s).toLocaleDateString('pt-BR') : '—';

export default function LevantamentosImportacoes() {
  const { isAdmin } = useAuth();
  const [lista, setLista] = useState([]);
  const [carregando, setCarregando] = useState(true);

  async function carregar() {
    setCarregando(true);
    try {
      const { data } = await api.get('/levantamentos-motoristas/importacoes');
      setLista(data);
    } catch { toast.error('Erro ao carregar importações'); }
    finally { setCarregando(false); }
  }

  useEffect(() => { carregar(); }, []);

  async function atualizarTipo(id, tipo) {
    try {
      await api.put(`/levantamentos-motoristas/importacoes/${id}`, { tipoPagamento: tipo });
      setLista(l => l.map(i => i.id === id ? { ...i, tipoPagamento: tipo || null } : i));
    } catch { toast.error('Erro ao atualizar tipo'); }
  }

  async function excluir(id, nome) {
    if (!confirm(`Excluir "${nome}" e todos os registros?`)) return;
    try {
      await api.delete(`/levantamentos-motoristas/importacoes/${id}`);
      toast.success('Importação removida');
      setLista(l => l.filter(i => i.id !== id));
    } catch { toast.error('Erro ao excluir'); }
  }

  const tipoBadge = tipo => {
    const t = TIPOS.find(x => x.key === tipo);
    if (!t) return null;
    return (
      <span style={{ padding:'2px 8px', borderRadius:20, fontSize:11, fontWeight:700, background: t.color + '18', color: t.color, border:`1px solid ${t.color}40` }}>
        {t.label}
      </span>
    );
  };

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24 }}>
        <h2 style={{ fontSize:20, fontWeight:700, color:'#1a1a2e', margin:0 }}>Importações — Por Motorista</h2>
        <span style={{ fontSize:12, color:'#9ca3af' }}>{lista.length} importação{lista.length !== 1 ? 'ões' : ''}</span>
      </div>

      {carregando ? (
        <div style={{ textAlign:'center', padding:60, color:'#9ca3af' }}>Carregando...</div>
      ) : lista.length === 0 ? (
        <div style={{ textAlign:'center', padding:60, color:'#9ca3af', background:'#fff', borderRadius:12, border:'1px dashed #d1d5db' }}>
          <i className="ti ti-file-off" style={{ fontSize:36, display:'block', marginBottom:10, color:'#d1d5db' }}></i>
          <div style={{ fontWeight:500 }}>Nenhuma importação encontrada</div>
          <div style={{ fontSize:12, marginTop:4 }}>Vá em Levantamentos → Por Motorista para importar</div>
        </div>
      ) : (
        <div style={{ background:'#fff', border:'1px solid #e5e7eb', borderRadius:12, overflow:'hidden' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
            <thead>
              <tr style={{ background:'#f8fafc' }}>
                {['Arquivo', 'Data', 'Registros', 'Tipo', ''].map(h => (
                  <th key={h} style={{ padding:'10px 16px', textAlign:'left', fontSize:11, fontWeight:700, color:'#374151', textTransform:'uppercase', letterSpacing:'0.4px', borderBottom:'1px solid #e5e7eb', whiteSpace:'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lista.map((im, i) => (
                <tr key={im.id} style={{ background: i % 2 === 0 ? '#fff' : '#fafafa' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#fef2f2'}
                  onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? '#fff' : '#fafafa'}>
                  <td style={{ padding:'11px 16px', fontWeight:600, color:'#1a1a2e', borderBottom:'1px solid #f3f4f6' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <i className="ti ti-file-spreadsheet" style={{ fontSize:16, color:'#6366f1' }}></i>
                      {im.nomeArquivo.replace(/\.xlsx?$/i, '')}
                    </div>
                  </td>
                  <td style={{ padding:'11px 16px', color:'#6b7280', borderBottom:'1px solid #f3f4f6' }}>{fmtDt(im.criadoEm)}</td>
                  <td style={{ padding:'11px 16px', borderBottom:'1px solid #f3f4f6' }}>
                    <span style={{ padding:'2px 8px', borderRadius:6, background:'#f1f5f9', color:'#374151', fontSize:12, fontWeight:700 }}>
                      {im.totalRegistros}
                    </span>
                  </td>
                  <td style={{ padding:'11px 16px', borderBottom:'1px solid #f3f4f6' }}>
                    {isAdmin ? (
                      <select value={im.tipoPagamento || ''} onChange={e => atualizarTipo(im.id, e.target.value)}
                        style={{ padding:'4px 8px', border:'1.5px solid #e5e7eb', borderRadius:6, fontSize:12, color:'#374151', background:'#fff', cursor:'pointer', outline:'none' }}>
                        <option value="">— sem tipo —</option>
                        {TIPOS.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
                      </select>
                    ) : (
                      tipoBadge(im.tipoPagamento) || <span style={{ color:'#d1d5db' }}>—</span>
                    )}
                  </td>
                  <td style={{ padding:'11px 16px', borderBottom:'1px solid #f3f4f6', textAlign:'right' }}>
                    <button onClick={() => excluir(im.id, im.nomeArquivo)}
                      style={{ padding:'5px 10px', border:'1px solid #fee2e2', borderRadius:6, background:'#fff5f5', color:'#dc2626', fontSize:12, cursor:'pointer' }}>
                      <i className="ti ti-trash"></i>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

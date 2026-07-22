// frontend/src/pages/ValesFixos.jsx
import { useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';

const DATA1_KEY = 'valesFixos_data1';
const DATA2_KEY = 'valesFixos_data2';

export default function ValesFixos() {
  const { usuario, isAdmin } = useAuth();
  const [lista, setLista] = useState([]);
  const [motoristas, setMotoristas] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ motoristaId: '', dataPagamento: '', valor: '' });
  const [data1, setData1] = useState(() => localStorage.getItem(DATA1_KEY) || '');
  const [data2, setData2] = useState(() => localStorage.getItem(DATA2_KEY) || '');

  function carregar() {
    api.get('/vales-fixos').then(r => setLista(r.data)).catch(() => {});
  }

  useEffect(() => {
    carregar();
    api.get('/motoristas').then(r => setMotoristas(r.data.filter(m => m.status === 'ativo'))).catch(() => {});
  }, []);

  function salvarData1(v) { setData1(v); localStorage.setItem(DATA1_KEY, v); }
  function salvarData2(v) { setData2(v); localStorage.setItem(DATA2_KEY, v); }

  async function salvar(e) {
    e.preventDefault();
    try {
      await api.post('/vales-fixos', form);
      toast.success('Vale registrado!');
      setShowForm(false);
      setForm({ motoristaId: '', dataPagamento: '', valor: '' });
      carregar();
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Erro ao salvar');
    }
  }

  async function excluir(id) {
    if (!confirm('Excluir este vale?')) return;
    try {
      await api.delete(`/vales-fixos/${id}`);
      carregar();
    } catch { toast.error('Erro ao excluir'); }
  }

  function exportar() {
    if (!lista.length) return toast.error('Nenhum vale para exportar');
    const rows = lista.map(v => {
      const dp = v.dataPagamento ? v.dataPagamento.split('T')[0] : '';
      let dataPart = '';
      if (dp) {
        const [, m, d] = dp.split('-');
        dataPart = ` ${d}/${m}`;
      }
      const pix = v.motorista?.pix || '';
      const obs = `Vale - Vale adiantamento - Ref: Vale pessoal - dep em conta ou dep via pix: ${pix} - Realizado ${usuario?.nome || ''}${dataPart}`;
      return {
        'Motorista':       v.motorista?.nome || '',
        'Data Pagamento':  dp ? dp.split('-').reverse().join('/') : '',
        'Valor':           parseFloat(v.valor),
        'Observação':      obs,
      };
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [{ wch: 30 }, { wch: 16 }, { wch: 14 }, { wch: 90 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Vales Fixos');
    XLSX.writeFile(wb, `vales-fixos-${new Date().toISOString().slice(0,10)}.xlsx`);
  }

  const lbl = { display:'block', fontSize:11, fontWeight:500, color:'#6b7280', marginBottom:4, textTransform:'uppercase' };
  const inp = { width:'100%', padding:'8px 10px', border:'1px solid #d1d5db', borderRadius:8, fontSize:13, boxSizing:'border-box' };
  const fmt = v => `R$ ${parseFloat(v).toLocaleString('pt-BR', { minimumFractionDigits:2 })}`;
  const fmtDate = iso => iso ? iso.split('T')[0].split('-').reverse().join('/') : '—';

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
        <h2 style={{ fontSize:20, fontWeight:600, color:'#1a1a2e' }}>Vales Fixos</h2>
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={exportar}
            style={{ padding:'9px 16px', background:'#fff', border:'1px solid #d1d5db', borderRadius:8, fontSize:13, fontWeight:500, cursor:'pointer', color:'#374151' }}>
            <i className="ti ti-download" style={{ marginRight:6 }}></i>Exportar
          </button>
          <button onClick={()=>setShowForm(v=>!v)}
            style={{ display:'flex', alignItems:'center', gap:8, padding:'9px 16px', background:'#EB3238', color:'#fff', border:'none', borderRadius:8, fontSize:13, fontWeight:500, cursor:'pointer' }}>
            <i className="ti ti-plus"></i> Incluir
          </button>
        </div>
      </div>

      {/* Datas de pagamento configuráveis */}
      <div style={{ background:'#f9fafb', borderRadius:10, border:'1px solid #e5e7eb', padding:'12px 16px', marginBottom:16, display:'flex', gap:24, alignItems:'center', flexWrap:'wrap' }}>
        <span style={{ fontSize:12, fontWeight:600, color:'#6b7280', textTransform:'uppercase' }}>Datas do ciclo</span>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <label style={{ fontSize:12, color:'#374151' }}>Data 1:</label>
          <input type="date" value={data1} onChange={e=>salvarData1(e.target.value)}
            style={{ padding:'5px 8px', border:'1px solid #d1d5db', borderRadius:6, fontSize:13 }}/>
          {data1 && <button onClick={()=>setForm(f=>({...f, dataPagamento: data1}))}
            style={{ padding:'4px 10px', background:'#EB3238', color:'#fff', border:'none', borderRadius:6, fontSize:12, cursor:'pointer' }}>
            Usar
          </button>}
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <label style={{ fontSize:12, color:'#374151' }}>Data 2:</label>
          <input type="date" value={data2} onChange={e=>salvarData2(e.target.value)}
            style={{ padding:'5px 8px', border:'1px solid #d1d5db', borderRadius:6, fontSize:13 }}/>
          {data2 && <button onClick={()=>setForm(f=>({...f, dataPagamento: data2}))}
            style={{ padding:'4px 10px', background:'#EB3238', color:'#fff', border:'none', borderRadius:6, fontSize:12, cursor:'pointer' }}>
            Usar
          </button>}
        </div>
      </div>

      {showForm && (
        <div style={{ background:'#fff', borderRadius:12, padding:20, marginBottom:16, border:'1px solid #e5e7eb' }}>
          <form onSubmit={salvar}>
            <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr', gap:12 }}>
              <div>
                <label style={lbl}>Motorista</label>
                <select value={form.motoristaId} onChange={e=>setForm(f=>({...f,motoristaId:e.target.value}))} required style={inp}>
                  <option value="">Selecionar...</option>
                  {motoristas.map(m=>(
                    <option key={m.id} value={m.id}>{m.nome}{m.pix ? ` — pix: ${m.pix}` : ''}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={lbl}>Data de Pagamento</label>
                <input type="date" value={form.dataPagamento} onChange={e=>setForm(f=>({...f,dataPagamento:e.target.value}))} required style={inp}/>
                {(data1 || data2) && (
                  <div style={{ display:'flex', gap:6, marginTop:4 }}>
                    {data1 && <button type="button" onClick={()=>setForm(f=>({...f,dataPagamento:data1}))}
                      style={{ padding:'2px 8px', fontSize:11, border:'1px solid #EB3238', color:'#EB3238', background:'#fff', borderRadius:4, cursor:'pointer' }}>
                      {fmtDate(data1)}
                    </button>}
                    {data2 && <button type="button" onClick={()=>setForm(f=>({...f,dataPagamento:data2}))}
                      style={{ padding:'2px 8px', fontSize:11, border:'1px solid #EB3238', color:'#EB3238', background:'#fff', borderRadius:4, cursor:'pointer' }}>
                      {fmtDate(data2)}
                    </button>}
                  </div>
                )}
              </div>
              <div>
                <label style={lbl}>Valor (R$)</label>
                <input type="number" step="0.01" min="0.01" value={form.valor} onChange={e=>setForm(f=>({...f,valor:e.target.value}))} required style={inp}/>
              </div>
            </div>
            <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:12 }}>
              <button type="button" onClick={()=>setShowForm(false)} style={{ padding:'8px 16px', border:'1px solid #d1d5db', borderRadius:8, fontSize:13, cursor:'pointer', background:'#fff' }}>Cancelar</button>
              <button type="submit" style={{ padding:'8px 20px', background:'#EB3238', color:'#fff', border:'none', borderRadius:8, fontSize:13, fontWeight:500, cursor:'pointer' }}>Salvar</button>
            </div>
          </form>
        </div>
      )}

      <div style={{ background:'#fff', borderRadius:12, border:'1px solid #e5e7eb', overflow:'hidden' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
          <thead>
            <tr style={{ background:'#f9fafb' }}>
              {['Motorista','PIX','Data Pagamento','Valor','Registrado por',''].map(h=>(
                <th key={h} style={{ padding:'10px 14px', textAlign:'left', fontSize:11, fontWeight:600, color:'#6b7280', textTransform:'uppercase', borderBottom:'1px solid #e5e7eb' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lista.map(v=>(
              <tr key={v.id} style={{ borderBottom:'1px solid #f3f4f6' }}>
                <td style={{ padding:'10px 14px', fontWeight:500 }}>{v.motorista?.nome}</td>
                <td style={{ padding:'10px 14px', color:'#6b7280', fontSize:12 }}>{v.motorista?.pix || '—'}</td>
                <td style={{ padding:'10px 14px' }}>{fmtDate(v.dataPagamento)}</td>
                <td style={{ padding:'10px 14px', color:'#EB3238', fontWeight:500 }}>{fmt(v.valor)}</td>
                <td style={{ padding:'10px 14px', fontSize:11, color:'#9ca3af' }}>{v.usuario?.nome || '—'}</td>
                <td style={{ padding:'10px 14px' }}>
                  {(isAdmin || v.usuarioId === usuario?.id) && (
                    <button onClick={()=>excluir(v.id)} style={{ padding:'3px 10px', background:'#fff', border:'1px solid #EB3238', borderRadius:6, fontSize:12, color:'#EB3238', cursor:'pointer' }}>Excluir</button>
                  )}
                </td>
              </tr>
            ))}
            {lista.length===0 && <tr><td colSpan={6} style={{ padding:40, textAlign:'center', color:'#9ca3af' }}>Nenhum vale fixo</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

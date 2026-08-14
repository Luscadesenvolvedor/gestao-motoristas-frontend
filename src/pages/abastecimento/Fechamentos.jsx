import { useState, useEffect, useRef } from 'react';
import api from '../../services/api';
import toast from 'react-hot-toast';

const fmt    = v => `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
const fmtNeg = v => {
  const n = Number(v);
  return (n < 0 ? '- ' : '') + `R$ ${Math.abs(n).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
};
const fmtData = iso => iso
  ? new Date(iso.slice(0,10) + 'T12:00:00').toLocaleDateString('pt-BR')
  : '—';

function fileParaBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = e => resolve(e.target.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function Fechamentos() {
  const [fechamentos, setFechamentos]   = useState([]);
  const [loading, setLoading]           = useState(true);
  const [expandidos, setExpandidos]     = useState({});

  // Upload / parse
  const [parseando, setParseando]       = useState(false);
  const [preview, setPreview]           = useState(null); // dados parseados antes de salvar
  const [salvando, setSalvando]         = useState(false);
  const fileRef = useRef();

  useEffect(() => { carregar(); }, []);

  async function carregar() {
    setLoading(true);
    try {
      const { data } = await api.get('/fechamentos');
      setFechamentos(data);
    } catch { toast.error('Erro ao carregar fechamentos'); }
    finally { setLoading(false); }
  }

  async function onArquivo(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (file.type !== 'application/pdf') { toast.error('Selecione um arquivo PDF'); return; }
    setParseando(true);
    setPreview(null);
    try {
      const base64 = await fileParaBase64(file);
      const { data } = await api.post('/fechamentos/parsear', {
        arquivoBase64: base64,
        arquivoNome: file.name,
      });
      setPreview(data);
      toast.success(`${data.placas.length} placa(s) encontrada(s)`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao processar PDF');
    } finally {
      setParseando(false);
      e.target.value = '';
    }
  }

  async function salvar() {
    if (!preview || salvando) return;
    setSalvando(true);
    try {
      await api.post('/fechamentos', preview);
      toast.success('Fechamento salvo!');
      setPreview(null);
      carregar();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao salvar');
    } finally { setSalvando(false); }
  }

  async function excluir(id) {
    if (!window.confirm('Excluir este fechamento?')) return;
    try {
      await api.delete(`/fechamentos/${id}`);
      toast.success('Excluído');
      setFechamentos(f => f.filter(x => x.id !== id));
    } catch { toast.error('Erro ao excluir'); }
  }

  // ── Totais do preview ──
  const totalGeral   = preview?.placas.reduce((s, p) => s + Number(p.totalDespesas), 0) ?? 0;
  const perdaGeral   = preview?.placas.reduce((s, p) => s + Number(p.estimativaPerda ?? 0), 0) ?? 0;

  return (
    <div style={{ maxWidth:1100, margin:'0 auto' }}>
      {/* Cabeçalho */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:24 }}>
        <div>
          <h1 style={{ margin:0, fontSize:22, fontWeight:700, color:'#1a1a2e' }}>Fechamentos</h1>
          <p style={{ margin:'4px 0 0', fontSize:13, color:'#9ca3af' }}>Importe o relatório de Desempenho Operacional em PDF</p>
        </div>
        <button onClick={() => fileRef.current.click()} disabled={parseando}
          style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 20px', background:'#EB3238', color:'#fff', border:'none', borderRadius:9, fontSize:13, fontWeight:600, cursor:'pointer', opacity: parseando ? 0.7 : 1 }}>
          <i className={`ti ${parseando ? 'ti-loader-2' : 'ti-file-import'}`} style={{ fontSize:17 }}></i>
          {parseando ? 'Lendo PDF...' : 'Importar PDF'}
        </button>
        <input ref={fileRef} type="file" accept=".pdf" style={{ display:'none' }} onChange={onArquivo} />
      </div>

      {/* Preview após parse */}
      {preview && (
        <div style={{ background:'#fff', borderRadius:12, border:'2px solid #EB3238', marginBottom:24, overflow:'hidden' }}>
          {/* Header preview */}
          <div style={{ background:'#fff5f5', padding:'14px 20px', borderBottom:'1px solid #fecaca', display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:12 }}>
            <div>
              <div style={{ fontSize:13, fontWeight:700, color:'#EB3238', textTransform:'uppercase', letterSpacing:'0.4px', marginBottom:4 }}>
                Prévia — confirme e salve
              </div>
              <div style={{ fontSize:14, fontWeight:600, color:'#1a1a2e' }}>{preview.empresa}</div>
              <div style={{ fontSize:12, color:'#6b7280', marginTop:2 }}>
                Período: {fmtData(preview.periodoInicio)} até {fmtData(preview.periodoFim)}
              </div>
            </div>
            {/* Cards de totais */}
            <div style={{ display:'flex', gap:14, flexWrap:'wrap' }}>
              {[
                { label:'Placas', valor: preview.placas.length, cor:'#0891b2', raw: true },
                { label:'Total Despesas', valor: fmt(totalGeral), cor:'#1a1a2e' },
                { label:'Estimativa Perda', valor: fmtNeg(perdaGeral), cor:'#dc2626' },
              ].map(c => (
                <div key={c.label} style={{ textAlign:'center', background:'#fff', borderRadius:8, border:'1px solid #f3f4f6', padding:'8px 18px' }}>
                  <div style={{ fontSize:11, color:'#9ca3af', textTransform:'uppercase', fontWeight:600, marginBottom:2 }}>{c.label}</div>
                  <div style={{ fontSize:15, fontWeight:700, color: c.cor }}>{c.valor}</div>
                </div>
              ))}
            </div>
            <div style={{ display:'flex', gap:8 }}>
              <button onClick={() => setPreview(null)}
                style={{ padding:'8px 16px', border:'1px solid #e5e7eb', borderRadius:8, background:'#fff', fontSize:13, cursor:'pointer', color:'#6b7280' }}>
                Cancelar
              </button>
              <button onClick={salvar} disabled={salvando}
                style={{ padding:'8px 18px', border:'none', borderRadius:8, background:'#16a34a', color:'#fff', fontSize:13, fontWeight:600, cursor:'pointer', opacity: salvando ? 0.7 : 1, display:'flex', alignItems:'center', gap:6 }}>
                <i className="ti ti-device-floppy" style={{ fontSize:15 }}></i>
                {salvando ? 'Salvando...' : 'Salvar Fechamento'}
              </button>
            </div>
          </div>

          {/* Tabela preview */}
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
              <thead>
                <tr style={{ background:'#f9fafb' }}>
                  {['Placa','Modelo','Total Despesas','Estimativa Perda'].map(h => (
                    <th key={h} style={{ padding:'9px 16px', textAlign:'left', fontSize:11, fontWeight:600, color:'#6b7280', textTransform:'uppercase', borderBottom:'1px solid #e5e7eb' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.placas.map((p, i) => (
                  <tr key={i} style={{ borderBottom:'1px solid #f3f4f6' }}>
                    <td style={{ padding:'9px 16px', fontWeight:700, color:'#1a1a2e', fontFamily:'monospace', fontSize:14 }}>{p.placa}</td>
                    <td style={{ padding:'9px 16px', color:'#374151' }}>{p.modelo || '—'}</td>
                    <td style={{ padding:'9px 16px', fontWeight:600, color:'#1a1a2e' }}>{fmt(p.totalDespesas)}</td>
                    <td style={{ padding:'9px 16px', color: Number(p.estimativaPerda) < 0 ? '#dc2626' : '#374151', fontWeight:600 }}>
                      {p.estimativaPerda != null ? fmtNeg(p.estimativaPerda) : '—'}
                    </td>
                  </tr>
                ))}
                {/* Total */}
                <tr style={{ background:'#f9fafb', fontWeight:700 }}>
                  <td colSpan={2} style={{ padding:'10px 16px', color:'#6b7280', fontSize:12 }}>TOTAL — {preview.placas.length} placa(s)</td>
                  <td style={{ padding:'10px 16px', color:'#1a1a2e' }}>{fmt(totalGeral)}</td>
                  <td style={{ padding:'10px 16px', color:'#dc2626' }}>{fmtNeg(perdaGeral)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Lista de fechamentos salvos */}
      {loading ? (
        <div style={{ textAlign:'center', padding:60, color:'#9ca3af' }}>Carregando...</div>
      ) : fechamentos.length === 0 ? (
        <div style={{ textAlign:'center', padding:60, color:'#9ca3af', background:'#fff', borderRadius:12, border:'1px solid #e5e7eb' }}>
          <i className="ti ti-file-report" style={{ fontSize:40, display:'block', marginBottom:8 }}></i>
          Nenhum fechamento importado ainda.
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          {fechamentos.map(f => {
            const totalF  = f.placas.reduce((s, p) => s + Number(p.totalDespesas), 0);
            const perdaF  = f.placas.reduce((s, p) => s + Number(p.estimativaPerda ?? 0), 0);
            const exp     = expandidos[f.id];
            return (
              <div key={f.id} style={{ background:'#fff', borderRadius:12, border:'1px solid #e5e7eb', overflow:'hidden' }}>
                {/* Linha principal */}
                <div style={{ padding:'14px 20px', display:'flex', alignItems:'center', gap:16, flexWrap:'wrap' }}>
                  {/* Empresa + Período */}
                  <div style={{ flex:1, minWidth:200 }}>
                    <div style={{ fontWeight:700, fontSize:14, color:'#1a1a2e' }}>{f.empresa}</div>
                    <div style={{ fontSize:12, color:'#9ca3af', marginTop:2 }}>
                      {fmtData(f.periodoInicio)} até {fmtData(f.periodoFim)}
                    </div>
                    {f.arquivoNome && (
                      <div style={{ fontSize:11, color:'#c4c4cc', marginTop:2 }}>
                        <i className="ti ti-file-type-pdf" style={{ fontSize:11 }}></i> {f.arquivoNome}
                      </div>
                    )}
                  </div>

                  {/* Métricas */}
                  <div style={{ display:'flex', gap:20, flexWrap:'wrap' }}>
                    <div style={{ textAlign:'center' }}>
                      <div style={{ fontSize:11, color:'#9ca3af', textTransform:'uppercase', fontWeight:600 }}>Placas</div>
                      <div style={{ fontSize:15, fontWeight:700, color:'#0891b2' }}>{f.placas.length}</div>
                    </div>
                    <div style={{ textAlign:'center' }}>
                      <div style={{ fontSize:11, color:'#9ca3af', textTransform:'uppercase', fontWeight:600 }}>Total Despesas</div>
                      <div style={{ fontSize:15, fontWeight:700, color:'#1a1a2e' }}>{fmt(totalF)}</div>
                    </div>
                    <div style={{ textAlign:'center' }}>
                      <div style={{ fontSize:11, color:'#9ca3af', textTransform:'uppercase', fontWeight:600 }}>Est. Perda</div>
                      <div style={{ fontSize:15, fontWeight:700, color:'#dc2626' }}>{fmtNeg(perdaF)}</div>
                    </div>
                  </div>

                  {/* Ações */}
                  <div style={{ display:'flex', gap:6 }}>
                    <button onClick={() => setExpandidos(e => ({ ...e, [f.id]: !e[f.id] }))}
                      style={{ padding:'6px 12px', border:'1px solid #e5e7eb', borderRadius:7, background: exp ? '#f0f9ff' : '#f9fafb', fontSize:12, cursor:'pointer', color: exp ? '#0891b2' : '#6b7280', display:'flex', alignItems:'center', gap:5 }}>
                      <i className={`ti ${exp ? 'ti-chevron-up' : 'ti-chevron-down'}`}></i>
                      {exp ? 'Fechar' : `Ver ${f.placas.length} placas`}
                    </button>
                    <button onClick={() => excluir(f.id)}
                      style={{ padding:'6px 10px', border:'1px solid #fee2e2', borderRadius:7, background:'#fff5f5', fontSize:13, cursor:'pointer', color:'#dc2626' }}>
                      <i className="ti ti-trash"></i>
                    </button>
                  </div>

                  {/* Quem importou */}
                  <div style={{ fontSize:11, color:'#c4c4cc', width:'100%', marginTop:-8 }}>
                    <i className="ti ti-user-plus" style={{ fontSize:10 }}></i> {f.usuario?.nome} · {new Date(f.importadoEm).toLocaleString('pt-BR')}
                  </div>
                </div>

                {/* Tabela de placas expandida */}
                {exp && (
                  <div style={{ borderTop:'1px solid #f3f4f6' }}>
                    <div style={{ overflowX:'auto' }}>
                      <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
                        <thead>
                          <tr style={{ background:'#f9fafb' }}>
                            <th style={{ padding:'8px 16px', textAlign:'left', fontSize:11, fontWeight:600, color:'#6b7280', textTransform:'uppercase', borderBottom:'1px solid #e5e7eb' }}>#</th>
                            {['Placa','Modelo','Total Despesas','Estimativa Perda'].map(h => (
                              <th key={h} style={{ padding:'8px 16px', textAlign:'left', fontSize:11, fontWeight:600, color:'#6b7280', textTransform:'uppercase', borderBottom:'1px solid #e5e7eb' }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {f.placas.map((p, i) => (
                            <tr key={p.id} style={{ borderBottom:'1px solid #f3f4f6' }}>
                              <td style={{ padding:'8px 16px', color:'#9ca3af', fontSize:11 }}>{i + 1}</td>
                              <td style={{ padding:'8px 16px', fontWeight:700, color:'#1a1a2e', fontFamily:'monospace', fontSize:13 }}>{p.placa}</td>
                              <td style={{ padding:'8px 16px', color:'#374151' }}>{p.modelo || '—'}</td>
                              <td style={{ padding:'8px 16px', fontWeight:600, color:'#1a1a2e' }}>{fmt(p.totalDespesas)}</td>
                              <td style={{ padding:'8px 16px', fontWeight:600, color: Number(p.estimativaPerda) < 0 ? '#dc2626' : '#16a34a' }}>
                                {p.estimativaPerda != null ? fmtNeg(p.estimativaPerda) : '—'}
                              </td>
                            </tr>
                          ))}
                          {/* Total */}
                          <tr style={{ background:'#f9fafb', fontWeight:700 }}>
                            <td></td>
                            <td colSpan={2} style={{ padding:'9px 16px', color:'#6b7280', fontSize:12 }}>TOTAL</td>
                            <td style={{ padding:'9px 16px', color:'#1a1a2e' }}>{fmt(totalF)}</td>
                            <td style={{ padding:'9px 16px', color:'#dc2626' }}>{fmtNeg(perdaF)}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

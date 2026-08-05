// v3
import { useState, useEffect, useRef, useMemo } from 'react';
import * as XLSX from 'xlsx';
import api from '../services/api';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';

const TIPOS = [
  { key: 'saldo',      label: 'Saldo/Prévia',      color: '#EB3238' },
  { key: 'diarias',    label: 'Diárias dedicados', color: '#0ea5e9' },
  { key: 'bonificacao',label: 'Bonificações',       color: '#16a34a' },
  { key: 'custoFolha', label: 'Custo Folha',        color: '#8b5cf6' },
];

const fmtR  = v => `R$ ${parseFloat(v||0).toLocaleString('pt-BR', { minimumFractionDigits:2 })}`;
const fmtDt = s => s ? new Date(s).toLocaleDateString('pt-BR') : '—';

const norm = s => String(s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9\s]/g,'').trim();

// Tokens com mais de 2 letras (ignora partículas como "de", "da")
const tokens = s => norm(s).split(/\s+/).filter(t => t.length > 2);

// Score de similaridade entre dois nomes (0–1)
function scoreNome(a, b) {
  const ta = tokens(a), tb = tokens(b);
  if (!ta.length || !tb.length) return 0;
  const tbSet = new Set(tb);
  const overlap = ta.filter(t => tbSet.has(t)).length;
  // token overlap é o fator principal
  const tokenScore = overlap / Math.max(ta.length, tb.length);
  // levenshtein normalizado como secundário
  const na = norm(a), nb = norm(b);
  const maxL = Math.max(na.length, nb.length);
  if (!maxL) return tokenScore;
  const dp = Array.from({length: na.length+1}, (_,i) =>
    Array.from({length: nb.length+1}, (_,j) => i===0 ? j : j===0 ? i : 0)
  );
  for (let i=1; i<=na.length; i++)
    for (let j=1; j<=nb.length; j++)
      dp[i][j] = na[i-1]===nb[j-1] ? dp[i-1][j-1] : 1+Math.min(dp[i-1][j],dp[i][j-1],dp[i-1][j-1]);
  const levScore = 1 - dp[na.length][nb.length] / maxL;
  return tokenScore * 0.7 + levScore * 0.3;
}

const THRESHOLD = 0.45; // score mínimo para considerar match

// Analisa correspondências entre nomes da planilha e registros existentes
function analisarCorrespondencias(nomesPlanilha, mapaExistentes) {
  const exatos = [], similares = [], semMatch = [];
  for (const nome of nomesPlanilha) {
    const n = norm(nome);
    if (mapaExistentes.has(n)) {
      exatos.push({ planilha: nome, encontrado: mapaExistentes.get(n).original, veiculo: mapaExistentes.get(n).veiculo, score: 1 });
      continue;
    }
    let melhorScore = 0, melhorEntry = null;
    for (const [nk, entry] of mapaExistentes) {
      const s = scoreNome(n, nk);
      if (s > melhorScore) { melhorScore = s; melhorEntry = entry; }
    }
    if (melhorScore >= THRESHOLD && melhorEntry) {
      similares.push({ planilha: nome, encontrado: melhorEntry.original, veiculo: melhorEntry.veiculo, score: melhorScore });
    } else {
      semMatch.push({ planilha: nome, melhorScore, melhorNome: melhorEntry?.original });
    }
  }
  return { exatos, similares, semMatch };
}

const MESES_PT = { janeiro:1,fevereiro:2,marco:3,abril:4,maio:5,junho:6,julho:7,agosto:8,setembro:9,outubro:10,novembro:11,dezembro:12,jan:1,fev:2,mar:3,abr:4,mai:5,jun:6,jul:7,ago:8,set:9,out:10,nov:11,dez:12 };

function parseMes(v) {
  if (!v && v !== 0) return null;
  const s = String(v).trim();
  if (/^\d{4}-\d{2}/.test(s)) return s.slice(0,7);
  if (/^\d{1,2}\/\d{4}$/.test(s)) { const [m,a] = s.split('/'); return `${a}-${m.padStart(2,'0')}`; }
  if (/^\d{4}\/\d{2}$/.test(s))   { const [a,m] = s.split('/'); return `${a}-${m}`; }
  if (v instanceof Date) return `${v.getFullYear()}-${String(v.getMonth()+1).padStart(2,'0')}`;
  if (typeof v === 'number') {
    const d = new Date(Math.round((v - 25569) * 86400 * 1000));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}`;
  }
  const lower = norm(s);
  for (const [nome, num] of Object.entries(MESES_PT)) {
    if (lower.startsWith(nome)) {
      const anoRaw = s.match(/\d{4}/)?.[0] || s.match(/\d{2}/)?.[0];
      const anoFull = anoRaw ? (anoRaw.length === 2 ? `20${anoRaw}` : anoRaw) : new Date().getFullYear();
      return `${anoFull}-${String(num).padStart(2,'0')}`;
    }
  }
  return s.length >= 7 ? s.slice(0,7) : null;
}

function parseVal(v) {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return v;
  const n = parseFloat(String(v).replace(/[R$\s]/g,'').replace(/\./g,'').replace(',','.'));
  return isNaN(n) ? null : n;
}

export default function LevantamentosImportacoes() {
  const { isAdmin } = useAuth();
  const [lista, setLista]         = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [preview, setPreview]     = useState(null); // { nomeArquivo, registros, tipoPagamento, frota, semPlaca }
  const [salvando, setSalvando]   = useState(false);
  const [relatorio, setRelatorio] = useState(null); // { correspondencias, nomeArquivo }
  const [placasEdit, setPlacasEdit] = useState({}); // { [motorista]: { valor, salvando, salvo } }
  const fileRef = useRef();

  async function carregar() {
    setCarregando(true);
    try {
      const { data } = await api.get('/levantamentos-motoristas/importacoes');
      setLista(data);
    } catch { toast.error('Erro ao carregar importações'); }
    finally { setCarregando(false); }
  }

  useEffect(() => { carregar(); }, []);

  async function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const buf = await file.arrayBuffer();
      const wb  = XLSX.read(buf, { cellDates: true });
      const ws  = wb.Sheets[wb.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true });

      const header = (raw[0] || []).map(norm);
      const iMot = header.findIndex(h => h.includes('motorista'));
      const iVei = header.findIndex(h => h.includes('veiculo') || h.includes('placa') || h.includes('vei'));
      const iVal = header.findIndex(h => h.includes('valor'));
      const iMes = header.findIndex(h => h.includes('mes'));

      if (iMot < 0 || iVal < 0) {
        toast.error(`Colunas não encontradas. Lidos: ${header.join(', ')}`);
        return;
      }

      const registros = raw.slice(1)
        .filter(r => r[iMot] && String(r[iMot]).trim())
        .map(r => ({
          motorista: String(r[iMot]).trim(),
          veiculo:   iVei >= 0 && r[iVei] ? String(r[iVei]).trim() : null,
          valor:     parseVal(r[iVal]),
          mes:       iMes >= 0 ? parseMes(r[iMes]) : null,
        }))
        .filter(r => r.valor !== null);

      if (!registros.length) { toast.error('Nenhum registro válido'); return; }
      setPreview({ nomeArquivo: file.name, registros, tipoPagamento: '', frota: '' });
      toast.success(`${registros.length} registros lidos`);
    } catch (err) { toast.error('Erro ao ler arquivo: ' + err.message); }
    e.target.value = '';
  }

  async function handleTipoSelect(tipo) {
    setPreview(p => ({ ...p, tipoPagamento: tipo, correspondencias: null }));
    if (tipo === 'custoFolha' && preview?.registros?.length) {
      try {
        const { data: existentes } = await api.get('/levantamentos-motoristas');
        // Mapa: normName → { original, veiculo } (usa o primeiro encontrado por nome)
        const mapaExistentes = new Map();
        for (const r of existentes) {
          const k = norm(r.motorista);
          if (!mapaExistentes.has(k)) mapaExistentes.set(k, { original: r.motorista, veiculo: r.veiculo });
        }
        const nomesPlanilha = [...new Set(preview.registros.map(r => r.motorista))];
        const correspondencias = analisarCorrespondencias(nomesPlanilha, mapaExistentes);

        // Popula veiculo nos registros quando há match (exato ou similar)
        const matchMap = new Map();
        for (const e of correspondencias.exatos)   matchMap.set(e.planilha, e.veiculo);
        for (const s of correspondencias.similares) matchMap.set(s.planilha, s.veiculo);
        const registrosAtualizados = preview.registros.map(r =>
          matchMap.has(r.motorista) ? { ...r, veiculo: matchMap.get(r.motorista) } : r
        );

        setPreview(p => ({ ...p, tipoPagamento: tipo, correspondencias, registros: registrosAtualizados }));
      } catch { setPreview(p => ({ ...p, tipoPagamento: tipo })); }
    }
  }

  async function salvar() {
    if (!preview) return;
    if (!preview.tipoPagamento) { toast.error('Selecione o tipo de pagamento'); return; }
    if (!preview.frota)         { toast.error('Selecione a frota'); return; }
    setSalvando(true);
    try {
      await api.post('/levantamentos-motoristas/importar', {
        nomeArquivo:   preview.nomeArquivo,
        registros:     preview.registros,
        tipoPagamento: preview.tipoPagamento,
        frota:         preview.frota,
      });
      toast.success('Importação salva!');
      // Se custo folha, mantém o relatório de correspondências
      if (preview.tipoPagamento === 'custoFolha' && preview.correspondencias) {
        setRelatorio({ correspondencias: preview.correspondencias, nomeArquivo: preview.nomeArquivo });
        setPlacasEdit({});
      }
      setPreview(null);
      await carregar();
    } catch (err) { toast.error(err?.response?.data?.error || 'Erro ao salvar'); }
    finally { setSalvando(false); }
  }

  async function salvarPlaca(motorista) {
    const placa = (placasEdit[motorista]?.valor || '').trim();
    if (!placa) { toast.error('Digite a placa'); return; }
    setPlacasEdit(p => ({ ...p, [motorista]: { ...p[motorista], salvando: true } }));
    try {
      await api.put('/levantamentos-motoristas/veiculo', { motorista, veiculo: placa });
      setPlacasEdit(p => ({ ...p, [motorista]: { ...p[motorista], salvando: false, salvo: true } }));
      toast.success(`Placa salva para ${motorista}`);
    } catch {
      toast.error('Erro ao salvar placa');
      setPlacasEdit(p => ({ ...p, [motorista]: { ...p[motorista], salvando: false } }));
    }
  }

  async function atualizarCampo(id, campo, valor) {
    try {
      const atual = lista.find(i => i.id === id) || {};
      const payload = {
        tipoPagamento: campo === 'tipoPagamento' ? valor : atual.tipoPagamento,
        frota:         campo === 'frota'         ? valor : atual.frota,
      };
      await api.put(`/levantamentos-motoristas/importacoes/${id}`, payload);
      setLista(l => l.map(i => i.id === id ? { ...i, [campo]: valor || null } : i));
    } catch { toast.error('Erro ao atualizar'); }
  }

  async function excluir(id, nome) {
    if (!confirm(`Excluir "${nome}" e todos os registros?`)) return;
    try {
      await api.delete(`/levantamentos-motoristas/importacoes/${id}`);
      toast.success('Removida');
      setLista(l => l.filter(i => i.id !== id));
    } catch { toast.error('Erro ao excluir'); }
  }

  const totaisPorTipo = useMemo(() => {
    const map = { saldo: 0, diarias: 0, bonificacao: 0 };
    for (const im of lista) {
      const k = im.tipoPagamento;
      if (k && map[k] !== undefined) map[k] += parseFloat(im.totalValor || 0);
    }
    return map;
  }, [lista]);

  return (
    <div style={{ padding: 24 }}>
      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <h2 style={{ fontSize:20, fontWeight:700, color:'#1a1a2e', margin:0 }}>Importações — Por Motorista</h2>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={handleFile} style={{ display:'none' }} />
          <button onClick={() => fileRef.current?.click()}
            style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 16px', background:'#EB3238', color:'#fff', border:'none', borderRadius:8, fontSize:13, fontWeight:600, cursor:'pointer' }}>
            <i className="ti ti-upload" style={{ fontSize:14 }}></i> Importar Planilha
          </button>
        </div>
      </div>

      {/* Preview */}
      {preview && (
        <div style={{ background:'#fffbeb', border:'1px solid #fde68a', borderRadius:12, padding:'16px 20px', marginBottom:20 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14 }}>
            <i className="ti ti-file-spreadsheet" style={{ fontSize:20, color:'#d97706' }}></i>
            <div>
              <div style={{ fontWeight:600, fontSize:13, color:'#92400e' }}>{preview.nomeArquivo}</div>
              <div style={{ fontSize:11, color:'#b45309' }}>{preview.registros.length} registros lidos — preencha os campos abaixo para salvar</div>
            </div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr auto auto', gap:10, alignItems:'end' }}>
            <div>
              <div style={{ fontSize:10, fontWeight:700, color:'#92400e', textTransform:'uppercase', marginBottom:4 }}>Tipo de Pagamento</div>
              <select value={preview.tipoPagamento}
                onChange={e => handleTipoSelect(e.target.value)}
                style={{ width:'100%', padding:'7px 10px', border:'1.5px solid #fbbf24', borderRadius:8, fontSize:13, background:'#fff', cursor:'pointer', outline:'none' }}>
                <option value="">— selecione —</option>
                {TIPOS.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <div style={{ fontSize:10, fontWeight:700, color:'#92400e', textTransform:'uppercase', marginBottom:4 }}>Frota</div>
              <select value={preview.frota}
                onChange={e => setPreview(p => ({ ...p, frota: e.target.value }))}
                style={{ width:'100%', padding:'7px 10px', border:'1.5px solid #fbbf24', borderRadius:8, fontSize:13, background:'#fff', cursor:'pointer', outline:'none' }}>
                <option value="">— selecione —</option>
                <option value="FROTA">FROTA</option>
                <option value="MELI">MELI</option>
              </select>
            </div>
            <button onClick={() => setPreview(null)}
              style={{ padding:'7px 14px', border:'1px solid #d1d5db', borderRadius:8, background:'#fff', fontSize:12, cursor:'pointer', whiteSpace:'nowrap' }}>
              Cancelar
            </button>
            <button onClick={salvar} disabled={salvando}
              style={{ padding:'7px 16px', border:'none', borderRadius:8, background:'#16a34a', color:'#fff', fontSize:12, fontWeight:600, cursor:'pointer', whiteSpace:'nowrap' }}>
              {salvando ? 'Salvando...' : 'Salvar no banco'}
            </button>
          </div>

          {/* Resumo de correspondências (visível já no preview) */}
          {preview.tipoPagamento === 'custoFolha' && preview.correspondencias && (() => {
            const { exatos, similares, semMatch } = preview.correspondencias;
            return (
              <div style={{ marginTop:14, display:'flex', flexDirection:'column', gap:8 }}>
                {exatos.length > 0 && (
                  <div style={{ background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:8, padding:'8px 14px', fontSize:12, color:'#166534', display:'flex', alignItems:'center', gap:6 }}>
                    <i className="ti ti-circle-check" style={{ fontSize:14 }}></i>
                    <strong>{exatos.length}</strong> motorista(s) encontrados exatamente
                  </div>
                )}
                {similares.length > 0 && (
                  <div style={{ background:'#fffbeb', border:'1px solid #fbbf24', borderRadius:8, padding:'10px 14px' }}>
                    <div style={{ fontWeight:700, fontSize:12, color:'#92400e', marginBottom:6, display:'flex', alignItems:'center', gap:6 }}>
                      <i className="ti ti-arrows-exchange" style={{ fontSize:14 }}></i>
                      {similares.length} encontrado(s) por similaridade — verifique:
                    </div>
                    <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
                      {similares.map(s => (
                        <div key={s.planilha} style={{ fontSize:11, color:'#92400e', display:'flex', gap:6, alignItems:'center' }}>
                          <span style={{ fontWeight:600 }}>{s.planilha}</span>
                          <i className="ti ti-arrow-right" style={{ fontSize:10 }}></i>
                          <span style={{ color:'#065f46', fontWeight:600 }}>{s.encontrado}</span>
                          <span style={{ color:'#9ca3af' }}>({Math.round(s.score*100)}%)</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {semMatch.length > 0 && (
                  <div style={{ background:'#fef2f2', border:'1px solid #fecaca', borderRadius:8, padding:'10px 14px' }}>
                    <div style={{ fontWeight:700, fontSize:12, color:'#991b1b', marginBottom:6, display:'flex', alignItems:'center', gap:6 }}>
                      <i className="ti ti-x" style={{ fontSize:14 }}></i>
                      {semMatch.length} sem correspondência — serão importados sem placa
                    </div>
                    <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
                      {semMatch.map(s => (
                        <span key={s.planilha} style={{ padding:'2px 8px', borderRadius:20, background:'#fee2e2', color:'#991b1b', fontSize:11, fontWeight:600 }}>{s.planilha}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {/* Relatório pós-importação */}
      {relatorio && (() => {
        const { exatos, similares, semMatch } = relatorio.correspondencias;
        const total = exatos.length + similares.length + semMatch.length;
        return (
          <div style={{ background:'#fff', border:'1px solid #e5e7eb', borderRadius:12, padding:20, marginBottom:20 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
              <div>
                <div style={{ fontWeight:700, fontSize:15, color:'#1a1a2e' }}>Relatório de Correspondências — {relatorio.nomeArquivo}</div>
                <div style={{ fontSize:12, color:'#6b7280', marginTop:2 }}>
                  {exatos.length} exatos · {similares.length} por similaridade · {semMatch.length} sem correspondência · {total} total
                </div>
              </div>
              <button onClick={() => setRelatorio(null)}
                style={{ padding:'5px 12px', border:'1px solid #d1d5db', borderRadius:8, background:'#fff', fontSize:12, cursor:'pointer', color:'#6b7280' }}>
                Fechar
              </button>
            </div>

            {/* Tabela completa */}
            <div style={{ border:'1px solid #e5e7eb', borderRadius:8, overflow:'hidden' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
                <thead>
                  <tr style={{ background:'#f8fafc' }}>
                    {['#','Nome na planilha','Encontrado como','Placa','Status'].map(h => (
                      <th key={h} style={{ padding:'9px 14px', textAlign:'left', fontSize:11, fontWeight:700, color:'#374151', textTransform:'uppercase', letterSpacing:'0.4px', borderBottom:'1px solid #e5e7eb', whiteSpace:'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    ...exatos.map(e => ({ ...e, status:'exato' })),
                    ...similares.map(s => ({ ...s, status:'similar' })),
                    ...semMatch.map(s => ({ planilha: s.planilha, encontrado: s.melhorNome, veiculo: null, score: s.melhorScore, status:'sem_match' })),
                  ].map((row, i) => (
                    <tr key={row.planilha+i} style={{ borderBottom:'1px solid #f3f4f6', background: i%2===0?'#fff':'#fafafa' }}>
                      <td style={{ padding:'9px 14px', color:'#9ca3af', fontSize:12 }}>{i+1}</td>
                      <td style={{ padding:'9px 14px', fontWeight:600, color:'#1a1a2e' }}>{row.planilha}</td>
                      <td style={{ padding:'9px 14px', color:'#374151' }}>
                        {row.encontrado || <span style={{ color:'#d1d5db' }}>—</span>}
                        {row.status === 'similar' && <span style={{ marginLeft:6, fontSize:10, color:'#9ca3af' }}>({Math.round(row.score*100)}%)</span>}
                      </td>
                      <td style={{ padding:'9px 14px' }}>
                        {row.veiculo ? (
                          <span style={{ padding:'2px 8px', borderRadius:6, background:'#f1f5f9', color:'#374151', fontSize:11, fontWeight:700, fontFamily:'monospace' }}>{row.veiculo}</span>
                        ) : row.status === 'sem_match' ? (
                          placasEdit[row.planilha]?.salvo ? (
                            <span style={{ padding:'2px 8px', borderRadius:6, background:'#dcfce7', color:'#166534', fontSize:11, fontWeight:700, fontFamily:'monospace' }}>
                              {placasEdit[row.planilha].valor} ✓
                            </span>
                          ) : (
                            <div style={{ display:'flex', gap:4, alignItems:'center' }}>
                              <input
                                value={placasEdit[row.planilha]?.valor || ''}
                                onChange={e => setPlacasEdit(p => ({ ...p, [row.planilha]: { ...p[row.planilha], valor: e.target.value.toUpperCase(), salvo: false } }))}
                                onKeyDown={e => e.key === 'Enter' && salvarPlaca(row.planilha)}
                                placeholder="ABC-1234"
                                style={{ width:90, padding:'4px 7px', border:'1.5px solid #e5e7eb', borderRadius:6, fontSize:11, fontFamily:'monospace', fontWeight:700, textTransform:'uppercase', outline:'none' }}
                              />
                              <button onClick={() => salvarPlaca(row.planilha)}
                                disabled={placasEdit[row.planilha]?.salvando}
                                style={{ padding:'4px 8px', border:'none', borderRadius:6, background:'#6366f1', color:'#fff', fontSize:11, fontWeight:600, cursor:'pointer', whiteSpace:'nowrap' }}>
                                {placasEdit[row.planilha]?.salvando ? '...' : 'Salvar'}
                              </button>
                            </div>
                          )
                        ) : (
                          <span style={{ color:'#d1d5db' }}>—</span>
                        )}
                      </td>
                      <td style={{ padding:'9px 14px' }}>
                        {row.status === 'exato'    && <span style={{ padding:'2px 8px', borderRadius:20, fontSize:11, fontWeight:700, background:'#dcfce7', color:'#166534', border:'1px solid #bbf7d0' }}>Exato</span>}
                        {row.status === 'similar'  && <span style={{ padding:'2px 8px', borderRadius:20, fontSize:11, fontWeight:700, background:'#fef3c7', color:'#92400e', border:'1px solid #fbbf24' }}>Similar</span>}
                        {row.status === 'sem_match'&& <span style={{ padding:'2px 8px', borderRadius:20, fontSize:11, fontWeight:700, background:'#fee2e2', color:'#991b1b', border:'1px solid #fecaca' }}>Sem correspondência</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}

      {/* Cards por tipo */}
      {lista.length > 0 && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(200px,1fr))', gap:12, marginBottom:20 }}>
          {TIPOS.map(t => (
            <div key={t.key} style={{ background:'#fff', border:'1px solid #e5e7eb', borderRadius:12, padding:'16px 20px', borderTop:`3px solid ${t.color}` }}>
              <div style={{ fontSize:10, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:8 }}>{t.label}</div>
              <div style={{ fontSize:22, fontWeight:800, color: t.color }}>{fmtR(totaisPorTipo[t.key])}</div>
            </div>
          ))}
        </div>
      )}

      {/* Tabela */}
      {carregando ? (
        <div style={{ textAlign:'center', padding:60, color:'#9ca3af' }}>Carregando...</div>
      ) : lista.length === 0 ? (
        <div style={{ textAlign:'center', padding:60, color:'#9ca3af', background:'#fff', borderRadius:12, border:'1px dashed #d1d5db' }}>
          <i className="ti ti-file-off" style={{ fontSize:36, display:'block', marginBottom:10, color:'#d1d5db' }}></i>
          <div style={{ fontWeight:500 }}>Nenhuma importação</div>
          <div style={{ fontSize:12, marginTop:4 }}>Clique em "Importar Planilha" para começar</div>
        </div>
      ) : (
        <div style={{ background:'#fff', border:'1px solid #e5e7eb', borderRadius:12, overflow:'hidden' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
            <thead>
              <tr style={{ background:'#f8fafc' }}>
                {['Arquivo','Data','Registros','Total','Tipo','Frota',''].map(h => (
                  <th key={h} style={{ padding:'10px 16px', textAlign:'left', fontSize:11, fontWeight:700, color:'#374151', textTransform:'uppercase', letterSpacing:'0.4px', borderBottom:'1px solid #e5e7eb', whiteSpace:'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lista.map((im, i) => (
                <tr key={im.id} style={{ background: i%2===0?'#fff':'#fafafa' }}
                  onMouseEnter={e => e.currentTarget.style.background='#fef2f2'}
                  onMouseLeave={e => e.currentTarget.style.background=i%2===0?'#fff':'#fafafa'}>
                  <td style={{ padding:'11px 16px', fontWeight:600, color:'#1a1a2e', borderBottom:'1px solid #f3f4f6' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <i className="ti ti-file-spreadsheet" style={{ fontSize:15, color:'#6366f1' }}></i>
                      {im.nomeArquivo.replace(/\.xlsx?$/i,'')}
                    </div>
                  </td>
                  <td style={{ padding:'11px 16px', color:'#6b7280', borderBottom:'1px solid #f3f4f6' }}>{fmtDt(im.criadoEm)}</td>
                  <td style={{ padding:'11px 16px', borderBottom:'1px solid #f3f4f6' }}>
                    <span style={{ padding:'2px 8px', borderRadius:6, background:'#f1f5f9', color:'#374151', fontSize:12, fontWeight:700 }}>{im.totalRegistros}</span>
                  </td>
                  <td style={{ padding:'11px 16px', fontWeight:700, color:'#374151', borderBottom:'1px solid #f3f4f6' }}>{fmtR(im.totalValor)}</td>
                  <td style={{ padding:'11px 16px', borderBottom:'1px solid #f3f4f6' }}>
                    {isAdmin ? (
                      <select value={im.tipoPagamento || ''} onChange={e => atualizarCampo(im.id, 'tipoPagamento', e.target.value)}
                        style={{ padding:'4px 8px', border:'1.5px solid #e5e7eb', borderRadius:6, fontSize:12, color:'#374151', background:'#fff', cursor:'pointer', outline:'none' }}>
                        <option value="">— sem tipo —</option>
                        {TIPOS.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
                      </select>
                    ) : (
                      (() => { const t = TIPOS.find(x => x.key === im.tipoPagamento); return t ? <span style={{ padding:'2px 8px', borderRadius:20, fontSize:11, fontWeight:700, background:t.color+'18', color:t.color, border:`1px solid ${t.color}40` }}>{t.label}</span> : <span style={{ color:'#d1d5db' }}>—</span>; })()
                    )}
                  </td>
                  <td style={{ padding:'11px 16px', borderBottom:'1px solid #f3f4f6' }}>
                    {isAdmin ? (
                      <select value={im.frota || ''} onChange={e => atualizarCampo(im.id, 'frota', e.target.value)}
                        style={{ padding:'4px 8px', border:'1.5px solid #e5e7eb', borderRadius:6, fontSize:12, color:'#374151', background:'#fff', cursor:'pointer', outline:'none' }}>
                        <option value="">— frota —</option>
                        <option value="FROTA">FROTA</option>
                        <option value="MELI">MELI</option>
                      </select>
                    ) : (
                      im.frota
                        ? <span style={{ padding:'2px 8px', borderRadius:20, fontSize:11, fontWeight:700, background: im.frota==='MELI'?'#dbeafe':'#d1fae5', color: im.frota==='MELI'?'#1d4ed8':'#065f46' }}>{im.frota}</span>
                        : <span style={{ color:'#d1d5db' }}>—</span>
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

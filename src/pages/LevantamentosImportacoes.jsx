// v4
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
const tokens = s => norm(s).split(/\s+/).filter(t => t.length > 2);

function scoreNome(a, b) {
  const ta = tokens(a), tb = tokens(b);
  if (!ta.length || !tb.length) return 0;

  // Primeiro token (primeiro nome) tem que bater — se não, não é a mesma pessoa
  if (ta[0] !== tb[0]) return 0;

  const tbSet = new Set(tb);
  const overlap = ta.filter(t => tbSet.has(t)).length;
  const tokenScore = overlap / Math.max(ta.length, tb.length);
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

const THRESHOLD = 0.45;

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

// Exibe um nome palavra por palavra, verde se bateu com o outro nome, vermelho se não
function TokenHighlight({ nome, referencia }) {
  if (!nome) return <span style={{ color:'#d1d5db', fontStyle:'italic' }}>Nenhum encontrado</span>;
  const palavras = nome.split(/\s+/).filter(Boolean);
  const refSet = new Set((referencia || '').toLowerCase().split(/\s+/).filter(Boolean));
  return (
    <span style={{ display:'flex', flexWrap:'wrap', gap:3, alignItems:'center' }}>
      {palavras.map((w, i) => {
        const ok = refSet.has(w.toLowerCase());
        return (
          <span key={i} style={{
            padding:'2px 7px', borderRadius:5, fontSize:12, fontWeight:600,
            background: ok ? '#dcfce7' : '#fee2e2',
            color:      ok ? '#166534' : '#991b1b',
            border:     `1px solid ${ok ? '#bbf7d0' : '#fecaca'}`,
          }}>{w}</span>
        );
      })}
    </span>
  );
}

// Cor do badge de status
function corStatus(score) {
  if (score >= 1)   return { bg:'#dcfce7', color:'#166534', border:'#bbf7d0', label:'Exato' };
  if (score >= 0.7) return { bg:'#fef9c3', color:'#854d0e', border:'#fde047', label:'Provável' };
  if (score >= THRESHOLD) return { bg:'#fef3c7', color:'#92400e', border:'#fbbf24', label:'Similar' };
  return { bg:'#fee2e2', color:'#991b1b', border:'#fecaca', label:'Novo' };
}

export default function LevantamentosImportacoes() {
  const { isAdmin } = useAuth();
  const [lista, setLista]           = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [preview, setPreview]       = useState(null);
  // preview = { nomeArquivo, registros, tipoPagamento, frota, revisao, buscando }
  // revisao = [{ nomePlanilha, melhorMatch, nomeEditado, score, veiculo }]
  const [salvando, setSalvando]     = useState(false);
  const fileRef = useRef();

  // ── FOLGAS ──────────────────────────────────────────────────────────────
  const [listaFolgas, setListaFolgas]       = useState([]);
  const [carregandoFolgas, setCarregandoFolgas] = useState(true);
  const [previewFolgas, setPreviewFolgas]   = useState(null);
  const [salvandoFolgas, setSalvandoFolgas] = useState(false);
  const fileRefFolgas = useRef();

  async function carregar() {
    setCarregando(true);
    try {
      const { data } = await api.get('/levantamentos-motoristas/importacoes');
      setLista(data);
    } catch { toast.error('Erro ao carregar importações'); }
    finally { setCarregando(false); }
  }

  useEffect(() => { carregar(); carregarFolgas(); }, []);

  // ── Funções FOLGAS ───────────────────────────────────────────────────────
  async function carregarFolgas() {
    setCarregandoFolgas(true);
    try {
      const { data } = await api.get('/levantamentos-folgas/importacoes');
      setListaFolgas(data);
    } catch { toast.error('Erro ao carregar importações de folgas'); }
    finally { setCarregandoFolgas(false); }
  }

  async function handleFileFolgas(e) {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = '';
    try {
      const buf = await file.arrayBuffer();
      const wb  = XLSX.read(buf, { cellDates: true });
      const ws  = wb.Sheets[wb.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true });

      const header = (raw[0] || []).map(norm);
      const iMot = header.findIndex(h => h.includes('motorista') || h.includes('nome'));
      const iVei = header.findIndex(h => h.includes('veiculo') || h.includes('placa'));
      const iVal = header.findIndex(h => h.includes('valor'));
      const iMes = header.findIndex(h =>
        h.includes('mes') || h.includes('periodo') || h.includes('competencia') ||
        h.includes('data') || h.includes('referencia') || h.includes('ref')
      );

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
      setPreviewFolgas({ nomeArquivo: file.name, registros });
      toast.success(`${registros.length} registros lidos`);
    } catch (err) {
      toast.error('Erro ao ler arquivo: ' + err.message);
    }
  }

  async function salvarFolgas() {
    if (!previewFolgas) return;
    setSalvandoFolgas(true);
    try {
      await api.post('/levantamentos-folgas/importar', {
        nomeArquivo: previewFolgas.nomeArquivo,
        registros:   previewFolgas.registros,
      });
      toast.success('Importação de folgas salva!');
      setPreviewFolgas(null);
      await carregarFolgas();
    } catch (err) { toast.error(err?.response?.data?.error || 'Erro ao salvar'); }
    finally { setSalvandoFolgas(false); }
  }

  async function excluirFolga(id, nome) {
    if (!confirm(`Excluir "${nome}" e todos os registros?`)) return;
    try {
      await api.delete(`/levantamentos-folgas/importacoes/${id}`);
      toast.success('Removida');
      setListaFolgas(l => l.filter(i => i.id !== id));
    } catch { toast.error('Erro ao excluir'); }
  }
  // ── Fim FOLGAS ───────────────────────────────────────────────────────────

  async function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = '';
    try {
      const buf = await file.arrayBuffer();
      const wb  = XLSX.read(buf, { cellDates: true });
      const ws  = wb.Sheets[wb.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true });

      const header = (raw[0] || []).map(norm);
      const iMot = header.findIndex(h => h.includes('motorista'));
      const iVei = header.findIndex(h => h.includes('veiculo') || h.includes('placa') || h.includes('vei'));
      const iVal = header.findIndex(h => h.includes('valor'));
      const iMes = header.findIndex(h =>
        h.includes('mes') || h.includes('periodo') || h.includes('competencia') ||
        h.includes('data') || h.includes('referencia') || h.includes('ref')
      );

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

      // Nomes únicos na planilha
      const nomesUnicos = [...new Set(registros.map(r => r.motorista))];

      // Preview inicial enquanto busca
      setPreview({ nomeArquivo: file.name, registros, tipoPagamento: '', frota: '', revisao: null, buscando: true });
      toast.success(`${registros.length} registros lidos — comparando nomes...`);

      // Busca motoristas existentes e monta revisão
      let revisao;
      try {
        const { data: existentes } = await api.get('/levantamentos-motoristas');
        const mapaExistentes = new Map();
        for (const r of existentes) {
          const k = norm(r.motorista);
          if (!mapaExistentes.has(k)) mapaExistentes.set(k, { original: r.motorista, veiculo: r.veiculo });
        }

        revisao = nomesUnicos.map(nome => {
          const n = norm(nome);
          // Match exato
          if (mapaExistentes.has(n)) {
            const entry = mapaExistentes.get(n);
            return { nomePlanilha: nome, melhorMatch: entry.original, nomeEditado: entry.original, score: 1, veiculo: entry.veiculo };
          }
          // Melhor match fuzzy
          let melhorScore = 0, melhorEntry = null;
          for (const [nk, entry] of mapaExistentes) {
            const s = scoreNome(n, nk);
            if (s > melhorScore) { melhorScore = s; melhorEntry = entry; }
          }
          if (melhorScore >= THRESHOLD && melhorEntry) {
            return { nomePlanilha: nome, melhorMatch: melhorEntry.original, nomeEditado: melhorEntry.original, score: melhorScore, veiculo: melhorEntry.veiculo };
          }
          // Sem match — mantém nome original para edição
          return { nomePlanilha: nome, melhorMatch: null, nomeEditado: nome, score: 0, veiculo: null };
        });
      } catch {
        // Se falhar, monta revisão sem comparação
        revisao = nomesUnicos.map(nome => ({
          nomePlanilha: nome, melhorMatch: null, nomeEditado: nome, score: 0, veiculo: null,
        }));
      }

      setPreview(p => ({ ...p, revisao, buscando: false }));
    } catch (err) {
      toast.error('Erro ao ler arquivo: ' + err.message);
      setPreview(null);
    }
  }

  async function salvar() {
    if (!preview) return;
    if (!preview.tipoPagamento) { toast.error('Selecione o tipo de pagamento'); return; }
    if (!preview.frota)         { toast.error('Selecione a frota'); return; }

    // Aplica nomes editados nos registros
    const mapaEditados = new Map(
      (preview.revisao || []).map(r => [r.nomePlanilha, { nome: r.nomeEditado, veiculo: r.veiculo }])
    );
    const registrosFinais = preview.registros.map(r => {
      const edit = mapaEditados.get(r.motorista);
      return {
        ...r,
        motorista: edit?.nome || r.motorista,
        veiculo:   r.veiculo || edit?.veiculo || null,
      };
    });

    setSalvando(true);
    try {
      await api.post('/levantamentos-motoristas/importar', {
        nomeArquivo:   preview.nomeArquivo,
        registros:     registrosFinais,
        tipoPagamento: preview.tipoPagamento,
        frota:         preview.frota,
      });
      toast.success('Importação salva!');
      setPreview(null);
      await carregar();
    } catch (err) { toast.error(err?.response?.data?.error || 'Erro ao salvar'); }
    finally { setSalvando(false); }
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
          <button onClick={() => fileRef.current?.click()} disabled={!!preview}
            style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 16px', background: preview ? '#9ca3af' : '#EB3238', color:'#fff', border:'none', borderRadius:8, fontSize:13, fontWeight:600, cursor: preview ? 'not-allowed' : 'pointer' }}>
            <i className="ti ti-upload" style={{ fontSize:14 }}></i> Importar Planilha
          </button>
        </div>
      </div>

      {/* Preview / Revisão */}
      {preview && (
        <div style={{ background:'#fff', border:'1px solid #e5e7eb', borderRadius:12, padding:'20px 24px', marginBottom:20 }}>
          {/* Título */}
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16 }}>
            <i className="ti ti-file-spreadsheet" style={{ fontSize:20, color:'#6366f1' }}></i>
            <div>
              <div style={{ fontWeight:700, fontSize:14, color:'#1a1a2e' }}>{preview.nomeArquivo}</div>
              <div style={{ fontSize:12, color:'#6b7280' }}>{preview.registros.length} registros lidos</div>
            </div>
            <button onClick={() => setPreview(null)}
              style={{ marginLeft:'auto', padding:'5px 12px', border:'1px solid #e5e7eb', borderRadius:7, background:'#fff', fontSize:12, cursor:'pointer', color:'#6b7280' }}>
              Cancelar
            </button>
          </div>

          {/* Tabela de revisão de nomes */}
          <div style={{ marginBottom:16 }}>
            <div style={{ fontSize:11, fontWeight:700, color:'#374151', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:8 }}>
              Revisão de nomes — edite antes de salvar
            </div>

            {preview.buscando ? (
              <div style={{ textAlign:'center', padding:'24px 0', color:'#9ca3af', fontSize:13 }}>
                <i className="ti ti-loader-2" style={{ fontSize:20, display:'block', marginBottom:6 }}></i>
                Comparando com o banco de dados...
              </div>
            ) : (
              <div style={{ border:'1px solid #e5e7eb', borderRadius:8, overflow:'hidden' }}>
                <div style={{ overflowX:'auto', maxHeight:340, overflowY:'auto' }}>
                  <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
                    <thead>
                      <tr style={{ background:'#f8fafc', position:'sticky', top:0, zIndex:1 }}>
                        <th style={{ padding:'8px 12px', textAlign:'left', fontSize:11, fontWeight:700, color:'#6b7280', textTransform:'uppercase', letterSpacing:'0.4px', borderBottom:'1px solid #e5e7eb', whiteSpace:'nowrap', width:36 }}>#</th>
                        <th style={{ padding:'8px 12px', textAlign:'left', fontSize:11, fontWeight:700, color:'#6b7280', textTransform:'uppercase', letterSpacing:'0.4px', borderBottom:'1px solid #e5e7eb', whiteSpace:'nowrap' }}>Nome na planilha</th>
                        <th style={{ padding:'8px 12px', textAlign:'left', fontSize:11, fontWeight:700, color:'#6b7280', textTransform:'uppercase', letterSpacing:'0.4px', borderBottom:'1px solid #e5e7eb', whiteSpace:'nowrap' }}>Mais parecido no sistema</th>
                        <th style={{ padding:'8px 12px', textAlign:'left', fontSize:11, fontWeight:700, color:'#6b7280', textTransform:'uppercase', letterSpacing:'0.4px', borderBottom:'1px solid #e5e7eb', whiteSpace:'nowrap' }}>Nome final (editável)</th>
                        <th style={{ padding:'8px 12px', textAlign:'center', fontSize:11, fontWeight:700, color:'#6b7280', textTransform:'uppercase', letterSpacing:'0.4px', borderBottom:'1px solid #e5e7eb', whiteSpace:'nowrap', width:90 }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(preview.revisao || []).map((r, i) => {
                        const st = corStatus(r.score);
                        return (
                          <tr key={i} style={{ borderBottom:'1px solid #f3f4f6', background: i%2===0 ? '#fff' : '#fafafa' }}>
                            <td style={{ padding:'7px 12px', color:'#9ca3af', fontSize:12 }}>{i+1}</td>
                            <td style={{ padding:'7px 12px' }}>
                              <TokenHighlight nome={r.nomePlanilha} referencia={r.melhorMatch} />
                            </td>
                            <td style={{ padding:'7px 12px' }}>
                              <TokenHighlight nome={r.melhorMatch} referencia={r.nomePlanilha} />
                            </td>
                            <td style={{ padding:'5px 8px' }}>
                              <input
                                value={r.nomeEditado}
                                onChange={e => setPreview(p => ({
                                  ...p,
                                  revisao: p.revisao.map((x, j) => j === i ? { ...x, nomeEditado: e.target.value } : x),
                                }))}
                                style={{
                                  width:'100%', padding:'5px 8px',
                                  border:'1.5px solid ' + (r.nomeEditado !== r.nomePlanilha ? '#6366f1' : '#e5e7eb'),
                                  borderRadius:6, fontSize:13, outline:'none',
                                  background: r.nomeEditado !== r.nomePlanilha ? '#f5f3ff' : '#fff',
                                  fontWeight: r.nomeEditado !== r.nomePlanilha ? 600 : 400,
                                  color:'#1a1a2e',
                                }}
                              />
                            </td>
                            <td style={{ padding:'7px 12px', textAlign:'center' }}>
                              <span style={{ padding:'2px 10px', borderRadius:20, fontSize:11, fontWeight:700, background:st.bg, color:st.color, border:`1px solid ${st.border}`, whiteSpace:'nowrap' }}>
                                {st.label}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Tipo + Frota + Salvar */}
          {!preview.buscando && (
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr auto', gap:10, alignItems:'end', paddingTop:16, borderTop:'1px solid #f1f5f9' }}>
              <div>
                <div style={{ fontSize:11, fontWeight:700, color:'#374151', textTransform:'uppercase', letterSpacing:'0.4px', marginBottom:5 }}>Tipo de Pagamento</div>
                <select value={preview.tipoPagamento}
                  onChange={e => setPreview(p => ({ ...p, tipoPagamento: e.target.value }))}
                  style={{ width:'100%', padding:'8px 10px', border:'1.5px solid #e5e7eb', borderRadius:8, fontSize:13, background:'#fff', cursor:'pointer', outline:'none' }}>
                  <option value="">— selecione —</option>
                  {TIPOS.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <div style={{ fontSize:11, fontWeight:700, color:'#374151', textTransform:'uppercase', letterSpacing:'0.4px', marginBottom:5 }}>Frota</div>
                <select value={preview.frota}
                  onChange={e => setPreview(p => ({ ...p, frota: e.target.value }))}
                  style={{ width:'100%', padding:'8px 10px', border:'1.5px solid #e5e7eb', borderRadius:8, fontSize:13, background:'#fff', cursor:'pointer', outline:'none' }}>
                  <option value="">— selecione —</option>
                  <option value="FROTA">FROTA</option>
                  <option value="MELI">MELI</option>
                </select>
              </div>
              <button onClick={salvar} disabled={salvando}
                style={{ padding:'9px 22px', border:'none', borderRadius:8, background: salvando ? '#9ca3af' : '#16a34a', color:'#fff', fontSize:13, fontWeight:700, cursor: salvando ? 'not-allowed' : 'pointer', whiteSpace:'nowrap' }}>
                {salvando ? 'Salvando...' : 'Confirmar e salvar'}
              </button>
            </div>
          )}
        </div>
      )}

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

      {/* Tabela de importações */}
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

    {/* ═══════════════════════════════════════════════════════════════════
        SEÇÃO FOLGAS
    ═══════════════════════════════════════════════════════════════════ */}
    <div style={{ marginTop: 40, borderTop: '2px solid #f1f5f9', paddingTop: 32 }}>
      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <h2 style={{ fontSize:20, fontWeight:700, color:'#1a1a2e', margin:0 }}>
          Importações — Folgas
        </h2>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <input ref={fileRefFolgas} type="file" accept=".xlsx,.xls" onChange={handleFileFolgas} style={{ display:'none' }} />
          <button onClick={() => fileRefFolgas.current?.click()} disabled={!!previewFolgas}
            style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 16px',
              background: previewFolgas ? '#9ca3af' : '#f59e0b', color:'#fff', border:'none',
              borderRadius:8, fontSize:13, fontWeight:600, cursor: previewFolgas ? 'not-allowed' : 'pointer' }}>
            <i className="ti ti-upload" style={{ fontSize:14 }}></i> Importar Planilha
          </button>
        </div>
      </div>

      {/* Preview */}
      {previewFolgas && (
        <div style={{ background:'#fff', border:'1px solid #e5e7eb', borderRadius:12, padding:'20px 24px', marginBottom:20 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16 }}>
            <i className="ti ti-file-spreadsheet" style={{ fontSize:20, color:'#f59e0b' }}></i>
            <div>
              <div style={{ fontWeight:700, fontSize:14, color:'#1a1a2e' }}>{previewFolgas.nomeArquivo}</div>
              <div style={{ fontSize:12, color:'#6b7280' }}>{previewFolgas.registros.length} registros lidos</div>
            </div>
            <button onClick={() => setPreviewFolgas(null)}
              style={{ marginLeft:'auto', padding:'5px 12px', border:'1px solid #e5e7eb', borderRadius:7, background:'#fff', fontSize:12, cursor:'pointer', color:'#6b7280' }}>
              Cancelar
            </button>
          </div>

          {/* Mini-tabela de preview */}
          <div style={{ border:'1px solid #e5e7eb', borderRadius:8, overflow:'hidden', marginBottom:16, maxHeight:280, overflowY:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
              <thead>
                <tr style={{ background:'#f8fafc', position:'sticky', top:0 }}>
                  {['Motorista','Placa','Mês','Valor'].map(h => (
                    <th key={h} style={{ padding:'8px 12px', textAlign:'left', fontSize:11, fontWeight:700, color:'#6b7280', textTransform:'uppercase', letterSpacing:'0.4px', borderBottom:'1px solid #e5e7eb' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {previewFolgas.registros.map((r, i) => (
                  <tr key={i} style={{ borderBottom:'1px solid #f3f4f6', background: i%2===0?'#fff':'#fafafa' }}>
                    <td style={{ padding:'7px 12px', fontWeight:600 }}>{r.motorista}</td>
                    <td style={{ padding:'7px 12px', color:'#6b7280' }}>{r.veiculo || '—'}</td>
                    <td style={{ padding:'7px 12px', color:'#6b7280' }}>{r.mes || '—'}</td>
                    <td style={{ padding:'7px 12px', fontWeight:600, color:'#f59e0b' }}>{fmtR(r.valor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ display:'flex', justifyContent:'flex-end' }}>
            <button onClick={salvarFolgas} disabled={salvandoFolgas}
              style={{ padding:'9px 22px', border:'none', borderRadius:8, background: salvandoFolgas ? '#9ca3af' : '#16a34a', color:'#fff', fontSize:13, fontWeight:700, cursor: salvandoFolgas ? 'not-allowed' : 'pointer' }}>
              {salvandoFolgas ? 'Salvando...' : 'Confirmar e salvar'}
            </button>
          </div>
        </div>
      )}

      {/* Lista de importações de folgas */}
      {carregandoFolgas ? (
        <div style={{ textAlign:'center', padding:60, color:'#9ca3af' }}>Carregando...</div>
      ) : listaFolgas.length === 0 ? (
        <div style={{ textAlign:'center', padding:60, color:'#9ca3af', background:'#fff', borderRadius:12, border:'1px dashed #d1d5db' }}>
          <i className="ti ti-file-off" style={{ fontSize:36, display:'block', marginBottom:10, color:'#d1d5db' }}></i>
          <div style={{ fontWeight:500 }}>Nenhuma importação de folgas</div>
          <div style={{ fontSize:12, marginTop:4 }}>Clique em "Importar Planilha" para começar</div>
        </div>
      ) : (
        <div style={{ background:'#fff', border:'1px solid #e5e7eb', borderRadius:12, overflow:'hidden' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
            <thead>
              <tr style={{ background:'#f8fafc' }}>
                {['Arquivo','Data','Registros','Total',''].map(h => (
                  <th key={h} style={{ padding:'10px 16px', textAlign:'left', fontSize:11, fontWeight:700, color:'#374151', textTransform:'uppercase', letterSpacing:'0.4px', borderBottom:'1px solid #e5e7eb', whiteSpace:'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {listaFolgas.map((im, i) => (
                <tr key={im.id} style={{ background: i%2===0?'#fff':'#fafafa' }}
                  onMouseEnter={e => e.currentTarget.style.background='#fffbeb'}
                  onMouseLeave={e => e.currentTarget.style.background=i%2===0?'#fff':'#fafafa'}>
                  <td style={{ padding:'11px 16px', fontWeight:600, color:'#1a1a2e', borderBottom:'1px solid #f3f4f6' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <i className="ti ti-file-spreadsheet" style={{ fontSize:15, color:'#f59e0b' }}></i>
                      {im.nomeArquivo.replace(/\.xlsx?$/i,'')}
                    </div>
                  </td>
                  <td style={{ padding:'11px 16px', color:'#6b7280', borderBottom:'1px solid #f3f4f6' }}>{fmtDt(im.criadoEm)}</td>
                  <td style={{ padding:'11px 16px', borderBottom:'1px solid #f3f4f6' }}>
                    <span style={{ padding:'2px 8px', borderRadius:6, background:'#fef3c7', color:'#92400e', fontSize:12, fontWeight:700 }}>{im.totalRegistros}</span>
                  </td>
                  <td style={{ padding:'11px 16px', fontWeight:700, color:'#f59e0b', borderBottom:'1px solid #f3f4f6' }}>{fmtR(im.totalValor)}</td>
                  <td style={{ padding:'11px 16px', borderBottom:'1px solid #f3f4f6', textAlign:'right' }}>
                    {isAdmin && (
                      <button onClick={() => excluirFolga(im.id, im.nomeArquivo)}
                        style={{ padding:'5px 10px', border:'1px solid #fee2e2', borderRadius:6, background:'#fff5f5', color:'#dc2626', fontSize:12, cursor:'pointer' }}>
                        <i className="ti ti-trash"></i>
                      </button>
                    )}
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

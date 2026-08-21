// v4
import { useState, useEffect, useRef, useMemo } from 'react';
import * as XLSX from 'xlsx';
import api from '../services/api';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';

const TIPOS = [
  { key: 'saldo',       label: 'Saldo/Prévia',      color: '#EB3238' },
  { key: 'diarias',     label: 'Diárias dedicados', color: '#0ea5e9' },
  { key: 'bonificacao', label: 'Bonificações',       color: '#16a34a' },
  { key: 'custoFolha',  label: 'Custo Folha',        color: '#8b5cf6' },
  { key: 'folgas',      label: 'Folgas',             color: '#f59e0b' },
  { key: 'faturamento', label: 'Faturamento',        color: '#0d9488' },
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
// Exibe palavras como blocos coloridos comparando com uma referência
// verde = palavra existe na referência | vermelho = não existe | cinza = nome vazio
function TokenBlocks({ nome, referencia, vazio = 'Nenhum encontrado' }) {
  if (!nome) return <span style={{ color:'#d1d5db', fontStyle:'italic', fontSize:12 }}>{vazio}</span>;
  const palavras = nome.trim().split(/\s+/).filter(Boolean);
  const refSet   = new Set((referencia || '').toUpperCase().trim().split(/\s+/).filter(Boolean));
  return (
    <div style={{ display:'flex', flexWrap:'wrap', gap:4, alignItems:'center' }}>
      {palavras.map((w, i) => {
        const ok = refSet.has(w.toUpperCase());
        return (
          <span key={i} style={{
            padding:'3px 9px', borderRadius:6, fontSize:12, fontWeight:700,
            background: ok ? '#dcfce7' : '#fee2e2',
            color:      ok ? '#166534' : '#991b1b',
            border:     `1px solid ${ok ? '#bbf7d0' : '#fecaca'}`,
            letterSpacing:'0.3px',
          }}>{w}</span>
        );
      })}
    </div>
  );
}

// Compatibilidade com código antigo
function TokenHighlight({ nome, referencia }) {
  return <TokenBlocks nome={nome} referencia={referencia} />;
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
  const [opBauSemCadastro, setOpBauSemCadastro] = useState(new Set()); // nomes marcados como OP. BAÚ no preview
  const [gerenciar, setGerenciar]   = useState(false); // painel gerenciar nomes
  const [nomes, setNomes]           = useState([]);    // [{ nome, total, nomeEditado, alterado }]
  const [carregandoNomes, setCarregandoNomes] = useState(false);
  const [salvandoNomes, setSalvandoNomes]     = useState(false);
  const [buscaNomes, setBuscaNomes] = useState('');
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
    e.target.value = '';
    try {
      const buf = await file.arrayBuffer();
      const wb  = XLSX.read(buf, { cellDates: true });
      const ws  = wb.Sheets[wb.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true });

      const header = (raw[0] || []).map(norm);
      const iMot = header.findIndex(h => h.includes('motorista'));
      const iVei = header.findIndex(h => h.includes('veiculo') || h.includes('placa') || h.includes('vei'));
      const iVal = header.findIndex(h => h.includes('valor') || h.includes('faturamento'));
      const iMes = header.findIndex(h =>
        h.includes('mes') || h.includes('periodo') || h.includes('competencia') ||
        h.includes('data') || h.includes('referencia') || h.includes('ref')
      );
      const iTit = header.findIndex(h => h.includes('titulo') || h.includes('title'));

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

      // Título: lê da coluna "titulo" (1ª linha de dados) ou usa nome do arquivo sem extensão
      const tituloDetectado = iTit >= 0 && raw[1]?.[iTit]
        ? String(raw[1][iTit]).trim()
        : file.name.replace(/\.xlsx?$/i, '');

      // Nomes únicos na planilha
      const nomesUnicos = [...new Set(registros.map(r => r.motorista))];

      // Preview inicial enquanto busca
      setOpBauSemCadastro(new Set());
      setPreview({ nomeArquivo: file.name, registros, titulo: tituloDetectado, tipoPagamento: '', frota: '', revisao: null, buscando: true, tituloDuplicado: null });
      toast.success(`${registros.length} registros lidos — comparando nomes...`);

      // Verifica duplicata de título em paralelo
      api.get('/levantamentos-motoristas/verificar-titulo', { params: { titulo: tituloDetectado } })
        .then(({ data }) => {
          if (data.existe) {
            setPreview(p => p ? ({ ...p, tituloDuplicado: { nomeArquivo: data.nomeArquivo, criadoEm: data.criadoEm } }) : p);
          }
        })
        .catch(() => {}); // silencioso

      // Busca motoristas existentes e monta revisão
      let revisao;
      try {
        const [{ data: existentes }, { data: motBD }, { data: opBauSalvos }] = await Promise.all([
          api.get('/levantamentos-motoristas'),
          api.get('/motoristas'),
          api.get('/levantamentos-motoristas/op-bau-nomes'),
        ]);
        // Pré-marca como OP. BAÚ os nomes já salvos anteriormente
        const opBauNorms = new Set((opBauSalvos || []).map(n => norm(n)));
        // Nomes da planilha que já estão na tabela op_bau → pré-selecionar
        const preMarcar = new Set(
          nomesUnicos.filter(nome => opBauNorms.has(norm(nome)))
        );
        if (preMarcar.size > 0) setOpBauSemCadastro(preMarcar);
        const mapaExistentes = new Map();
        // Primeiro: nomes do banco de motoristas cadastrados
        const motBDNorms = new Set(motBD.map(m => norm(m.nome)));
        for (const m of motBD) {
          const k = norm(m.nome);
          if (!mapaExistentes.has(k)) mapaExistentes.set(k, { original: m.nome, veiculo: null });
        }
        // Depois: nomes já importados (sobrescreve com veiculo se houver)
        for (const r of existentes) {
          const k = norm(r.motorista);
          if (!mapaExistentes.has(k)) mapaExistentes.set(k, { original: r.motorista, veiculo: r.veiculo });
          else if (r.veiculo) mapaExistentes.set(k, { ...mapaExistentes.get(k), veiculo: r.veiculo });
        }

        revisao = nomesUnicos.map(nome => {
          const n = norm(nome);
          // Verifica se tem match: banco de motoristas, importações anteriores ou override OP. BAÚ
          const emBD =
            opBauNorms.has(n) ||
            motBDNorms.has(n) ||
            mapaExistentes.has(n) ||
            [...motBDNorms].some(nk => scoreNome(n, nk) >= THRESHOLD) ||
            [...mapaExistentes.keys()].some(nk => scoreNome(n, nk) >= THRESHOLD);
          // Match exato
          if (mapaExistentes.has(n)) {
            const entry = mapaExistentes.get(n);
            return { nomePlanilha: nome, melhorMatch: entry.original, nomeEditado: nome, score: 1, veiculo: entry.veiculo, semCadastro: !emBD };
          }
          // Melhor match fuzzy
          let melhorScore = 0, melhorEntry = null;
          for (const [nk, entry] of mapaExistentes) {
            const s = scoreNome(n, nk);
            if (s > melhorScore) { melhorScore = s; melhorEntry = entry; }
          }
          if (melhorScore >= THRESHOLD && melhorEntry) {
            return { nomePlanilha: nome, melhorMatch: melhorEntry.original, nomeEditado: nome, score: melhorScore, veiculo: melhorEntry.veiculo, semCadastro: !emBD };
          }
          return { nomePlanilha: nome, melhorMatch: melhorEntry?.original || null, nomeEditado: nome, score: melhorScore, veiculo: null, semCadastro: !emBD };
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
    if (preview.tipoPagamento === 'custoFolha' && !preview.mesReferencia) { toast.error('Selecione o mês de referência para Custo Folha'); return; }

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
        nomeArquivo:      preview.nomeArquivo,
        registros:        registrosFinais,
        titulo:           preview.titulo?.trim() || null,
        tipoPagamento:    preview.tipoPagamento,
        frota:            null,
        mesReferencia:    preview.mesReferencia || null,
        motoristasOpBau:  [...opBauSemCadastro],
      });
      toast.success('Importação salva!');
      setOpBauSemCadastro(new Set());
      setPreview(null);
      await carregar();
    } catch (err) { toast.error(err?.response?.data?.error || 'Erro ao salvar'); }
    finally { setSalvando(false); }
  }

  async function atualizarCampo(id, campo, valor) {
    try {
      const atual = lista.find(i => i.id === id) || {};
      const payload = {
        titulo:         campo === 'titulo'         ? valor : atual.titulo,
        tipoPagamento:  campo === 'tipoPagamento'  ? valor : atual.tipoPagamento,
        frota:          campo === 'frota'          ? valor : atual.frota,
        mesReferencia:  campo === 'mesReferencia'  ? valor : atual.mesReferencia,
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

  async function abrirGerenciar() {
    setGerenciar(true);
    setBuscaNomes('');
    setCarregandoNomes(true);
    try {
      const { data } = await api.get('/levantamentos-motoristas/nomes-unicos');
      // Para cada nome, encontra o mais parecido entre os outros
      const lista = data.map(r => ({ ...r, nomeEditado: r.nome, alterado: false, sugestao: null }));
      // Marca sugestões de duplicatas (nomes similares entre si)
      for (let i = 0; i < lista.length; i++) {
        let melhorScore = 0, melhorNome = null;
        for (let j = 0; j < lista.length; j++) {
          if (i === j) continue;
          const s = scoreNome(norm(lista[i].nome), norm(lista[j].nome));
          if (s > melhorScore && s >= 0.6) { melhorScore = s; melhorNome = lista[j].nome; }
        }
        if (melhorNome) lista[i].sugestao = { nome: melhorNome, score: melhorScore };
      }
      setNomes(lista);
    } catch { toast.error('Erro ao carregar nomes'); }
    finally { setCarregandoNomes(false); }
  }

  async function salvarNomes() {
    const alterados = nomes.filter(r => r.alterado && r.nomeEditado.trim() && r.nomeEditado.trim() !== r.nome);
    if (!alterados.length) { toast('Nenhuma alteração para salvar'); return; }
    setSalvandoNomes(true);
    try {
      for (const r of alterados) {
        await api.put('/levantamentos-motoristas/renomear', { de: r.nome, para: r.nomeEditado.trim() });
      }
      toast.success(`${alterados.length} nome(s) atualizado(s)`);
      setGerenciar(false);
    } catch { toast.error('Erro ao salvar nomes'); }
    finally { setSalvandoNomes(false); }
  }

  const nomesFiltrados = useMemo(() =>
    nomes.filter(r => !buscaNomes || norm(r.nome).includes(norm(buscaNomes)) || norm(r.nomeEditado).includes(norm(buscaNomes)))
  , [nomes, buscaNomes]);

  const totaisPorTipo = useMemo(() => {
    const map = { saldo: 0, diarias: 0, bonificacao: 0, custoFolha: 0, folgas: 0, faturamento: 0 };
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
          {isAdmin && (
            <button onClick={abrirGerenciar} disabled={!!preview}
              style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 16px', background:'#fff', color:'#374151', border:'1px solid #e5e7eb', borderRadius:8, fontSize:13, fontWeight:600, cursor: preview ? 'not-allowed' : 'pointer' }}>
              <i className="ti ti-pencil" style={{ fontSize:14 }}></i> Gerenciar Nomes
            </button>
          )}
          <button onClick={() => fileRef.current?.click()} disabled={!!preview}
            style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 16px', background: preview ? '#9ca3af' : '#EB3238', color:'#fff', border:'none', borderRadius:8, fontSize:13, fontWeight:600, cursor: preview ? 'not-allowed' : 'pointer' }}>
            <i className="ti ti-upload" style={{ fontSize:14 }}></i> Importar Planilha
          </button>
        </div>
      </div>

      {/* Painel Gerenciar Nomes */}
      {gerenciar && (
        <div style={{ background:'#fff', border:'1px solid #e5e7eb', borderRadius:12, padding:'20px 24px', marginBottom:20 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16 }}>
            <i className="ti ti-pencil" style={{ fontSize:18, color:'#6366f1' }}></i>
            <div style={{ fontWeight:700, fontSize:14, color:'#1a1a2e' }}>Gerenciar Nomes Importados</div>
            <div style={{ fontSize:12, color:'#6b7280', marginLeft:4 }}>{nomes.length} nomes únicos</div>
            <div style={{ marginLeft:'auto', display:'flex', gap:8 }}>
              <input value={buscaNomes} onChange={e => setBuscaNomes(e.target.value)} placeholder="Buscar nome..." style={{ padding:'6px 10px', border:'1px solid #e5e7eb', borderRadius:7, fontSize:13, outline:'none', width:180 }} />
              <button onClick={() => setGerenciar(false)} style={{ padding:'6px 12px', border:'1px solid #e5e7eb', borderRadius:7, background:'#fff', fontSize:12, cursor:'pointer', color:'#6b7280' }}>Fechar</button>
              <button onClick={salvarNomes} disabled={salvandoNomes || !nomes.some(r => r.alterado)}
                style={{ padding:'6px 14px', border:'none', borderRadius:7, background: nomes.some(r => r.alterado) ? '#16a34a' : '#9ca3af', color:'#fff', fontSize:12, fontWeight:700, cursor: nomes.some(r => r.alterado) ? 'pointer' : 'not-allowed' }}>
                {salvandoNomes ? 'Salvando...' : `Salvar${nomes.filter(r=>r.alterado).length > 0 ? ` (${nomes.filter(r=>r.alterado).length})` : ''}`}
              </button>
            </div>
          </div>

          {carregandoNomes ? (
            <div style={{ textAlign:'center', padding:'32px 0', color:'#9ca3af' }}>Carregando nomes...</div>
          ) : (
            <div style={{ border:'1px solid #e5e7eb', borderRadius:8, overflow:'hidden' }}>
              <div style={{ maxHeight:420, overflowY:'auto' }}>
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
                  <thead>
                    <tr style={{ background:'#f8fafc', position:'sticky', top:0, zIndex:1 }}>
                      <th style={{ padding:'8px 12px', textAlign:'left', fontSize:11, fontWeight:700, color:'#6b7280', textTransform:'uppercase', letterSpacing:'0.4px', borderBottom:'1px solid #e5e7eb' }}>Nome atual no banco</th>
                      <th style={{ padding:'8px 12px', textAlign:'left', fontSize:11, fontWeight:700, color:'#6b7280', textTransform:'uppercase', letterSpacing:'0.4px', borderBottom:'1px solid #e5e7eb' }}>Nome similar encontrado</th>
                      <th style={{ padding:'8px 12px', textAlign:'left', fontSize:11, fontWeight:700, color:'#6b7280', textTransform:'uppercase', letterSpacing:'0.4px', borderBottom:'1px solid #e5e7eb' }}>Nome final (editável)</th>
                      <th style={{ padding:'8px 12px', textAlign:'center', fontSize:11, fontWeight:700, color:'#6b7280', textTransform:'uppercase', letterSpacing:'0.4px', borderBottom:'1px solid #e5e7eb', width:60 }}>Regs</th>
                    </tr>
                  </thead>
                  <tbody>
                    {nomesFiltrados.map((r, i) => (
                      <tr key={i} style={{ borderBottom:'1px solid #f3f4f6', background: r.alterado ? '#f5f3ff' : i%2===0 ? '#fff' : '#fafafa' }}>
                        <td style={{ padding:'7px 12px', color:'#374151', fontWeight: r.alterado ? 600 : 400 }}>{r.nome}</td>
                        <td style={{ padding:'7px 12px' }}>
                          {r.sugestao ? (
                            <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                              <span style={{ color:'#92400e', fontSize:12 }}>{r.sugestao.nome}</span>
                              <span style={{ fontSize:10, padding:'1px 6px', borderRadius:10, background:'#fef9c3', color:'#854d0e', border:'1px solid #fde047', fontWeight:700 }}>
                                {Math.round(r.sugestao.score * 100)}%
                              </span>
                              <button onClick={() => setNomes(ns => ns.map((x,j) => j===i ? { ...x, nomeEditado: r.sugestao.nome, alterado: r.sugestao.nome !== x.nome } : x))}
                                style={{ fontSize:10, padding:'2px 7px', border:'1px solid #d1d5db', borderRadius:5, background:'#fff', cursor:'pointer', color:'#374151' }}>
                                Usar
                              </button>
                            </div>
                          ) : <span style={{ color:'#d1d5db' }}>—</span>}
                        </td>
                        <td style={{ padding:'5px 8px' }}>
                          <input
                            value={r.nomeEditado}
                            onChange={e => setNomes(ns => ns.map((x,j) => j===i ? { ...x, nomeEditado: e.target.value, alterado: e.target.value.trim() !== x.nome } : x))}
                            style={{ width:'100%', padding:'5px 8px', border:`1.5px solid ${r.alterado ? '#6366f1' : '#e5e7eb'}`, borderRadius:6, fontSize:13, outline:'none', background: r.alterado ? '#f5f3ff' : '#fff', color:'#1a1a2e', fontWeight: r.alterado ? 600 : 400, boxSizing:'border-box' }}
                          />
                        </td>
                        <td style={{ padding:'7px 12px', textAlign:'center', color:'#9ca3af', fontSize:12 }}>{r.total}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

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
            <div style={{ fontSize:11, fontWeight:700, color:'#374151', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:8, display:'flex', alignItems:'center', gap:8 }}>
              Revisão de nomes — edite antes de salvar
              {!preview.buscando && (() => {
                const pendentes = (preview.revisao || []).filter(r => r.score < 1 || r.nomeEditado !== r.nomePlanilha || r.semCadastro).length;
                const total     = (preview.revisao || []).length;
                return pendentes > 0
                  ? <span style={{ padding:'2px 8px', borderRadius:10, background:'#fef2f2', color:'#dc2626', border:'1px solid #fecaca', fontSize:11, fontWeight:700, textTransform:'none' }}>{pendentes} de {total} precisam revisão</span>
                  : <span style={{ padding:'2px 8px', borderRadius:10, background:'#dcfce7', color:'#16a34a', border:'1px solid #bbf7d0', fontSize:11, fontWeight:700, textTransform:'none' }}>Todos exatos ✓</span>;
              })()}
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
                        <th style={{ padding:'8px 12px', textAlign:'center', fontSize:11, fontWeight:700, color:'#6b7280', textTransform:'uppercase', letterSpacing:'0.4px', borderBottom:'1px solid #e5e7eb', whiteSpace:'nowrap' }}>No sistema</th>
                        <th style={{ padding:'8px 12px', textAlign:'center', fontSize:11, fontWeight:700, color:'#6b7280', textTransform:'uppercase', letterSpacing:'0.4px', borderBottom:'1px solid #e5e7eb', whiteSpace:'nowrap' }}>Cadastro</th>
                        <th style={{ padding:'8px 12px', textAlign:'center', fontSize:11, fontWeight:700, color:'#6b7280', textTransform:'uppercase', letterSpacing:'0.4px', borderBottom:'1px solid #e5e7eb', whiteSpace:'nowrap' }}>Match</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(preview.revisao || []).map((r, origIdx) => ({ ...r, origIdx })).filter(r => r.score < 1 || r.nomeEditado !== r.nomePlanilha || r.semCadastro).map((r, i) => {
                        // Score mais confiável: compara nome final vs melhor match do sistema (reativo ao editar)
                        const scoreFinal = r.melhorMatch
                          ? Math.max(r.score, scoreNome(norm(r.nomeEditado), norm(r.melhorMatch)))
                          : scoreNome(norm(r.nomeEditado), norm(r.nomePlanilha));
                        const isNovo     = r.score < THRESHOLD;
                        const matchLabel = scoreFinal >= 1 ? 'Exato' : scoreFinal >= 0.7 ? 'Provável' : scoreFinal > 0.1 ? 'Parecido' : null;
                        const matchStyle = scoreFinal >= 1
                          ? { bg:'#dcfce7', color:'#166534', border:'#bbf7d0' }
                          : scoreFinal >= 0.7
                          ? { bg:'#fef9c3', color:'#854d0e', border:'#fde047' }
                          : { bg:'#fef3c7', color:'#92400e', border:'#fbbf24' };
                        return (
                          <tr key={i} style={{ borderBottom:'1px solid #f3f4f6', background: i%2===0 ? '#fff' : '#fafafa' }}>
                            <td style={{ padding:'7px 12px', color:'#9ca3af', fontSize:12 }}>{i+1}</td>
                            {/* Planilha: blocos comparados com o nome final */}
                            <td style={{ padding:'7px 12px' }}>
                              <TokenBlocks nome={r.nomePlanilha} referencia={r.nomeEditado} />
                            </td>
                            {/* Sistema: blocos comparados com a planilha */}
                            <td style={{ padding:'7px 12px' }}>
                              <TokenBlocks nome={r.melhorMatch} referencia={r.nomePlanilha} vazio="—" />
                            </td>
                            {/* Nome Final: blocos + campo editável */}
                            <td style={{ padding:'5px 8px' }}>
                              {/* Blocos do nome final comparados com a planilha */}
                              <div style={{ marginBottom:4 }}>
                                <TokenBlocks nome={r.nomeEditado} referencia={r.nomePlanilha} />
                              </div>
                              <input
                                value={r.nomeEditado}
                                onChange={e => setPreview(p => ({
                                  ...p,
                                  revisao: p.revisao.map((x, j) => j === r.origIdx ? { ...x, nomeEditado: e.target.value } : x),
                                }))}
                                style={{
                                  width:'100%', padding:'4px 8px',
                                  border:'1.5px solid ' + (r.nomeEditado !== r.nomePlanilha ? '#6366f1' : '#e5e7eb'),
                                  borderRadius:6, fontSize:12, outline:'none',
                                  background: r.nomeEditado !== r.nomePlanilha ? '#f5f3ff' : '#fff',
                                  fontWeight: r.nomeEditado !== r.nomePlanilha ? 600 : 400,
                                  color:'#1a1a2e', boxSizing:'border-box',
                                }}
                              />
                            </td>
                            {/* Coluna: Novo no sistema? */}
                            <td style={{ padding:'7px 12px', textAlign:'center' }}>
                              {isNovo && (
                                <span style={{ padding:'2px 10px', borderRadius:20, fontSize:11, fontWeight:700, background:'#fee2e2', color:'#991b1b', border:'1px solid #fecaca', whiteSpace:'nowrap' }}>
                                  Novo
                                </span>
                              )}
                            </td>
                            {/* Coluna: sem cadastro no banco de motoristas */}
                            <td style={{ padding:'7px 12px', textAlign:'center' }}>
                              {r.semCadastro
                                ? <span style={{ padding:'2px 10px', borderRadius:20, fontSize:11, fontWeight:700, background:'#fff7ed', color:'#c2410c', border:'1px solid #fed7aa', whiteSpace:'nowrap' }}>Sem cadastro</span>
                                : <span style={{ padding:'2px 10px', borderRadius:20, fontSize:11, fontWeight:700, background:'#dcfce7', color:'#166534', border:'1px solid #bbf7d0', whiteSpace:'nowrap' }}>✓ Cadastrado</span>
                              }
                            </td>
                            {/* Coluna: qualidade do match */}
                            <td style={{ padding:'7px 12px', textAlign:'center' }}>
                              {matchLabel && (
                                <span style={{ padding:'2px 10px', borderRadius:20, fontSize:11, fontWeight:700, background:matchStyle.bg, color:matchStyle.color, border:`1px solid ${matchStyle.border}`, whiteSpace:'nowrap' }}>
                                  {matchLabel}
                                </span>
                              )}
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

          {/* Aviso: motoristas sem cadastro — toggle OP. BAÚ */}
          {!preview.buscando && (preview.revisao || []).some(r => r.semCadastro) && (
            <div style={{ background:'#fff7ed', border:'1.5px solid #fb923c', borderRadius:10, padding:'14px 16px', marginBottom:12 }}>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
                <i className="ti ti-user-exclamation" style={{ fontSize:18, color:'#ea580c', flexShrink:0 }}></i>
                <div>
                  <div style={{ fontSize:13, fontWeight:700, color:'#9a3412' }}>
                    {(preview.revisao || []).filter(r => r.semCadastro).length} motorista(s) sem cadastro no banco
                  </div>
                  <div style={{ fontSize:12, color:'#c2410c', marginTop:2 }}>
                    Por padrão são <strong>FROTA</strong>. Clique nos que forem <strong>OP. BAÚ</strong> para marcá-los — o sistema vai registrar automaticamente.
                  </div>
                </div>
              </div>
              {opBauSemCadastro.size > 0 && (
                <div style={{ fontSize:11, color:'#6d28d9', fontWeight:600, marginBottom:6 }}>
                  {opBauSemCadastro.size} marcado(s) como OP. BAÚ
                </div>
              )}
              <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                {(preview.revisao || []).filter(r => r.semCadastro).map((r, i) => {
                  const nome = r.nomeEditado || r.nomePlanilha;
                  const isOpBau = opBauSemCadastro.has(nome);
                  return (
                    <button key={i}
                      onClick={() => setOpBauSemCadastro(prev => {
                        const next = new Set(prev);
                        if (next.has(nome)) next.delete(nome); else next.add(nome);
                        return next;
                      })}
                      title={isOpBau ? 'Clique para desmarcar' : 'Clique para marcar como OP. BAÚ'}
                      style={{
                        padding:'4px 12px', borderRadius:20, fontSize:12, fontWeight:700,
                        cursor:'pointer', border:'1.5px solid',
                        background: isOpBau ? '#ede9fe' : '#fff',
                        color:      isOpBau ? '#6d28d9' : '#9a3412',
                        borderColor: isOpBau ? '#c4b5fd' : '#fb923c',
                        transition:'all 0.15s',
                      }}>
                      {isOpBau ? '✓ OP. BAÚ' : nome}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Aviso de duplicata */}
          {preview.tituloDuplicado && (
            <div style={{ display:'flex', alignItems:'center', gap:10, background:'#fffbeb', border:'1.5px solid #fbbf24', borderRadius:8, padding:'10px 14px', marginBottom:12 }}>
              <i className="ti ti-alert-triangle" style={{ fontSize:18, color:'#d97706', flexShrink:0 }}></i>
              <div style={{ fontSize:13, color:'#92400e' }}>
                <strong>Título &quot;{preview.titulo}&quot; já foi importado!</strong> Arquivo original: <strong>{preview.tituloDuplicado.nomeArquivo}</strong> em {preview.tituloDuplicado.criadoEm}. Verifique se não é uma duplicata antes de salvar.
              </div>
            </div>
          )}

          {/* Tipo + Frota + Mês Referência + Salvar */}
          {!preview.buscando && (
            <div style={{ paddingTop:16, borderTop:'1px solid #f1f5f9' }}>
              <div style={{ display:'grid', gridTemplateColumns: preview.tipoPagamento === 'custoFolha' ? '1fr 1fr auto' : '1fr auto', gap:10, alignItems:'end' }}>
                <div>
                  <div style={{ fontSize:11, fontWeight:700, color:'#374151', textTransform:'uppercase', letterSpacing:'0.4px', marginBottom:5 }}>Tipo de Pagamento</div>
                  <select value={preview.tipoPagamento}
                    onChange={e => setPreview(p => ({ ...p, tipoPagamento: e.target.value, mesReferencia: '' }))}
                    style={{ width:'100%', padding:'8px 10px', border:'1.5px solid #e5e7eb', borderRadius:8, fontSize:13, background:'#fff', cursor:'pointer', outline:'none' }}>
                    <option value="">— selecione —</option>
                    {TIPOS.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
                  </select>
                </div>
                {preview.tipoPagamento === 'custoFolha' && (
                  <div>
                    <div style={{ fontSize:11, fontWeight:700, color:'#374151', textTransform:'uppercase', letterSpacing:'0.4px', marginBottom:5 }}>Mês Referência</div>
                    <input type="month" value={preview.mesReferencia || ''}
                      onChange={e => setPreview(p => ({ ...p, mesReferencia: e.target.value }))}
                      style={{ width:'100%', padding:'8px 10px', border:'1.5px solid #e5e7eb', borderRadius:8, fontSize:13, background:'#fff', outline:'none' }} />
                  </div>
                )}
                <button onClick={salvar} disabled={salvando}
                  style={{ padding:'9px 22px', border:'none', borderRadius:8, background: salvando ? '#9ca3af' : '#16a34a', color:'#fff', fontSize:13, fontWeight:700, cursor: salvando ? 'not-allowed' : 'pointer', whiteSpace:'nowrap' }}>
                  {salvando ? 'Salvando...' : 'Confirmar e salvar'}
                </button>
              </div>
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
                {['Arquivo','Data','Registros','Total','Tipo','Mês Ref.',''].map(h => (
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
                    {im.tipoPagamento === 'custoFolha' ? (
                      isAdmin ? (
                        <input type="month" value={im.mesReferencia || ''}
                          onChange={e => atualizarCampo(im.id, 'mesReferencia', e.target.value)}
                          style={{ padding:'3px 6px', border:'1.5px solid #e5e7eb', borderRadius:6, fontSize:12, color:'#374151', background:'#fff', outline:'none' }} />
                      ) : (
                        im.mesReferencia
                          ? <span style={{ padding:'2px 8px', borderRadius:6, background:'#f1f5f9', color:'#374151', fontSize:12, fontWeight:700 }}>{im.mesReferencia}</span>
                          : <span style={{ color:'#d1d5db' }}>—</span>
                      )
                    ) : <span style={{ color:'#d1d5db' }}>—</span>}
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

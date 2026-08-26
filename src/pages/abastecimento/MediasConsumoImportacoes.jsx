import { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import * as XLSX from 'xlsx';
import api from '../../services/api';
import toast from 'react-hot-toast';

/* ── fuzzy match de nomes ── */
const normFuzzy = s => String(s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9\s]/g,'').trim();
const tokens    = s => normFuzzy(s).split(/\s+/).filter(t => t.length > 2);
const THRESHOLD_CONSUMO = 0.45;

function levDist(a, b) {
  const dp = Array.from({length:a.length+1}, (_,i) =>
    Array.from({length:b.length+1}, (_,j) => i===0?j:j===0?i:0));
  for (let i=1;i<=a.length;i++)
    for (let j=1;j<=b.length;j++)
      dp[i][j] = a[i-1]===b[j-1] ? dp[i-1][j-1] : 1+Math.min(dp[i-1][j],dp[i][j-1],dp[i-1][j-1]);
  return dp[a.length][b.length];
}

function scoreNomeConsumo(a, b) {
  const ta = tokens(a), tb = tokens(b);
  if (!ta.length || !tb.length) return 0;
  if (levDist(ta[0], tb[0]) > 1) return 0;
  const tbSet = new Set(tb);
  const overlap = ta.filter(t => tbSet.has(t)).length;
  const tokenScore = overlap / Math.max(ta.length, tb.length);
  const na = normFuzzy(a), nb = normFuzzy(b);
  const maxL = Math.max(na.length, nb.length);
  if (!maxL) return tokenScore;
  const dp = Array.from({length:na.length+1}, (_,i) =>
    Array.from({length:nb.length+1}, (_,j) => i===0?j:j===0?i:0));
  for (let i=1;i<=na.length;i++)
    for (let j=1;j<=nb.length;j++)
      dp[i][j] = na[i-1]===nb[j-1] ? dp[i-1][j-1] : 1+Math.min(dp[i-1][j],dp[i][j-1],dp[i-1][j-1]);
  const levScore = 1 - dp[na.length][nb.length] / maxL;
  return tokenScore * 0.7 + levScore * 0.3;
}

function badgeScore(score) {
  if (score >= 1)                 return { bg:'#dcfce7', color:'#166534', border:'#bbf7d0', label:'Exato' };
  if (score >= 0.7)               return { bg:'#fef9c3', color:'#854d0e', border:'#fde047', label:'Provável' };
  if (score >= THRESHOLD_CONSUMO) return { bg:'#fef3c7', color:'#92400e', border:'#fbbf24', label:'Similar' };
  return                                 { bg:'#fee2e2', color:'#991b1b', border:'#fecaca', label:'Não encontrado' };
}

/* ── helpers ── */
function excelDateToISO(serial) {
  const d = new Date(Math.round((serial - 25569) * 86400 * 1000));
  return d.toISOString().slice(0, 10);
}
const fmtDt = s => s ? new Date(s + 'T12:00:00').toLocaleDateString('pt-BR') : '—';
const fmtN  = (v, d = 0) => v != null ? Number(v).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—';
const fmtR  = v => v != null ? `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—';

const FROTAS = ['BAÚ', 'FROTA'];
const normPlaca = p => String(p || '').toUpperCase().trim();

/* ── badge de frota ── */
function FrotaBadge({ frota }) {
  const isBAU = frota === 'BAÚ';
  return (
    <span style={{ padding:'2px 10px', borderRadius:20, fontSize:11, fontWeight:700, border:'1px solid',
      background: isBAU ? '#eff6ff' : '#f0fdf4',
      color:      isBAU ? '#1d4ed8' : '#15803d',
      borderColor:isBAU ? '#bfdbfe' : '#86efac' }}>
      {frota || 'Sem frota'}
    </span>
  );
}

export default function MediasConsumoImportacoes() {
  const fileRef      = useRef();
  const filePlacaRef = useRef();

  // ── aba ativa ──
  const [aba, setAba] = useState('importacoes'); // 'importacoes' | 'placas'

  // ── importações existentes ──
  const [importacoes, setImportacoes] = useState([]);
  const [loadingImps, setLoadingImps] = useState(true);

  // ── preview (antes de salvar) ──
  const [preview,   setPreview]   = useState(null);
  const [salvando,  setSalvando]  = useState(false);
  const [progresso, setProgresso] = useState(0);

  // ── cadastro de placas ──
  const [cadastroPlacas,    setCadastroPlacas]    = useState([]);
  const [loadingPlacas,     setLoadingPlacas]     = useState(true);
  const [importandoPlacas,  setImportandoPlacas]  = useState(false);

  // mapa placa → frota para uso durante importação de consumo
  const placaMap = useMemo(() => {
    const m = {};
    for (const p of cadastroPlacas) m[normPlaca(p.placa)] = p.frota;
    return m;
  }, [cadastroPlacas]);

  const carregarPlacas = useCallback(async () => {
    setLoadingPlacas(true);
    try {
      const { data } = await api.get('/medias-consumo/cadastro-placas');
      setCadastroPlacas(data);
    } catch { toast.error('Erro ao carregar placas'); }
    finally { setLoadingPlacas(false); }
  }, []);
  useEffect(() => { carregarPlacas(); }, [carregarPlacas]);

  async function excluirPlaca(placa) {
    if (!confirm(`Excluir a placa ${placa}?`)) return;
    try {
      await api.delete(`/medias-consumo/cadastro-placas/${placa}`);
      toast.success('Placa removida');
      await carregarPlacas();
    } catch { toast.error('Erro ao excluir placa'); }
  }

  /* ── importar planilha de placas ── */
  async function handleFilePlacas(e) {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { cellDates: true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true });

      const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').trim();
      const header = raw[0] || [];
      const iPlaca  = header.findIndex(h => norm(h).includes('placa'));
      const iFrota  = header.findIndex(h => norm(h).includes('frota') || norm(h).includes('operacao') || norm(h).includes('tipo'));
      const iModelo = header.findIndex(h => norm(h).includes('modelo'));

      if (iPlaca < 0 || iFrota < 0) {
        toast.error('Planilha precisa ter colunas "placa" e "frota"');
        e.target.value = '';
        return;
      }

      const placas = raw.slice(1)
        .map(r => ({
          placa:  r[iPlaca]  ? String(r[iPlaca]).toUpperCase().trim()  : null,
          frota:  r[iFrota]  ? String(r[iFrota]).toUpperCase().trim()  : null,
          modelo: iModelo >= 0 && r[iModelo] ? String(r[iModelo]).trim() : null,
        }))
        .filter(p => p.placa && p.frota);

      if (!placas.length) { toast.error('Nenhuma placa válida encontrada'); e.target.value = ''; return; }

      setImportandoPlacas(true);
      const toastId = toast.loading(`Salvando ${placas.length} placas...`);
      try {
        const { data } = await api.post('/medias-consumo/cadastro-placas/importar', { placas });
        toast.success(`${data.inseridas} inseridas, ${data.atualizadas} atualizadas`, { id: toastId });
        await carregarPlacas();
      } catch (err) {
        toast.error(err?.response?.data?.error || 'Erro ao importar', { id: toastId });
      } finally { setImportandoPlacas(false); }
    } catch (err) { toast.error('Erro ao ler arquivo: ' + err.message); }
    e.target.value = '';
  }

  // ── aliases de nomes ──
  const [aliases, setAliases] = useState([]);
  useEffect(() => {
    api.get('/nome-aliases').then(r => setAliases(r.data)).catch(() => {});
  }, []);
  const aliasMap = useMemo(() => {
    const map = {};
    for (const a of aliases) map[a.nomeImportado] = a.motoristaNome;
    return map;
  }, [aliases]);
  function resolverNome(nome) {
    const chave = String(nome || '').toUpperCase().replace(/\s+/g,' ').trim();
    return aliasMap[chave] || nome;
  }
  async function salvarAliasLocal(nomeOriginal, nomeNovo) {
    try {
      const { data } = await api.post('/nome-aliases', { nomeImportado: nomeOriginal, motoristaNome: nomeNovo });
      setAliases(prev => { const sem = prev.filter(a => a.nomeImportado !== data.nomeImportado); return [...sem, data]; });
      setPreview(p => p ? ({
        ...p,
        revisaoNomes: (p.revisaoNomes || []).map(r =>
          r.nomeOriginal === nomeOriginal ? { ...r, nomeEditado: nomeNovo, matchByAlias: true } : r
        ),
      }) : p);
      toast.success(`Alias salvo: "${nomeOriginal}" → "${nomeNovo}"`);
    } catch { toast.error('Erro ao salvar alias'); }
  }
  function confirmarNomesConsumo() {
    setPreview(p => {
      const mapa = {};
      for (const r of (p.revisaoNomes || [])) mapa[r.nomeOriginal] = r.nomeEditado;
      return { ...p, registros: p.registros.map(r => ({ ...r, motorista: mapa[r.motorista] || r.motorista })), nomesConfirmados: true };
    });
  }

  // ── revisão de placas: classificar placas novas antes de salvar ──
  function confirmarPlacasConsumo() {
    setPreview(p => {
      // Atualiza registros com a frota definida na revisão
      const novoMapa = {};
      for (const rp of (p.revisaoPlacas || [])) novoMapa[normPlaca(rp.placa)] = rp.frota;
      return {
        ...p,
        registros: p.registros.map(r => ({
          ...r,
          _frota: novoMapa[normPlaca(r.placa)] || placaMap[normPlaca(r.placa)] || r._frota || 'BAÚ',
        })),
        placasConfirmadas: true,
      };
    });
  }

  /* ── carregar importações ── */
  const carregarImportacoes = useCallback(async () => {
    setLoadingImps(true);
    try {
      const { data } = await api.get('/medias-consumo/importacoes');
      setImportacoes(data);
    } catch { toast.error('Erro ao carregar importações'); }
    finally { setLoadingImps(false); }
  }, []);
  useEffect(() => { carregarImportacoes(); }, [carregarImportacoes]);

  async function excluirImportacao(id) {
    if (!confirm('Excluir esta importação e todos os registros?')) return;
    try {
      await api.delete(`/medias-consumo/importacoes/${id}`);
      toast.success('Importação removida');
      await carregarImportacoes();
    } catch { toast.error('Erro ao excluir'); }
  }

  /* ── ler Excel de consumo ── */
  async function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    try {
      // Buscar cadastro de placas atualizado (evita race condition com o carregamento inicial)
      let placaMapAtual = placaMap;
      try {
        const { data } = await api.get('/medias-consumo/cadastro-placas');
        setCadastroPlacas(data);
        const m = {};
        for (const p of data) m[normPlaca(p.placa)] = p.frota;
        placaMapAtual = m;
      } catch {}

      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { cellDates: true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true });

      const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
      const MAPA = {
        data:           ['data abt', 'data'],
        motorista:      ['motorista'],
        placa:          ['placa'],
        modelo:         ['modelo'],
        conjunto:       ['conjunto'],
        kmInicial:      ['km inicial', 'kminicial'],
        kmFinal:        ['km final', 'kmfinal'],
        distancia:      ['distancia'],
        posto:          ['posto'],
        cidade:         ['cidade'],
        uf:             ['uf'],
        precoLitro:     ['r$', 'preco litro', 'preco', 'vl unitario'],
        litros:         ['litros'],
        produto:        ['produto'],
        vlrTotal:       ['vlr total', 'valor total', 'vlrtotal'],
        mediaRealizada: ['media realizada', 'mediarealizada'],
        mediaSugerida:  ['media sugerida', 'mediasugerida'],
        percAtingido:   ['% atingido', 'perc atingido'],
        gap:            ['gap'],
      };

      const header = raw[0] || [];
      const idx = {};
      for (const [campo, al] of Object.entries(MAPA)) idx[campo] = header.findIndex(h => al.includes(norm(h)));

      const col    = (row, campo, def = null) => { const i = idx[campo]; return i >= 0 && row[i] !== undefined && row[i] !== '' ? row[i] : def; };
      const colNum = (row, campo) => { const v = col(row, campo); if (v === null || v === undefined || v === '') return null; if (typeof v === 'number') return v; const n = parseFloat(String(v).replace(/[R$\s.]/g,'').replace(',','.')); return isNaN(n) ? null : n; };
      const colData = (row, campo) => { const v = col(row, campo); if (!v) return null; if (v instanceof Date) return v.toISOString().slice(0,10); if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0,10); if (typeof v === 'number') return excelDateToISO(v); return null; };

      // Revisão de nomes
      const nomesUnicos = [...new Set(raw.slice(1).filter(r => col(r,'motorista')).map(r => String(col(r,'motorista')||'').trim()).filter(Boolean))];
      let motoristasBD = [];
      try { const { data } = await api.get('/medias-consumo/motoristas-nomes'); motoristasBD = data; } catch {}
      const revisaoNomes = nomesUnicos.map(nomeOriginal => {
        const nomeEditado = resolverNome(nomeOriginal);
        const matchByAlias = nomeEditado !== nomeOriginal;
        let melhorMatch = null, melhorScore = 0, melhorId = null;
        for (const m of motoristasBD) { const s = scoreNomeConsumo(nomeEditado, m.nome); if (s > melhorScore) { melhorScore = s; melhorMatch = m.nome; melhorId = m.id; } }
        const exacto = melhorScore >= 1 || normFuzzy(nomeEditado) === normFuzzy(melhorMatch || '');
        if (exacto && melhorMatch) melhorScore = 1;
        return { nomeOriginal, nomeEditado, matchByAlias, melhorMatch, score: melhorScore, melhorId };
      });
      const todosNomesResolvidos = revisaoNomes.every(r => r.score >= 1);

      const registros = raw.slice(1)
        .filter(r => col(r,'data') && col(r,'motorista'))
        .map(r => ({
          data: colData(r,'data'), motorista: String(col(r,'motorista')||'').trim(),
          placa: col(r,'placa'), modelo: col(r,'modelo'), conjunto: col(r,'conjunto'),
          kmInicial: colNum(r,'kmInicial'), kmFinal: colNum(r,'kmFinal'), distancia: colNum(r,'distancia'),
          posto: col(r,'posto'), cidade: col(r,'cidade'), uf: col(r,'uf'),
          precoLitro: colNum(r,'precoLitro'), litros: colNum(r,'litros'), produto: col(r,'produto',''),
          vlrTotal: colNum(r,'vlrTotal'), mediaRealizada: colNum(r,'mediaRealizada'),
          mediaSugerida: colNum(r,'mediaSugerida'), percAtingido: col(r,'percAtingido',''), gap: colNum(r,'gap'),
        }));

      // Revisão de placas: detectar placas sem frota cadastrada (usa placaMapAtual, sempre fresco)
      const placasUnicas = [...new Set(registros.map(r => normPlaca(r.placa)).filter(Boolean))];
      const revisaoPlacas = placasUnicas
        .filter(p => !placaMapAtual[p]) // só as não cadastradas
        .map(p => ({ placa: p, frota: '' }));
      const todasPlacasCadastradas = revisaoPlacas.length === 0;

      setPreview({
        nomeArquivo: file.name,
        registros,
        revisaoNomes,
        nomesConfirmados: todosNomesResolvidos,
        revisaoPlacas,
        placasConfirmadas: todasPlacasCadastradas,
      });
      toast.success(`${registros.length.toLocaleString('pt-BR')} registros lidos`);
    } catch (err) { toast.error('Erro ao ler o arquivo: ' + err.message); }
    e.target.value = '';
  }

  /* ── salvar no banco ── */
  async function salvarImportacao() {
    if (!preview) return;
    setSalvando(true);
    setProgresso(0);

    // Enriquecer registros com frota da placa
    const registrosFinais = preview.registros.map(r => ({
      ...r,
      frota: r._frota || placaMap[normPlaca(r.placa)] || 'BAÚ',
    }));

    // Determinar frota "dominante" da importação (a mais frequente)
    const contFrota = {};
    for (const r of registrosFinais) contFrota[r.frota] = (contFrota[r.frota] || 0) + 1;
    const frotaDominante = Object.entries(contFrota).sort((a,b) => b[1]-a[1])[0]?.[0] || 'BAÚ';

    const total = registrosFinais.length;
    const CHUNK = 3000;
    const chunks = [];
    for (let i = 0; i < total; i += CHUNK) chunks.push(registrosFinais.slice(i, i + CHUNK));

    const toastId = toast.loading(`Salvando 0 / ${total.toLocaleString('pt-BR')} registros...`);
    try {
      const { data: primeira } = await api.post('/medias-consumo/importar', {
        nomeArquivo: preview.nomeArquivo,
        registros:   chunks[0],
        frota:       frotaDominante,
      });
      const importacaoIdNova = primeira.importacaoId;
      let salvos = chunks[0].length;
      setProgresso(Math.round((salvos / total) * 100));
      toast.loading(`Salvando ${salvos.toLocaleString('pt-BR')} / ${total.toLocaleString('pt-BR')}...`, { id: toastId });

      for (let i = 1; i < chunks.length; i++) {
        await api.post(`/medias-consumo/importacoes/${importacaoIdNova}/registros`, { registros: chunks[i] });
        salvos += chunks[i].length;
        setProgresso(Math.round((salvos / total) * 100));
        toast.loading(`Salvando ${salvos.toLocaleString('pt-BR')} / ${total.toLocaleString('pt-BR')}...`, { id: toastId });
      }

      // Salvar placas novas no cadastro
      if (preview.revisaoPlacas?.length > 0) {
        const novas = preview.revisaoPlacas.filter(p => p.frota);
        if (novas.length) {
          await api.post('/medias-consumo/cadastro-placas/importar', { placas: novas }).catch(() => {});
          await carregarPlacas();
        }
      }

      toast.success(`${total.toLocaleString('pt-BR')} registros salvos!`, { id: toastId });
      setPreview(null);
      setProgresso(0);
      await carregarImportacoes();
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Erro ao salvar', { id: toastId });
      setProgresso(0);
    } finally { setSalvando(false); }
  }

  const podeSalvar = preview && preview.nomesConfirmados && preview.placasConfirmadas;

  /* ─────────── render ─────────── */
  return (
    <div>
      {/* ── CABEÇALHO ── */}
      <div style={{ background:'#fff', border:'1px solid #e5e7eb', borderRadius:12, padding:'14px 20px', marginBottom:16 }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <div style={{ flex:1 }}>
            <h2 style={{ fontSize:17, fontWeight:700, color:'#1a1a2e', margin:0 }}>Importações — Médias de Consumo</h2>
            <p style={{ fontSize:11, color:'#9ca3af', margin:0 }}>Somente administradores</p>
          </div>
          {/* Tabs */}
          <div style={{ display:'flex', gap:4 }}>
            {[{key:'importacoes', label:'Importações', icon:'ti-file-spreadsheet'}, {key:'placas', label:'Cadastro de Placas', icon:'ti-car'}].map(t => (
              <button key={t.key} onClick={() => setAba(t.key)}
                style={{ display:'flex', alignItems:'center', gap:6, padding:'7px 14px', border:'1.5px solid', borderRadius:8, fontSize:12, fontWeight:600, cursor:'pointer',
                  borderColor: aba===t.key ? '#EB3238' : '#e5e7eb',
                  background:  aba===t.key ? '#EB3238' : '#f9fafb',
                  color:       aba===t.key ? '#fff'    : '#374151' }}>
                <i className={`ti ${t.icon}`} style={{ fontSize:14 }}></i>
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ══════════ ABA IMPORTAÇÕES ══════════ */}
      {aba === 'importacoes' && (
        <div>
          {/* Botão importar */}
          <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:12 }}>
            <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={handleFile} style={{ display:'none' }} />
            <button onClick={() => fileRef.current?.click()}
              style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 16px', background:'#EB3238', color:'#fff', border:'none', borderRadius:8, fontSize:13, fontWeight:600, cursor:'pointer' }}>
              <i className="ti ti-upload" style={{ fontSize:14 }}></i> Importar planilha
            </button>
          </div>

          {/* Preview Excel */}
          {preview && (
            <div style={{ background:'#fffbeb', border:'1px solid #fde68a', borderRadius:12, padding:16, marginBottom:16 }}>
              <div style={{ display:'flex', alignItems:'center', gap:12, flexWrap:'wrap', marginBottom:12 }}>
                <i className="ti ti-file-spreadsheet" style={{ fontSize:20, color:'#d97706' }}></i>
                <div>
                  <div style={{ fontWeight:600, fontSize:13, color:'#92400e' }}>{preview.nomeArquivo}</div>
                  <div style={{ fontSize:11, color:'#b45309' }}>{preview.registros.length.toLocaleString('pt-BR')} registros lidos</div>
                </div>
                <div style={{ marginLeft:'auto', display:'flex', gap:8 }}>
                  <button onClick={() => setPreview(null)} style={{ padding:'7px 14px', border:'1px solid #d1d5db', borderRadius:8, background:'#fff', fontSize:12, cursor:'pointer' }}>Cancelar</button>
                  <button onClick={salvarImportacao} disabled={salvando || !podeSalvar}
                    style={{ padding:'7px 16px', border:'none', borderRadius:8, background: podeSalvar ? '#16a34a' : '#9ca3af', color:'#fff', fontSize:12, fontWeight:600, cursor: podeSalvar ? 'pointer' : 'not-allowed' }}>
                    {salvando ? `Salvando... ${progresso}%` : 'Salvar no banco'}
                  </button>
                </div>
              </div>

              {/* ── Revisão de PLACAS ── */}
              {preview.revisaoPlacas && !preview.placasConfirmadas && (
                <div style={{ background:'#fff', border:'1px solid #e5e7eb', borderRadius:10, overflow:'hidden', marginBottom:12 }}>
                  <div style={{ padding:'10px 14px', background:'#f8fafc', borderBottom:'1px solid #e5e7eb', display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                    <i className="ti ti-car" style={{ color:'#EB3238', fontSize:15 }}></i>
                    <span style={{ fontSize:12, fontWeight:700, color:'#374151' }}>Placas não cadastradas</span>
                    <span style={{ padding:'2px 8px', borderRadius:10, background:'#fee2e2', color:'#991b1b', border:'1px solid #fecaca', fontSize:11, fontWeight:700 }}>
                      {preview.revisaoPlacas.length} placa{preview.revisaoPlacas.length !== 1 ? 's' : ''} sem frota
                    </span>
                    <button
                      onClick={() => {
                        // se todas já têm frota definida, confirmar
                        const todas = (preview.revisaoPlacas || []).every(p => p.frota);
                        if (!todas) { toast.error('Classifique todas as placas antes de continuar'); return; }
                        confirmarPlacasConsumo();
                      }}
                      style={{ marginLeft:'auto', padding:'5px 14px', background:'#EB3238', color:'#fff', border:'none', borderRadius:7, fontSize:12, fontWeight:600, cursor:'pointer' }}>
                      Confirmar placas →
                    </button>
                  </div>
                  <div style={{ padding:12 }}>
                    <p style={{ fontSize:12, color:'#6b7280', margin:'0 0 10px' }}>
                      Essas placas não estão no cadastro. Classifique cada uma para continuar. Elas serão salvas no cadastro automaticamente.
                    </p>
                    <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
                      {(preview.revisaoPlacas || []).map((rp, i) => (
                        <div key={rp.placa} style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 12px', border:'1.5px solid', borderColor: rp.frota ? '#bbf7d0' : '#fde68a', borderRadius:10, background: rp.frota ? '#f0fdf4' : '#fffbeb' }}>
                          <span style={{ fontWeight:700, fontSize:13, color:'#1a1a2e', fontFamily:'monospace' }}>{rp.placa}</span>
                          <div style={{ display:'flex', gap:4 }}>
                            {FROTAS.map(f => (
                              <button key={f} onClick={() => setPreview(p => ({
                                ...p,
                                revisaoPlacas: p.revisaoPlacas.map((x, j) => j === i ? { ...x, frota: f } : x),
                              }))}
                                style={{ padding:'4px 12px', border:'1.5px solid', borderRadius:20, fontSize:11, fontWeight:700, cursor:'pointer',
                                  borderColor: rp.frota===f ? (f==='BAÚ'?'#93c5fd':'#86efac') : '#d1d5db',
                                  background:  rp.frota===f ? (f==='BAÚ'?'#3b82f6':'#22c55e') : '#fff',
                                  color:       rp.frota===f ? '#fff' : '#374151' }}>
                                {f}
                              </button>
                            ))}
                          </div>
                          {rp.frota && <i className="ti ti-check" style={{ color:'#16a34a', fontSize:14 }}></i>}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Placas confirmadas */}
              {preview.placasConfirmadas && preview.revisaoPlacas?.length > 0 && (
                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12, padding:'6px 10px', background:'#f0fdf4', border:'1px solid #86efac', borderRadius:8 }}>
                  <i className="ti ti-check" style={{ color:'#16a34a' }}></i>
                  <span style={{ fontSize:12, color:'#15803d' }}>
                    {preview.revisaoPlacas.length} placa{preview.revisaoPlacas.length!==1?'s':''} classificada{preview.revisaoPlacas.length!==1?'s':''} —
                    {preview.revisaoPlacas.filter(p=>p.frota==='BAÚ').length} BAÚ,
                    {preview.revisaoPlacas.filter(p=>p.frota==='FROTA').length} FROTA
                  </span>
                  <button onClick={() => setPreview(p => ({ ...p, placasConfirmadas: false }))}
                    style={{ fontSize:11, color:'#6b7280', background:'none', border:'none', cursor:'pointer', textDecoration:'underline' }}>Rever</button>
                </div>
              )}

              {/* ── Revisão de NOMES ── */}
              {preview.revisaoNomes && !preview.nomesConfirmados && (
                <div style={{ background:'#fff', border:'1px solid #e5e7eb', borderRadius:10, overflow:'hidden' }}>
                  <div style={{ padding:'10px 14px', background:'#f8fafc', borderBottom:'1px solid #e5e7eb', display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                    <i className="ti ti-users" style={{ color:'#6366f1', fontSize:15 }}></i>
                    <span style={{ fontSize:12, fontWeight:700, color:'#374151' }}>Verificação de motoristas</span>
                    {(() => {
                      const exatos    = (preview.revisaoNomes||[]).filter(r => r.score >= 1).length;
                      const provaveis = (preview.revisaoNomes||[]).filter(r => r.score >= 0.7 && r.score < 1).length;
                      const similares = (preview.revisaoNomes||[]).filter(r => r.score >= THRESHOLD_CONSUMO && r.score < 0.7).length;
                      const novos     = (preview.revisaoNomes||[]).filter(r => r.score < THRESHOLD_CONSUMO).length;
                      return <>
                        {exatos    > 0 && <span style={{ padding:'2px 8px', borderRadius:10, background:'#dcfce7', color:'#166534', border:'1px solid #bbf7d0', fontSize:11, fontWeight:700 }}>{exatos} exatos</span>}
                        {provaveis > 0 && <span style={{ padding:'2px 8px', borderRadius:10, background:'#fef9c3', color:'#854d0e', border:'1px solid #fde047', fontSize:11, fontWeight:700 }}>{provaveis} prováveis</span>}
                        {similares > 0 && <span style={{ padding:'2px 8px', borderRadius:10, background:'#fef3c7', color:'#92400e', border:'1px solid #fbbf24', fontSize:11, fontWeight:700 }}>{similares} similares</span>}
                        {novos     > 0 && <span style={{ padding:'2px 8px', borderRadius:10, background:'#fee2e2', color:'#991b1b', border:'1px solid #fecaca', fontSize:11, fontWeight:700 }}>{novos} não encontrados</span>}
                      </>;
                    })()}
                    <button onClick={confirmarNomesConsumo}
                      style={{ marginLeft:'auto', padding:'5px 14px', background:'#6366f1', color:'#fff', border:'none', borderRadius:7, fontSize:12, fontWeight:600, cursor:'pointer' }}>
                      Confirmar e continuar →
                    </button>
                  </div>
                  <div style={{ maxHeight:360, overflowY:'auto' }}>
                    <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                      <thead>
                        <tr style={{ background:'#f8fafc' }}>
                          <th style={{ padding:'7px 12px', textAlign:'left', fontSize:11, fontWeight:700, color:'#6b7280', textTransform:'uppercase', borderBottom:'1px solid #e5e7eb' }}>Nome na planilha</th>
                          <th style={{ padding:'7px 12px', textAlign:'left', fontSize:11, fontWeight:700, color:'#6b7280', textTransform:'uppercase', borderBottom:'1px solid #e5e7eb' }}>Melhor match no banco</th>
                          <th style={{ padding:'7px 12px', textAlign:'left', fontSize:11, fontWeight:700, color:'#6b7280', textTransform:'uppercase', borderBottom:'1px solid #e5e7eb' }}>Nome a salvar (editável)</th>
                          <th style={{ padding:'7px 12px', textAlign:'center', fontSize:11, fontWeight:700, color:'#6b7280', textTransform:'uppercase', borderBottom:'1px solid #e5e7eb' }}>Match</th>
                          <th style={{ padding:'7px 12px', textAlign:'center', fontSize:11, fontWeight:700, color:'#6b7280', textTransform:'uppercase', borderBottom:'1px solid #e5e7eb' }}>Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(preview.revisaoNomes||[]).map((r, i) => {
                          const badge = badgeScore(r.score);
                          const temSugestao = r.melhorMatch && r.score >= 0.7 && r.score < 1 && r.nomeEditado !== r.melhorMatch;
                          return (
                            <tr key={i} style={{ borderBottom:'1px solid #f3f4f6', background: i%2===0?'#fff':'#fafafa' }}>
                              <td style={{ padding:'6px 12px', color:'#374151', fontWeight:500 }}>
                                {r.nomeOriginal}
                                {r.matchByAlias && <span style={{ marginLeft:6, padding:'1px 6px', borderRadius:8, background:'#f0fdf4', color:'#15803d', border:'1px solid #86efac', fontSize:10, fontWeight:700 }}>alias</span>}
                              </td>
                              <td style={{ padding:'6px 12px', color: r.melhorMatch?'#374151':'#9ca3af', fontStyle: r.melhorMatch?'normal':'italic' }}>
                                {r.melhorMatch || '—'}
                              </td>
                              <td style={{ padding:'4px 8px' }}>
                                <input value={r.nomeEditado}
                                  onChange={e2 => setPreview(p => ({
                                    ...p,
                                    revisaoNomes: p.revisaoNomes.map((x, j) => j === i
                                      ? { ...x, nomeEditado: e2.target.value, matchByAlias: false,
                                          score: normFuzzy(e2.target.value) === normFuzzy(x.melhorMatch||'') ? 1 : x.score }
                                      : x),
                                  }))}
                                  style={{ width:'100%', padding:'4px 8px', border:'1.5px solid '+(r.nomeEditado!==r.nomeOriginal?'#6366f1':'#e5e7eb'), borderRadius:6, fontSize:12, outline:'none', background: r.nomeEditado!==r.nomeOriginal?'#f5f3ff':'#fff', boxSizing:'border-box' }}
                                />
                              </td>
                              <td style={{ padding:'6px 8px', textAlign:'center' }}>
                                <span style={{ padding:'2px 8px', borderRadius:10, background:badge.bg, color:badge.color, border:`1px solid ${badge.border}`, fontSize:11, fontWeight:700, whiteSpace:'nowrap' }}>
                                  {badge.label}
                                </span>
                              </td>
                              <td style={{ padding:'4px 8px', textAlign:'center', whiteSpace:'nowrap' }}>
                                <div style={{ display:'flex', gap:4, justifyContent:'center' }}>
                                  {temSugestao && (
                                    <button onClick={() => setPreview(p => ({
                                      ...p,
                                      revisaoNomes: p.revisaoNomes.map((x, j) => j===i ? { ...x, nomeEditado: x.melhorMatch, score:1, matchByAlias:false } : x),
                                    }))}
                                      style={{ background:'#f0fdf4', border:'1px solid #86efac', borderRadius:6, padding:'3px 8px', fontSize:11, fontWeight:600, color:'#15803d', cursor:'pointer' }}>
                                      ✓ Aceitar
                                    </button>
                                  )}
                                  {r.nomeEditado !== r.nomeOriginal && !r.matchByAlias && (
                                    <button onClick={() => salvarAliasLocal(r.nomeOriginal, r.nomeEditado)}
                                      style={{ background:'#eff6ff', border:'1px solid #bfdbfe', borderRadius:6, padding:'3px 8px', fontSize:11, fontWeight:600, color:'#1d4ed8', cursor:'pointer' }}>
                                      <i className="ti ti-link"></i> Alias
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Nomes confirmados */}
              {preview.nomesConfirmados && preview.revisaoNomes && (
                <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:8 }}>
                  {(() => {
                    const total = (preview.revisaoNomes||[]).length;
                    const exatos  = (preview.revisaoNomes||[]).filter(r => r.score >= 1).length;
                    const aliasOk = (preview.revisaoNomes||[]).filter(r => r.matchByAlias).length;
                    const sem     = total - exatos;
                    return <span style={{ fontSize:12, color:'#15803d' }}><i className="ti ti-check"></i> {total} motoristas verificados — {exatos} com match{aliasOk>0?`, ${aliasOk} por alias`:''}{sem>0?`, ${sem} sem correspondência`:''}</span>;
                  })()}
                  <button onClick={() => setPreview(p => ({ ...p, nomesConfirmados: false }))}
                    style={{ fontSize:11, color:'#6b7280', background:'none', border:'none', cursor:'pointer', textDecoration:'underline' }}>Rever</button>
                </div>
              )}
            </div>
          )}

          {/* Lista de importações */}
          <div style={{ background:'#fff', border:'1px solid #e5e7eb', borderRadius:12, overflow:'hidden' }}>
            <div style={{ padding:'12px 20px', borderBottom:'1px solid #f3f4f6', display:'flex', alignItems:'center', gap:8 }}>
              <i className="ti ti-history" style={{ fontSize:16, color:'#6b7280' }}></i>
              <span style={{ fontWeight:700, fontSize:13, color:'#374151' }}>Histórico de importações</span>
              <span style={{ marginLeft:'auto', fontSize:11, color:'#9ca3af' }}>{importacoes.length} arquivo{importacoes.length!==1?'s':''}</span>
            </div>
            {loadingImps && <div style={{ padding:40, textAlign:'center', color:'#9ca3af' }}>Carregando...</div>}
            {!loadingImps && importacoes.length === 0 && (
              <div style={{ padding:60, textAlign:'center', color:'#9ca3af' }}>
                <i className="ti ti-file-spreadsheet" style={{ fontSize:36, display:'block', marginBottom:10, color:'#d1d5db' }}></i>
                <div style={{ fontWeight:500, marginBottom:4 }}>Nenhuma importação ainda</div>
                <div style={{ fontSize:12 }}>Clique em "Importar planilha" para começar</div>
              </div>
            )}
            {!loadingImps && importacoes.length > 0 && (
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
                <thead>
                  <tr style={{ background:'#f8fafc' }}>
                    <th style={{ padding:'9px 16px', textAlign:'left', fontSize:11, fontWeight:700, color:'#6b7280', textTransform:'uppercase', borderBottom:'1px solid #e5e7eb' }}>Arquivo</th>
                    <th style={{ padding:'9px 16px', textAlign:'left', fontSize:11, fontWeight:700, color:'#6b7280', textTransform:'uppercase', borderBottom:'1px solid #e5e7eb' }}>Frota</th>
                    <th style={{ padding:'9px 16px', textAlign:'right', fontSize:11, fontWeight:700, color:'#6b7280', textTransform:'uppercase', borderBottom:'1px solid #e5e7eb' }}>Registros</th>
                    <th style={{ padding:'9px 16px', textAlign:'right', fontSize:11, fontWeight:700, color:'#6b7280', textTransform:'uppercase', borderBottom:'1px solid #e5e7eb' }}>Valor total</th>
                    <th style={{ padding:'9px 16px', textAlign:'left', fontSize:11, fontWeight:700, color:'#6b7280', textTransform:'uppercase', borderBottom:'1px solid #e5e7eb' }}>Data</th>
                    <th style={{ padding:'9px 16px', borderBottom:'1px solid #e5e7eb' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {importacoes.map((im, i) => (
                    <tr key={im.id} style={{ borderBottom:'1px solid #f3f4f6', background: i%2===0?'#fff':'#fafafa' }}>
                      <td style={{ padding:'10px 16px', color:'#1a1a2e', fontWeight:500 }}>
                        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                          <i className="ti ti-file-spreadsheet" style={{ color:'#16a34a', fontSize:16 }}></i>
                          {im.nomeArquivo}
                        </div>
                      </td>
                      <td style={{ padding:'10px 16px' }}><FrotaBadge frota={im.frota} /></td>
                      <td style={{ padding:'10px 16px', textAlign:'right', color:'#374151' }}>
                        {fmtN(im._count?.registros ?? im.totalRegistros ?? '—')}
                      </td>
                      <td style={{ padding:'10px 16px', textAlign:'right', color:'#16a34a', fontWeight:600 }}>
                        {im.totalValor != null ? fmtR(im.totalValor) : '—'}
                      </td>
                      <td style={{ padding:'10px 16px', color:'#6b7280', fontSize:12 }}>{fmtDt(im.criadoEm?.slice(0,10))}</td>
                      <td style={{ padding:'10px 16px', textAlign:'center' }}>
                        <button onClick={() => excluirImportacao(im.id)}
                          style={{ padding:'5px 10px', border:'1px solid #fee2e2', borderRadius:7, background:'#fff5f5', color:'#dc2626', fontSize:12, cursor:'pointer' }}>
                          <i className="ti ti-trash"></i>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ══════════ ABA CADASTRO DE PLACAS ══════════ */}
      {aba === 'placas' && (
        <div>
          {/* Toolbar */}
          <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:12, gap:8 }}>
            <input ref={filePlacaRef} type="file" accept=".xlsx,.xls" onChange={handleFilePlacas} style={{ display:'none' }} />
            <button onClick={() => filePlacaRef.current?.click()} disabled={importandoPlacas}
              style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 16px', background:'#1d4ed8', color:'#fff', border:'none', borderRadius:8, fontSize:13, fontWeight:600, cursor:'pointer' }}>
              <i className="ti ti-upload" style={{ fontSize:14 }}></i>
              {importandoPlacas ? 'Importando...' : 'Importar lista de placas'}
            </button>
          </div>

          {/* Instrução */}
          <div style={{ background:'#eff6ff', border:'1px solid #bfdbfe', borderRadius:10, padding:'10px 16px', marginBottom:12, fontSize:12, color:'#1e40af' }}>
            <i className="ti ti-info-circle" style={{ marginRight:6 }}></i>
            A planilha deve ter colunas <strong>placa</strong> e <strong>frota</strong> (valores: BAÚ ou FROTA). Coluna <strong>modelo</strong> é opcional.
            Ao importar, as placas existentes são atualizadas (upsert).
          </div>

          {/* Tabela de placas */}
          <div style={{ background:'#fff', border:'1px solid #e5e7eb', borderRadius:12, overflow:'hidden' }}>
            <div style={{ padding:'12px 20px', borderBottom:'1px solid #f3f4f6', display:'flex', alignItems:'center', gap:8 }}>
              <i className="ti ti-car" style={{ fontSize:16, color:'#6b7280' }}></i>
              <span style={{ fontWeight:700, fontSize:13, color:'#374151' }}>Placas cadastradas</span>
              <span style={{ marginLeft:'auto', fontSize:11, color:'#9ca3af' }}>{cadastroPlacas.length} placa{cadastroPlacas.length!==1?'s':''}</span>
            </div>
            {loadingPlacas && <div style={{ padding:40, textAlign:'center', color:'#9ca3af' }}>Carregando...</div>}
            {!loadingPlacas && cadastroPlacas.length === 0 && (
              <div style={{ padding:60, textAlign:'center', color:'#9ca3af' }}>
                <i className="ti ti-car" style={{ fontSize:36, display:'block', marginBottom:10, color:'#d1d5db' }}></i>
                <div style={{ fontWeight:500, marginBottom:4 }}>Nenhuma placa cadastrada</div>
                <div style={{ fontSize:12 }}>Importe uma planilha com placa + frota</div>
              </div>
            )}
            {!loadingPlacas && cadastroPlacas.length > 0 && (
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
                <thead>
                  <tr style={{ background:'#f8fafc' }}>
                    <th style={{ padding:'9px 16px', textAlign:'left', fontSize:11, fontWeight:700, color:'#6b7280', textTransform:'uppercase', borderBottom:'1px solid #e5e7eb' }}>Placa</th>
                    <th style={{ padding:'9px 16px', textAlign:'left', fontSize:11, fontWeight:700, color:'#6b7280', textTransform:'uppercase', borderBottom:'1px solid #e5e7eb' }}>Frota</th>
                    <th style={{ padding:'9px 16px', textAlign:'left', fontSize:11, fontWeight:700, color:'#6b7280', textTransform:'uppercase', borderBottom:'1px solid #e5e7eb' }}>Modelo</th>
                    <th style={{ padding:'9px 16px', textAlign:'left', fontSize:11, fontWeight:700, color:'#6b7280', textTransform:'uppercase', borderBottom:'1px solid #e5e7eb' }}>Atualizado</th>
                    <th style={{ padding:'9px 16px', borderBottom:'1px solid #e5e7eb' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {cadastroPlacas.map((p, i) => (
                    <tr key={p.placa} style={{ borderBottom:'1px solid #f3f4f6', background: i%2===0?'#fff':'#fafafa' }}>
                      <td style={{ padding:'10px 16px', fontWeight:700, color:'#1a1a2e', fontFamily:'monospace', fontSize:14 }}>{p.placa}</td>
                      <td style={{ padding:'10px 16px' }}><FrotaBadge frota={p.frota} /></td>
                      <td style={{ padding:'10px 16px', color:'#6b7280' }}>{p.modelo || '—'}</td>
                      <td style={{ padding:'10px 16px', color:'#9ca3af', fontSize:12 }}>{fmtDt((p.atualizadoEm||p.criadoEm)?.slice?.(0,10) ?? p.atualizadoEm)}</td>
                      <td style={{ padding:'10px 16px', textAlign:'center' }}>
                        <button onClick={() => excluirPlaca(p.placa)}
                          style={{ padding:'5px 10px', border:'1px solid #fee2e2', borderRadius:7, background:'#fff5f5', color:'#dc2626', fontSize:12, cursor:'pointer' }}>
                          <i className="ti ti-trash"></i>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

import { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import * as XLSX from 'xlsx';
import api from '../../services/api';
import toast from 'react-hot-toast';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, Cell, ReferenceLine, LabelList
} from 'recharts';

/* ── helpers ── */
function excelDateToISO(serial) {
  const d = new Date(Math.round((serial - 25569) * 86400 * 1000));
  return d.toISOString().slice(0, 10);
}
const fmtMesStr = s => {
  const [ano, mes] = s.split('-');
  return new Date(Number(ano), Number(mes) - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
};
const fmtDt = s => s ? new Date(s + 'T12:00:00').toLocaleDateString('pt-BR') : '—';
const fmtN = (v, d = 2) => v != null && v !== '' ? Number(v).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—';
const fmtR = v => v != null ? `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—';
const corPerc = p => p >= 100 ? '#16a34a' : p >= 85 ? '#d97706' : '#dc2626';

const fmtMesCurto = s => {
  const [ano, mes] = s.split('-');
  return new Date(Number(ano), Number(mes) - 1, 1).toLocaleDateString('pt-BR', { month: 'short' }).replace('.','');
};

const TooltipGrafico = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  return (
    <div style={{ background:'#fff', border:'1px solid #e5e7eb', borderRadius:10, padding:'12px 16px', fontSize:12, boxShadow:'0 4px 12px rgba(0,0,0,0.1)' }}>
      <div style={{ fontWeight:700, marginBottom:6, color:'#1a1a2e' }}>{fmtMesStr(d?.mes)}</div>
      <div style={{ color:'#EB3238' }}>Total gasto: <strong>{fmtR(d?.totalGasto)}</strong></div>
      <div style={{ color:'#374151' }}>Distância: <strong>{fmtN(d?.totalKm,0)} km</strong></div>
      <div style={{ color:'#374151' }}>Litros diesel: <strong>{fmtN(d?.totalLitros)} L</strong></div>
      {d?.mediaReal > 0 && <div style={{ color:'#1d4ed8' }}>Média real: <strong>{fmtN(d?.mediaReal)} km/L</strong></div>}
    </div>
  );
};

const inp = { width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13, outline: 'none', background: '#fff', cursor: 'pointer', boxSizing: 'border-box' };
const lbl = { fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 };

export default function MediasConsumo() {
  // ── estado importações ──
  const [importacoes,  setImportacoes]  = useState([]);
  const [importacaoId, setImportacaoId] = useState('');
  const [loadingImps,  setLoadingImps]  = useState(true);

  // ── estado Excel local (antes de salvar) ──
  const [preview,     setPreview]     = useState(null); // { nomeArquivo, registros[], frota }
  const [salvando,    setSalvando]    = useState(false);
  const [frotaSel,    setFrotaSel]    = useState('');   // filtro rápido de frota

  const FROTAS = ['BAÚ', 'FROTA'];
  const fileRef  = useRef();
  const rowRefs  = useRef({});

  // ── filtros do relatório ──
  const [motorista, setMotorista]   = useState('');
  const [mesSel,    setMesSel]      = useState('');   // accordion dentro da tabela
  const [mesFiltro, setMesFiltro]   = useState('');   // filtro global de mês (YYYY-MM)
  const [motoristas,   setMotoristas]   = useState([]);
  const [meses,        setMeses]        = useState([]);
  const [resumoChart,  setResumoChart]  = useState([]);
  const [loadingChart, setLoadingChart] = useState(false);

  // ── resumo por motorista (view de mês) ──
  const [resumoMotoristas, setResumoMotoristas] = useState([]);
  const [loadingResMot,    setLoadingResMot]    = useState(false);

  // ── dados carregados do banco ──
  const [registros,  setRegistros]  = useState([]);
  const [loadingReg, setLoadingReg] = useState(false);

  /* ── sincronizar importacaoId quando frotaSel muda ── */
  useEffect(() => {
    if (!importacoes.length) return;
    const filtradas = frotaSel ? importacoes.filter(i => (i.frota || 'Geral') === frotaSel) : importacoes;
    if (filtradas.length === 0) { setImportacaoId(''); return; }
    if (!filtradas.find(i => i.id === importacaoId)) {
      setImportacaoId(filtradas[0].id);
      setMotorista(''); setMesSel('');
    }
  }, [frotaSel, importacoes]);

  /* ── buscar importações ao montar ── */
  const carregarImportacoes = useCallback(async () => {
    setLoadingImps(true);
    try {
      const { data } = await api.get('/medias-consumo/importacoes');
      setImportacoes(data);
      if (data.length > 0 && !importacaoId) setImportacaoId(data[0].id);
    } catch { toast.error('Erro ao carregar importações'); }
    finally { setLoadingImps(false); }
  }, []);

  useEffect(() => { carregarImportacoes(); }, [carregarImportacoes]);

  // helper: params para queries — usa frota se filtro ativo, senão importacaoId
  const queryParams = useCallback((extra = {}) => {
    if (frotaSel) return { frota: frotaSel, ...extra };
    if (importacaoId) return { importacaoId, ...extra };
    return extra;
  }, [frotaSel, importacaoId]);

  /* ── buscar motoristas, meses e resumo geral quando filtro muda ── */
  useEffect(() => {
    const p = frotaSel ? { frota: frotaSel } : importacaoId ? { importacaoId } : null;
    if (!p) {
      setMotoristas([]); setMeses([]); setMotorista(''); setMesSel('');
      setResumoChart([]); setRegistros([]);
      return;
    }
    api.get('/medias-consumo/motoristas', { params: p })
      .then(r => { setMotoristas(r.data); setMotorista(''); setMesSel(''); setRegistros([]); })
      .catch(() => {});
    api.get('/medias-consumo/meses', { params: p })
      .then(r => setMeses(r.data))
      .catch(() => {});
    setLoadingChart(true);
    api.get('/medias-consumo/resumo-mensal', { params: p })
      .then(r => setResumoChart(r.data))
      .catch(() => {})
      .finally(() => setLoadingChart(false));
  }, [frotaSel, importacaoId]);

  /* ── atualizar gráfico quando motorista muda ── */
  useEffect(() => {
    const base = frotaSel ? { frota: frotaSel } : importacaoId ? { importacaoId } : null;
    if (!base) return;
    setLoadingChart(true);
    const params = { ...base };
    if (motorista) params.motorista = motorista;
    api.get('/medias-consumo/resumo-mensal', { params })
      .then(r => setResumoChart(r.data))
      .catch(() => {})
      .finally(() => setLoadingChart(false));
  }, [frotaSel, importacaoId, motorista]);

  /* ── buscar registros quando motorista muda ── */
  useEffect(() => {
    const base = frotaSel ? { frota: frotaSel } : importacaoId ? { importacaoId } : null;
    if (!base || !motorista) { setRegistros([]); setMesSel(''); return; }
    setLoadingReg(true);
    api.get('/medias-consumo', { params: { ...base, motorista } })
      .then(r => setRegistros(r.data))
      .catch(() => toast.error('Erro ao carregar dados'))
      .finally(() => setLoadingReg(false));
  }, [frotaSel, importacaoId, motorista]);

  /* ── carregar resumo por motorista quando mesFiltro muda ── */
  useEffect(() => {
    const base = frotaSel ? { frota: frotaSel } : importacaoId ? { importacaoId } : null;
    if (!base || !mesFiltro) { setResumoMotoristas([]); return; }
    const [ano, mes] = mesFiltro.split('-');
    setLoadingResMot(true);
    api.get('/medias-consumo/resumo-motoristas', { params: { ...base, mes, ano } })
      .then(r => setResumoMotoristas(r.data))
      .catch(() => toast.error('Erro ao carregar resumo do mês'))
      .finally(() => setLoadingResMot(false));
  }, [frotaSel, importacaoId, mesFiltro]);

  /* ── ler Excel localmente ── */
  async function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { cellDates: true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, dateNF: 'yyyy-mm-dd' });

      // Mapear colunas por nome do cabeçalho (case-insensitive, sem acento)
      const norm = s => String(s || '').toLowerCase()
        .normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

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
      for (const [campo, aliases] of Object.entries(MAPA)) {
        idx[campo] = header.findIndex(h => aliases.includes(norm(h)));
      }

      const col = (row, campo, def = null) => {
        const i = idx[campo];
        return i >= 0 && row[i] !== undefined && row[i] !== '' ? row[i] : def;
      };
      const colNum = (row, campo) => {
        const v = col(row, campo);
        const n = parseFloat(String(v || '').replace(',', '.'));
        return isNaN(n) ? null : n;
      };
      const colData = (row, campo) => {
        const v = col(row, campo);
        if (!v) return null;
        // já é string yyyy-mm-dd (cellDates + dateNF)
        if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);
        // serial numérico (fallback)
        if (typeof v === 'number') return excelDateToISO(v);
        return null;
      };

      const registros = raw.slice(1)
        .filter(r => col(r, 'data') && col(r, 'motorista'))
        .map(r => ({
          data:           colData(r, 'data'),
          motorista:      String(col(r, 'motorista') || '').trim(),
          placa:          col(r, 'placa'),
          modelo:         col(r, 'modelo'),
          conjunto:       col(r, 'conjunto'),
          kmInicial:      colNum(r, 'kmInicial'),
          kmFinal:        colNum(r, 'kmFinal'),
          distancia:      colNum(r, 'distancia'),
          posto:          col(r, 'posto'),
          cidade:         col(r, 'cidade'),
          uf:             col(r, 'uf'),
          precoLitro:     colNum(r, 'precoLitro'),
          litros:         colNum(r, 'litros'),
          produto:        col(r, 'produto', ''),
          vlrTotal:       colNum(r, 'vlrTotal'),
          mediaRealizada: colNum(r, 'mediaRealizada'),
          mediaSugerida:  colNum(r, 'mediaSugerida'),
          percAtingido:   col(r, 'percAtingido', ''),
          gap:            colNum(r, 'gap'),
        }));

      setPreview({ nomeArquivo: file.name, registros, frota: '' });
      toast.success(`${registros.length.toLocaleString('pt-BR')} registros lidos`);
    } catch (err) { toast.error('Erro ao ler o arquivo: ' + err.message); }
    e.target.value = '';
  }

  /* ── salvar no banco ── */
  const [progresso, setProgresso] = useState(0); // 0-100

  async function salvarImportacao() {
    if (!preview) return;
    setSalvando(true);
    setProgresso(0);
    const total = preview.registros.length;
    const CHUNK = 3000; // registros por requisição
    const chunks = [];
    for (let i = 0; i < total; i += CHUNK) chunks.push(preview.registros.slice(i, i + CHUNK));

    const toastId = toast.loading(`Salvando 0 / ${total.toLocaleString('pt-BR')} registros...`);
    try {
      // 1º chunk → cria a importação
      const { data: primeira } = await api.post('/medias-consumo/importar', {
        nomeArquivo: preview.nomeArquivo,
        registros:   chunks[0],
        frota:       preview.frota || 'BAÚ',
      });
      const importacaoIdNova = primeira.importacaoId;
      let salvos = chunks[0].length;
      setProgresso(Math.round((salvos / total) * 100));
      toast.loading(`Salvando ${salvos.toLocaleString('pt-BR')} / ${total.toLocaleString('pt-BR')}...`, { id: toastId });

      // chunks restantes → append
      for (let i = 1; i < chunks.length; i++) {
        await api.post(`/medias-consumo/importacoes/${importacaoIdNova}/registros`, {
          registros: chunks[i],
        });
        salvos += chunks[i].length;
        setProgresso(Math.round((salvos / total) * 100));
        toast.loading(`Salvando ${salvos.toLocaleString('pt-BR')} / ${total.toLocaleString('pt-BR')}...`, { id: toastId });
      }

      toast.success(`${total.toLocaleString('pt-BR')} registros salvos!`, { id: toastId });
      setPreview(null);
      setProgresso(0);
      await carregarImportacoes();
      if (importacaoIdNova) setImportacaoId(importacaoIdNova);
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Erro ao salvar', { id: toastId });
      setProgresso(0);
    } finally { setSalvando(false); }
  }

  /* ── excluir importação ── */
  async function excluirImportacao(id) {
    if (!confirm('Excluir esta importação e todos os registros?')) return;
    try {
      await api.delete(`/medias-consumo/importacoes/${id}`);
      toast.success('Importação removida');
      setImportacaoId('');
      setRegistros([]);
      setMotorista('');
      await carregarImportacoes();
    } catch { toast.error('Erro ao excluir'); }
  }

  /* ── resumo mensal ── */
  const resumoMensal = useMemo(() => {
    if (!registros.length) return [];
    const map = {};
    for (const r of registros) {
      const chave = r.data?.slice(0, 7); // YYYY-MM
      if (!chave) continue;
      if (!map[chave]) map[chave] = { chave, diesel: [], todos: [] };
      map[chave].todos.push(r);
      if (String(r.produto || '').toLowerCase().includes('diesel')) map[chave].diesel.push(r);
    }
    return Object.values(map).sort((a, b) => a.chave.localeCompare(b.chave)).map(m => {
      const totalKm    = m.diesel.reduce((s, r) => s + Number(r.distancia || 0), 0);
      const totalLit   = m.diesel.reduce((s, r) => s + Number(r.litros || 0), 0);
      const totalGasto = m.todos.reduce((s, r) => s + Number(r.vlrTotal || 0), 0);
      const mediaReal  = totalLit > 0 ? totalKm / totalLit : 0;
      const sugs       = m.diesel.filter(r => Number(r.mediaSugerida) > 0);
      const mediaSug   = sugs.length ? sugs.reduce((s, r) => s + Number(r.mediaSugerida), 0) / sugs.length : 0;
      const perc       = mediaSug > 0 ? (mediaReal / mediaSug) * 100 : 0;
      return { ...m, totalKm, totalLit, totalGasto, mediaReal, mediaSug, perc };
    });
  }, [registros]);

  /* ── detalhe mês ── */
  const detalhe = useMemo(() => {
    if (!mesSel) return [];
    return registros.filter(r => r.data?.slice(0, 7) === mesSel).sort((a, b) => a.data?.localeCompare(b.data));
  }, [registros, mesSel]);

  const summaryMes = useMemo(() => {
    if (!detalhe.length) return null;
    const diesel    = detalhe.filter(r => String(r.produto || '').toLowerCase().includes('diesel'));
    const totalKm   = diesel.reduce((s, r) => s + Number(r.distancia || 0), 0);
    const totalLit  = diesel.reduce((s, r) => s + Number(r.litros || 0), 0);
    const totalGasto= detalhe.reduce((s, r) => s + Number(r.vlrTotal || 0), 0);
    const mediaReal = totalLit > 0 ? totalKm / totalLit : 0;
    const sugs      = diesel.filter(r => Number(r.mediaSugerida) > 0);
    const mediaSug  = sugs.length ? sugs.reduce((s, r) => s + Number(r.mediaSugerida), 0) / sugs.length : 0;
    const perc      = mediaSug > 0 ? (mediaReal / mediaSug) * 100 : 0;
    const custoKm   = totalKm > 0 ? totalGasto / totalKm : 0;
    return { totalKm, totalLit, totalGasto, mediaReal, mediaSug, perc, custoKm };
  }, [detalhe]);

  function toggleMes(chave) {
    const abrindo = mesSel !== chave;
    setMesSel(abrindo ? chave : '');
    setTimeout(() => {
      const el = rowRefs.current[chave];
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, abrindo ? 50 : 0);
  }

  const imp = importacoes.find(i => i.id === importacaoId);

  /* ─────────── render ─────────── */
  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, color: '#1a1a2e', margin: 0 }}>Médias de Consumo</h2>
        <p style={{ fontSize: 13, color: '#6b7280', marginTop: 2 }}>Relatório de consumo por motorista • filtro mensal</p>
      </div>

      {/* ── Preview Excel (antes de salvar) ── */}
      {preview && (
        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 12, padding: 20, marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: preview.frota ? 0 : 14 }}>
            <i className="ti ti-file-spreadsheet" style={{ fontSize: 24, color: '#d97706' }}></i>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14, color: '#92400e' }}>{preview.nomeArquivo}</div>
              <div style={{ fontSize: 12, color: '#b45309' }}>{preview.registros.length.toLocaleString('pt-BR')} registros lidos</div>
            </div>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 10 }}>
              <button onClick={() => setPreview(null)}
                style={{ padding: '8px 16px', border: '1px solid #d1d5db', borderRadius: 8, background: '#fff', fontSize: 13, cursor: 'pointer' }}>
                Cancelar
              </button>
              <button onClick={salvarImportacao} disabled={salvando || !preview.frota}
                title={!preview.frota ? 'Selecione a frota antes de salvar' : ''}
                style={{ padding: '8px 20px', border: 'none', borderRadius: 8, background: preview.frota ? '#16a34a' : '#9ca3af', color: '#fff', fontSize: 13, fontWeight: 600, cursor: preview.frota ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', gap: 6 }}>
                <i className="ti ti-device-floppy"></i>
                {salvando ? `Salvando... ${progresso}%` : 'Salvar no banco'}
              </button>
            </div>
          </div>
          {/* Seletor de frota */}
          {!preview.frota && (
            <div style={{ marginTop: 4 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#92400e', marginBottom: 10 }}>
                <i className="ti ti-truck" style={{ marginRight: 6 }}></i>
                Qual é a frota deste arquivo?
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {FROTAS.map(f => (
                  <button key={f} onClick={() => setPreview(p => ({ ...p, frota: f }))}
                    style={{ padding: '8px 28px', border: '2px solid #d97706', borderRadius: 20, background: '#fff', color: '#92400e', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                    {f}
                  </button>
                ))}
              </div>
            </div>
          )}
          {preview.frota && (
            <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, color: '#b45309' }}>Frota selecionada:</span>
              <span style={{ padding: '4px 12px', background: '#d97706', color: '#fff', borderRadius: 20, fontSize: 12, fontWeight: 700 }}>{preview.frota}</span>
              <button onClick={() => setPreview(p => ({ ...p, frota: '' }))}
                style={{ fontSize: 11, color: '#b45309', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
                Trocar
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Painel de importações ── */}
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 20, marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', marginBottom: importacoes.length > 0 ? 14 : 0 }}>
          <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={handleFile} style={{ display: 'none' }} />
          <button onClick={() => fileRef.current?.click()}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 20px', background: '#EB3238', color: '#fff', border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
            <i className="ti ti-upload"></i> Importar Excel
          </button>

          {loadingImps ? (
            <span style={{ fontSize: 13, color: '#9ca3af' }}>Carregando...</span>
          ) : importacoes.length === 0 ? (
            <span style={{ fontSize: 13, color: '#9ca3af' }}>Nenhuma importação — carregue um arquivo Excel</span>
          ) : null}
        </div>

        {/* Filtro rápido de frota + dropdown */}
        {!loadingImps && importacoes.length > 0 && (() => {
          const frotasDisponiveis = [...new Set(importacoes.map(i => i.frota || 'Geral'))].sort();
          const importacoesFiltradas = frotaSel ? importacoes.filter(i => (i.frota || 'Geral') === frotaSel) : importacoes;
          return (
            <div>
              {/* Filtro rápido */}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                <button onClick={() => { setFrotaSel(''); }}
                  style={{ padding: '6px 14px', borderRadius: 20, border: '2px solid', borderColor: !frotaSel ? '#EB3238' : '#e5e7eb', background: !frotaSel ? '#EB3238' : '#fff', color: !frotaSel ? '#fff' : '#374151', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                  Todos
                </button>
                {frotasDisponiveis.map(f => (
                  <button key={f} onClick={() => { setFrotaSel(frotaSel === f ? '' : f); }}
                    style={{ padding: '6px 14px', borderRadius: 20, border: '2px solid', borderColor: frotaSel === f ? '#EB3238' : '#e5e7eb', background: frotaSel === f ? '#EB3238' : '#fff', color: frotaSel === f ? '#fff' : '#374151', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                    {f}
                  </button>
                ))}
              </div>
              {/* Dropdown de importações filtradas */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <select
                  value={importacoesFiltradas.find(i => i.id === importacaoId) ? importacaoId : (importacoesFiltradas[0]?.id || '')}
                  onChange={e => { setImportacaoId(e.target.value); setMotorista(''); setMesSel(''); }}
                  style={{ ...inp, maxWidth: 440 }}>
                  {importacoesFiltradas.length === 0 && <option value="">Nenhuma importação para {frotaSel}</option>}
                  {importacoesFiltradas.map(im => (
                    <option key={im.id} value={im.id}>
                      [{im.frota || 'Geral'}] {im.nomeArquivo} — {im.totalRegistros?.toLocaleString('pt-BR')} reg. — {fmtDt(im.criadoEm?.slice(0,10))}
                    </option>
                  ))}
                </select>
                {importacaoId && (
                  <button onClick={() => excluirImportacao(importacaoId)}
                    style={{ padding: '8px 12px', border: '1px solid #fee2e2', borderRadius: 8, background: '#fff5f5', color: '#dc2626', fontSize: 12, cursor: 'pointer' }}>
                    <i className="ti ti-trash"></i>
                  </button>
                )}
              </div>
            </div>
          );
        })()}
      </div>

      {/* ── Filtros ── */}
      {motoristas.length > 0 && (
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 20, marginBottom: 20, display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: '1 1 300px' }}>
            <label style={lbl}>Motorista</label>
            <select value={motorista} onChange={e => { setMotorista(e.target.value); setMesSel(''); }} style={inp}>
              <option value="">Selecionar motorista…</option>
              {motoristas.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          {motorista && (
            <button onClick={() => { setMotorista(''); setMesSel(''); }}
              style={{ padding: '9px 14px', border: '1px solid #e5e7eb', borderRadius: 8, background: '#f9fafb', fontSize: 12, color: '#6b7280', cursor: 'pointer' }}>
              Limpar
            </button>
          )}
        </div>
      )}

      {/* ── Filtro de mês ── */}
      {meses.length > 0 && (
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '14px 20px', marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 10 }}>
            <i className="ti ti-calendar-month" style={{ marginRight: 6 }}></i>Filtrar por mês
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={() => setMesFiltro('')}
              style={{ padding: '6px 14px', borderRadius: 20, border: '2px solid', borderColor: !mesFiltro ? '#EB3238' : '#e5e7eb', background: !mesFiltro ? '#EB3238' : '#fff', color: !mesFiltro ? '#fff' : '#374151', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              Todos
            </button>
            {meses.map(m => {
              const [ano, mes] = m.split('-');
              const label = new Date(Number(ano), Number(mes) - 1, 1).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }).replace('.','');
              return (
                <button key={m} onClick={() => setMesFiltro(mesFiltro === m ? '' : m)}
                  style={{ padding: '6px 14px', borderRadius: 20, border: '2px solid', borderColor: mesFiltro === m ? '#EB3238' : '#e5e7eb', background: mesFiltro === m ? '#EB3238' : '#fff', color: mesFiltro === m ? '#fff' : '#374151', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── TABELA: Resumo por motorista (mês selecionado) ── */}
      {mesFiltro && (
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden', marginBottom: 20 }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: 8 }}>
            <i className="ti ti-users" style={{ color: '#EB3238', fontSize: 16 }}></i>
            <span style={{ fontWeight: 600, fontSize: 14, color: '#1a1a2e' }}>
              {fmtMesStr(mesFiltro)} — Todos os motoristas
            </span>
            {loadingResMot && <span style={{ fontSize: 12, color: '#9ca3af', marginLeft: 8 }}>Carregando...</span>}
          </div>
          {!loadingResMot && resumoMotoristas.length > 0 && (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    {['Motorista','Distância (km)','Litros Diesel','Média Real','Média Sug.','% Atingido','Total Gasto'].map(h => (
                      <th key={h} style={{ padding: '10px 16px', textAlign: h === 'Motorista' ? 'left' : 'right', fontSize: 11, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.4px', borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {resumoMotoristas.map((m, i) => (
                    <tr key={m.motorista} style={{ background: i % 2 === 0 ? '#fff' : '#f9fafb' }}
                      onMouseEnter={e => e.currentTarget.style.background = '#f0f9ff'}
                      onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? '#fff' : '#f9fafb'}>
                      <td style={{ padding: '11px 16px', fontWeight: 600, color: '#1a1a2e', borderBottom: '1px solid #f3f4f6' }}>{m.motorista}</td>
                      <td style={{ padding: '11px 16px', textAlign: 'right', borderBottom: '1px solid #f3f4f6' }}>{fmtN(m.totalKm, 0)} km</td>
                      <td style={{ padding: '11px 16px', textAlign: 'right', borderBottom: '1px solid #f3f4f6' }}>{fmtN(m.totalLitros)} L</td>
                      <td style={{ padding: '11px 16px', textAlign: 'right', fontWeight: 600, borderBottom: '1px solid #f3f4f6' }}>{fmtN(m.mediaReal)}</td>
                      <td style={{ padding: '11px 16px', textAlign: 'right', color: '#6b7280', borderBottom: '1px solid #f3f4f6' }}>{fmtN(m.mediaSug)}</td>
                      <td style={{ padding: '11px 16px', textAlign: 'right', borderBottom: '1px solid #f3f4f6' }}>
                        <span style={{ fontWeight: 700, color: corPerc(m.perc) }}>{fmtN(m.perc, 1)}%</span>
                        <div style={{ marginTop: 3, height: 4, borderRadius: 2, background: '#e5e7eb', width: 70, marginLeft: 'auto' }}>
                          <div style={{ height: '100%', borderRadius: 2, background: corPerc(m.perc), width: `${Math.min(m.perc, 100)}%` }}></div>
                        </div>
                      </td>
                      <td style={{ padding: '11px 16px', textAlign: 'right', fontWeight: 600, borderBottom: '1px solid #f3f4f6' }}>{fmtR(m.totalGasto)}</td>
                    </tr>
                  ))}
                </tbody>
                {resumoMotoristas.length > 1 && (() => {
                  const tk = resumoMotoristas.reduce((s, m) => s + m.totalKm, 0);
                  const tl = resumoMotoristas.reduce((s, m) => s + m.totalLitros, 0);
                  const tg = resumoMotoristas.reduce((s, m) => s + m.totalGasto, 0);
                  const mr = tl > 0 ? tk / tl : 0;
                  const sg = resumoMotoristas.filter(m => m.mediaSug > 0);
                  const ms = sg.length ? sg.reduce((s, m) => s + m.mediaSug, 0) / sg.length : 0;
                  const pc = ms > 0 ? (mr / ms) * 100 : 0;
                  return (
                    <tfoot>
                      <tr style={{ background: '#f8fafc', fontWeight: 700 }}>
                        <td style={{ padding: '12px 16px', color: '#374151' }}>TOTAL / MÉDIA GERAL</td>
                        <td style={{ padding: '12px 16px', textAlign: 'right' }}>{fmtN(tk, 0)} km</td>
                        <td style={{ padding: '12px 16px', textAlign: 'right' }}>{fmtN(tl)} L</td>
                        <td style={{ padding: '12px 16px', textAlign: 'right' }}>{fmtN(mr)}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', color: '#6b7280' }}>{fmtN(ms)}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', color: corPerc(pc) }}>{fmtN(pc, 1)}%</td>
                        <td style={{ padding: '12px 16px', textAlign: 'right' }}>{fmtR(tg)}</td>
                      </tr>
                    </tfoot>
                  );
                })()}
              </table>
            </div>
          )}
          {!loadingResMot && resumoMotoristas.length === 0 && (
            <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>Nenhum dado para este mês.</div>
          )}
        </div>
      )}

      {/* ── Sem importações ── */}
      {!loadingImps && importacoes.length === 0 && !preview && (
        <div style={{ textAlign: 'center', padding: 80, color: '#9ca3af', background: '#fff', borderRadius: 12, border: '1px dashed #d1d5db' }}>
          <i className="ti ti-file-spreadsheet" style={{ fontSize: 48, display: 'block', marginBottom: 12, color: '#d1d5db' }}></i>
          <div style={{ fontWeight: 500, marginBottom: 4 }}>Nenhum dado importado</div>
          <div style={{ fontSize: 12 }}>Clique em "Importar Excel" para carregar o relatório de abastecimento</div>
        </div>
      )}


      {/* ── Carregando ── */}
      {loadingReg && (
        <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af' }}>Carregando dados...</div>
      )}

      {/* ── GRÁFICO MENSAL ── */}
      {!mesSel && resumoChart.length > 0 && (
        <div style={{ background:'#fff', border:'1px solid #e5e7eb', borderRadius:12, padding:'20px 20px 8px', marginBottom:16 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
            <i className="ti ti-chart-bar" style={{ color:'#EB3238', fontSize:16 }}></i>
            <span style={{ fontWeight:600, fontSize:14, color:'#1a1a2e' }}>
              Total gasto por mês {motorista ? `— ${motorista.split(' ').slice(0,2).join(' ')}` : '— Geral (todos motoristas)'}
            </span>
            {motorista && <span style={{ marginLeft:'auto', fontSize:11, color:'#9ca3af' }}>Clique em uma barra para detalhar</span>}
          </div>
          {loadingChart && <div style={{ textAlign:'center', padding:20, fontSize:12, color:'#9ca3af' }}>Carregando...</div>}
          {!loadingChart && (
            <ResponsiveContainer width="100%" height={240}>
              <ComposedChart
                data={resumoChart.map(m => ({ ...m, label: fmtMesCurto(m.mes) }))}
                onClick={e => motorista && e?.activePayload?.[0] && setMesSel(e.activePayload[0].payload.mes)}
                style={{ cursor: motorista ? 'pointer' : 'default' }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="label" tick={{ fontSize:12, fill:'#6b7280' }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} tick={{ fontSize:11, fill:'#9ca3af' }} axisLine={false} tickLine={false} width={52} />
                <Tooltip content={<TooltipGrafico />} />
                <Bar dataKey="totalGasto" name="Total Gasto (R$)" radius={[4,4,0,0]} maxBarSize={52} fill="#EB3238" fillOpacity={0.85}>
                  <LabelList dataKey="totalGasto" position="top" style={{ fontSize:11, fontWeight:600, fill:'#374151' }}
                    formatter={v => `R$${(v/1000).toFixed(1)}k`} />
                </Bar>
                <Line dataKey="mediaReal" name="Média Real (km/L)" type="monotone" stroke="#1d4ed8" strokeWidth={2} dot={{ r:3 }} yAxisId={0} hide={!motorista} />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>
      )}

      {/* ── RESUMO MENSAL ── */}
      {!loadingReg && resumoMensal.length > 0 && (
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: 8 }}>
            <i className="ti ti-chart-line" style={{ color: '#EB3238', fontSize: 16 }}></i>
            <span style={{ fontWeight: 600, fontSize: 14, color: '#1a1a2e' }}>
              {motorista ? motorista.split(' ').slice(0,3).join(' ') : 'Todos os motoristas'} — resumo mensal
            </span>
            <span style={{ marginLeft: 'auto', fontSize: 12, color: '#9ca3af' }}>Clique em um mês para detalhar</span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  {['Mês','Distância (km)','Litros Diesel','Média Real','Média Sug.','% Atingido','Total Gasto'].map(h => (
                    <th key={h} style={{ padding: '10px 16px', textAlign: h==='Mês' ? 'left' : 'right', fontSize: 11, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.4px', borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {resumoMensal.map(m => {
                  const aberto = mesSel === m.chave;
                  const det = aberto ? detalhe : [];
                  const sm  = aberto ? summaryMes : null;
                  return (
                    <>
                      <tr key={m.chave}
                        ref={el => rowRefs.current[m.chave] = el}
                        onClick={() => toggleMes(m.chave)}
                        style={{ cursor:'pointer', background: aberto ? '#eff6ff' : '' }}
                        onMouseEnter={e => { if (!aberto) e.currentTarget.style.background='#f0f9ff'; }}
                        onMouseLeave={e => { if (!aberto) e.currentTarget.style.background=''; }}>
                        <td style={{ padding:'12px 16px', borderBottom: aberto ? 'none' : '1px solid #f3f4f6', fontWeight:600, color:'#1a1a2e' }}>
                          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                            <i className={`ti ${aberto ? 'ti-chevron-down' : 'ti-chevron-right'}`} style={{ fontSize:12, color:'#EB3238' }}></i>
                            {fmtMesStr(m.chave)}
                          </div>
                        </td>
                        <td style={{ padding:'12px 16px', textAlign:'right', borderBottom: aberto ? 'none' : '1px solid #f3f4f6' }}>{fmtN(m.totalKm,0)} km</td>
                        <td style={{ padding:'12px 16px', textAlign:'right', borderBottom: aberto ? 'none' : '1px solid #f3f4f6' }}>{fmtN(m.totalLit)} L</td>
                        <td style={{ padding:'12px 16px', textAlign:'right', borderBottom: aberto ? 'none' : '1px solid #f3f4f6', fontWeight:600, color:'#1a1a2e' }}>{fmtN(m.mediaReal)}</td>
                        <td style={{ padding:'12px 16px', textAlign:'right', borderBottom: aberto ? 'none' : '1px solid #f3f4f6', color:'#6b7280' }}>{fmtN(m.mediaSug)}</td>
                        <td style={{ padding:'12px 16px', textAlign:'right', borderBottom: aberto ? 'none' : '1px solid #f3f4f6' }}>
                          <span style={{ fontWeight:700, color:corPerc(m.perc) }}>{fmtN(m.perc,1)}%</span>
                          <div style={{ marginTop:4, height:4, borderRadius:2, background:'#e5e7eb', width:80, marginLeft:'auto' }}>
                            <div style={{ height:'100%', borderRadius:2, background:corPerc(m.perc), width:`${Math.min(m.perc,100)}%` }}></div>
                          </div>
                        </td>
                        <td style={{ padding:'12px 16px', textAlign:'right', borderBottom: aberto ? 'none' : '1px solid #f3f4f6', fontWeight:600 }}>{fmtR(m.totalGasto)}</td>
                      </tr>
                      {aberto && sm && (
                        <tr key={`${m.chave}-det`}>
                          <td colSpan={7} style={{ padding:'0 0 8px', background:'#f8fafc', borderBottom:'2px solid #e5e7eb' }}>
                            {/* KPIs */}
                            <div style={{ display:'flex', flexWrap:'wrap', gap:10, padding:'14px 16px 10px' }}>
                              {[
                                ['Distância', `${fmtN(sm.totalKm,0)} km`],
                                ['Litros Diesel', `${fmtN(sm.totalLit)} L`],
                                ['Média Real', `${fmtN(sm.mediaReal)} km/L`, corPerc(sm.perc)],
                                ['Média Sugerida', `${fmtN(sm.mediaSug)} km/L`],
                                ['% Atingido', `${fmtN(sm.perc,1)}%`, corPerc(sm.perc)],
                                ['Custo/km', `R$ ${fmtN(sm.custoKm,4)}`],
                                ['Total Gasto', fmtR(sm.totalGasto)],
                              ].map(([lbl,val,cor='#1a1a2e']) => (
                                <div key={lbl} style={{ background:'#fff', border:'1px solid #e5e7eb', borderRadius:8, padding:'10px 14px', minWidth:110 }}>
                                  <div style={{ fontSize:10, color:'#6b7280', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.4px', marginBottom:4 }}>{lbl}</div>
                                  <div style={{ fontSize:18, fontWeight:700, color:cor }}>{val}</div>
                                </div>
                              ))}
                            </div>
                            {/* Tabela detalhe */}
                            <div style={{ overflowX:'auto', padding:'0 8px 8px' }}>
                              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12, background:'#fff', borderRadius:8, overflow:'hidden' }}>
                                <thead>
                                  <tr style={{ background:'#f1f5f9' }}>
                                    {['Data','Placa','Produto','Litros','Distância','Média Real','Média Sug','%','Vlr Total','Posto'].map(h => (
                                      <th key={h} style={{ padding:'8px 10px', textAlign:['Litros','Distância','Média Real','Média Sug','%','Vlr Total'].includes(h)?'right':'left', fontSize:10, fontWeight:700, color:'#374151', textTransform:'uppercase', whiteSpace:'nowrap', borderBottom:'1px solid #e5e7eb' }}>{h}</th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {det.map((r,i) => {
                                    const isDiesel = String(r.produto||'').toLowerCase().includes('diesel');
                                    const perc = r.mediaSugerida>0?(r.mediaRealizada/r.mediaSugerida)*100:null;
                                    return (
                                      <tr key={i} style={{ background:i%2===0?'#fff':'#f9fafb' }}>
                                        <td style={{ padding:'7px 10px', whiteSpace:'nowrap', borderBottom:'1px solid #f3f4f6' }}>{fmtDt(r.data?.slice(0,10))}</td>
                                        <td style={{ padding:'7px 10px', fontWeight:600, borderBottom:'1px solid #f3f4f6' }}>{r.placa}</td>
                                        <td style={{ padding:'7px 10px', borderBottom:'1px solid #f3f4f6' }}>
                                          <span style={{ padding:'2px 6px', borderRadius:4, fontSize:10, fontWeight:600, background:isDiesel?'#eff6ff':'#f0fdf4', color:isDiesel?'#1d4ed8':'#15803d' }}>{isDiesel?'Diesel':'Arla'}</span>
                                        </td>
                                        <td style={{ padding:'7px 10px', textAlign:'right', borderBottom:'1px solid #f3f4f6' }}>{fmtN(r.litros)}</td>
                                        <td style={{ padding:'7px 10px', textAlign:'right', borderBottom:'1px solid #f3f4f6' }}>{r.distancia?`${fmtN(r.distancia,0)} km`:'—'}</td>
                                        <td style={{ padding:'7px 10px', textAlign:'right', fontWeight:600, borderBottom:'1px solid #f3f4f6' }}>{isDiesel&&r.mediaRealizada?fmtN(r.mediaRealizada):'—'}</td>
                                        <td style={{ padding:'7px 10px', textAlign:'right', color:'#6b7280', borderBottom:'1px solid #f3f4f6' }}>{isDiesel&&r.mediaSugerida?fmtN(r.mediaSugerida):'—'}</td>
                                        <td style={{ padding:'7px 10px', textAlign:'right', borderBottom:'1px solid #f3f4f6' }}>{perc!==null&&isDiesel?<span style={{ fontWeight:700, color:corPerc(perc) }}>{fmtN(perc,0)}%</span>:'—'}</td>
                                        <td style={{ padding:'7px 10px', textAlign:'right', fontWeight:600, borderBottom:'1px solid #f3f4f6' }}>{fmtR(r.vlrTotal)}</td>
                                        <td style={{ padding:'7px 10px', color:'#6b7280', maxWidth:140, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', borderBottom:'1px solid #f3f4f6' }}>{r.posto}</td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
              {resumoMensal.length > 1 && (() => {
                const tk=resumoMensal.reduce((s,m)=>s+m.totalKm,0);
                const tl=resumoMensal.reduce((s,m)=>s+m.totalLit,0);
                const tg=resumoMensal.reduce((s,m)=>s+m.totalGasto,0);
                const mr=tl>0?tk/tl:0;
                const sg=resumoMensal.filter(m=>m.mediaSug>0);
                const ms=sg.length?sg.reduce((s,m)=>s+m.mediaSug,0)/sg.length:0;
                const pc=ms>0?(mr/ms)*100:0;
                return (
                  <tfoot>
                    <tr style={{ background:'#f8fafc', fontWeight:700 }}>
                      <td style={{ padding:'12px 16px', color:'#374151' }}>TOTAL / MÉDIA GERAL</td>
                      <td style={{ padding:'12px 16px', textAlign:'right' }}>{fmtN(tk,0)} km</td>
                      <td style={{ padding:'12px 16px', textAlign:'right' }}>{fmtN(tl)} L</td>
                      <td style={{ padding:'12px 16px', textAlign:'right', color:'#1a1a2e' }}>{fmtN(mr)}</td>
                      <td style={{ padding:'12px 16px', textAlign:'right', color:'#6b7280' }}>{fmtN(ms)}</td>
                      <td style={{ padding:'12px 16px', textAlign:'right', color:corPerc(pc) }}>{fmtN(pc,1)}%</td>
                      <td style={{ padding:'12px 16px', textAlign:'right' }}>{fmtR(tg)}</td>
                    </tr>
                  </tfoot>
                );
              })()}
            </table>
          </div>
        </div>
      )}

    </div>
  );
}

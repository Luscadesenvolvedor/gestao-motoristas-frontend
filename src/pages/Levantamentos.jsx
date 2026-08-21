// frontend/src/pages/Levantamentos.jsx
import { useState, useEffect, useMemo, useRef } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, LabelList,
  ResponsiveContainer
} from 'recharts';

// helpers de parse para import inline
const _norm = s => String(s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9\s]/g,'').trim();
const MESES_PT_IMP = { janeiro:1,fevereiro:2,marco:3,abril:4,maio:5,junho:6,julho:7,agosto:8,setembro:9,outubro:10,novembro:11,dezembro:12,jan:1,fev:2,mar:3,abr:4,mai:5,jun:6,jul:7,ago:8,set:9,out:10,nov:11,dez:12 };
function parseMesImp(v) {
  if (!v && v !== 0) return null;
  const s = String(v).trim();
  if (/^\d{4}-\d{2}/.test(s)) return s.slice(0,7);
  if (/^\d{1,2}\/\d{4}$/.test(s)) { const [m,a] = s.split('/'); return `${a}-${m.padStart(2,'0')}`; }
  if (/^\d{4}\/\d{2}$/.test(s))   { const [a,m] = s.split('/'); return `${a}-${m}`; }
  if (v instanceof Date) return `${v.getFullYear()}-${String(v.getMonth()+1).padStart(2,'0')}`;
  if (typeof v === 'number') { const d = new Date(Math.round((v-25569)*86400*1000)); return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}`; }
  const lower = _norm(s);
  for (const [nome, num] of Object.entries(MESES_PT_IMP)) { if (lower.startsWith(nome)) { const ar = s.match(/\d{4}/)?.[0]; const af = ar || new Date().getFullYear(); return `${af}-${String(num).padStart(2,'0')}`; } }
  return s.length >= 7 ? s.slice(0,7) : null;
}
function parseValImp(v) {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return v;
  const n = parseFloat(String(v).replace(/[R$\s]/g,'').replace(/\./g,'').replace(',','.'));
  return isNaN(n) ? null : n;
}
function normFrotaImp(v) {
  if (!v) return null;
  const s = String(v).trim().toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g,'');
  if (s === 'FROTA') return 'FROTA';
  if (s.includes('BAU') || s === 'MELI' || s.includes('OP') || s.includes('BAU')) return 'MELI';
  return null;
}

const CustomTooltip = ({ active, payload, label, fmtVal }) => {
  if (!active || !payload?.length) return null;
  const totalVal = payload.reduce((s, p) => s + (p.value || 0), 0);
  return (
    <div style={{ background:'#1e293b', borderRadius:10, padding:'12px 16px', boxShadow:'0 8px 32px rgba(0,0,0,0.25)', minWidth:200 }}>
      <div style={{ color:'#94a3b8', fontSize:11, fontWeight:600, marginBottom:8, textTransform:'uppercase', letterSpacing:'0.05em' }}>{label}</div>
      {payload.map(p => (
        <div key={p.name} style={{ display:'flex', justifyContent:'space-between', gap:24, marginBottom:4 }}>
          <span style={{ color: p.fill, fontSize:12, display:'flex', alignItems:'center', gap:6 }}>
            <span style={{ width:8, height:8, borderRadius:'50%', background:p.fill, display:'inline-block' }}/>
            {p.name}
          </span>
          <span style={{ color:'#f1f5f9', fontSize:12, fontWeight:600 }}>{fmtVal(p.value)}</span>
        </div>
      ))}
      <div style={{ borderTop:'1px solid #334155', marginTop:8, paddingTop:8, display:'flex', justifyContent:'space-between' }}>
        <span style={{ color:'#94a3b8', fontSize:12 }}>Total</span>
        <span style={{ color:'#fff', fontSize:13, fontWeight:700 }}>{fmtVal(totalVal)}</span>
      </div>
    </div>
  );
};

export default function Levantamentos() {
  const [lista, setLista] = useState([]);
  const [showLista, setShowLista] = useState(false);
  const [editandoInlineId, setEditandoInlineId] = useState(null);
  const [inlineForm, setInlineForm] = useState({});
  const [anoFiltro, setAnoFiltro] = useState(null);
  const [mesFiltro, setMesFiltro] = useState(null);
  const [tipoFiltro, setTipoFiltro] = useState(null);

  // ── Por Motorista ──
  const [abaAtiva, setAbaAtiva]           = useState('geral'); // 'geral' | 'motoristas'
  const [regsMot, setRegsMot]             = useState([]);
  const [mesFiltroMot, setMesFiltroMot]   = useState('');
  const [buscaMot, setBuscaMot]           = useState('');
  const [frotaFiltroMot, setFrotaFiltroMot] = useState(''); // '' | 'MELI' | 'FROTA'
  const [importacoesMot, setImportacoesMot] = useState([]);
  const [placasMot, setPlacasMot]         = useState({}); // { [motorista]: { valor, salvando, salvo } }
  const [detalheMot, setDetalheMot]       = useState(null); // motorista key expandido
  const [motoristasBD, setMotoristasBD]   = useState([]); // motoristas do banco para cruzar frota/info
  const [opBauOverrides, setOpBauOverrides] = useState(new Set()); // nomes marcados como OP. BAÚ via importação
  const [frotaOverrides, setFrotaOverrides] = useState(new Set()); // exceções FROTA para motoristas MELI no cadastro
  const [sortMot, setSortMot]             = useState({ col: 'motorista', dir: 'asc' });

  // ── Modal import inline ──
  const [importModal, setImportModal]   = useState(null); // null | { nomeArquivo, registros, tipoPagamento, mesReferencia, opBauDaPlanilha }
  const [importSalvando, setImportSalvando] = useState(false);
  const fileRefMot = useRef();

  async function handleFileMot(e) {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = '';
    try {
      const XLSX = await import('xlsx');
      const buf = await file.arrayBuffer();
      const wb  = XLSX.read(buf, { cellDates: true });
      const ws  = wb.Sheets[wb.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true });
      const header = (raw[0] || []).map(_norm);
      const iMot = header.findIndex(h => h.includes('motorista'));
      const iVei = header.findIndex(h => h.includes('veiculo') || h.includes('placa') || h.includes('vei'));
      const iVal = header.findIndex(h => h.includes('valor') || h.includes('faturamento'));
      const iMes = header.findIndex(h => h.includes('mes') || h.includes('periodo') || h.includes('competencia') || h.includes('data') || h.includes('referencia') || h.includes('ref'));
      const iFrota = header.findIndex(h => h === 'frota' || h === 'info' || h === 'bau' || h === 'tipo' || h.includes('classificac') || h.includes('operac') || h.includes('frota'));
      if (iMot < 0 || iVal < 0) { toast.error(`Colunas não encontradas. Lidos: ${header.join(', ')}`); return; }
      const registros = raw.slice(1)
        .filter(r => r[iMot] && String(r[iMot]).trim())
        .map(r => ({ motorista: String(r[iMot]).trim(), veiculo: iVei >= 0 && r[iVei] ? String(r[iVei]).trim() : null, valor: parseValImp(r[iVal]), mes: iMes >= 0 ? parseMesImp(r[iMes]) : null, frota: iFrota >= 0 ? normFrotaImp(r[iFrota]) : null }))
        .filter(r => r.valor !== null);
      if (!registros.length) { toast.error('Nenhum registro válido'); return; }
      const opBauDaPlanilha = new Set(registros.filter(r => r.frota === 'MELI').map(r => r.motorista));
      toast.success(`${registros.length} registros lidos`);
      setImportModal({ nomeArquivo: file.name, registros, tipoPagamento: '', mesReferencia: '', opBauDaPlanilha });
    } catch(err) { toast.error('Erro ao ler arquivo: ' + err.message); }
  }

  async function salvarImportMot() {
    if (!importModal) return;
    if (!importModal.tipoPagamento) { toast.error('Selecione o tipo de pagamento'); return; }
    if (importModal.tipoPagamento === 'custoFolha' && !importModal.mesReferencia) { toast.error('Selecione o mês de referência'); return; }
    setImportSalvando(true);
    try {
      await api.post('/levantamentos-motoristas/importar', {
        nomeArquivo:   importModal.nomeArquivo,
        registros:     importModal.registros,
        tipoPagamento: importModal.tipoPagamento,
        frota:         null,
        mesReferencia: importModal.mesReferencia || null,
        motoristasOpBau: [...(importModal.opBauDaPlanilha || [])].map(nome => ({
          nome,
          meses: [...new Set(importModal.registros.filter(r => r.motorista === nome && (r.mes || importModal.mesReferencia)).map(r => r.mes || importModal.mesReferencia))],
        })),
      });
      toast.success('Importação salva!');
      setImportModal(null);
      // Recarrega dados
      const [r1, r2] = await Promise.all([
        api.get('/levantamentos-motoristas'),
        api.get('/levantamentos-motoristas/importacoes'),
      ]);
      setRegsMot(r1.data);
      setImportacoesMot(r2.data);
    } catch(err) { toast.error(err?.response?.data?.error || 'Erro ao salvar'); }
    finally { setImportSalvando(false); }
  }

  const fmtR = v => `R$ ${parseFloat(v||0).toLocaleString('pt-BR', { minimumFractionDigits:2 })}`;
  const fmtDt = s => s ? new Date(s+'T12:00:00').toLocaleDateString('pt-BR') : '—';

  useEffect(() => {
    api.get('/levantamentos-motoristas')
      .then(r => setRegsMot(r.data))
      .catch(() => {});
    api.get('/levantamentos-motoristas/importacoes')
      .then(r => setImportacoesMot(r.data))
      .catch(() => {});
    api.get('/motoristas')
      .then(r => setMotoristasBD(r.data))
      .catch(() => {});
    api.get('/levantamentos-motoristas/op-bau-nomes')
      .then(r => {
        const pairs = r.data || [];
        setOpBauOverrides(new Set(pairs.map(({ nome, mes }) => nome.trim().toUpperCase() + '|' + (mes || ''))));
      })
      .catch(() => {});
    api.get('/levantamentos-motoristas/frota-override')
      .then(r => {
        const pairs = r.data || [];
        setFrotaOverrides(new Set(pairs.map(({ nome, mes }) => nome.trim().toUpperCase() + '|' + (mes || ''))));
      })
      .catch(() => {});
  }, []);

  async function salvarPlacaMot(motorista) {
    const placa = (placasMot[motorista]?.valor || '').trim();
    if (!placa) return;
    setPlacasMot(p => ({ ...p, [motorista]: { ...p[motorista], salvando: true } }));
    try {
      await api.put('/levantamentos-motoristas/veiculo', { motorista, veiculo: placa });
      // Atualiza localmente os registros para refletir a placa salva
      setRegsMot(prev => prev.map(r =>
        r.motorista.trim().toUpperCase() === motorista.trim().toUpperCase()
          ? { ...r, veiculo: placa }
          : r
      ));
      setPlacasMot(p => ({ ...p, [motorista]: { valor: placa, salvando: false, salvo: true } }));
      toast.success(`Placa salva`);
    } catch {
      toast.error('Erro ao salvar placa');
      setPlacasMot(p => ({ ...p, [motorista]: { ...p[motorista], salvando: false } }));
    }
  }

  // Inclui meses de mesReferencia (custo folha armazena mês no nível de importação, não por registro)
  const mesesMot = useMemo(() => {
    const meses = new Set();
    for (const r of regsMot) {
      const mesEf = r.mes || importacoesMap[r.importacaoId]?.mesReferencia || '';
      if (mesEf) meses.add(mesEf);
    }
    return [...meses].sort();
  }, [regsMot, importacoesMap]);

  // Mapa nome normalizado → motorista do banco (para cruzar frota/info na aba Por Motorista)
  const motoristasBDMap = useMemo(() => {
    const map = {};
    for (const m of motoristasBD) map[m.nome.trim().toUpperCase()] = m;
    return map;
  }, [motoristasBD]);

  const FROTAS_LABEL_BD = { buzin:'BUZIN', lbm:'LBM', meli_buzin:'OP. BAÚ BUZIN', meli_lbm:'OP. BAÚ LBM' };
  const isMeliBD = frota => frota?.startsWith('meli');
  const labelTipo = t => t === 'MELI' ? 'OP. BAÚ' : t;
  // Retorna 'MELI' ou 'FROTA' para o motorista/mês.
  // Ordem de prioridade:
  //   1. frotaOverrides (exceção FROTA para motoristas MELI no cadastro) — ganha de tudo
  //   2. opBauOverrides (override OP. BAÚ por mês ou global)
  //   3. descricao='MELI' no banco (cadastro)
  //   4. FROTA por padrão
  const getFrotaReal = (motoristaNome, mes) => {
    const key = motoristaNome?.trim().toUpperCase();
    if (mes !== undefined && mes !== null) {
      if (frotaOverrides.has(key + '|' + mes)) return 'FROTA'; // exceção FROTA tem prioridade máxima
      if (opBauOverrides.has(key + '|' + mes)) return 'MELI';
      if (opBauOverrides.has(key + '|')) return 'MELI'; // override global (legado)
    } else {
      // sem mês: verifica se existe qualquer override BAÚ
      for (const k of opBauOverrides) {
        if (k.startsWith(key + '|')) return 'MELI';
      }
    }
    const bd = motoristasBDMap[key];
    if (bd?.descricao?.toUpperCase() === 'MELI') return 'MELI';
    return 'FROTA';
  };

  // Alterna classificação OP. BAÚ / FROTA
  // mes: mês específico (quando filtrado) | null: aplica a todos os meses do motorista (allMeses)
  // Motoristas com descricao='MELI' no cadastro: usa frotaOverrides (exceção FROTA por mês)
  // Motoristas sem cadastro MELI: usa opBauOverrides (override OP. BAÚ por mês)
  async function toggleOpBau(motoristaNome, mes, allMeses) {
    const key = motoristaNome.trim().toUpperCase();
    const fromDB = motoristasBDMap[key]?.descricao?.toUpperCase() === 'MELI';
    const isOpBau = getFrotaReal(motoristaNome, mes) === 'MELI';

    if (mes) {
      // ── Toggle para mês específico ──
      const bauKey    = key + '|' + mes;
      const bauGlobal = key + '|';
      const frotaKey  = key + '|' + mes;
      const hasBauSpecific = opBauOverrides.has(bauKey);
      const hasBauGlobal   = opBauOverrides.has(bauGlobal);
      const hasFrotaOvr    = frotaOverrides.has(frotaKey);

      if (isOpBau) {
        // OP. BAÚ → FROTA
        if (fromDB && !hasBauSpecific && !hasBauGlobal) {
          // MELI vem do cadastro → adiciona exceção FROTA para este mês
          setFrotaOverrides(prev => { const n = new Set(prev); n.add(frotaKey); return n; });
          try {
            await api.post('/levantamentos-motoristas/frota-override', { nome: motoristaNome.trim(), mes });
          } catch {
            setFrotaOverrides(prev => { const n = new Set(prev); n.delete(frotaKey); return n; });
            toast.error('Erro ao atualizar classificação');
          }
        } else {
          // MELI vem de override BAÚ → remove o override
          setOpBauOverrides(prev => {
            const n = new Set(prev); n.delete(bauKey); n.delete(bauGlobal); return n;
          });
          try {
            await api.delete('/levantamentos-motoristas/op-bau-nomes', { data: { nome: motoristaNome.trim(), mes } });
          } catch {
            setOpBauOverrides(prev => {
              const n = new Set(prev);
              if (hasBauSpecific) n.add(bauKey);
              if (hasBauGlobal)   n.add(bauGlobal);
              return n;
            });
            toast.error('Erro ao atualizar classificação');
          }
        }
      } else {
        // FROTA → OP. BAÚ
        if (hasFrotaOvr) {
          // FROTA por exceção → remove a exceção (volta a ser MELI do cadastro)
          setFrotaOverrides(prev => { const n = new Set(prev); n.delete(frotaKey); return n; });
          try {
            await api.delete('/levantamentos-motoristas/frota-override', { data: { nome: motoristaNome.trim(), mes } });
          } catch {
            setFrotaOverrides(prev => { const n = new Set(prev); n.add(frotaKey); return n; });
            toast.error('Erro ao atualizar classificação');
          }
        } else {
          // FROTA por padrão → adiciona override BAÚ
          setOpBauOverrides(prev => { const n = new Set(prev); n.add(bauKey); return n; });
          try {
            await api.post('/levantamentos-motoristas/op-bau-nomes', { nome: motoristaNome.trim(), mes });
          } catch {
            setOpBauOverrides(prev => { const n = new Set(prev); n.delete(bauKey); return n; });
            toast.error('Erro ao atualizar classificação');
          }
        }
      }
    } else {
      // ── Toggle para todos os meses do motorista ──
      const meses = [...(allMeses || [])].filter(Boolean);

      if (isOpBau) {
        if (fromDB) {
          // Cadastro MELI → adiciona exceção FROTA para todos os meses
          setFrotaOverrides(prev => {
            const n = new Set(prev);
            for (const m of meses) n.add(key + '|' + m);
            return n;
          });
          try {
            await Promise.all(meses.map(m =>
              api.post('/levantamentos-motoristas/frota-override', { nome: motoristaNome.trim(), mes: m })
            ));
          } catch {
            setFrotaOverrides(prev => {
              const n = new Set(prev);
              for (const m of meses) n.delete(key + '|' + m);
              return n;
            });
            toast.error('Erro ao atualizar classificação');
          }
        } else {
          // Override BAÚ → remove todos os overrides BAÚ
          setOpBauOverrides(prev => {
            const n = new Set(prev);
            for (const k of [...n]) if (k.startsWith(key + '|')) n.delete(k);
            return n;
          });
          try {
            await api.delete('/levantamentos-motoristas/op-bau-nomes', { data: { nome: motoristaNome.trim() } });
          } catch {
            toast.error('Erro ao atualizar classificação');
            api.get('/levantamentos-motoristas/op-bau-nomes')
              .then(r => setOpBauOverrides(new Set((r.data||[]).map(({ nome, mes: m }) => nome.trim().toUpperCase() + '|' + (m||'')))));
          }
        }
      } else {
        // FROTA → OP. BAÚ
        const hasFrotaOvrs = meses.some(m => frotaOverrides.has(key + '|' + m));
        if (hasFrotaOvrs) {
          // Remove exceções FROTA (volta a ser MELI do cadastro)
          setFrotaOverrides(prev => {
            const n = new Set(prev);
            for (const m of meses) n.delete(key + '|' + m);
            return n;
          });
          try {
            await Promise.all(meses.map(m =>
              api.delete('/levantamentos-motoristas/frota-override', { data: { nome: motoristaNome.trim(), mes: m } })
            ));
          } catch {
            toast.error('Erro ao atualizar classificação');
            api.get('/levantamentos-motoristas/frota-override')
              .then(r => setFrotaOverrides(new Set((r.data||[]).map(({ nome, mes: m }) => nome.trim().toUpperCase() + '|' + (m||'')))));
          }
        } else {
          // Adiciona overrides BAÚ para todos os meses
          setOpBauOverrides(prev => {
            const n = new Set(prev);
            for (const m of meses) n.add(key + '|' + m);
            return n;
          });
          try {
            await Promise.all(meses.map(m =>
              api.post('/levantamentos-motoristas/op-bau-nomes', { nome: motoristaNome.trim(), mes: m })
            ));
          } catch {
            toast.error('Erro ao atualizar classificação');
            api.get('/levantamentos-motoristas/op-bau-nomes')
              .then(r => setOpBauOverrides(new Set((r.data||[]).map(({ nome, mes: m }) => nome.trim().toUpperCase() + '|' + (m||'')))));
          }
        }
      }
    }
  }

  // Map importacaoId → { tipoPagamento, frota, mesReferencia }
  const importacoesMap = useMemo(() => {
    const map = {};
    for (const im of importacoesMot) map[im.id] = { tipoPagamento: im.tipoPagamento, frota: im.frota, mesReferencia: im.mesReferencia || null };
    return map;
  }, [importacoesMot]);

  const regsFiltrados = useMemo(() => {
    const filtrado = regsMot.filter(r => {
      // Custo Folha tem mes vazio no registro — usa mesReferencia da importação como fallback
      const mesEf = r.mes || importacoesMap[r.importacaoId]?.mesReferencia || '';
      if (mesFiltroMot && mesEf !== mesFiltroMot) return false;
      if (buscaMot && !r.motorista.toLowerCase().includes(buscaMot.toLowerCase())) return false;
      if (frotaFiltroMot && getFrotaReal(r.motorista, mesEf || null) !== frotaFiltroMot) return false;
      return true;
    });
    // agrupar por motorista + veiculo, somando valores
    const map = {};
    for (const r of filtrado) {
      const key = r.motorista.trim().toUpperCase();
      if (!map[key]) map[key] = { motorista: r.motorista, veiculo: r.veiculo, valor: 0, faturamento: 0, meses: new Set() };
      const meta = importacoesMap[r.importacaoId];
      if (meta?.tipoPagamento === 'faturamento') {
        map[key].faturamento += parseFloat(r.valor || 0);
      } else {
        map[key].valor += parseFloat(r.valor || 0);
      }
      // Inclui mesReferencia quando r.mes está vazio (ex: Custo Folha)
      const mesEf = r.mes || meta?.mesReferencia;
      if (mesEf) map[key].meses.add(mesEf);
    }
    const rows = Object.values(map);
    rows.sort((a, b) => {
      let va, vb;
      if (sortMot.col === 'motorista') { va = a.motorista; vb = b.motorista; return sortMot.dir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va); }
      if (sortMot.col === 'faturamento') { va = a.faturamento; vb = b.faturamento; }
      if (sortMot.col === 'valor') { va = a.valor; vb = b.valor; }
      return sortMot.dir === 'asc' ? va - vb : vb - va;
    });
    return rows;
  }, [regsMot, mesFiltroMot, buscaMot, frotaFiltroMot, importacoesMap, sortMot, opBauOverrides, frotaOverrides, motoristasBDMap]);

  const totalMot = regsFiltrados.reduce((s, r) => s + r.valor, 0);

  function getDetalheMotorista(motoristaNome) {
    const key = motoristaNome.trim().toUpperCase();
    const registros = regsMot.filter(r => {
      if (r.motorista.trim().toUpperCase() !== key) return false;
      if (mesFiltroMot && r.mes !== mesFiltroMot) return false;
      return true;
    });
    const map = {};
    for (const r of registros) {
      if (!map[r.importacaoId]) {
        const im = importacoesMot.find(i => i.id === r.importacaoId);
        map[r.importacaoId] = {
          nomeArquivo: im?.nomeArquivo?.replace(/\.xlsx?$/i,'') || `Importação ${r.importacaoId}`,
          valor: 0,
        };
      }
      map[r.importacaoId].valor += parseFloat(r.valor || 0);
    }
    return Object.values(map).sort((a, b) => b.valor - a.valor);
  }



  function carregar() {
    api.get('/levantamentos').then(r => setLista(r.data)).catch(err => {
      const status = err?.response?.status;
      const msg = err?.response?.data?.error || 'Erro desconhecido';
      toast.error(`Erro ${status || ''}: ${msg}`);
    });
  }

  useEffect(() => { carregar(); }, []);

  function abrirInline(l) {
    setEditandoInlineId(l.id);
    setInlineForm({ motoristasFechados: l.motoristasFechados, saldo: parseFloat(l.previa||0)+parseFloat(l.saldo||0), custoFolha: l.custoFolha });
  }

  async function salvarInline(id) {
    try {
      await api.put(`/levantamentos/${id}`, { ...inlineForm, mes: lista.find(l=>l.id===id)?.mes });
      toast.success('Atualizado!');
      setEditandoInlineId(null);
      carregar();
    } catch (err) { toast.error(err?.response?.data?.error || 'Erro ao salvar'); }
  }

  async function excluir(id) {
    if (!confirm('Excluir este levantamento?')) return;
    try { await api.delete(`/levantamentos/${id}`); carregar(); }
    catch { toast.error('Erro ao excluir'); }
  }

  const fmt  = v => `R$ ${parseFloat(v||0).toLocaleString('pt-BR', { minimumFractionDigits:2, maximumFractionDigits:2 })}`;
  const fmtK = v => v >= 1000 ? `R$${(v/1000).toFixed(1)}k` : `R$${v.toFixed(0)}`;
  const fmtMes = mes => {
    if (!mes) return '—';
    const nomes = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
    const parts = mes.split('-');
    if (parts.length >= 2) {
      const [ano, m] = parts;
      return `${nomes[parseInt(m,10)-1] || m}/${ano.slice(2)}`;
    }
    // fallback: nome por extenso (ex: "Janeiro", "JANEIRO")
    const MESES_PT_NUM = { janeiro:1,fevereiro:2,marco:3,abril:4,maio:5,junho:6,julho:7,agosto:8,setembro:9,outubro:10,novembro:11,dezembro:12 };
    const normStr = mes.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').trim();
    const num = MESES_PT_NUM[normStr];
    if (num) {
      const anoAtual = String(new Date().getFullYear()).slice(2);
      return `${nomes[num-1]}/${anoAtual}`;
    }
    return mes;
  };
  const total = l => parseFloat(l.previa||0)+parseFloat(l.saldo||0)+parseFloat(l.custoFolha||0);

  // anos e meses disponíveis (combinando entradas manuais + dados importados)
  const todosMeses = useMemo(() =>
    [...new Set([
      ...lista.map(l => l.mes),
      // exclui faturamento dos filtros de mês do Geral
      ...regsMot
        .filter(r => importacoesMap[r.importacaoId]?.tipoPagamento !== 'faturamento')
        .map(r => r.mes)
        .filter(m => m && m.length >= 7),
    ])].sort(),
    [lista, regsMot, importacoesMap]
  );
  const anos = [...new Set(todosMeses.map(m => m.split('-')[0]))].filter(Boolean).sort((a,b) => b-a);
  const listaFiltrada = lista.filter(l => {
    if (tipoFiltro && l.tipo !== tipoFiltro) return false;
    if (mesFiltro) return l.mes === mesFiltro;
    if (anoFiltro) return l.mes.startsWith(anoFiltro);
    return true;
  });

  // Tipos/frotas disponíveis — FROTA e MELI sempre presentes + quaisquer outros do dado
  const todosTipos = useMemo(() => {
    const fromLista   = lista.map(l => l.tipo).filter(Boolean);
    const fromRegsMot = regsMot.map(r => importacoesMap[r.importacaoId]?.frota).filter(Boolean);
    return [...new Set(['FROTA', 'MELI', ...fromLista, ...fromRegsMot])].sort();
  }, [lista, regsMot, importacoesMap]);

  // Totais por tipoPagamento respeitando filtros (para os cards)
  const totaisMot = useMemo(() => {
    const result = { saldo: 0, diarias: 0, bonificacao: 0, custoFolha: 0, folgas: 0 };
    // soma por motorista para contar apenas quem tem valor > 0
    const motoristasPorMes = {}; // { mes: Set<nome> } — soma por mês para calcular média corretamente
    for (const r of regsMot) {
      const meta = importacoesMap[r.importacaoId];
      if (!meta?.tipoPagamento) continue;
      const mesEfetivo = r.mes || meta.mesReferencia || '';
      if (tipoFiltro && getFrotaReal(r.motorista, mesEfetivo || null) !== tipoFiltro) continue;
      if (mesFiltro  && mesEfetivo !== mesFiltro) continue;
      if (anoFiltro  && mesEfetivo && !mesEfetivo.startsWith(anoFiltro)) continue;
      const k = meta.tipoPagamento;
      const v = parseFloat(r.valor || 0);
      if (result[k] !== undefined) result[k] += v;
      if (k === 'custoFolha' && v > 0) {
        const mk = mesEfetivo || '_';
        if (!motoristasPorMes[mk]) motoristasPorMes[mk] = new Set();
        motoristasPorMes[mk].add(r.motorista.trim().toUpperCase());
      }
    }
    // soma de motoristas únicos por mês (não únicos globais) para média mensal correta
    const motoristasFechados = Object.values(motoristasPorMes).reduce((s, set) => s + set.size, 0);
    return { ...result, motoristasFechados };
  }, [regsMot, importacoesMap, tipoFiltro, mesFiltro, anoFiltro, opBauOverrides, frotaOverrides, motoristasBDMap]);

  // Totais por frota agrupados por mês (para o gráfico — soma nas barras FROTA/MELI)
  const chartMotData = useMemo(() => {
    const map = {};
    for (const r of regsMot) {
      const meta = importacoesMap[r.importacaoId];
      if (!meta) continue;
      if (meta.tipoPagamento === 'faturamento') continue; // faturamento é receita, não entra no geral
      const frotaReal = getFrotaReal(r.motorista, r.mes || meta.mesReferencia || null);
      if (tipoFiltro && frotaReal !== tipoFiltro) continue;
      if (mesFiltro  && r.mes !== mesFiltro) continue;
      if (anoFiltro  && !r.mes?.startsWith(anoFiltro)) continue;
      if (!map[r.mes]) map[r.mes] = { FROTA: 0, MELI: 0 };
      map[r.mes][frotaReal] = (map[r.mes][frotaReal] || 0) + parseFloat(r.valor || 0);
    }
    return map;
  }, [regsMot, importacoesMap, tipoFiltro, mesFiltro, anoFiltro, opBauOverrides, frotaOverrides, motoristasBDMap]);

  const mesesChart = [...new Set([
    ...listaFiltrada.map(l => l.mes),
    ...Object.keys(chartMotData),
  ])].sort();

  const chartData = mesesChart.map(mes => {
    const frotaEntry = listaFiltrada.find(l => l.mes === mes && l.tipo === 'FROTA');
    const meliEntry  = listaFiltrada.find(l => l.mes === mes && l.tipo === 'MELI');
    const mot = chartMotData[mes] || {};
    const frotaTotal = (frotaEntry ? total(frotaEntry) : 0) + (mot.FROTA || 0);
    const meliTotal  = (meliEntry  ? total(meliEntry)  : 0) + (mot.MELI  || 0);
    return {
      mes: fmtMes(mes),
      ...(frotaTotal > 0 ? { FROTA: frotaTotal } : {}),
      ...(meliTotal  > 0 ? { MELI:  meliTotal  } : {}),
    };
  });

  const soma = key => listaFiltrada.reduce((s,l) => s + parseFloat(l[key]||0), 0);

  // soma dos dados importados (todos os tipos) — inclui no Total Geral e Média
  const totalImportados = (totaisMot.saldo || 0) + (totaisMot.diarias || 0) + (totaisMot.bonificacao || 0) + (totaisMot.custoFolha || 0) + (totaisMot.folgas || 0);

  const calcMedia = (registros, extraTotal = 0, extraMot = 0) => {
    // desconsiderar entradas com total = 0 na média
    const validos = registros.filter(l => total(l) > 0);
    const t = validos.reduce((s,l) => s + total(l), 0) + extraTotal;
    // soma motoristasFechados de cada mês → média mensal por motorista (total/meses/motoristas)
    const m = validos.reduce((s,l) => s + (parseInt(l.motoristasFechados)||0), 0) + extraMot;
    return m > 0 ? t / m : 0;
  };

  const listaFrota = lista.filter(l => (!anoFiltro || l.mes.startsWith(anoFiltro)) && (!mesFiltro || l.mes === mesFiltro) && l.tipo === 'FROTA');
  const listaMeli  = lista.filter(l => (!anoFiltro || l.mes.startsWith(anoFiltro)) && (!mesFiltro || l.mes === mesFiltro) && l.tipo === 'MELI');

  const corFrota = '#10b981';
  const corMeli  = '#8b5cf6';

  // Totais importados separados por frota (para calcMedia das cards FROTA e MELI sem filtro)
  // Motoristas são contados POR MÊS (e depois somados), igual ao motoristasFechados das entradas manuais.
  // Contar únicos globais causaria denominador menor → resultado parecendo soma de médias.
  const totaisImportPorFrota = useMemo(() => {
    const acc = {
      FROTA: { total: 0, porMes: {} },
      MELI:  { total: 0, porMes: {} },
    };
    for (const r of regsMot) {
      const meta = importacoesMap[r.importacaoId];
      if (!meta) continue;
      if (meta.tipoPagamento === 'faturamento') continue; // faturamento é receita, não entra na média de custo
      const mesEf2 = r.mes || meta.mesReferencia || '';
      const frotaReal = getFrotaReal(r.motorista, mesEf2 || null);
      if (mesFiltro && mesEf2 !== mesFiltro) continue;
      if (anoFiltro && mesEf2 && !mesEf2.startsWith(anoFiltro)) continue;
      const v = parseFloat(r.valor || 0);
      acc[frotaReal].total += v;
      if (v > 0) {
        const mk2 = mesEf2 || '_';
        if (!acc[frotaReal].porMes[mk2]) acc[frotaReal].porMes[mk2] = new Set();
        acc[frotaReal].porMes[mk2].add(r.motorista.trim().toUpperCase());
      }
    }
    // soma de motoristas únicos por mês (cada mês conta separadamente)
    const somarMes = porMes => Object.values(porMes).reduce((s, set) => s + set.size, 0);
    return {
      FROTA: { total: acc.FROTA.total, motoristas: somarMes(acc.FROTA.porMes) },
      MELI:  { total: acc.MELI.total,  motoristas: somarMes(acc.MELI.porMes)  },
    };
  }, [regsMot, importacoesMap, mesFiltro, anoFiltro, opBauOverrides, frotaOverrides, motoristasBDMap]);

  // Motoristas únicos dos importados — filtrado só por tempo (não por frota)
  const motoristasUnicosImportados = useMemo(() => new Set(
    regsMot.filter(r => {
      if (mesFiltro && r.mes !== mesFiltro) return false;
      if (anoFiltro && !r.mes?.startsWith(anoFiltro)) return false;
      return true;
    }).map(r => r.motorista.trim().toUpperCase())
  ).size, [mesFiltro, anoFiltro, regsMot]);

  // Motoristas fechados por frota — só da custo folha, por frota da importação
  const motoristasClosedPorFrota = useMemo(() => {
    const porMes = { FROTA: {}, MELI: {} };
    for (const r of regsMot) {
      const meta = importacoesMap[r.importacaoId];
      if (meta?.tipoPagamento !== 'custoFolha') continue;
      const mesEf = r.mes || meta.mesReferencia || '';
      const frotaReal = getFrotaReal(r.motorista, mesEf || null);
      if (tipoFiltro && frotaReal !== tipoFiltro) continue;
      if (mesFiltro  && mesEf !== mesFiltro) continue;
      if (anoFiltro  && mesEf && !mesEf.startsWith(anoFiltro)) continue;
      if (parseFloat(r.valor || 0) > 0) {
        const mk = mesEf || '_';
        if (!porMes[frotaReal][mk]) porMes[frotaReal][mk] = new Set();
        porMes[frotaReal][mk].add(r.motorista.trim().toUpperCase());
      }
    }
    const sum = f => Object.values(porMes[f]).reduce((s, set) => s + set.size, 0);
    return { FROTA: sum('FROTA'), MELI: sum('MELI') };
  }, [regsMot, importacoesMap, tipoFiltro, mesFiltro, anoFiltro, opBauOverrides, frotaOverrides, motoristasBDMap]);

  // Card "Motoristas Fechados": exclusivamente da planilha Custo Folha importada.
  const motoristasCard = useMemo(() => {
    return totaisMot.motoristasFechados || 0;
  }, [totaisMot]);

  // Para o DENOMINADOR da média
  const motoristasParaMedia = useMemo(() => {
    return totaisMot.motoristasFechados || motoristasUnicosImportados || 1;
  }, [totaisMot, motoristasUnicosImportados]);

  const cardsMedia = tipoFiltro
    ? [{ label:`Média/Motorista ${labelTipo(tipoFiltro)}`, valor: fmt(motoristasParaMedia > 0 ? (listaFiltrada.reduce((s,l)=>s+total(l),0) + totalImportados) / motoristasParaMedia : 0), cor: tipoFiltro === 'FROTA' ? corFrota : corMeli, icon:'ti-chart-bar' }]
    : [
        { label:'Média/Motorista FROTA', valor: fmt(motoristasClosedPorFrota.FROTA > 0 ? (listaFrota.reduce((s,l)=>s+total(l),0) + totaisImportPorFrota.FROTA.total) / motoristasClosedPorFrota.FROTA : 0), cor: corFrota, icon:'ti-chart-bar' },
        { label:'Média/Motorista OP. BAÚ',  valor: fmt(motoristasClosedPorFrota.MELI  > 0 ? (listaMeli.reduce((s,l)=>s+total(l),0)  + totaisImportPorFrota.MELI.total)  / motoristasClosedPorFrota.MELI  : 0), cor: corMeli,  icon:'ti-chart-bar' },
        { label:'Média/Motorista Geral', valor: fmt(motoristasCard > 0 ? (listaFiltrada.reduce((s,l)=>s+total(l),0) + totalImportados) / motoristasCard : 0), cor:'#f59e0b', icon:'ti-chart-bar' },
      ];


  const resumo = [
    { label:'Total Geral', valor: fmt(listaFiltrada.reduce((s,l)=>s+total(l),0) + totalImportados), cor:'#EB3238', icon:'ti-cash' },
    ...(mesFiltro ? [{ label:'Motoristas Fechados', valor: motoristasCard, cor:'#0ea5e9', icon:'ti-users' }] : []),
    { label:'Custo Folha',       valor: fmt(soma('custoFolha') + totaisMot.custoFolha),               cor:'#3b82f6', icon:'ti-id-badge' },
    { label:'Saldo/Prévia',      valor: fmt(soma('saldo') + soma('previa') + totaisMot.saldo),          cor:'#06b6d4', icon:'ti-wallet'   },
    { label:'Diárias Dedicados', valor: fmt(totaisMot.diarias),                                         cor:'#0ea5e9', icon:'ti-truck'    },
    { label:'Bonificações',      valor: fmt(totaisMot.bonificacao),                                     cor:'#16a34a', icon:'ti-gift'     },
    { label:'Folgas',            valor: fmt(totaisMot.folgas),                                          cor:'#f59e0b', icon:'ti-beach'    },
    ...cardsMedia,
  ];

  return (
    <div>
      {/* Header com abas */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <h2 style={{ fontSize:20, fontWeight:700, color:'#1a1a2e', margin:0 }}>Levantamentos</h2>
          <div style={{ display:'flex', gap:4, background:'#f1f5f9', borderRadius:10, padding:4 }}>
            {[{ id:'geral', label:'Geral' }, { id:'motoristas', label:'Por Motorista' }].map(ab => (
              <button key={ab.id} onClick={() => setAbaAtiva(ab.id)}
                style={{ padding:'5px 14px', borderRadius:7, border:'none', fontSize:12, fontWeight:600, cursor:'pointer',
                  background: abaAtiva === ab.id ? '#fff' : 'transparent',
                  color: abaAtiva === ab.id ? '#EB3238' : '#64748b',
                  boxShadow: abaAtiva === ab.id ? '0 1px 4px rgba(0,0,0,0.08)' : 'none' }}>
                {ab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ═══════════════ ABA POR MOTORISTA ═══════════════ */}
      {abaAtiva === 'motoristas' && (
        <div>
          {/* Barra de ferramentas */}
          <div style={{ background:'#fff', border:'1px solid #e5e7eb', borderRadius:12, padding:'14px 20px', marginBottom:16, display:'flex', gap:10, flexWrap:'wrap', alignItems:'center' }}>
            <div style={{ display:'flex', gap:8, alignItems:'center', width:'100%', flexWrap:'wrap' }}>
              {/* busca motorista */}
              <div style={{ position:'relative' }}>
                <i className="ti ti-search" style={{ position:'absolute', left:8, top:'50%', transform:'translateY(-50%)', fontSize:12, color:'#9ca3af', pointerEvents:'none' }}></i>
                <input value={buscaMot} onChange={e => setBuscaMot(e.target.value)} placeholder="Buscar motorista..."
                  style={{ padding:'6px 10px 6px 26px', border:'1.5px solid #e5e7eb', borderRadius:8, fontSize:12, outline:'none', width:180 }} />
              </div>
              {/* filtro frota/info */}
              <div style={{ display:'flex', gap:4 }}>
                {[{ val: '', label: 'Todos' }, { val: 'FROTA', label: 'FROTA' }, { val: 'MELI', label: 'OP. BAÚ' }].map(({ val, label }) => (
                  <button key={val} onClick={() => setFrotaFiltroMot(val)}
                    style={{ padding:'4px 12px', borderRadius:20, border:'1.5px solid', fontSize:11, fontWeight:600, cursor:'pointer', transition:'all .15s',
                      borderColor: frotaFiltroMot === val ? (val === 'MELI' ? '#6d28d9' : val === 'FROTA' ? '#065f46' : '#6366f1') : '#e5e7eb',
                      background:  frotaFiltroMot === val ? (val === 'MELI' ? '#ede9fe' : val === 'FROTA' ? '#d1fae5' : '#6366f1') : '#f9fafb',
                      color:       frotaFiltroMot === val ? (val === 'MELI' ? '#6d28d9' : val === 'FROTA' ? '#065f46' : '#fff')    : '#6b7280' }}>
                    {label}
                  </button>
                ))}
              </div>
              {/* filtros rápidos de mês */}
              {mesesMot.length > 0 && (
                <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
                  <button onClick={() => setMesFiltroMot('')}
                    style={{ padding:'4px 10px', borderRadius:20, border:'1.5px solid', fontSize:11, fontWeight:600, cursor:'pointer', transition:'all .15s',
                      borderColor: mesFiltroMot === '' ? '#6366f1' : '#e5e7eb',
                      background:  mesFiltroMot === '' ? '#6366f1' : '#f9fafb',
                      color:       mesFiltroMot === '' ? '#fff'    : '#6b7280' }}>
                    Todos
                  </button>
                  {mesesMot.map(m => (
                    <button key={m} onClick={() => setMesFiltroMot(mesFiltroMot === m ? '' : m)}
                      style={{ padding:'4px 10px', borderRadius:20, border:'1.5px solid', fontSize:11, fontWeight:600, cursor:'pointer', transition:'all .15s',
                        borderColor: mesFiltroMot === m ? '#6366f1' : '#e5e7eb',
                        background:  mesFiltroMot === m ? '#6366f1' : '#f9fafb',
                        color:       mesFiltroMot === m ? '#fff'    : '#6b7280' }}>
                      {fmtMes(m)}
                    </button>
                  ))}
                </div>
              )}
              {/* botão importar */}
              <input ref={fileRefMot} type="file" accept=".xlsx,.xls,.csv" style={{ display:'none' }} onChange={handleFileMot} />
              <button onClick={() => fileRefMot.current?.click()}
                style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:6, padding:'6px 14px', borderRadius:8, border:'1.5px solid #6366f1', background:'#6366f1', color:'#fff', fontWeight:600, fontSize:12, cursor:'pointer' }}>
                <i className="ti ti-upload" style={{ fontSize:14 }}></i> Importar
              </button>
            </div>
          </div>

          {/* Cards resumo */}
          {regsFiltrados.length > 0 && (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(160px,1fr))', gap:12, marginBottom:16 }}>
              <div style={{ background:'#fff', border:'1px solid #e5e7eb', borderRadius:12, padding:'14px 18px' }}>
                <div style={{ fontSize:10, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:6 }}>Total</div>
                <div style={{ fontSize:22, fontWeight:800, color:'#EB3238' }}>{fmtR(totalMot)}</div>
              </div>
              <div style={{ background:'#fff', border:'1px solid #e5e7eb', borderRadius:12, padding:'14px 18px' }}>
                <div style={{ fontSize:10, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:6 }}>Motoristas</div>
                <div style={{ fontSize:22, fontWeight:800, color:'#0ea5e9' }}>{regsFiltrados.length}</div>
              </div>
            </div>
          )}

          {/* Tabela */}
          {regsFiltrados.length > 0 ? (
            <div style={{ background:'#fff', border:'1px solid #e5e7eb', borderRadius:12, overflow:'hidden' }}>
              <div style={{ overflowX:'auto' }}>
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
                  <thead>
                    <tr style={{ background:'#f8fafc' }}>
                      {[
                        { label:'Motorista', col:'motorista' },
                        { label:'Frota/Info', col:null },
                        { label:'Veículo', col:null },
                        { label:'Mês(es)', col:null },
                        { label:'Faturamento', col:'faturamento' },
                        { label:'Valor Total', col:'valor' },
                        { label:'', col:null },
                      ].map(({ label, col }) => (
                        <th key={label} style={{ padding:'10px 16px', textAlign: label==='Valor Total'||label==='Faturamento' ? 'right' : 'left', fontSize:11, fontWeight:700, color:'#374151', textTransform:'uppercase', letterSpacing:'0.4px', borderBottom:'1px solid #e5e7eb', whiteSpace:'nowrap', width: label==='' ? 40 : 'auto' }}>
                          {col ? (
                            <button onClick={() => setSortMot(s => ({ col, dir: s.col === col && s.dir === 'asc' ? 'desc' : 'asc' }))}
                              style={{ background:'none', border:'none', cursor:'pointer', padding:0, display:'flex', alignItems:'center', gap:6 }}>
                              <span style={{ fontSize:11, fontWeight:700, color: sortMot.col === col ? '#EB3238' : '#6b7280', textTransform:'uppercase', letterSpacing:'0.4px' }}>{label}</span>
                              <span style={{ display:'flex', flexDirection:'column', gap:1 }}>
                                <span style={{ fontSize:8, lineHeight:1, color: sortMot.col === col && sortMot.dir === 'asc' ? '#EB3238' : '#cbd5e1', fontWeight:900 }}>▲</span>
                                <span style={{ fontSize:8, lineHeight:1, color: sortMot.col === col && sortMot.dir === 'desc' ? '#EB3238' : '#cbd5e1', fontWeight:900 }}>▼</span>
                              </span>
                            </button>
                          ) : label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {regsFiltrados.map((r, i) => {
                      const key = r.motorista.trim().toUpperCase();
                      const aberto = detalheMot === key;
                      const detalhes = aberto ? getDetalheMotorista(r.motorista) : [];
                      return [
                        <tr key={r.motorista} style={{ background: i%2===0?'#fff':'#fafafa' }}
                          onMouseEnter={e => e.currentTarget.style.background='#fef2f2'}
                          onMouseLeave={e => e.currentTarget.style.background= aberto ? '#f0f9ff' : i%2===0?'#fff':'#fafafa'}>
                          <td style={{ padding:'10px 16px', fontWeight:600, color:'#1a1a2e', borderBottom: aberto ? 'none' : '1px solid #f3f4f6' }}>{r.motorista}</td>
                          <td style={{ padding:'10px 16px', borderBottom: aberto ? 'none' : '1px solid #f3f4f6' }}>
                            {(() => {
                              const mes = mesFiltroMot || null;
                              const isMeli = getFrotaReal(r.motorista, mes) === 'MELI';
                              const fromDB = motoristasBDMap[r.motorista.trim().toUpperCase()]?.descricao?.toUpperCase() === 'MELI';
                              const titleMeli = fromDB
                                ? (mes ? 'Cadastro MELI — clique para FROTA neste mês' : 'Cadastro MELI — selecione um mês para alterar')
                                : (mes ? 'Clique para mudar para FROTA' : 'Clique para mudar para FROTA (todos os meses)');
                              const titleFrota = mes ? 'Clique para mudar para OP. BAÚ' : 'Clique para mudar para OP. BAÚ (todos os meses)';
                              return isMeli
                                ? <span
                                    onClick={() => toggleOpBau(r.motorista, mes, r.meses)}
                                    title={titleMeli}
                                    style={{ padding:'2px 10px', borderRadius:20, fontSize:11, fontWeight:700, background:'#ede9fe', color:'#6d28d9', border:'1px solid #c4b5fd', cursor:'pointer' }}>
                                    OP. BAÚ
                                  </span>
                                : <span
                                    onClick={() => toggleOpBau(r.motorista, mes, r.meses)}
                                    title={titleFrota}
                                    style={{ padding:'2px 10px', borderRadius:20, fontSize:11, fontWeight:700, background:'#d1fae5', color:'#065f46', border:'1px solid #a7f3d0', cursor:'pointer' }}>
                                    FROTA
                                  </span>;
                            })()}
                          </td>
                          <td style={{ padding:'10px 16px', borderBottom: aberto ? 'none' : '1px solid #f3f4f6' }}>
                            {r.veiculo ? (
                              <span style={{ padding:'2px 8px', borderRadius:6, background:'#f1f5f9', color:'#374151', fontSize:11, fontWeight:700, fontFamily:'monospace' }}>{r.veiculo}</span>
                            ) : placasMot[r.motorista]?.salvo ? (
                              <span style={{ padding:'2px 8px', borderRadius:6, background:'#dcfce7', color:'#166534', fontSize:11, fontWeight:700, fontFamily:'monospace' }}>
                                {placasMot[r.motorista].valor} ✓
                              </span>
                            ) : (
                              <div style={{ display:'flex', gap:4, alignItems:'center' }}>
                                <input
                                  value={placasMot[r.motorista]?.valor || ''}
                                  onChange={e => setPlacasMot(p => ({ ...p, [r.motorista]: { ...p[r.motorista], valor: e.target.value.toUpperCase(), salvo: false } }))}
                                  onKeyDown={e => e.key === 'Enter' && salvarPlacaMot(r.motorista)}
                                  placeholder="ABC-1234"
                                  style={{ width:85, padding:'3px 7px', border:'1.5px solid #e5e7eb', borderRadius:6, fontSize:11, fontFamily:'monospace', fontWeight:700, textTransform:'uppercase', outline:'none' }}
                                />
                                <button
                                  onClick={() => salvarPlacaMot(r.motorista)}
                                  disabled={placasMot[r.motorista]?.salvando || !placasMot[r.motorista]?.valor}
                                  style={{ padding:'3px 8px', border:'none', borderRadius:6, background:'#6366f1', color:'#fff', fontSize:11, fontWeight:600, cursor:'pointer' }}>
                                  {placasMot[r.motorista]?.salvando ? '...' : 'Salvar'}
                                </button>
                              </div>
                            )}
                          </td>
                          <td style={{ padding:'10px 16px', borderBottom: aberto ? 'none' : '1px solid #f3f4f6', color:'#475569', fontSize:12 }}>
                            {[...r.meses].sort().map(m => fmtMes(m)).join(', ') || '—'}
                          </td>
                          <td style={{ padding:'10px 16px', textAlign:'right', fontWeight:700, color:'#0d9488', borderBottom: aberto ? 'none' : '1px solid #f3f4f6' }}>
                            {r.faturamento > 0 ? fmtR(r.faturamento) : <span style={{ color:'#d1d5db' }}>—</span>}
                          </td>
                          <td style={{ padding:'10px 16px', textAlign:'right', fontWeight:700, color:'#EB3238', borderBottom: aberto ? 'none' : '1px solid #f3f4f6' }}>{fmtR(r.valor)}</td>
                          <td style={{ padding:'10px 16px', textAlign:'center', borderBottom: aberto ? 'none' : '1px solid #f3f4f6' }}>
                            <button
                              onClick={() => setDetalheMot(aberto ? null : key)}
                              title="Ver composição"
                              style={{ padding:'3px 7px', border:`1.5px solid ${aberto ? '#0ea5e9' : '#e5e7eb'}`, borderRadius:6, background: aberto ? '#e0f2fe' : '#fff', color: aberto ? '#0369a1' : '#9ca3af', fontSize:12, cursor:'pointer', lineHeight:1 }}>
                              <i className="ti ti-flag-3"></i>
                            </button>
                          </td>
                        </tr>,
                        aberto && (
                          <tr key={r.motorista + '_detalhe'}>
                            <td colSpan={7} style={{ padding:'0 16px 12px 32px', background:'#f0f9ff', borderBottom:'1px solid #bae6fd' }}>
                              <div style={{ fontSize:11, fontWeight:700, color:'#0369a1', textTransform:'uppercase', letterSpacing:'0.4px', marginBottom:6 }}>
                                Composição do valor — {r.motorista}
                              </div>
                              <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                                {detalhes.map((d, di) => (
                                  <div key={di} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'5px 10px', background:'#fff', borderRadius:6, border:'1px solid #bae6fd' }}>
                                    <span style={{ fontSize:12, color:'#374151' }}>
                                      <i className="ti ti-file-spreadsheet" style={{ fontSize:12, color:'#6366f1', marginRight:5 }}></i>
                                      {d.nomeArquivo}
                                    </span>
                                    <span style={{ fontSize:12, fontWeight:700, color:'#0369a1' }}>{fmtR(d.valor)}</span>
                                  </div>
                                ))}
                                {detalhes.length === 0 && (
                                  <div style={{ fontSize:12, color:'#9ca3af', padding:'4px 0' }}>Nenhum registro encontrado</div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )
                      ];
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{ background:'#f8fafc', fontWeight:700 }}>
                      <td colSpan={5} style={{ padding:'11px 16px', color:'#374151' }}>TOTAL</td>
                      <td style={{ padding:'11px 16px', textAlign:'right', color:'#0d9488' }}>{fmtR(regsFiltrados.reduce((s, r) => s + r.faturamento, 0))}</td>
                      <td style={{ padding:'11px 16px', textAlign:'right', color:'#EB3238' }}>{fmtR(totalMot)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          ) : (
            <div style={{ textAlign:'center', padding:60, color:'#9ca3af', background:'#fff', borderRadius:12, border:'1px dashed #d1d5db' }}>
              <i className="ti ti-users" style={{ fontSize:36, display:'block', marginBottom:10, color:'#d1d5db' }}></i>
              <div style={{ fontWeight:500, marginBottom:4 }}>Nenhum dado</div>
              <div style={{ fontSize:12 }}>Importe uma planilha para começar</div>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════ ABA GERAL ═══════════════ */}
      {abaAtiva === 'geral' && <>

      {(lista.length > 0 || regsMot.length > 0) ? (<>
        {/* Filtros por tipo FROTA/MELI */}
        <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:10 }}>
          {todosTipos.map(t => (
            <button key={t} onClick={()=>setTipoFiltro(tipoFiltro===t ? null : t)}
              style={{ padding:'6px 20px', borderRadius:20, fontSize:12, fontWeight:700, cursor:'pointer', border:'none',
                background: tipoFiltro===t ? (t==='FROTA' ? '#065f46' : '#1d4ed8') : '#f1f5f9',
                color: tipoFiltro===t ? '#fff' : '#64748b',
                boxShadow: tipoFiltro===t ? '0 2px 8px rgba(0,0,0,0.15)' : 'none' }}>
              {labelTipo(t)}
            </button>
          ))}
        </div>

        {/* Filtros por ano e mês */}
        <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap', marginBottom:16 }}>
          <button onClick={()=>{ setAnoFiltro(null); setMesFiltro(null); setTipoFiltro(null); }}
            style={{ padding:'5px 14px', borderRadius:20, fontSize:12, fontWeight:600, cursor:'pointer', border:'none',
              background: !anoFiltro && !mesFiltro && !tipoFiltro ? '#EB3238' : '#f1f5f9', color: !anoFiltro && !mesFiltro && !tipoFiltro ? '#fff' : '#64748b' }}>
            Todos
          </button>
          {anos.map(ano => (
            <button key={ano} onClick={()=>{ setAnoFiltro(anoFiltro===ano ? null : ano); setMesFiltro(null); }}
              style={{ padding:'5px 14px', borderRadius:20, fontSize:12, fontWeight:600, cursor:'pointer', border:'none',
                background: anoFiltro===ano && !mesFiltro ? '#1e293b' : '#f1f5f9',
                color: anoFiltro===ano && !mesFiltro ? '#fff' : '#64748b',
                boxShadow: anoFiltro===ano && !mesFiltro ? '0 2px 8px rgba(0,0,0,0.15)' : 'none' }}>
              {ano}
            </button>
          ))}
          <span style={{ width:1, height:20, background:'#e2e8f0', margin:'0 4px' }}/>
          {todosMeses.map(mes => (
            <button key={mes} onClick={()=>setMesFiltro(mesFiltro===mes ? null : mes)}
              style={{ padding:'4px 12px', borderRadius:20, fontSize:11, fontWeight:500, cursor:'pointer',
                border: mesFiltro===mes ? '1px solid #EB3238' : '1px solid #e2e8f0',
                background: mesFiltro===mes ? '#EB3238' : '#fff',
                color: mesFiltro===mes ? '#fff' : '#475569' }}>
              {fmtMes(mes)}
            </button>
          ))}
        </div>

        {/* Cards resumo */}
        <div style={{ display:'grid', gridTemplateColumns:`repeat(${resumo.length},1fr)`, gap:10, marginBottom:16 }}>
          {resumo.map(r => (
            <div key={r.label} style={{ background:'#fff', borderRadius:12, padding:'16px 18px', border:'1px solid #e5e7eb', boxShadow:'0 1px 4px rgba(0,0,0,0.04)' }}>
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
                <div style={{ width:34, height:34, borderRadius:8, background:r.cor+'18', display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <i className={`ti ${r.icon}`} style={{ fontSize:18, color:r.cor }}></i>
                </div>
                <span style={{ fontSize:11, color:'#6b7280', fontWeight:500 }}>{r.label}</span>
              </div>
              <div style={{ fontSize:20, fontWeight:700, color:'#1a1a2e' }}>{r.valor}</div>
            </div>
          ))}
        </div>

        {/* Gráfico */}
        <div style={{ background:'linear-gradient(135deg,#1e293b 0%,#0f172a 100%)', borderRadius:16, padding:'24px 20px 16px', boxShadow:'0 8px 32px rgba(0,0,0,0.18)' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
            <div>
              <div style={{ color:'#f1f5f9', fontSize:15, fontWeight:700 }}>Comparativo por mês</div>
              <div style={{ color:'#64748b', fontSize:12, marginTop:2 }}>Distribuição de gastos por categoria</div>
            </div>
            <div style={{ fontSize:11, color:'#64748b' }}>Total gasto por mês</div>
          </div>
          <ResponsiveContainer width="100%" height={380}>
            <ComposedChart data={chartData} margin={{ top:16, right:16, left:0, bottom:4 }} barCategoryGap="25%" barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e3a5f" vertical={false} />
              <XAxis dataKey="mes" tick={{ fontSize:12, fill:'#94a3b8', fontWeight:500 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize:11, fill:'#64748b' }} axisLine={false} tickLine={false} tickFormatter={fmtK} width={60} />
              <Tooltip content={<CustomTooltip fmtVal={fmt} />} cursor={{ fill:'rgba(255,255,255,0.04)' }} />
              {(!tipoFiltro || tipoFiltro === 'FROTA') && (
                <Bar dataKey="FROTA" fill="#10b981" radius={[6,6,0,0]} maxBarSize={50} name="FROTA">
                  <LabelList dataKey="FROTA" position="top" style={{ fontSize:10, fontWeight:700, fill:'#10b981' }} formatter={v => fmtK(v)} />
                  <LabelList dataKey="FROTA" position="insideBottom" style={{ fontSize:9, fontWeight:700, fill:'rgba(255,255,255,0.85)' }} formatter={() => 'FROTA'} />
                </Bar>
              )}
              {(!tipoFiltro || tipoFiltro === 'MELI') && (
                <Bar dataKey="MELI" fill="#3b82f6" radius={[6,6,0,0]} maxBarSize={50} name="OP. BAÚ">
                  <LabelList dataKey="MELI" position="top" style={{ fontSize:10, fontWeight:700, fill:'#3b82f6' }} formatter={v => fmtK(v)} />
                  <LabelList dataKey="MELI" position="insideBottom" style={{ fontSize:9, fontWeight:700, fill:'rgba(255,255,255,0.85)' }} formatter={() => 'OP. BAÚ'} />
                </Bar>
              )}
              {tipoFiltro && (
                <Line dataKey={tipoFiltro} type="monotone" stroke="#e2e8f0" strokeWidth={2}
                  dot={{ fill:'#fff', stroke:'#e2e8f0', strokeWidth:2, r:4 }}
                  activeDot={{ r:6, fill:'#fff' }} legendType="none" />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Gerenciar */}
        <div style={{ marginTop:12 }}>
          <button onClick={()=>setShowLista(v=>!v)}
            style={{ background:'none', border:'none', fontSize:12, color:'#6b7280', cursor:'pointer', padding:'4px 0', display:'flex', alignItems:'center', gap:4 }}>
            <i className={`ti ${showLista?'ti-chevron-up':'ti-chevron-down'}`}></i>
            {showLista ? 'Ocultar registros' : 'Gerenciar registros'}
          </button>
          {showLista && (
            <div style={{ background:'#fff', borderRadius:12, border:'1px solid #e5e7eb', overflow:'hidden', marginTop:8 }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
                <thead>
                  <tr style={{ background:'#f9fafb' }}>
                    {['Mês','Tipo','Motoristas','Saldo/Prévia','Custo Folha','Total',''].map(h=>(
                      <th key={h} style={{ padding:'8px 12px', textAlign:'left', fontSize:11, fontWeight:600, color:'#6b7280', textTransform:'uppercase', borderBottom:'1px solid #e5e7eb', whiteSpace:'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {listaFiltrada.map(l=>{
                    const editando = editandoInlineId === l.id;
                    const inpI = { width:'70px', padding:'3px 6px', border:'1px solid #d1d5db', borderRadius:6, fontSize:12, boxSizing:'border-box' };
                    return (
                      <tr key={l.id} style={{ borderBottom:'1px solid #f3f4f6', background: editando ? '#f9fafb' : '#fff' }}>
                        <td style={{ padding:'8px 12px', fontWeight:600 }}>{fmtMes(l.mes)}</td>
                        {editando ? <>
                          <td style={{ padding:'8px 12px' }}>
                            <span style={{ padding:'2px 10px', borderRadius:20, fontSize:11, fontWeight:700,
                              background: l.tipo==='MELI' ? '#dbeafe' : '#d1fae5',
                              color: l.tipo==='MELI' ? '#1d4ed8' : '#065f46' }}>{l.tipo||'FROTA'}</span>
                          </td>
                          <td style={{ padding:'4px 8px' }}><input type="number" min="0" value={inlineForm.motoristasFechados} onChange={e=>setInlineForm(f=>({...f,motoristasFechados:e.target.value}))} style={inpI}/></td>
                          <td style={{ padding:'4px 8px' }}><input type="number" step="0.01" value={inlineForm.saldo} onChange={e=>setInlineForm(f=>({...f,saldo:e.target.value}))} style={inpI}/></td>
                          <td style={{ padding:'4px 8px' }}><input type="number" step="0.01" value={inlineForm.custoFolha} onChange={e=>setInlineForm(f=>({...f,custoFolha:e.target.value}))} style={inpI}/></td>
                          <td style={{ padding:'4px 8px', color:'#EB3238', fontWeight:700 }}>{fmt(Object.values(inlineForm).slice(1).reduce((s,v)=>s+parseFloat(v||0),0))}</td>
                          <td style={{ padding:'4px 8px', whiteSpace:'nowrap' }}>
                            <button onClick={()=>salvarInline(l.id)} style={{ padding:'3px 10px', background:'#EB3238', border:'none', borderRadius:6, fontSize:12, color:'#fff', cursor:'pointer', marginRight:4 }}>Salvar</button>
                            <button onClick={()=>setEditandoInlineId(null)} style={{ padding:'3px 10px', background:'#fff', border:'1px solid #d1d5db', borderRadius:6, fontSize:12, color:'#374151', cursor:'pointer' }}>Cancelar</button>
                          </td>
                        </> : <>
                          <td style={{ padding:'8px 12px' }}>
                            <span style={{ padding:'2px 10px', borderRadius:20, fontSize:11, fontWeight:700,
                              background: l.tipo==='MELI' ? '#dbeafe' : '#d1fae5',
                              color: l.tipo==='MELI' ? '#1d4ed8' : '#065f46' }}>{l.tipo||'FROTA'}</span>
                          </td>
                          <td style={{ padding:'8px 12px' }}>{l.motoristasFechados}</td>
                          <td style={{ padding:'8px 12px' }}>{fmt(parseFloat(l.previa||0)+parseFloat(l.saldo||0))}</td>
                          <td style={{ padding:'8px 12px' }}>{fmt(l.custoFolha)}</td>
                          <td style={{ padding:'8px 12px', color:'#EB3238', fontWeight:700 }}>{fmt(total(l))}</td>
                          <td style={{ padding:'8px 12px', whiteSpace:'nowrap' }}>
                            <button onClick={()=>abrirInline(l)} style={{ padding:'3px 10px', background:'#fff', border:'1px solid #d1d5db', borderRadius:6, fontSize:12, color:'#374151', cursor:'pointer', marginRight:6 }}>Editar</button>
                            <button onClick={()=>excluir(l.id)} style={{ padding:'3px 10px', background:'#fff', border:'1px solid #EB3238', borderRadius:6, fontSize:12, color:'#EB3238', cursor:'pointer' }}>Excluir</button>
                          </td>
                        </>}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </>) : (
        <div style={{ background:'#fff', borderRadius:12, border:'1px solid #e5e7eb', padding:60, textAlign:'center', color:'#9ca3af' }}>
          Nenhum levantamento registrado
        </div>
      )}
      </>}

      {/* ── Modal importação inline ── */}
      {importModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center' }}
          onClick={e => { if (e.target === e.currentTarget && !importSalvando) setImportModal(null); }}>
          <div style={{ background:'#fff', borderRadius:16, padding:28, width:420, maxWidth:'95vw', boxShadow:'0 20px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
              <div>
                <div style={{ fontWeight:700, fontSize:16, color:'#1e293b' }}>Importar planilha</div>
                <div style={{ fontSize:12, color:'#6b7280', marginTop:2 }}>{importModal.nomeArquivo} · {importModal.registros.length} registros</div>
              </div>
              {!importSalvando && (
                <button onClick={() => setImportModal(null)} style={{ background:'none', border:'none', cursor:'pointer', fontSize:20, color:'#9ca3af', lineHeight:1 }}>×</button>
              )}
            </div>

            {/* Tipo de pagamento */}
            <div style={{ marginBottom:14 }}>
              <div style={{ fontSize:11, fontWeight:700, color:'#6b7280', marginBottom:6, textTransform:'uppercase' }}>Tipo de pagamento *</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
                {[
                  { key:'saldo',       label:'Saldo/Prévia' },
                  { key:'diarias',     label:'Diárias dedicados' },
                  { key:'bonificacao', label:'Bonificações' },
                  { key:'custoFolha',  label:'Custo Folha' },
                  { key:'folgas',      label:'Folgas' },
                  { key:'faturamento', label:'Faturamento' },
                ].map(({ key, label }) => (
                  <button key={key} onClick={() => setImportModal(m => ({ ...m, tipoPagamento: key }))}
                    style={{ padding:'7px 10px', borderRadius:8, border:'1.5px solid', fontSize:12, fontWeight:600, cursor:'pointer', textAlign:'left', transition:'all .15s',
                      borderColor: importModal.tipoPagamento === key ? '#6366f1' : '#e5e7eb',
                      background:  importModal.tipoPagamento === key ? '#eef2ff' : '#f9fafb',
                      color:       importModal.tipoPagamento === key ? '#4f46e5' : '#374151' }}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Mês de referência (só custo folha) */}
            {importModal.tipoPagamento === 'custoFolha' && (
              <div style={{ marginBottom:14 }}>
                <div style={{ fontSize:11, fontWeight:700, color:'#6b7280', marginBottom:6, textTransform:'uppercase' }}>Mês de referência *</div>
                <input type="month" value={importModal.mesReferencia || ''}
                  onChange={e => setImportModal(m => ({ ...m, mesReferencia: e.target.value }))}
                  style={{ padding:'7px 10px', border:'1.5px solid #e5e7eb', borderRadius:8, fontSize:13, outline:'none', width:'100%', boxSizing:'border-box' }} />
              </div>
            )}

            {/* BAÚ detectados */}
            {importModal.opBauDaPlanilha?.size > 0 && (
              <div style={{ background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:8, padding:'8px 12px', marginBottom:14, fontSize:12, color:'#166534' }}>
                <i className="ti ti-check" style={{ marginRight:6 }}></i>
                {importModal.opBauDaPlanilha.size} motorista(s) marcados como OP. BAÚ pela coluna Frota
              </div>
            )}

            <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:4 }}>
              {!importSalvando && (
                <button onClick={() => setImportModal(null)}
                  style={{ padding:'8px 16px', borderRadius:8, border:'1.5px solid #e5e7eb', background:'#f9fafb', color:'#374151', fontWeight:600, fontSize:13, cursor:'pointer' }}>
                  Cancelar
                </button>
              )}
              <button onClick={salvarImportMot} disabled={importSalvando}
                style={{ padding:'8px 20px', borderRadius:8, border:'none', background:'#6366f1', color:'#fff', fontWeight:700, fontSize:13, cursor: importSalvando ? 'not-allowed' : 'pointer', opacity: importSalvando ? 0.7 : 1 }}>
                {importSalvando ? 'Salvando...' : 'Salvar importação'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

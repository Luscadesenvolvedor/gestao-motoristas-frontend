import { useState, useEffect } from 'react';
import StickyScrollTable from '../components/StickyScrollTable';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx-js-style';


function dataHoje() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
const vazio = { motoristaId:'', tipoId:'', tipoValeId:'', tipoRefId:'', data: dataHoje(), placa:'', valor:'' };

const FROTAS = [
  { key:'buzin', label:'BUZIN', cor:'#EB3238', bg:'#fff0f0' },
  { key:'lbm',   label:'LBM',   cor:'#1a1a2e', bg:'#f0f0ff' },
  { key:'meli',  label:'MELI',  cor:'#d97706', bg:'#fffbeb' },
];

const estiloCabecalho = {
  fill: { fgColor: { rgb: 'A6A6A6' } },
  font: { bold: true, color: { rgb: '000000' } },
  border: {
    top: { style:'thin', color:{ rgb:'000000' } },
    bottom: { style:'thin', color:{ rgb:'000000' } },
    left: { style:'thin', color:{ rgb:'000000' } },
    right: { style:'thin', color:{ rgb:'000000' } },
  },
  alignment: { horizontal:'center', vertical:'center' }
};

const estiloCelula = {
  border: {
    top: { style:'thin', color:{ rgb:'D1D5DB' } },
    bottom: { style:'thin', color:{ rgb:'D1D5DB' } },
    left: { style:'thin', color:{ rgb:'D1D5DB' } },
    right: { style:'thin', color:{ rgb:'D1D5DB' } },
  }
};

function ehTipoSaldo(nomeTipo) {
  return (nomeTipo || '').toLowerCase().includes('saldo');
}

function ehTipoFolga(nomeTipo) {
  return (nomeTipo || '').toLowerCase().includes('folga');
}

function ehTipoFluxo(nomeTipo) {
  const n = (nomeTipo || '').toLowerCase();
  return !n.includes('saldo') && !n.includes('folga');
}

function limparPix(pix) {
  const p = pix || '';
  if (p.includes('@')) return p.trim();
  return p.replace(/[^a-zA-Z0-9]/g, '');
}


function ModalHistoricoSol({ titulo, solicitacaoId, onClose }) {
  const [historico, setHistorico] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    api.get(`/solicitacoes/${solicitacaoId}/historico`)
      .then(r => setHistorico(r.data))
      .catch(() => toast.error('Erro ao carregar histórico'))
      .finally(() => setLoading(false));
  }, [solicitacaoId]);
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:3000, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
      <div style={{ background:'#fff', borderRadius:12, padding:24, width:'100%', maxWidth:520, maxHeight:'80vh', display:'flex', flexDirection:'column', boxShadow:'0 8px 32px rgba(0,0,0,0.18)' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
          <div>
            <h3 style={{ fontSize:15, fontWeight:600, margin:0 }}>Histórico de alterações</h3>
            <p style={{ fontSize:12, color:'#6b7280', margin:'2px 0 0' }}>{titulo}</p>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', fontSize:20, cursor:'pointer', color:'#9ca3af', lineHeight:1 }}>×</button>
        </div>
        <div style={{ overflowY:'auto', flex:1 }}>
          {loading && <p style={{ color:'#9ca3af', fontSize:13, textAlign:'center', padding:20 }}>Carregando...</p>}
          {!loading && historico.length === 0 && <p style={{ color:'#9ca3af', fontSize:13, textAlign:'center', padding:20 }}>Nenhum histórico encontrado.</p>}
          {!loading && historico.map((h, i) => {
            const isPagou = h.acao === 'pagou';
            const bgAcao = isPagou ? '#f0fdf4' : h.acao==='criou' ? '#f0fdf4' : h.acao==='editou' ? '#eff6ff' : '#fff7ed';
            const corAcao = isPagou ? '#166534' : h.acao==='criou' ? '#166534' : h.acao==='editou' ? '#1d4ed8' : '#9a3412';
            const bgBadge = isPagou ? '#dcfce7' : h.acao==='criou' ? '#dcfce7' : h.acao==='editou' ? '#dbeafe' : '#ffedd5';
            return (
              <div key={h.id} style={{ borderBottom: i < historico.length-1 ? '1px solid #f3f4f6' : 'none', padding:'10px 0', background: isPagou ? '#f0fdf4' : 'transparent', borderRadius: isPagou ? 8 : 0, paddingLeft: isPagou ? 10 : 0, paddingRight: isPagou ? 10 : 0 }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <span style={{ padding:'2px 8px', borderRadius:20, fontSize:10, fontWeight:600, textTransform:'uppercase', background: bgBadge, color: corAcao }}>{isPagou ? 'pagamento' : h.acao}</span>
                    <span style={{ fontSize:12, fontWeight:500 }}>{h.usuario?.nome || '—'}</span>
                  </div>
                  <span style={{ fontSize:11, color:'#9ca3af' }}>{new Date(h.criadoEm).toLocaleString('pt-BR')}</span>
                </div>
                {isPagou && h.dadosNovos && (
                  <div style={{ marginTop:6, fontSize:12, color:'#166534', display:'flex', gap:16 }}>
                    <span>Lote: <strong>R$ {parseFloat(h.dadosNovos.lote||0).toLocaleString('pt-BR',{minimumFractionDigits:2})}</strong></span>
                    <span>Total liberado: <strong>R$ {parseFloat(h.dadosNovos.totalLiberado||0).toLocaleString('pt-BR',{minimumFractionDigits:2})}</strong></span>
                    <span>Data: <strong>{h.dadosNovos.data}</strong></span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div style={{ marginTop:12, textAlign:'right' }}>
          <button onClick={onClose} style={{ padding:'7px 18px', border:'1px solid #d1d5db', borderRadius:8, fontSize:13, cursor:'pointer', background:'#fff' }}>Fechar</button>
        </div>
      </div>
    </div>
  );
}

export default function Solicitacoes() {
  const { usuario, isAdmin, pode } = useAuth();
  const isAdminOrFinanceiro = isAdmin || usuario?.papel === 'financeiro';
  const [historicoSol, setHistoricoSol] = useState(null);
  const [lista, setLista] = useState([]);
  const [motoristas, setMotoristas] = useState([]);
  const [tipos, setTipos] = useState([]);
  const [tiposVale, setTiposVale] = useState([]);
  const [tiposRef, setTiposRef] = useState([]);
  const [form, setForm] = useState(vazio);
  const [showForm, setShowForm] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [novoVale, setNovoVale] = useState('');
  const [showNovoVale, setShowNovoVale] = useState(false);
  const [novoRef, setNovoRef] = useState('');
  const [showNovoRef, setShowNovoRef] = useState(false);
  const [alertas, setAlertas] = useState({});
  const [alertasMotorista, setAlertasMotorista] = useState({});
  const [pixMotorista, setPixMotorista] = useState('');
  const [contaMotorista, setContaMotorista] = useState('');
  const [filtroMotorista, setFiltroMotorista] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('');
  const [filtroVale, setFiltroVale] = useState('');
  const [filtroRef, setFiltroRef] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('pendente');
  const [filtroMes, setFiltroMes] = useState('');
  const [filtroRapido, setFiltroRapido] = useState('');
  const [filtroFrota, setFiltroFrota] = useState('');
  const [selecionados, setSelecionados] = useState([]);
  const [dataMassa, setDataMassa] = useState('');

  useEffect(() => { carregar(); carregarSelects(); }, []);


  async function carregar() {
    const { data } = await api.get('/solicitacoes');
    setLista(data.solicitacoes);
    const novosIds = new Set(data.solicitacoes.map(s => s.id));
    setSelecionados(prev => prev.filter(id => novosIds.has(id)));
    // Buscar alertas dos motoristas em lotes de 30
    const mIds = [...new Set(data.solicitacoes.map(s => s.motoristaId).filter(Boolean))];
    if (mIds.length) {
      try {
        const LOTE = 30;
        const resultados = {};
        for (let i = 0; i < mIds.length; i += LOTE) {
          const lote = mIds.slice(i, i + LOTE);
          const { data: al } = await api.get('/ferias/alertas-bulk', { params: { ids: lote.join(',') } });
          Object.assign(resultados, al);
        }
        setAlertasMotorista(resultados);
      } catch {}
    }
  }

  async function carregarSelects() {
    try {
      const [m, t, v, r] = await Promise.all([
        api.get('/motoristas'),
        api.get('/tipos/solicitacao'),
        api.get('/tipos/vale'),
        api.get('/tipos/ref'),
      ]);
      setMotoristas(m.data);
      setTipos(t.data);
      setTiposVale(v.data);
      setTiposRef(r.data);
    } catch {}
  }

  async function verificarStatus(motoristaId) {
    if (!motoristaId) { setAlertas({}); setPixMotorista(''); setContaMotorista(''); return; }
    try {
      const { data } = await api.get(`/ferias/ativo/${motoristaId}`);
      setAlertas(data);
    } catch { setAlertas({}); }
    const m = motoristas.find(x => x.id === motoristaId);
    setPixMotorista(m?.pix || '');
    setContaMotorista(m?.conta || '');
  }

  function montarObservacao(formAtual) {
    const vale = tiposVale.find(t => t.id === formAtual.tipoValeId)?.nome || '';
    const tipo = tipos.find(t => t.id === formAtual.tipoId)?.nome || '';
    const ref = tiposRef.find(t => t.id === formAtual.tipoRefId)?.nome || '';
    const nomesTipo = tipo.toLowerCase();
    const saldo = nomesTipo.includes('saldo');
    const usaConta = saldo || nomesTipo.includes('folga');
    const pagamento = usaConta ? 'Dep via Envelope' : (pixMotorista ? `Dep via PIX: ${pixMotorista}` : '');
    const data = formAtual.data ? (() => { const [a,m,d] = formAtual.data.split('-'); return `${d}/${m}`; })() : '';
    const partes = [];
    if (vale) partes.push(vale);
    if (ref) partes.push(`Ref: ${ref}`);
    if (saldo) partes.push(`Solicitado por: ${usuario?.nome || ''}`);
    if (pagamento) partes.push(pagamento);
    if (data) partes.push(data);
    return partes.join(' - ');
  }

  async function salvar(e) {
    e.preventDefault();
    if (salvando) return;
    setSalvando(true);
    try {
      const observacao = montarObservacao(form);
      const { data } = await api.post('/solicitacoes', { ...form, observacao });
      if (data.alertaFerias) toast.error('🏖️ Este motorista está de FÉRIAS!', { duration: 6000 });
      if (data.alertaAtestado) toast.error('🏥 Este motorista está de ATESTADO!', { duration: 6000 });
      if (data.alertaAfastamento) toast.error('⚠️ Este motorista está AFASTADO!', { duration: 6000 });
      if (data.alertaAbandono) toast.error('🚪 Este motorista ABANDONOU o serviço!', { duration: 6000 });
      toast.success('Solicitação criada');
      setForm({...vazio, data: dataHoje()}); setShowForm(false); setAlertas({}); setPixMotorista(''); setContaMotorista(''); carregar();
    } catch {} finally {
      setSalvando(false);
    }
  }

  async function excluir(id) {
    if (!confirm('Excluir esta solicitação?')) return;
    try {
      await api.delete(`/solicitacoes/${id}`);
      toast.success('Solicitação excluída');
      carregar();
    } catch {}
  }

  async function excluirTipo(categoria, id) {
    if (!confirm('Excluir este tipo?')) return;
    try {
      await api.delete(`/tipos/${categoria}/${id}`);
      toast.success('Tipo excluído');
      carregarSelects();
    } catch {}
  }


  async function salvarNovoVale() {
    if (!novoVale.trim()) return;
    const { data } = await api.post('/tipos/vale', { nome: novoVale.toUpperCase() });
    toast.success('Vale adicionado'); setNovoVale(''); setShowNovoVale(false);
    carregarSelects();
    setForm(f => ({ ...f, tipoValeId: data.id }));
  }

  async function salvarNovoRef() {
    if (!novoRef.trim()) return;
    const { data } = await api.post('/tipos/ref', { nome: novoRef.toUpperCase() });
    toast.success('Ref adicionado'); setNovoRef(''); setShowNovoRef(false);
    carregarSelects();
    setForm(f => ({ ...f, tipoRefId: data.id }));
  }

  async function atualizarLiberado(id, liberado) {
    await api.patch(`/solicitacoes/${id}/liberado`, { liberado: parseFloat(liberado) });
    carregar();
  }

  async function marcarPago(id) {
    if (!confirm('Marcar esta solicitação como PAGA?')) return;
    await api.patch(`/solicitacoes/${id}/liberado`, { marcarPago: true });
    toast.success('Marcado como pago!');
    carregar();
  }

  async function atualizarDataPagamento(id, data) {
    await api.patch(`/solicitacoes/${id}/data-pagamento`, { dataPagamento: data || null });
    carregar();
  }

  async function pagarEmMassa() {
    const ids = selecionados.length > 0
      ? listaFiltrada.filter(s => selecionados.includes(s.id)).map(s => s.id)
      : listaFiltrada.map(s => s.id);
    if (!ids.length) return;
    if (!confirm(`Marcar ${ids.length} registro(s) como PAGO?`)) return;
    const { data } = await api.patch('/solicitacoes/pagar-bulk', { ids });
    toast.success(`${data.atualizados} registro(s) marcado(s) como pago!`);
    setSelecionados([]);
    setDataMassa('');
    carregar();
  }

  async function togglePrioridade(id) {
    await api.patch(`/solicitacoes/${id}/prioridade`);
    carregar();
  }

  async function aplicarDataEmMassa(data) {
    if (!data) return;
    const ids = selecionados.length > 0
      ? listaFiltrada.filter(s => selecionados.includes(s.id)).map(s => s.id)
      : listaFiltrada.map(s => s.id);
    if (!ids.length) return;
    const qtd = ids.length;
    if (!confirm(`Aplicar data ${data.split('-').reverse().join('/')} em ${qtd} registro(s)?`)) return;
    await api.patch('/solicitacoes/data-pagamento-bulk', { ids, dataPagamento: data });
    toast.success(`Data aplicada em ${qtd} registro(s)!`);
    carregar();
  }

  function toggleSelecionado(id) {
    setSelecionados(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);
  }

  function toggleTodos() {
    if (selecionados.length === listaFiltrada.length) {
      setSelecionados([]);
    } else {
      setSelecionados(listaFiltrada.map(s => s.id));
    }
  }

  const FILTROS_RAPIDOS = [
    { key:'fluxos', label:'Fluxos Diários', nomes:['fluxo'] },
    { key:'saldos', label:'Saldos', nomes:['saldo'] },
    { key:'folgas', label:'Folgas', nomes:['folga'] },
  ];

  const listaFiltrada = lista.filter(s => {
    if (filtroFrota && s.motorista?.frota !== filtroFrota) return false;
    if (filtroRapido) {
      const nomeAtual = (s.tipo?.nome || '').toLowerCase();
      const fr = FILTROS_RAPIDOS.find(f => f.key === filtroRapido);
      if (fr && !fr.nomes.some(n => nomeAtual.includes(n))) return false;
    }
    if (filtroMotorista && s.motoristaId !== filtroMotorista) return false;
    if (filtroTipo && s.tipoId !== filtroTipo) return false;
    if (filtroVale && s.tipoValeId !== filtroVale) return false;
    if (filtroRef && s.tipoRefId !== filtroRef) return false;
    if (filtroStatus && s.status !== filtroStatus) return false;
    if (filtroMes) {
      const [ano, mes] = filtroMes.split('-').map(Number);
      const d = new Date(s.data);
      if (d.getFullYear() !== ano || d.getMonth() + 1 !== mes) return false;
    }
    return true;
  }).sort((a, b) => (b.prioridade ? 1 : 0) - (a.prioridade ? 1 : 0));

  const base = selecionados.length > 0
    ? listaFiltrada.filter(s => selecionados.includes(s.id))
    : listaFiltrada;

  const totalBase = base.reduce((s, x) => s + Number(x.valor), 0);
  const liberadoBase = base.reduce((s, x) => s + Number(x.liberado || 0), 0);
  const pendenteBase = totalBase - liberadoBase;

  async function exportarExcel() {
    const exportBase = selecionados.length > 0
      ? listaFiltrada.filter(s => selecionados.includes(s.id))
      : listaFiltrada;

    const idsSaldo = [];
    const observacoesFinais = {};
    exportBase.forEach(s => {
      if (ehTipoSaldo(s.tipo?.nome)) {
        let obs = s.observacao || '';
        obs = obs.replace(/ - Realizado por: .*/i, '');
        const dataRef = s.dataPagamento || s.data;
        if (dataRef) {
          const [a,m,d] = dataRef.split('T')[0].split('-');
          obs = obs.replace(/\d{2}\/\d{2}$/, `${d}/${m}`);
        }
        obs = `${obs} - Realizado por: ${usuario?.nome || ''}`;
        observacoesFinais[s.id] = obs;
        idsSaldo.push(s.id);
      } else if (ehTipoFolga(s.tipo?.nome)) {
        let obs = s.observacao || '';
        obs = obs.replace(/ - Realizado por: .*/i, '');
        const dataRef = s.dataPagamento || s.data;
        let dataPart = '';
        if (dataRef) {
          const [a,m,d] = dataRef.split('T')[0].split('-');
          dataPart = ` ${d}/${m}`;
        }
        obs = `${obs} - Realizado por: ${usuario?.nome || ''}${dataPart}`;
        observacoesFinais[s.id] = obs;
        idsSaldo.push(s.id);
      }
    });

    if (idsSaldo.length > 0) {
      try { await api.patch('/solicitacoes/marcar-realizado', { ids: idsSaldo, observacoes: observacoesFinais }); } catch {}
    }

    const temFluxoLbm = exportBase.some(s => ehTipoFluxo(s.tipo?.nome) && s.motorista?.frota === 'lbm');

    const cabecalho = ['Motorista','Liberado','Vale','Placa','Tipo','Banco','Agência','Conta',...(temFluxoLbm ? ['PIX'] : []),'Observação'];

    const toNum = v => parseFloat(String(v).replace(',', '.')) || 0;
    const linhas = exportBase.map(s => {
      const m = motoristas.find(x => x.id === s.motoristaId);
      const liberadoAcum = toNum(s.liberado);
      const liberadoExp = toNum(s.liberadoExportado);
      const delta = liberadoAcum - liberadoExp;
      const liberadoFinal = ehTipoSaldo(s.tipo?.nome)
        ? toNum(s.valor)
        : delta > 0 ? delta : (liberadoAcum > 0 ? liberadoAcum : toNum(s.valor));
      const fluxo = ehTipoFluxo(s.tipo?.nome);
      const ehLbm = s.motorista?.frota === 'lbm';
      return [
        { v: (s.motorista?.nome || '').toUpperCase(), s: estiloCelula },
        { v: liberadoFinal, t: 'n', s: { ...estiloCelula, numFmt: '"R$"\\ #,##0.00' } },
        { v: s.tipoVale?.nome || '', s: estiloCelula },
        { v: s.placa || '', s: estiloCelula },
        { v: s.tipo?.nome || '', s: estiloCelula },
        { v: m?.banco || '', s: estiloCelula },
        { v: m?.agencia || '', s: estiloCelula },
        { v: m?.conta || '', s: estiloCelula },
        ...(temFluxoLbm ? [{ v: (fluxo && ehLbm) ? limparPix(m?.pix) : '', s: estiloCelula }] : []),
        { v: observacoesFinais[s.id] || s.observacao || '', s: estiloCelula },
      ];
    });

    const totalLiberado = linhas.reduce((s, x) => s + Number(x[1].v || 0), 0);
    const totalCols = cabecalho.length;
    linhas.push(Array.from({ length: totalCols }, (_, i) =>
      i === 1
        ? { v: totalLiberado, t: 'n', s: { ...estiloCelula, font: { bold: true }, numFmt: '"R$"\\ #,##0.00' } }
        : { v: '', s: estiloCelula }
    ));

    const ws = XLSX.utils.aoa_to_sheet([
      cabecalho.map(c => ({ v: c, s: estiloCabecalho })),
      ...linhas
    ]);

    const colWidths = [
      { wch: 35 }, { wch: 12 }, { wch: 15 }, { wch: 12 },
      { wch: 15 }, { wch: 12 }, { wch: 10 }, { wch: 12 },
      ...(temFluxoLbm ? [{ wch: 18 }] : []),
      { wch: 60 },
    ];
    ws['!cols'] = colWidths;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Solicitações');
    XLSX.writeFile(wb, `solicitacoes_${new Date().toLocaleDateString('pt-BR').replace(/\//g,'-')}.xlsx`);
    toast.success('Excel exportado!');
    // Marcar liberadoExportado para itens com delta > 0
    const idsParaMarcar = exportBase
      .filter(s => !ehTipoSaldo(s.tipo?.nome) && (toNum(s.liberado) - toNum(s.liberadoExportado)) > 0)
      .map(s => s.id);
    if (idsParaMarcar.length > 0) {
      try { await api.patch('/solicitacoes/marcar-exportado', { ids: idsParaMarcar }); } catch (err) { console.error('marcar-exportado error:', err?.response?.data || err.message); toast.error('Aviso: exportado mas não registrou lote'); }
    }
    if (idsSaldo.length > 0 || idsParaMarcar.length > 0) carregar();
  }

  const fmt = v => `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
  const inp = { width:'100%', padding:'8px 10px', border:'1px solid #d1d5db', borderRadius:8, fontSize:13, boxSizing:'border-box' };
  const lbl = { display:'block', fontSize:11, fontWeight:500, color:'#6b7280', marginBottom:4, textTransform:'uppercase' };
  const btn = (bg, color='#fff') => ({ padding:'8px 16px', background:bg, color, border:'none', borderRadius:8, fontSize:13, fontWeight:500, cursor:'pointer' });
  const previewObs = montarObservacao(form);
  const podeExcluir = isAdminOrFinanceiro;
  const todosSelecionados = selecionados.length === listaFiltrada.length && listaFiltrada.length > 0;
  const ocultarLiberadoPendente = filtroRapido === 'saldos';

  return (
    <div>
      <style>{`
        .sol-table { font-size: 11px; }
        .sol-table th, .sol-table td { padding: 6px 8px; }
      `}</style>

      {historicoSol && (
        <ModalHistoricoSol
          titulo={historicoSol.titulo}
          solicitacaoId={historicoSol.id}
          onClose={() => setHistoricoSol(null)}
        />
      )}
            <div style={{ display:'flex', gap:10, marginBottom:16 }}>
        {FROTAS.map(f => {
         const total = lista.filter(s => s.motorista?.frota === f.key && s.status === 'pendente').length;
          const ativo = filtroFrota === f.key;
          return (
            <button key={f.key} onClick={() => setFiltroFrota(ativo ? '' : f.key)}
              style={{ flex:1, padding:'14px 10px', border:`2px solid ${ativo ? f.cor : '#e5e7eb'}`, borderRadius:12, cursor:'pointer', background: ativo ? f.cor : '#fff', color: ativo ? '#fff' : f.cor, fontWeight:700, fontSize:16, letterSpacing:1, transition:'all 0.15s', display:'flex', flexDirection:'column', alignItems:'center', gap:4 }}>
              {f.label}
              <span style={{ fontSize:11, fontWeight:400, opacity:0.8 }}>{total} solicitação(ões)</span>
            </button>
          );
        })}
      </div>

      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
        <div style={{ display:'flex', alignItems:'center', gap:12, flexWrap:'wrap' }}>
          <h2 style={{ fontSize:20, fontWeight:600, color:'#1a1a2e', margin:0 }}>Solicitações</h2>
          <div style={{ display:'flex', gap:6 }}>
            {FILTROS_RAPIDOS.map(f => (
              <button key={f.key} onClick={() => { setFiltroRapido(filtroRapido === f.key ? '' : f.key); setFiltroTipo(''); }}
                style={{ padding:'4px 12px', border:'1px solid '+(filtroRapido===f.key?'#EB3238':'#d1d5db'), borderRadius:20, fontSize:12, cursor:'pointer', background:filtroRapido===f.key?'#EB3238':'#fff', color:filtroRapido===f.key?'#fff':'#374151', fontWeight:filtroRapido===f.key?500:400 }}>
                {f.label}
              </button>
            ))}
          </div>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={exportarExcel} style={btn('#16a34a')}>⬇ Exportar Excel</button>
          <button onClick={()=>setShowForm(v=>!v)} style={btn('#EB3238')}>+ Incluir solicitação</button>
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12, marginBottom:16 }}>
        {[
          ['Total solicitado', totalBase, '#1a1a2e'],
          ['Total liberado', liberadoBase, '#16a34a'],
          ['Pendente', pendenteBase, '#d97706']
        ].map(([l,v,c])=>(
          <div key={l} style={{ background:'#fff', borderRadius:12, padding:'14px 18px', border:'1px solid #e5e7eb' }}>
            <div style={{ fontSize:11, color:'#6b7280', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:6 }}>
              {l} {selecionados.length > 0 && <span style={{ color:'#EB3238', fontSize:10 }}>({selecionados.length} selecionados)</span>}
            </div>
            <div style={{ fontSize:22, fontWeight:600, color:c }}>{fmt(v||0)}</div>
          </div>
        ))}
      </div>

      {showForm && (
        <div style={{ background:'#fff', borderRadius:12, padding:20, marginBottom:16, border:'1px solid #e5e7eb' }}>
          <form onSubmit={salvar}>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              <div>
                <label style={lbl}>Solicitante</label>
                <input value={usuario?.nome} readOnly style={{ ...inp, background:'#f9fafb' }}/>
              </div>
              <div>
                <label style={lbl}>Data</label>
                <input type="date" value={form.data} onChange={e=>setForm(f=>({...f,data:e.target.value}))} style={inp}/>
              </div>
              <div>
                <label style={lbl}>Tipo</label>
                <div style={{ display:'flex', gap:8 }}>
                  <select value={form.tipoId} onChange={e=>setForm(f=>({...f,tipoId:e.target.value}))} required style={{ flex:1, padding:'8px 10px', border:'1px solid #d1d5db', borderRadius:8, fontSize:13 }}>
                    <option value="">Selecionar...</option>
                    {tipos.filter(t => /fluxo|saldo|folga/i.test(t.nome)).map(t=><option key={t.id} value={t.id}>{t.nome}</option>)}
                  </select>
                </div>

              </div>
              <div>
                <label style={lbl}>Motorista</label>
                <select value={form.motoristaId} onChange={e=>{ setForm(f=>({...f,motoristaId:e.target.value})); verificarStatus(e.target.value); }} required style={{ width:'100%', padding:'8px 10px', border:'1px solid #d1d5db', borderRadius:8, fontSize:13 }}>
                  <option value="">Selecionar...</option>
                  {motoristas.map(m=><option key={m.id} value={m.id}>{m.nome}</option>)}
                </select>
                {pixMotorista && <p style={{ fontSize:11, color:'#6b7280', marginTop:4 }}>PIX: {pixMotorista}</p>}
                {contaMotorista && <p style={{ fontSize:11, color:'#6b7280', marginTop:2 }}>Conta: {contaMotorista}</p>}
              </div>

              {alertas.emFerias && <div style={{ gridColumn:'1/-1', padding:'10px 14px', background:'#ede9fe', borderRadius:8, fontSize:13, color:'#6d28d9', fontWeight:500 }}>🏖️ Este motorista está de FÉRIAS!</div>}
              {alertas.emAtestado && <div style={{ gridColumn:'1/-1', padding:'10px 14px', background:'#fef3c7', borderRadius:8, fontSize:13, color:'#92400e', fontWeight:500 }}>🏥 Este motorista está de ATESTADO!</div>}
              {alertas.emAfastamento && <div style={{ gridColumn:'1/-1', padding:'10px 14px', background:'#fee2e2', borderRadius:8, fontSize:13, color:'#991b1b', fontWeight:500 }}>⚠️ Este motorista está AFASTADO!</div>}
              {alertas.abandonou && <div style={{ gridColumn:'1/-1', padding:'10px 14px', background:'#fef2f2', borderRadius:8, fontSize:13, color:'#7f1d1d', fontWeight:500 }}>🚪 Este motorista ABANDONOU o serviço!</div>}

              <div>
                <label style={lbl}>Vale</label>
                <div style={{ display:'flex', gap:8 }}>
                  <select value={form.tipoValeId} onChange={e=>setForm(f=>({...f,tipoValeId:e.target.value}))} required style={{ flex:1, padding:'8px 10px', border:'1px solid #d1d5db', borderRadius:8, fontSize:13 }}>
                    <option value="">Selecionar...</option>
                    {tiposVale.map(t=><option key={t.id} value={t.id}>{t.nome}</option>)}
                  </select>
                  <button type="button" onClick={()=>setShowNovoVale(v=>!v)} style={{ padding:'8px 10px', border:'1px solid #d1d5db', borderRadius:8, fontSize:12, cursor:'pointer', background:'#fff' }}>+ Novo</button>
                </div>
                {showNovoVale && (
                  <>
                    <div style={{ display:'flex', gap:8, marginTop:8 }}>
                      <input value={novoVale} onChange={e=>setNovoVale(e.target.value)} placeholder="Nome do vale" style={{ flex:1, padding:'6px 10px', border:'1px solid #d1d5db', borderRadius:8, fontSize:13 }}/>
                      <button type="button" onClick={salvarNovoVale} style={{ padding:'6px 12px', background:'#EB3238', color:'#fff', border:'none', borderRadius:8, fontSize:13, cursor:'pointer' }}>Salvar</button>
                    </div>
                    <div style={{ marginTop:8, display:'flex', flexWrap:'wrap', gap:6 }}>
                      {tiposVale.map(t => (
                        <span key={t.id} style={{ display:'flex', alignItems:'center', gap:4, background:'#f3f4f6', borderRadius:20, padding:'3px 10px', fontSize:12 }}>
                          {t.nome}
                          <button type="button" onClick={()=>excluirTipo('vale', t.id)} style={{ background:'none', border:'none', cursor:'pointer', color:'#EB3238', fontSize:14, lineHeight:1, padding:0 }}>×</button>
                        </span>
                      ))}
                    </div>
                  </>
                )}
              </div>

              <div>
                <label style={lbl}>Ref</label>
                <div style={{ display:'flex', gap:8 }}>
                  <select value={form.tipoRefId} onChange={e=>setForm(f=>({...f,tipoRefId:e.target.value}))} required style={{ flex:1, padding:'8px 10px', border:'1px solid #d1d5db', borderRadius:8, fontSize:13 }}>
                    <option value="">Selecionar...</option>
                    {tiposRef.map(t=><option key={t.id} value={t.id}>{t.nome}</option>)}
                  </select>
                  <button type="button" onClick={()=>setShowNovoRef(v=>!v)} style={{ padding:'8px 10px', border:'1px solid #d1d5db', borderRadius:8, fontSize:12, cursor:'pointer', background:'#fff' }}>+ Novo</button>
                </div>
                {showNovoRef && (
                  <>
                    <div style={{ display:'flex', gap:8, marginTop:8 }}>
                      <input value={novoRef} onChange={e=>setNovoRef(e.target.value)} placeholder="Nome da ref" style={{ flex:1, padding:'6px 10px', border:'1px solid #d1d5db', borderRadius:8, fontSize:13 }}/>
                      <button type="button" onClick={salvarNovoRef} style={{ padding:'6px 12px', background:'#EB3238', color:'#fff', border:'none', borderRadius:8, fontSize:13, cursor:'pointer' }}>Salvar</button>
                    </div>
                    <div style={{ marginTop:8, display:'flex', flexWrap:'wrap', gap:6 }}>
                      {tiposRef.map(t => (
                        <span key={t.id} style={{ display:'flex', alignItems:'center', gap:4, background:'#f3f4f6', borderRadius:20, padding:'3px 10px', fontSize:12 }}>
                          {t.nome}
                          <button type="button" onClick={()=>excluirTipo('ref', t.id)} style={{ background:'none', border:'none', cursor:'pointer', color:'#EB3238', fontSize:14, lineHeight:1, padding:0 }}>×</button>
                        </span>
                      ))}
                    </div>
                  </>
                )}
              </div>

              <div>
                <label style={lbl}>Placa</label>
                <input value={form.placa} onChange={e=>setForm(f=>({...f,placa:e.target.value.toUpperCase()}))} placeholder="ABC-1234" required style={inp}/>
              </div>
              <div>
                <label style={lbl}>Valor (R$)</label>
                <input type="number" value={form.valor} onChange={e=>setForm(f=>({...f,valor:e.target.value}))} required placeholder="0.00" style={inp}/>
              </div>

              {previewObs && (
                <div style={{ gridColumn:'1/-1', padding:'10px 14px', background:'#f9fafb', borderRadius:8, fontSize:12, color:'#6b7280', border:'1px solid #e5e7eb' }}>
                  <span style={{ fontWeight:500, color:'#374151' }}>Observação: </span>{previewObs}
                </div>
              )}
            </div>
            <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:16 }}>
              <button type="button" onClick={()=>{ setShowForm(false); setAlertas({}); setPixMotorista(''); setContaMotorista(''); }} style={btn('#e5e7eb','#374151')}>Cancelar</button>
              <button type="submit" disabled={salvando} style={{...btn('#EB3238'), opacity: salvando ? 0.6 : 1, cursor: salvando ? 'not-allowed' : 'pointer'}}>{salvando ? 'Salvando...' : 'Salvar'}</button>
            </div>
          </form>
        </div>
      )}

      <div style={{ background:'#fff', borderRadius:12, border:'1px solid #e5e7eb', padding:'12px 16px', marginBottom:12, display:'flex', gap:10, flexWrap:'wrap', alignItems:'flex-end' }}>
        <div>
          <label style={lbl}>Motorista</label>
          <select value={filtroMotorista} onChange={e=>setFiltroMotorista(e.target.value)} style={{ padding:'7px 10px', border:'1px solid #d1d5db', borderRadius:8, fontSize:13 }}>
            <option value="">Todos</option>
            {motoristas.map(m=><option key={m.id} value={m.id}>{m.nome}</option>)}
          </select>
        </div>
        <div>
          <label style={lbl}>Tipo</label>
          <select value={filtroTipo} onChange={e => {
              const id = e.target.value;
              setFiltroTipo(id);
              if (!id) { setFiltroRapido(''); return; }
              const nome = (tipos.find(t => t.id === id)?.nome || '').toLowerCase();
              if (nome.includes('saldo')) setFiltroRapido('saldos');
              else if (nome.includes('folga')) setFiltroRapido('folgas');
              else setFiltroRapido('fluxos');
            }} style={{ padding:'7px 10px', border:'1px solid #d1d5db', borderRadius:8, fontSize:13 }}>
            <option value="">Todos</option>
            {tipos.map(t=><option key={t.id} value={t.id}>{t.nome}</option>)}
          </select>
        </div>
        <div>
          <label style={lbl}>Vale</label>
          <select value={filtroVale} onChange={e=>setFiltroVale(e.target.value)} style={{ padding:'7px 10px', border:'1px solid #d1d5db', borderRadius:8, fontSize:13 }}>
            <option value="">Todos</option>
            {tiposVale.map(t=><option key={t.id} value={t.id}>{t.nome}</option>)}
          </select>
        </div>
        <div>
          <label style={lbl}>Ref</label>
          <select value={filtroRef} onChange={e=>setFiltroRef(e.target.value)} style={{ padding:'7px 10px', border:'1px solid #d1d5db', borderRadius:8, fontSize:13 }}>
            <option value="">Todos</option>
            {tiposRef.map(t=><option key={t.id} value={t.id}>{t.nome}</option>)}
          </select>
        </div>
        <div>
          <label style={lbl}>Status</label>
          <select value={filtroStatus} onChange={e=>setFiltroStatus(e.target.value)} style={{ padding:'7px 10px', border:'1px solid #d1d5db', borderRadius:8, fontSize:13 }}>
            <option value="">Todos</option>
            <option value="pendente">Pendente</option>
            <option value="pago">Pago</option>
          </select>
        </div>
        <div>
          <label style={lbl}>Mês</label>
          <input type="month" value={filtroMes} onChange={e=>setFiltroMes(e.target.value)} style={{ padding:'7px 10px', border:'1px solid #d1d5db', borderRadius:8, fontSize:13 }}/>
        </div>
        <button onClick={()=>{ setFiltroMotorista(''); setFiltroTipo(''); setFiltroVale(''); setFiltroRef(''); setFiltroStatus(''); setFiltroMes(''); setFiltroRapido(''); setFiltroFrota(''); setSelecionados([]); }}
          style={{ padding:'7px 14px', border:'1px solid #d1d5db', borderRadius:8, fontSize:13, cursor:'pointer', background:'#fff', color:'#6b7280' }}>
          Limpar
        </button>
        <span style={{ fontSize:12, color:'#6b7280', alignSelf:'center' }}>{listaFiltrada.length} registro(s)</span>
        {selecionados.length > 0 && (
          <button onClick={()=>setSelecionados([])} style={{ padding:'7px 14px', border:'1px solid #EB3238', borderRadius:8, fontSize:13, cursor:'pointer', background:'#fff', color:'#EB3238' }}>
            Limpar seleção ({selecionados.length})
          </button>
        )}
        <div style={{ display:'flex', alignItems:'center', gap:8, marginLeft:'auto', flexWrap:'wrap' }}>
          <span style={{ fontSize:12, color:'#6b7280', whiteSpace:'nowrap' }}>
            {selecionados.length > 0 ? `${selecionados.length} selecionados` : 'Todos filtrados'}:
          </span>
          <input type="date"
            value={dataMassa}
            onChange={e => { setDataMassa(e.target.value); aplicarDataEmMassa(e.target.value); }}
            title="Aplicar data de pagamento"
            style={{ padding:'6px 10px', border:'1px solid #d1d5db', borderRadius:8, fontSize:13 }}/>
          {isAdminOrFinanceiro && (
            <button onClick={pagarEmMassa} style={{ padding:'6px 14px', background:'#16a34a', color:'#fff', border:'none', borderRadius:8, fontSize:13, fontWeight:500, cursor:'pointer' }}>
              ✓ Pagar
            </button>
          )}
        </div>
      </div>

      <div style={{ background:'#fff', borderRadius:12, border:'1px solid #e5e7eb', overflow:'hidden' }}>
        <StickyScrollTable deps={[lista]}>
          <table className="sol-table" style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
            <thead>
              <tr style={{ background:'#f9fafb' }}>
                <th style={{ padding:'10px 14px', borderBottom:'1px solid #e5e7eb', width:40 }}>
                  <input type="checkbox" checked={todosSelecionados} onChange={toggleTodos} style={{ accentColor:'#EB3238', width:16, height:16, cursor:'pointer' }}/>
                </th>
                {['Motorista','Frota','Tipo','Vale','Ref','Placa','Valor',...(ocultarLiberadoPendente?[]:['Liberado','Pendente']),'Dt Solicitação','Dt Pagamento','Status','Ações',...(isAdminOrFinanceiro?['Alteração']:[])].map(h=>(
                  <th key={h} className={h==='Vale'?'sol-col-vale':h==='Ref'?'sol-col-ref':h==='Placa'?'sol-col-placa':h==='Dt Solicitação'?'sol-col-dtsol':h==='Alteração'?'sol-col-alter':''} style={{ padding:'10px 14px', textAlign:'left', fontSize:11, fontWeight:600, color:'#6b7280', textTransform:'uppercase', borderBottom:'1px solid #e5e7eb', whiteSpace:'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {listaFiltrada.map(s=>{
                const frota = FROTAS.find(f => f.key === s.motorista?.frota);
                const sel = selecionados.includes(s.id);
                const saldo = ehTipoSaldo(s.tipo?.nome);
                return (
                  <tr key={s.id} style={{ borderBottom:'1px solid #f3f4f6', background: sel ? '#fff8f8' : s.prioridade ? '#fef9c3' : '#fff', borderLeft: s.prioridade ? '4px solid #f59e0b' : '4px solid transparent' }}>
                    <td style={{ padding:'10px 14px' }}>
                      <input type="checkbox" checked={sel} onChange={()=>toggleSelecionado(s.id)} style={{ accentColor:'#EB3238', width:16, height:16, cursor:'pointer' }}/>
                    </td>
                    <td style={{ padding:'10px 14px', fontWeight:500 }}>
                      <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
                        {s.motorista?.nome}
                        {alertasMotorista[s.motoristaId]?.emFerias && <span style={{ fontSize:10, padding:'1px 6px', background:'#ede9fe', color:'#6d28d9', borderRadius:20, fontWeight:500, width:'fit-content' }}>🏖️ Férias</span>}
                        {alertasMotorista[s.motoristaId]?.emAtestado && <span style={{ fontSize:10, padding:'1px 6px', background:'#fef3c7', color:'#92400e', borderRadius:20, fontWeight:500, width:'fit-content' }}>🏥 Atestado</span>}
                        {alertasMotorista[s.motoristaId]?.emAfastamento && <span style={{ fontSize:10, padding:'1px 6px', background:'#fee2e2', color:'#991b1b', borderRadius:20, fontWeight:500, width:'fit-content' }}>⚠️ Afastado</span>}
                        {alertasMotorista[s.motoristaId]?.abandonou && <span style={{ fontSize:10, padding:'1px 6px', background:'#fef2f2', color:'#7f1d1d', borderRadius:20, fontWeight:500, width:'fit-content' }}>🚪 Abandono</span>}
                      </div>
                    </td>
                    <td style={{ padding:'10px 14px' }}>
                      {frota && <span style={{ padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:600, background:frota.bg, color:frota.cor }}>{frota.label}</span>}
                    </td>
                    <td style={{ padding:'10px 14px', color:'#6b7280' }}>{s.tipo?.nome}</td>
                    <td className="sol-col-vale" style={{ padding:'10px 14px', color:'#6b7280' }}>{s.tipoVale?.nome || '—'}</td>
                    <td className="sol-col-ref" style={{ padding:'10px 14px', color:'#6b7280' }}>{s.tipoRef?.nome || '—'}</td>
                    <td className="sol-col-placa" style={{ padding:'10px 14px', color:'#6b7280' }}>{s.placa||'—'}</td>
                    <td style={{ padding:'10px 14px' }}>{fmt(s.valor)}</td>
                    {!ocultarLiberadoPendente && (
  <>
    <td style={{ padding:'10px 14px' }}>
      {saldo ? (
        '—'
      ) : isAdminOrFinanceiro && s.status !== 'pago' ? (
        <div style={{ display:'flex', flexDirection:'column', gap:2 }}>
          <span style={{ fontSize:12, color:'#6b7280' }}>{fmt(s.liberado||0)}</span>
          <input type="number" placeholder="+ valor" onBlur={e=>{ if(e.target.value) { atualizarLiberado(s.id,e.target.value); e.target.value=''; }}}
            style={{ width:80, padding:'4px 6px', border:'1px solid #d1d5db', borderRadius:6, fontSize:12 }}/>
        </div>
      ) : fmt(s.liberado||0)}
    </td>
    <td style={{ padding:'10px 14px', fontWeight:500, color:'#d97706' }}>
      {saldo ? '—' : fmt(Math.max(0, Number(s.valor) - Number(s.liberado||0)))}
    </td>
  </>
)}
                    <td className="sol-col-dtsol" style={{ padding:'10px 14px', fontSize:12, color:'#6b7280', whiteSpace:'nowrap' }}>{s.data ? s.data.split('T')[0].split('-').reverse().join('/') : '—'}</td>
                    <td style={{ padding:'10px 14px', fontSize:12, color:'#6b7280', whiteSpace:'nowrap' }}>{s.dataPagamento ? s.dataPagamento.split('T')[0].split('-').reverse().join('/') : '—'}</td>
                    <td style={{ padding:'10px 14px' }}>
                      <span style={{ padding:'3px 10px', borderRadius:20, fontSize:11, fontWeight:500, background:s.status==='pago'?'#dcfce7':'#fef3c7', color:s.status==='pago'?'#166534':'#92400e' }}>{s.status}</span>
                    </td>
                    <td style={{ padding:'10px 14px', display:'flex', gap:6, alignItems:'center' }}>
                      <button onClick={()=>togglePrioridade(s.id)} title={s.prioridade ? 'Remover prioridade' : 'Marcar como prioritário'}
                        style={{ padding:'4px 8px', border:'1px solid '+(s.prioridade?'#f59e0b':'#d1d5db'), borderRadius:6, fontSize:13, cursor:'pointer', background:s.prioridade?'#fef3c7':'#fff', color:s.prioridade?'#92400e':'#9ca3af' }}>
                        {s.prioridade ? '⚡' : '⚡'}
                      </button>
                      {podeExcluir && (
                        <button onClick={()=>excluir(s.id)} style={{ padding:'4px 12px', border:'1px solid #EB3238', borderRadius:6, fontSize:12, cursor:'pointer', background:'#fff', color:'#EB3238' }}>
                          Excluir
                        </button>
                      )}
                    </td>
                    {isAdminOrFinanceiro && (
                      <td style={{ padding:'10px 14px', fontSize:11, color:'#9ca3af', whiteSpace:'nowrap' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                          <span>{s.auditorias?.[0]?`${s.auditorias[0].acao} — ${s.auditorias[0].usuario.nome} — ${new Date(s.auditorias[0].criadoEm).toLocaleString('pt-BR')}`:'—'}</span>
                          <button onClick={()=>setHistoricoSol({ id:s.id, titulo:`${s.motorista?.nome||''} — ${s.tipo?.nome||''}` })}
                            style={{ padding:'2px 8px', border:'1px solid #d1d5db', borderRadius:6, fontSize:11, cursor:'pointer', background:'#f9fafb', color:'#6b7280', whiteSpace:'nowrap' }}>
                            Ver mais
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
              {listaFiltrada.length===0 && <tr><td colSpan={14} style={{ padding:40, textAlign:'center', color:'#9ca3af' }}>Nenhuma solicitação encontrada</td></tr>}
            </tbody>
          </table>
        </StickyScrollTable>
      </div>
    </div>
  );
}
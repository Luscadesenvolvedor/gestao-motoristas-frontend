import { useState, useEffect, useMemo, useRef } from 'react';
import api from '../../services/api';
import toast from 'react-hot-toast';

const fmt       = v => `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
const fmtData   = d => d ? new Date(d.slice(0,10) + 'T12:00:00').toLocaleDateString('pt-BR') : '—';
const hoje      = () => { const d = new Date(); d.setHours(0,0,0,0); return d; };
const emDias    = d => d ? Math.ceil((new Date(d.slice(0,10) + 'T12:00:00') - hoje()) / 86400000) : null;
const dataHoje  = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
// Aceita formatos BR ("1.500,00") e EN ("1500.00")
const parseMoeda = v => parseFloat(String(v||'').trim().replace(/\./g,'').replace(',','.'));

const STATUS = {
  pendente: { bg:'#fef9c3', cor:'#854d0e', label:'Pendente' },
  vencido:  { bg:'#fee2e2', cor:'#991b1b', label:'Vencido'  },
  pago:     { bg:'#dcfce7', cor:'#166534', label:'Pago'     },
};

const TIPOS = [
  { val:'lavagem',        label:'Lavagem',        icone:'ti-wash',    cor:'#0891b2', bg:'#f0f9ff' },
  { val:'estacionamento', label:'Estacionamento', icone:'ti-parking', cor:'#7c3aed', bg:'#f5f3ff' },
];

function mascaraCNPJ(v) {
  return v.replace(/\D/g,'').slice(0,14)
    .replace(/^(\d{2})(\d)/,'$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/,'$1.$2.$3')
    .replace(/\.(\d{3})(\d)/,'.$1/$2')
    .replace(/(\d{4})(\d)/,'$1-$2');
}

function fileParaBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = e => resolve(e.target.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ── Upload de arquivo com preview do nome ──
function UploadArquivo({ nome, onSelect, label, accept = '.pdf,.jpg,.jpeg,.png' }) {
  const ref = useRef();
  return (
    <div>
      <input ref={ref} type="file" accept={accept} style={{ display:'none' }} onChange={onSelect} />
      {nome ? (
        <div style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 14px', border:'1px solid #bbf7d0', borderRadius:9, background:'#f0fdf4' }}>
          <i className="ti ti-file-check" style={{ fontSize:18, color:'#16a34a' }}></i>
          <span style={{ flex:1, fontSize:13, color:'#166534', fontWeight:500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{nome}</span>
          <button type="button" onClick={() => ref.current.click()}
            style={{ padding:'3px 10px', border:'1px solid #16a34a', borderRadius:6, background:'#fff', fontSize:11, cursor:'pointer', color:'#16a34a', flexShrink:0 }}>
            Trocar
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => ref.current.click()}
          style={{ width:'100%', padding:'22px 0', border:'2px dashed #d1d5db', borderRadius:9, background:'#f9fafb', cursor:'pointer', display:'flex', flexDirection:'column', alignItems:'center', gap:6 }}>
          <i className="ti ti-cloud-upload" style={{ fontSize:28, color:'#9ca3af' }}></i>
          <span style={{ fontSize:13, color:'#6b7280', fontWeight:500 }}>{label}</span>
          <span style={{ fontSize:11, color:'#9ca3af' }}>PDF, JPEG ou PNG</span>
        </button>
      )}
    </div>
  );
}

// ── Indicador de etapas ──
function Etapas({ atual }) {
  const etapas = ['Dados do Fornecedor', 'Fatura e Documentos'];
  return (
    <div style={{ display:'flex', alignItems:'center', gap:0, marginBottom:24 }}>
      {etapas.map((label, i) => {
        const n = i + 1;
        const ativo    = n === atual;
        const concluido = n < atual;
        return (
          <div key={n} style={{ display:'flex', alignItems:'center', flex: i < etapas.length-1 ? 1 : 'none' }}>
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:4 }}>
              <div style={{
                width:30, height:30, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center',
                background: concluido ? '#16a34a' : ativo ? '#EB3238' : '#e5e7eb',
                color: (concluido || ativo) ? '#fff' : '#9ca3af', fontWeight:700, fontSize:13,
              }}>
                {concluido ? <i className="ti ti-check" style={{ fontSize:14 }}></i> : n}
              </div>
              <span style={{ fontSize:11, fontWeight: ativo ? 600 : 400, color: ativo ? '#EB3238' : concluido ? '#16a34a' : '#9ca3af', whiteSpace:'nowrap' }}>{label}</span>
            </div>
            {i < etapas.length-1 && (
              <div style={{ flex:1, height:2, background: concluido ? '#16a34a' : '#e5e7eb', margin:'0 10px', marginBottom:18 }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

const vazioStep1 = { razaoSocial:'', cnpj:'', responsavel:'', contato:'', numeroOC:'', tipoServico:'lavagem', frota:'buzin', formaPagamento:'pix', chavePix:'' };
const vazioStep2 = { valor:'', dataVencimento:'', observacao:'', arquivoNome:null, arquivoBase64:null, arquivoTipo:null };

export default function Faturas() {
  const [faturas, setFaturas]       = useState([]);
  const [loading, setLoading]       = useState(true);
  const [expandidos, setExpandidos] = useState({});
  const [showModal, setShowModal]   = useState(false);
  const [etapa, setEtapa]           = useState(1);
  const [step1, setStep1]           = useState(vazioStep1);
  const [step2, setStep2]           = useState(vazioStep2);
  const [nfsTemp, setNfsTemp]       = useState([]); // NFs antes de salvar
  const [salvando, setSalvando]     = useState(false);
  const [filtroStatus, setFiltroStatus] = useState('todos');
  const [filtroTipo, setFiltroTipo] = useState('todos');
  const [showPagarId, setShowPagarId] = useState(null);
  const [dataPagamento, setDataPagamento] = useState(dataHoje());
  // Adicionar NF a fatura existente
  const [nfFaturaId, setNfFaturaId] = useState(null);
  const [nfForm, setNfForm]         = useState({ numero:'', valor:'', arquivoNome:null, arquivoBase64:null, arquivoTipo:null });
  const [salvandoNF, setSalvandoNF] = useState(false);

  useEffect(() => { carregar(); }, []);

  async function carregar() {
    setLoading(true);
    try {
      const { data } = await api.get('/faturas-abastecimento');
      setFaturas(data);
    } catch { toast.error('Erro ao carregar faturas'); }
    finally { setLoading(false); }
  }

  function abrirNovo() {
    setStep1(vazioStep1); setStep2(vazioStep2); setNfsTemp([]);
    setEtapa(1); setShowModal(true);
  }

  function fecharModal() { setShowModal(false); }

  // ── Etapa 1 → 2 ──
  function avancar(e) {
    e.preventDefault();
    setEtapa(2);
  }

  // ── Upload fatura ──
  async function onArquivoFatura(e) {
    const file = e.target.files[0]; if (!file) return;
    const b64 = await fileParaBase64(file);
    setStep2(s => ({ ...s, arquivoNome: file.name, arquivoBase64: b64, arquivoTipo: file.type }));
  }

  // ── NFs temporárias (antes de criar a fatura) ──
  async function onArquivoNFTemp(e, idx) {
    const file = e.target.files[0]; if (!file) return;
    const b64 = await fileParaBase64(file);
    setNfsTemp(prev => prev.map((nf, i) => i === idx ? { ...nf, arquivoNome: file.name, arquivoBase64: b64, arquivoTipo: file.type } : nf));
  }

  function adicionarNFTemp() {
    setNfsTemp(prev => [...prev, { numero:'', valor:'', arquivoNome:null, arquivoBase64:null, arquivoTipo:null }]);
  }

  function removerNFTemp(idx) {
    setNfsTemp(prev => prev.filter((_,i) => i !== idx));
  }

  // ── Criar fatura ──
  async function criar(e) {
    e.preventDefault();
    if (salvando) return;

    if (!step2.dataVencimento) { toast.error('Informe a data de vencimento'); return; }

    const valorNum = parseMoeda(step2.valor);
    if (!step2.valor || isNaN(valorNum) || valorNum <= 0) {
      toast.error(`Valor inválido: "${step2.valor}" — use formato 1500 ou 1500,00`);
      return;
    }

    const payload = {
      fornecedorData: { ...step1, cnpj: step1.cnpj.replace(/\D/g,'') },
      valor: valorNum,
      dataVencimento: step2.dataVencimento,
      observacao: step2.observacao || null,
      arquivoNome:   step2.arquivoNome   || null,
      arquivoBase64: step2.arquivoBase64 || null,
      arquivoTipo:   step2.arquivoTipo   || null,
    };
    console.log('[Faturas] enviando payload:', { ...payload, arquivoBase64: payload.arquivoBase64 ? '[base64]' : null });

    setSalvando(true);
    try {
      const { data: fatura } = await api.post('/faturas-abastecimento', payload);
      // Cria as NFs vinculadas
      for (const nf of nfsTemp) {
        if (!nf.numero && !nf.valor) continue;
        await api.post(`/faturas-abastecimento/${fatura.id}/nfs`, {
          numero: nf.numero || 'S/N',
          valor: parseMoeda(nf.valor) || 0,
          arquivoNome:   nf.arquivoNome   || null,
          arquivoBase64: nf.arquivoBase64 || null,
          arquivoTipo:   nf.arquivoTipo   || null,
        });
      }
      toast.success('Fatura criada com sucesso');
      fecharModal(); carregar();
    } catch (err) {
      // interceptor já exibe o toast para erros HTTP; só exibe aqui se não tiver resposta
      if (!err?.response) toast.error('Erro ao criar fatura — verifique a conexão');
    } finally { setSalvando(false); }
  }

  // ── Pagar ──
  async function pagar() {
    try {
      await api.patch(`/faturas-abastecimento/${showPagarId}/pagar`, { dataPagamento });
      toast.success('Marcada como paga'); setShowPagarId(null); carregar();
    } catch { toast.error('Erro ao marcar como pago'); }
  }

  async function reabrir(id) {
    try { await api.patch(`/faturas-abastecimento/${id}/reabrir`); toast.success('Reaberta'); carregar(); }
    catch { toast.error('Erro ao reabrir'); }
  }

  async function excluir(id) {
    if (!confirm('Excluir esta fatura e todas as suas NFs?')) return;
    try { await api.delete(`/faturas-abastecimento/${id}`); toast.success('Excluída'); carregar(); }
    catch { toast.error('Erro ao excluir'); }
  }

  // ── Adicionar NF a fatura existente ──
  async function salvarNF(e) {
    e.preventDefault();
    if (salvandoNF) return;
    setSalvandoNF(true);
    try {
      await api.post(`/faturas-abastecimento/${nfFaturaId}/nfs`, {
        ...nfForm, valor: parseMoeda(nfForm.valor) || 0
      });
      toast.success('NF adicionada');
      setNfFaturaId(null);
      setNfForm({ numero:'', valor:'', arquivoNome:null, arquivoBase64:null, arquivoTipo:null });
      carregar();
    } catch { toast.error('Erro ao adicionar NF'); } finally { setSalvandoNF(false); }
  }

  async function excluirNF(faturaId, nfId) {
    if (!confirm('Excluir esta NF?')) return;
    try { await api.delete(`/faturas-abastecimento/${faturaId}/nfs/${nfId}`); toast.success('NF excluída'); carregar(); }
    catch { toast.error('Erro ao excluir NF'); }
  }

  async function onArquivoNFExistente(e) {
    const file = e.target.files[0]; if (!file) return;
    const b64 = await fileParaBase64(file);
    setNfForm(f => ({ ...f, arquivoNome: file.name, arquivoBase64: b64, arquivoTipo: file.type }));
  }

  // ── Filtros ──
  const listaFiltrada = useMemo(() => faturas.filter(f => {
    if (filtroStatus !== 'todos' && f.status !== filtroStatus) return false;
    if (filtroTipo !== 'todos' && f.fornecedor?.tipoServico !== filtroTipo) return false;
    return true;
  }), [faturas, filtroStatus, filtroTipo]);

  const totalFaturas  = listaFiltrada.reduce((s,f) => s + Number(f.valor), 0);
  const totalNFs      = listaFiltrada.reduce((s,f) => s + (f.notasFiscais||[]).reduce((ss,nf) => ss + Number(nf.valor), 0), 0);
  const totalPendente = listaFiltrada.filter(f => f.status !== 'pago').reduce((s,f) => s + Number(f.valor), 0);
  const totalPago     = listaFiltrada.filter(f => f.status === 'pago').reduce((s,f) => s + Number(f.valor), 0);

  const inp = { width:'100%', padding:'9px 12px', border:'1px solid #d1d5db', borderRadius:8, fontSize:13, outline:'none', boxSizing:'border-box' };
  const lbl = { fontSize:12, fontWeight:600, color:'#374151', display:'block', marginBottom:5 };

  return (
    <div>
      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <div>
          <h2 style={{ fontSize:20, fontWeight:600, color:'#1a1a2e', margin:0 }}>Faturas</h2>
          <p style={{ fontSize:13, color:'#6b7280', marginTop:2 }}>Controle de faturas e notas fiscais</p>
        </div>
        <button onClick={abrirNovo}
          style={{ display:'flex', alignItems:'center', gap:6, padding:'9px 20px', background:'#EB3238', color:'#fff', border:'none', borderRadius:9, fontSize:13, fontWeight:500, cursor:'pointer' }}>
          <i className="ti ti-plus" style={{ fontSize:16 }}></i> Nova Fatura
        </button>
      </div>

      {/* Cards */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:18 }}>
        {[
          { label:'Soma Faturas',   valor:totalFaturas,  cor:'#1a1a2e', icone:'ti-file-invoice', bg:'#f8fafc' },
          { label:'Soma NFs',       valor:totalNFs,      cor:'#0891b2', icone:'ti-receipt',       bg:'#f0f9ff' },
          { label:'Total Pendente', valor:totalPendente, cor:'#d97706', icone:'ti-clock',         bg:'#fffbeb' },
          { label:'Total Pago',     valor:totalPago,     cor:'#16a34a', icone:'ti-circle-check',  bg:'#f0fdf4' },
        ].map(c => (
          <div key={c.label} style={{ background:c.bg, border:`1px solid ${c.cor}22`, borderRadius:12, padding:'16px 18px' }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
              <i className={`ti ${c.icone}`} style={{ fontSize:16, color:c.cor }}></i>
              <span style={{ fontSize:11, fontWeight:600, color:'#6b7280', textTransform:'uppercase', letterSpacing:'0.4px' }}>{c.label}</span>
            </div>
            <div style={{ fontSize:20, fontWeight:700, color:c.cor }}>{fmt(c.valor)}</div>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div style={{ background:'#fff', border:'1px solid #e5e7eb', borderRadius:10, padding:'10px 14px', marginBottom:14, display:'flex', gap:10, alignItems:'center', flexWrap:'wrap' }}>
        <span style={{ fontSize:12, color:'#6b7280', fontWeight:500 }}>Serviço:</span>
        {['todos','lavagem','estacionamento'].map(t => {
          const tp = TIPOS.find(x => x.val === t);
          return (
            <button key={t} onClick={() => setFiltroTipo(t)}
              style={{ padding:'4px 14px', borderRadius:20, border:`1px solid ${filtroTipo===t ? '#EB3238' : '#d1d5db'}`,
                background: filtroTipo===t ? '#EB3238' : '#fff', color: filtroTipo===t ? '#fff' : '#374151', fontSize:12, cursor:'pointer' }}>
              {t === 'todos' ? 'Todos' : tp?.label}
            </button>
          );
        })}
        <div style={{ width:1, height:20, background:'#e5e7eb', margin:'0 4px' }} />
        <span style={{ fontSize:12, color:'#6b7280', fontWeight:500 }}>Status:</span>
        {['todos','pendente','vencido','pago'].map(s => (
          <button key={s} onClick={() => setFiltroStatus(s)}
            style={{ padding:'4px 14px', borderRadius:20, border:`1px solid ${filtroStatus===s ? (STATUS[s]?.cor||'#374151') : '#d1d5db'}`,
              background: filtroStatus===s ? (STATUS[s]?.cor||'#374151') : '#fff', color: filtroStatus===s ? '#fff' : '#374151', fontSize:12, cursor:'pointer' }}>
            {s === 'todos' ? 'Todos' : STATUS[s]?.label}
          </button>
        ))}
        <span style={{ marginLeft:'auto', fontSize:12, color:'#9ca3af' }}>{listaFiltrada.length} fatura(s)</span>
      </div>

      {/* Lista */}
      {loading ? (
        <div style={{ textAlign:'center', padding:60, color:'#9ca3af' }}>Carregando...</div>
      ) : listaFiltrada.length === 0 ? (
        <div style={{ textAlign:'center', padding:60, color:'#9ca3af', background:'#fff', borderRadius:12, border:'1px solid #e5e7eb' }}>
          <i className="ti ti-file-off" style={{ fontSize:40, display:'block', marginBottom:8 }}></i>
          Nenhuma fatura. Clique em "Nova Fatura" para começar.
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {listaFiltrada.map(fatura => {
            const sc      = STATUS[fatura.status] || STATUS.pendente;
            const dias    = emDias(fatura.dataVencimento);
            const nfs     = fatura.notasFiscais || [];
            const somaANFs = nfs.reduce((s,nf) => s + Number(nf.valor), 0);
            const exp     = expandidos[fatura.id];
            const forn    = fatura.fornecedor;
            const tp      = TIPOS.find(t => t.val === forn?.tipoServico);

            return (
              <div key={fatura.id} style={{ background:'#fff', borderRadius:12, border:'1px solid #e5e7eb', overflow:'hidden' }}>
                {/* Cabeçalho da fatura */}
                <div style={{ padding:'14px 18px', display:'flex', gap:14, alignItems:'center' }}>
                  {/* Fornecedor */}
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:3 }}>
                      <span style={{ fontSize:14, fontWeight:600, color:'#1a1a2e', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{forn?.razaoSocial}</span>
                      {tp && <span style={{ padding:'2px 9px', borderRadius:20, fontSize:11, fontWeight:600, background:tp.bg, color:tp.cor, flexShrink:0 }}>{tp.label}</span>}
                    </div>
                    <div style={{ fontSize:11, color:'#9ca3af' }}>CNPJ: {mascaraCNPJ(forn?.cnpj||'')} · {forn?.responsavel}</div>
                  </div>
                  {/* Valor fatura */}
                  <div style={{ textAlign:'right', flexShrink:0 }}>
                    <div style={{ fontSize:11, color:'#9ca3af' }}>Fatura</div>
                    <div style={{ fontSize:14, fontWeight:700, color:'#1a1a2e' }}>{fmt(fatura.valor)}</div>
                  </div>
                  {/* Soma NFs */}
                  <div style={{ textAlign:'right', flexShrink:0 }}>
                    <div style={{ fontSize:11, color:'#9ca3af' }}>NFs ({nfs.length})</div>
                    <div style={{ fontSize:14, fontWeight:600, color:'#0891b2' }}>{fmt(somaANFs)}</div>
                  </div>
                  {/* Vencimento */}
                  <div style={{ textAlign:'right', flexShrink:0, minWidth:90 }}>
                    <div style={{ fontSize:11, color:'#9ca3af' }}>Vencimento</div>
                    <div style={{ fontSize:12, fontWeight:500, color: fatura.status==='vencido' ? '#dc2626' : '#374151' }}>{fmtData(fatura.dataVencimento)}</div>
                    {fatura.status !== 'pago' && dias !== null && (
                      <div style={{ fontSize:11, color: dias < 0 ? '#dc2626' : dias <= 7 ? '#d97706' : '#9ca3af' }}>
                        {dias < 0 ? `${Math.abs(dias)}d atraso` : dias === 0 ? 'Hoje' : `${dias}d`}
                      </div>
                    )}
                  </div>
                  {/* Status */}
                  <span style={{ padding:'4px 12px', borderRadius:20, fontSize:11, fontWeight:600, background:sc.bg, color:sc.cor, whiteSpace:'nowrap', flexShrink:0 }}>{sc.label}</span>
                  {/* Ações */}
                  <div style={{ display:'flex', gap:5, flexShrink:0 }}>
                    <button onClick={() => setExpandidos(e => ({ ...e, [fatura.id]: !e[fatura.id] }))} title="Ver NFs"
                      style={{ padding:'5px 9px', border:'1px solid #d1d5db', borderRadius:6, background:'#f9fafb', fontSize:12, cursor:'pointer', color: exp ? '#EB3238' : '#374151' }}>
                      <i className={`ti ${exp ? 'ti-chevron-up' : 'ti-chevron-down'}`}></i>
                    </button>
                    {fatura.arquivoNome && (
                      <button onClick={() => window.open(`${api.defaults.baseURL}/faturas-abastecimento/${fatura.id}/arquivo`, '_blank')} title="Baixar fatura"
                        style={{ padding:'5px 9px', border:'1px solid #dbeafe', borderRadius:6, background:'#eff6ff', fontSize:12, cursor:'pointer', color:'#1d4ed8' }}>
                        <i className="ti ti-download"></i>
                      </button>
                    )}
                    {fatura.status !== 'pago' ? (
                      <button onClick={() => { setShowPagarId(fatura.id); setDataPagamento(dataHoje()); }} title="Marcar como pago"
                        style={{ padding:'5px 9px', border:'1px solid #bbf7d0', borderRadius:6, background:'#f0fdf4', fontSize:12, cursor:'pointer', color:'#16a34a' }}>
                        <i className="ti ti-check"></i>
                      </button>
                    ) : (
                      <button onClick={() => reabrir(fatura.id)} title="Reabrir"
                        style={{ padding:'5px 9px', border:'1px solid #d1d5db', borderRadius:6, background:'#f9fafb', fontSize:12, cursor:'pointer', color:'#6b7280' }}>
                        <i className="ti ti-rotate-clockwise"></i>
                      </button>
                    )}
                    <button onClick={() => excluir(fatura.id)} title="Excluir"
                      style={{ padding:'5px 9px', border:'1px solid #fee2e2', borderRadius:6, background:'#fff5f5', fontSize:12, cursor:'pointer', color:'#dc2626' }}>
                      <i className="ti ti-trash"></i>
                    </button>
                  </div>
                </div>

                {/* Painel NFs */}
                {exp && (
                  <div style={{ borderTop:'1px solid #f3f4f6', background:'#fafafa', padding:'12px 18px' }}>
                    <div style={{ fontSize:12, fontWeight:600, color:'#6b7280', marginBottom:10, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                      <span style={{ textTransform:'uppercase', letterSpacing:'0.4px' }}>Notas Fiscais — Soma: {fmt(somaANFs)}</span>
                    </div>
                    {nfs.length === 0 ? (
                      <p style={{ fontSize:12, color:'#9ca3af', marginBottom:10 }}>Nenhuma NF vinculada.</p>
                    ) : (
                      <div style={{ display:'flex', flexDirection:'column', gap:7, marginBottom:12 }}>
                        {nfs.map(nf => (
                          <div key={nf.id} style={{ display:'flex', alignItems:'center', gap:12, background:'#fff', borderRadius:8, border:'1px solid #e5e7eb', padding:'8px 12px' }}>
                            <i className="ti ti-receipt" style={{ fontSize:15, color:'#0891b2' }}></i>
                            <span style={{ fontWeight:500, fontSize:13 }}>NF #{nf.numero}</span>
                            <span style={{ color:'#0891b2', fontWeight:600, fontSize:13 }}>{fmt(nf.valor)}</span>
                            {nf.arquivoNome && (
                              <button onClick={() => window.open(`${api.defaults.baseURL}/faturas-abastecimento/${fatura.id}/nfs/${nf.id}/arquivo`, '_blank')}
                                style={{ marginLeft:'auto', padding:'4px 10px', border:'1px solid #dbeafe', borderRadius:6, background:'#eff6ff', fontSize:12, cursor:'pointer', color:'#1d4ed8', display:'flex', alignItems:'center', gap:4 }}>
                                <i className="ti ti-download" style={{ fontSize:12 }}></i>
                                <span style={{ maxWidth:110, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{nf.arquivoNome}</span>
                              </button>
                            )}
                            <button onClick={() => excluirNF(fatura.id, nf.id)}
                              style={{ padding:'4px 8px', border:'1px solid #fee2e2', borderRadius:6, background:'#fff5f5', fontSize:12, cursor:'pointer', color:'#dc2626', marginLeft: nf.arquivoNome ? 0 : 'auto' }}>
                              <i className="ti ti-trash"></i>
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    <button onClick={() => { setNfFaturaId(fatura.id); setNfForm({ numero:'', valor:'', arquivoNome:null, arquivoBase64:null, arquivoTipo:null }); }}
                      style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'6px 14px', border:'1px dashed #d1d5db', borderRadius:8, background:'#fff', fontSize:12, cursor:'pointer', color:'#374151' }}>
                      <i className="ti ti-plus" style={{ fontSize:13 }}></i> Adicionar NF
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ══════════ MODAL NOVA FATURA (2 etapas) ══════════ */}
      {showModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:2000, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
          <div style={{ background:'#fff', borderRadius:16, width:'100%', maxWidth:540, maxHeight:'92vh', overflowY:'auto', boxShadow:'0 12px 40px rgba(0,0,0,0.2)' }}>
            {/* Header modal */}
            <div style={{ padding:'22px 28px 0', display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
              <div>
                <h3 style={{ fontSize:17, fontWeight:700, margin:0, color:'#1a1a2e' }}>Nova Fatura</h3>
                <p style={{ fontSize:12, color:'#9ca3af', margin:'3px 0 0' }}>Etapa {etapa} de 2</p>
              </div>
              <button onClick={fecharModal} style={{ background:'none', border:'none', fontSize:24, cursor:'pointer', color:'#9ca3af', lineHeight:1 }}>×</button>
            </div>

            <div style={{ padding:'0 28px 28px' }}>
              <Etapas atual={etapa} />

              {/* ── ETAPA 1: Dados do Fornecedor ── */}
              {etapa === 1 && (
                <form onSubmit={avancar}>
                  <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
                    <div>
                      <label style={lbl}>Razão Social *</label>
                      <input value={step1.razaoSocial} onChange={e => setStep1(s=>({...s,razaoSocial:e.target.value}))} style={inp} required placeholder="Nome da empresa" />
                    </div>
                    <div>
                      <label style={lbl}>CNPJ *</label>
                      <input value={step1.cnpj} onChange={e => setStep1(s=>({...s,cnpj:mascaraCNPJ(e.target.value)}))} style={inp} required placeholder="00.000.000/0000-00" />
                    </div>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
                      <div>
                        <label style={lbl}>Responsável</label>
                        <input value={step1.responsavel} onChange={e => setStep1(s=>({...s,responsavel:e.target.value}))} style={inp} />
                      </div>
                      <div>
                        <label style={lbl}>Contato</label>
                        <input value={step1.contato} onChange={e => setStep1(s=>({...s,contato:e.target.value}))} style={inp} placeholder="Telefone ou e-mail" />
                      </div>
                    </div>
                    <div>
                      <label style={lbl}>Número da OC</label>
                      <input value={step1.numeroOC} onChange={e => setStep1(s=>({...s,numeroOC:e.target.value}))} style={inp} placeholder="Opcional" />
                    </div>
                    <div>
                      <label style={lbl}>Frota *</label>
                      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                        {[
                          { val:'buzin', label:'BUZIN', icone:'ti-truck', cor:'#7c3aed', bg:'#f5f3ff' },
                          { val:'lbm',   label:'LBM',   icone:'ti-truck', cor:'#b45309', bg:'#fffbeb' },
                        ].map(f => (
                          <button key={f.val} type="button" onClick={() => setStep1(s=>({...s,frota:f.val}))}
                            style={{ padding:'11px', border:`2px solid ${step1.frota===f.val ? f.cor : '#e5e7eb'}`, borderRadius:10,
                              background: step1.frota===f.val ? f.bg : '#fff', cursor:'pointer',
                              display:'flex', alignItems:'center', justifyContent:'center', gap:8,
                              color: step1.frota===f.val ? f.cor : '#6b7280',
                              fontWeight: step1.frota===f.val ? 700 : 400, fontSize:13 }}>
                            <i className={`ti ${f.icone}`} style={{ fontSize:18 }}></i> {f.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label style={lbl}>Tipo de Serviço *</label>
                      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                        {TIPOS.map(t => (
                          <button key={t.val} type="button" onClick={() => setStep1(s=>({...s,tipoServico:t.val}))}
                            style={{ padding:'12px', border:`2px solid ${step1.tipoServico===t.val ? t.cor : '#e5e7eb'}`, borderRadius:10,
                              background: step1.tipoServico===t.val ? t.bg : '#fff', cursor:'pointer',
                              display:'flex', alignItems:'center', justifyContent:'center', gap:8,
                              color: step1.tipoServico===t.val ? t.cor : '#6b7280',
                              fontWeight: step1.tipoServico===t.val ? 600 : 400, fontSize:13 }}>
                            <i className={`ti ${t.icone}`} style={{ fontSize:20 }}></i> {t.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label style={lbl}>Forma de Pagamento *</label>
                      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                        {[
                          { val:'pix',    label:'PIX',    icone:'ti-brand-cashapp', cor:'#16a34a', bg:'#f0fdf4' },
                          { val:'boleto', label:'Boleto', icone:'ti-barcode',       cor:'#1d4ed8', bg:'#eff6ff' },
                        ].map(fp => (
                          <button key={fp.val} type="button" onClick={() => setStep1(s=>({...s,formaPagamento:fp.val,chavePix:''}))}
                            style={{ padding:'11px', border:`2px solid ${step1.formaPagamento===fp.val ? fp.cor : '#e5e7eb'}`, borderRadius:10,
                              background: step1.formaPagamento===fp.val ? fp.bg : '#fff', cursor:'pointer',
                              display:'flex', alignItems:'center', justifyContent:'center', gap:8,
                              color: step1.formaPagamento===fp.val ? fp.cor : '#6b7280',
                              fontWeight: step1.formaPagamento===fp.val ? 600 : 400, fontSize:13 }}>
                            <i className={`ti ${fp.icone}`} style={{ fontSize:18 }}></i> {fp.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {step1.formaPagamento === 'pix' && (
                      <div>
                        <label style={lbl}>Chave PIX *</label>
                        <input value={step1.chavePix} onChange={e => setStep1(s=>({...s,chavePix:e.target.value}))} style={inp} required placeholder="CPF, CNPJ, e-mail, telefone ou chave aleatória" />
                      </div>
                    )}
                  </div>
                  <div style={{ display:'flex', justifyContent:'flex-end', marginTop:24 }}>
                    <button type="submit"
                      style={{ display:'flex', alignItems:'center', gap:6, padding:'10px 24px', border:'none', borderRadius:9, background:'#EB3238', color:'#fff', fontSize:13, fontWeight:600, cursor:'pointer' }}>
                      Próximo <i className="ti ti-arrow-right" style={{ fontSize:15 }}></i>
                    </button>
                  </div>
                </form>
              )}

              {/* ── ETAPA 2: Fatura e Documentos ── */}
              {etapa === 2 && (
                <form onSubmit={criar}>
                  <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
                    {/* Resumo fornecedor */}
                    <div style={{ background:'#f8fafc', borderRadius:10, padding:'12px 14px', fontSize:13, border:'1px solid #e5e7eb' }}>
                      <div style={{ fontWeight:600, color:'#1a1a2e' }}>{step1.razaoSocial}</div>
                      <div style={{ color:'#6b7280', fontSize:12 }}>
                        {mascaraCNPJ(step1.cnpj)} · {TIPOS.find(t=>t.val===step1.tipoServico)?.label} · {step1.formaPagamento === 'pix' ? `PIX: ${step1.chavePix}` : 'Boleto'}
                      </div>
                    </div>

                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
                      <div>
                        <label style={lbl}>Valor da Fatura (R$) *</label>
                        <input type="text" inputMode="decimal" value={step2.valor} onChange={e => setStep2(s=>({...s,valor:e.target.value}))} style={inp} placeholder="Ex: 1500,00" />
                      </div>
                      <div>
                        <label style={lbl}>Data de Vencimento *</label>
                        <input type="date" value={step2.dataVencimento} onChange={e => setStep2(s=>({...s,dataVencimento:e.target.value}))} style={inp} required />
                      </div>
                    </div>

                    <div>
                      <label style={lbl}>Documento da Fatura</label>
                      <UploadArquivo nome={step2.arquivoNome} onSelect={onArquivoFatura} label="Clique para anexar a fatura" />
                    </div>

                    {/* NFs */}
                    <div>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
                        <label style={{ ...lbl, margin:0 }}>Notas Fiscais</label>
                        <button type="button" onClick={adicionarNFTemp}
                          style={{ display:'flex', alignItems:'center', gap:5, padding:'5px 12px', border:'1px solid #d1d5db', borderRadius:7, background:'#fff', fontSize:12, cursor:'pointer', color:'#374151' }}>
                          <i className="ti ti-plus" style={{ fontSize:13 }}></i> Adicionar NF
                        </button>
                      </div>

                      {nfsTemp.length === 0 ? (
                        <div style={{ padding:'12px', border:'1px dashed #e5e7eb', borderRadius:9, textAlign:'center', fontSize:12, color:'#9ca3af' }}>
                          Nenhuma NF adicionada. Você pode adicionar depois também.
                        </div>
                      ) : (
                        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                          {nfsTemp.map((nf, idx) => (
                            <div key={idx} style={{ border:'1px solid #e5e7eb', borderRadius:9, padding:'12px 14px', background:'#fafafa' }}>
                              <div style={{ display:'flex', gap:10, marginBottom:8, alignItems:'flex-end' }}>
                                <div style={{ flex:1 }}>
                                  <label style={lbl}>Número da NF</label>
                                  <input value={nf.numero} onChange={e => setNfsTemp(p => p.map((x,i) => i===idx ? {...x,numero:e.target.value} : x))} style={inp} placeholder="Ex: 001234" />
                                </div>
                                <div style={{ flex:1 }}>
                                  <label style={lbl}>Valor (R$)</label>
                                  <input type="text" inputMode="decimal" value={nf.valor} onChange={e => setNfsTemp(p => p.map((x,i) => i===idx ? {...x,valor:e.target.value} : x))} style={inp} placeholder="Ex: 150,00" />
                                </div>
                                <button type="button" onClick={() => removerNFTemp(idx)}
                                  style={{ padding:'8px 10px', border:'1px solid #fee2e2', borderRadius:7, background:'#fff5f5', color:'#dc2626', cursor:'pointer', fontSize:13, flexShrink:0 }}>
                                  <i className="ti ti-trash"></i>
                                </button>
                              </div>
                              <div>
                                <label style={lbl}>Documento da NF</label>
                                <UploadArquivo
                                  nome={nf.arquivoNome}
                                  onSelect={e => onArquivoNFTemp(e, idx)}
                                  label="Clique para anexar a NF"
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div>
                      <label style={lbl}>Observação</label>
                      <textarea value={step2.observacao} onChange={e => setStep2(s=>({...s,observacao:e.target.value}))}
                        style={{ ...inp, height:60, resize:'vertical' }} placeholder="Opcional" />
                    </div>
                  </div>

                  <div style={{ display:'flex', justifyContent:'space-between', marginTop:24 }}>
                    <button type="button" onClick={() => setEtapa(1)}
                      style={{ display:'flex', alignItems:'center', gap:5, padding:'10px 20px', border:'1px solid #d1d5db', borderRadius:9, background:'#fff', fontSize:13, cursor:'pointer', color:'#374151' }}>
                      <i className="ti ti-arrow-left" style={{ fontSize:14 }}></i> Voltar
                    </button>
                    <button type="submit" disabled={salvando}
                      style={{ display:'flex', alignItems:'center', gap:6, padding:'10px 24px', border:'none', borderRadius:9, background:'#EB3238', color:'#fff', fontSize:13, fontWeight:600, cursor:'pointer' }}>
                      {salvando ? 'Salvando...' : <><i className="ti ti-check" style={{ fontSize:15 }}></i> Criar Fatura</>}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Confirmar Pagamento */}
      {showPagarId && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:2000, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
          <div style={{ background:'#fff', borderRadius:14, padding:28, width:'100%', maxWidth:340, boxShadow:'0 8px 32px rgba(0,0,0,0.18)' }}>
            <h3 style={{ fontSize:15, fontWeight:600, margin:'0 0 16px' }}>Confirmar Pagamento</h3>
            <label style={lbl}>Data do pagamento</label>
            <input type="date" value={dataPagamento} onChange={e => setDataPagamento(e.target.value)}
              style={{ ...inp, marginBottom:20 }} />
            <div style={{ display:'flex', justifyContent:'flex-end', gap:10 }}>
              <button onClick={() => setShowPagarId(null)}
                style={{ padding:'8px 20px', border:'1px solid #d1d5db', borderRadius:8, background:'#fff', fontSize:13, cursor:'pointer' }}>Cancelar</button>
              <button onClick={pagar}
                style={{ padding:'8px 20px', border:'none', borderRadius:8, background:'#16a34a', color:'#fff', fontSize:13, fontWeight:500, cursor:'pointer' }}>Confirmar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Adicionar NF a fatura existente */}
      {nfFaturaId && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:2000, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
          <div style={{ background:'#fff', borderRadius:14, padding:28, width:'100%', maxWidth:420, boxShadow:'0 8px 32px rgba(0,0,0,0.18)' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
              <h3 style={{ fontSize:15, fontWeight:600, margin:0 }}>Adicionar Nota Fiscal</h3>
              <button onClick={() => setNfFaturaId(null)} style={{ background:'none', border:'none', fontSize:22, cursor:'pointer', color:'#9ca3af' }}>×</button>
            </div>
            <form onSubmit={salvarNF}>
              <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
                  <div>
                    <label style={lbl}>Número da NF *</label>
                    <input value={nfForm.numero} onChange={e => setNfForm(f=>({...f,numero:e.target.value}))} style={inp} required />
                  </div>
                  <div>
                    <label style={lbl}>Valor (R$) *</label>
                    <input type="text" inputMode="decimal" value={nfForm.valor} onChange={e => setNfForm(f=>({...f,valor:e.target.value}))} style={inp} required placeholder="Ex: 150,00" />
                  </div>
                </div>
                <div>
                  <label style={lbl}>Documento da NF</label>
                  <UploadArquivo nome={nfForm.arquivoNome} onSelect={onArquivoNFExistente} label="Clique para anexar a NF" />
                </div>
              </div>
              <div style={{ display:'flex', justifyContent:'flex-end', gap:10, marginTop:20 }}>
                <button type="button" onClick={() => setNfFaturaId(null)}
                  style={{ padding:'8px 20px', border:'1px solid #d1d5db', borderRadius:8, background:'#fff', fontSize:13, cursor:'pointer' }}>Cancelar</button>
                <button type="submit" disabled={salvandoNF}
                  style={{ padding:'8px 20px', border:'none', borderRadius:8, background:'#0891b2', color:'#fff', fontSize:13, fontWeight:500, cursor:'pointer' }}>
                  {salvandoNF ? 'Adicionando...' : 'Adicionar NF'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

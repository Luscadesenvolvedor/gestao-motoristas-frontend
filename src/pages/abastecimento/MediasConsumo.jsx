import { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import * as XLSX from 'xlsx';
import api from '../../services/api';
import toast from 'react-hot-toast';

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

const inp = { width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13, outline: 'none', background: '#fff', cursor: 'pointer', boxSizing: 'border-box' };
const lbl = { fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 };

export default function MediasConsumo() {
  // ── estado importações ──
  const [importacoes,  setImportacoes]  = useState([]);
  const [importacaoId, setImportacaoId] = useState('');
  const [loadingImps,  setLoadingImps]  = useState(true);

  // ── estado Excel local (antes de salvar) ──
  const [preview,     setPreview]     = useState(null); // { nomeArquivo, registros[] }
  const [salvando,    setSalvando]    = useState(false);
  const fileRef = useRef();

  // ── filtros do relatório ──
  const [motorista, setMotorista]   = useState('');
  const [mesSel,    setMesSel]      = useState('');
  const [motoristas, setMotoristas] = useState([]);
  const [meses,      setMeses]      = useState([]);

  // ── dados carregados do banco ──
  const [registros,  setRegistros]  = useState([]);
  const [loadingReg, setLoadingReg] = useState(false);

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

  /* ── buscar motoristas e meses quando importação muda ── */
  useEffect(() => {
    if (!importacaoId) { setMotoristas([]); setMeses([]); setMotorista(''); setMesSel(''); return; }
    api.get('/medias-consumo/motoristas', { params: { importacaoId } })
      .then(r => { setMotoristas(r.data); setMotorista(''); setMesSel(''); setRegistros([]); })
      .catch(() => {});
    api.get('/medias-consumo/meses', { params: { importacaoId } })
      .then(r => setMeses(r.data))
      .catch(() => {});
  }, [importacaoId]);

  /* ── buscar registros quando motorista ou mês muda ── */
  useEffect(() => {
    if (!importacaoId || (!motorista && !mesSel)) { setRegistros([]); return; }
    setLoadingReg(true);
    const params = { importacaoId };
    if (motorista) params.motorista = motorista;
    if (mesSel) { params.mes = mesSel.split('-')[1]; params.ano = mesSel.split('-')[0]; }
    api.get('/medias-consumo', { params })
      .then(r => setRegistros(r.data))
      .catch(() => toast.error('Erro ao carregar dados'))
      .finally(() => setLoadingReg(false));
  }, [importacaoId, motorista, mesSel]);

  /* ── ler Excel localmente ── */
  async function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json(ws, { header: 1 });
      const registros = raw.slice(1).filter(r => r[0] && r[1]).map(r => ({
        data:           excelDateToISO(r[0]),
        motorista:      String(r[1] || '').trim(),
        placa:          r[2] || null,
        modelo:         r[3] || null,
        conjunto:       r[4] || null,
        kmInicial:      Number(r[5]) || null,
        kmFinal:        Number(r[6]) || null,
        distancia:      Number(r[7]) || null,
        posto:          r[8] || null,
        cidade:         r[9] || null,
        uf:             r[10] || null,
        precoLitro:     Number(r[11]) || null,
        litros:         Number(r[12]) || null,
        produto:        String(r[13] || ''),
        vlrTotal:       Number(r[14]) || null,
        mediaRealizada: Number(r[15]) || null,
        mediaSugerida:  Number(r[16]) || null,
        percAtingido:   String(r[17] || ''),
        gap:            Number(r[18]) || null,
      }));
      setPreview({ nomeArquivo: file.name, registros });
      toast.success(`${registros.length.toLocaleString('pt-BR')} registros lidos`);
    } catch (err) { toast.error('Erro ao ler o arquivo: ' + err.message); }
    e.target.value = '';
  }

  /* ── salvar no banco ── */
  async function salvarImportacao() {
    if (!preview) return;
    setSalvando(true);
    const toastId = toast.loading(`Salvando ${preview.registros.length.toLocaleString('pt-BR')} registros...`);
    try {
      // Enviar em lotes de 1000 para não estourar o limite da requisição
      const LOTE = 1000;
      const lotes = [];
      for (let i = 0; i < preview.registros.length; i += LOTE) {
        lotes.push(preview.registros.slice(i, i + LOTE));
      }

      let importacaoIdNova = null;
      for (let i = 0; i < lotes.length; i++) {
        const payload = {
          nomeArquivo: preview.nomeArquivo,
          registros:   lotes[i],
          // No primeiro lote cria a importação; nos demais seria append
          // Simplificação: enviamos tudo de uma vez
        };
        if (i === 0) {
          // Primeiro lote: cria a importação com TODOS os registros
          const { data } = await api.post('/medias-consumo/importar', {
            nomeArquivo: preview.nomeArquivo,
            registros:   preview.registros,
          });
          importacaoIdNova = data.importacaoId;
          break; // Enviou tudo de uma vez
        }
      }

      toast.success('Dados salvos com sucesso!', { id: toastId });
      setPreview(null);
      await carregarImportacoes();
      if (importacaoIdNova) setImportacaoId(importacaoIdNova);
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Erro ao salvar', { id: toastId });
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <i className="ti ti-file-spreadsheet" style={{ fontSize: 24, color: '#d97706' }}></i>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14, color: '#92400e' }}>{preview.nomeArquivo}</div>
              <div style={{ fontSize: 12, color: '#b45309' }}>{preview.registros.length.toLocaleString('pt-BR')} registros prontos para salvar</div>
            </div>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 10 }}>
              <button onClick={() => setPreview(null)}
                style={{ padding: '8px 16px', border: '1px solid #d1d5db', borderRadius: 8, background: '#fff', fontSize: 13, cursor: 'pointer' }}>
                Cancelar
              </button>
              <button onClick={salvarImportacao} disabled={salvando}
                style={{ padding: '8px 20px', border: 'none', borderRadius: 8, background: '#16a34a', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                <i className="ti ti-device-floppy"></i>
                {salvando ? 'Salvando...' : 'Salvar no banco'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Painel de importações ── */}
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 20, marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={handleFile} style={{ display: 'none' }} />
          <button onClick={() => fileRef.current?.click()}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 20px', background: '#EB3238', color: '#fff', border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
            <i className="ti ti-upload"></i> Importar Excel
          </button>

          {loadingImps ? (
            <span style={{ fontSize: 13, color: '#9ca3af' }}>Carregando...</span>
          ) : importacoes.length === 0 ? (
            <span style={{ fontSize: 13, color: '#9ca3af' }}>Nenhuma importação — carregue um arquivo Excel</span>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, flexWrap: 'wrap' }}>
              <select value={importacaoId} onChange={e => { setImportacaoId(e.target.value); setMotorista(''); setMesSel(''); }}
                style={{ ...inp, maxWidth: 380 }}>
                {importacoes.map(im => (
                  <option key={im.id} value={im.id}>
                    {im.nomeArquivo} — {im.totalRegistros?.toLocaleString('pt-BR')} reg. — {fmtDt(im.criadoEm?.slice(0,10))}
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
          )}
        </div>
      </div>

      {/* ── Filtros ── */}
      {(motoristas.length > 0 || meses.length > 0) && (
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 20, marginBottom: 20, display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: '1 1 260px' }}>
            <label style={lbl}>Motorista</label>
            <select value={motorista} onChange={e => { setMotorista(e.target.value); setMesSel(''); }} style={inp}>
              <option value="">Todos os motoristas</option>
              {motoristas.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div style={{ flex: '1 1 180px' }}>
            <label style={lbl}>Mês</label>
            <select value={mesSel} onChange={e => setMesSel(e.target.value)} style={inp}>
              <option value="">Todos os meses</option>
              {meses.map(m => (
                <option key={m} value={m}>{fmtMesStr(m)}</option>
              ))}
            </select>
          </div>
          {(motorista || mesSel) && (
            <button onClick={() => { setMotorista(''); setMesSel(''); }}
              style={{ padding: '9px 14px', border: '1px solid #e5e7eb', borderRadius: 8, background: '#f9fafb', fontSize: 12, color: '#6b7280', cursor: 'pointer' }}>
              Limpar
            </button>
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

      {/* ── Aguardando seleção ── */}
      {importacaoId && !motorista && !mesSel && motoristas.length > 0 && (
        <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af', background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb' }}>
          <i className="ti ti-filter" style={{ fontSize: 40, display: 'block', marginBottom: 8 }}></i>
          Selecione um motorista ou mês para ver o relatório
        </div>
      )}

      {/* ── Carregando ── */}
      {loadingReg && (
        <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af' }}>Carregando dados...</div>
      )}

      {/* ── RESUMO MENSAL ── */}
      {!loadingReg && !mesSel && resumoMensal.length > 0 && (
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
                {resumoMensal.map(m => (
                  <tr key={m.chave} onClick={() => setMesSel(m.chave)} style={{ cursor: 'pointer' }}
                    onMouseEnter={e => e.currentTarget.style.background='#f0f9ff'}
                    onMouseLeave={e => e.currentTarget.style.background=''}>
                    <td style={{ padding:'12px 16px', borderBottom:'1px solid #f3f4f6', fontWeight:600, color:'#1a1a2e' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                        <i className="ti ti-calendar" style={{ fontSize:13, color:'#EB3238' }}></i>
                        {fmtMesStr(m.chave)}
                      </div>
                    </td>
                    <td style={{ padding:'12px 16px', textAlign:'right', borderBottom:'1px solid #f3f4f6' }}>{fmtN(m.totalKm,0)} km</td>
                    <td style={{ padding:'12px 16px', textAlign:'right', borderBottom:'1px solid #f3f4f6' }}>{fmtN(m.totalLit)} L</td>
                    <td style={{ padding:'12px 16px', textAlign:'right', borderBottom:'1px solid #f3f4f6', fontWeight:600, color:'#1a1a2e' }}>{fmtN(m.mediaReal)}</td>
                    <td style={{ padding:'12px 16px', textAlign:'right', borderBottom:'1px solid #f3f4f6', color:'#6b7280' }}>{fmtN(m.mediaSug)}</td>
                    <td style={{ padding:'12px 16px', textAlign:'right', borderBottom:'1px solid #f3f4f6' }}>
                      <span style={{ fontWeight:700, color:corPerc(m.perc) }}>{fmtN(m.perc,1)}%</span>
                      <div style={{ marginTop:4, height:4, borderRadius:2, background:'#e5e7eb', width:80, marginLeft:'auto' }}>
                        <div style={{ height:'100%', borderRadius:2, background:corPerc(m.perc), width:`${Math.min(m.perc,100)}%` }}></div>
                      </div>
                    </td>
                    <td style={{ padding:'12px 16px', textAlign:'right', borderBottom:'1px solid #f3f4f6', fontWeight:600 }}>{fmtR(m.totalGasto)}</td>
                  </tr>
                ))}
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

      {/* ── DETALHE MÊS ── */}
      {!loadingReg && mesSel && summaryMes && (
        <div>
          <button onClick={() => setMesSel('')}
            style={{ display:'flex', alignItems:'center', gap:6, marginBottom:16, padding:'7px 14px', border:'1px solid #e5e7eb', borderRadius:8, background:'#fff', fontSize:12, color:'#374151', cursor:'pointer' }}>
            <i className="ti ti-arrow-left"></i> Voltar ao resumo
          </button>
          <div style={{ display:'flex', flexWrap:'wrap', gap:12, marginBottom:20 }}>
            {[
              ['Distância', `${fmtN(summaryMes.totalKm,0)} km`],
              ['Litros Diesel', `${fmtN(summaryMes.totalLit)} L`],
              ['Média Real', `${fmtN(summaryMes.mediaReal)} km/L`, corPerc(summaryMes.perc)],
              ['Média Sugerida', `${fmtN(summaryMes.mediaSug)} km/L`],
              ['% Atingido', `${fmtN(summaryMes.perc,1)}%`, corPerc(summaryMes.perc)],
              ['Custo por km', `R$ ${fmtN(summaryMes.custoKm,4)}`],
              ['Total Gasto', fmtR(summaryMes.totalGasto)],
            ].map(([label,value,cor='#1a1a2e']) => (
              <div key={label} style={{ background:'#fff', border:'1px solid #e5e7eb', borderRadius:12, padding:'16px 20px', minWidth:130 }}>
                <div style={{ fontSize:11, color:'#6b7280', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.4px', marginBottom:6 }}>{label}</div>
                <div style={{ fontSize:22, fontWeight:700, color:cor }}>{value}</div>
              </div>
            ))}
          </div>
          <div style={{ background:'#fff', border:'1px solid #e5e7eb', borderRadius:12, overflow:'hidden' }}>
            <div style={{ padding:'14px 20px', borderBottom:'1px solid #e5e7eb', display:'flex', alignItems:'center', gap:8 }}>
              <i className="ti ti-list-details" style={{ color:'#EB3238', fontSize:15 }}></i>
              <span style={{ fontWeight:600, fontSize:13 }}>Abastecimentos — {fmtMesStr(mesSel)}</span>
              <span style={{ marginLeft:'auto', fontSize:12, color:'#9ca3af' }}>{detalhe.length} registros</span>
            </div>
            <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                <thead>
                  <tr style={{ background:'#f8fafc' }}>
                    {['Data','Placa','Produto','Litros','Distância','Média Real','Média Sug','%','Vlr Total','Posto'].map(h => (
                      <th key={h} style={{ padding:'9px 12px', textAlign:['Litros','Distância','Média Real','Média Sug','%','Vlr Total'].includes(h)?'right':'left', fontSize:10, fontWeight:700, color:'#374151', textTransform:'uppercase', letterSpacing:'0.4px', borderBottom:'1px solid #e5e7eb', whiteSpace:'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {detalhe.map((r,i) => {
                    const isDiesel = String(r.produto||'').toLowerCase().includes('diesel');
                    const perc = r.mediaSugerida>0?(r.mediaRealizada/r.mediaSugerida)*100:null;
                    return (
                      <tr key={i} style={{ background:i%2===0?'#fff':'#fafafa' }}>
                        <td style={{ padding:'9px 12px', borderBottom:'1px solid #f3f4f6', whiteSpace:'nowrap' }}>{fmtDt(r.data?.slice(0,10))}</td>
                        <td style={{ padding:'9px 12px', borderBottom:'1px solid #f3f4f6', fontWeight:600 }}>{r.placa}</td>
                        <td style={{ padding:'9px 12px', borderBottom:'1px solid #f3f4f6' }}>
                          <span style={{ padding:'2px 8px', borderRadius:6, fontSize:11, fontWeight:600, background:isDiesel?'#eff6ff':'#f0fdf4', color:isDiesel?'#1d4ed8':'#15803d' }}>
                            {isDiesel?'Diesel':'Arla'}
                          </span>
                        </td>
                        <td style={{ padding:'9px 12px', borderBottom:'1px solid #f3f4f6', textAlign:'right' }}>{fmtN(r.litros)}</td>
                        <td style={{ padding:'9px 12px', borderBottom:'1px solid #f3f4f6', textAlign:'right' }}>{r.distancia?`${fmtN(r.distancia,0)} km`:'—'}</td>
                        <td style={{ padding:'9px 12px', borderBottom:'1px solid #f3f4f6', textAlign:'right', fontWeight:600 }}>{isDiesel&&r.mediaRealizada?fmtN(r.mediaRealizada):'—'}</td>
                        <td style={{ padding:'9px 12px', borderBottom:'1px solid #f3f4f6', textAlign:'right', color:'#6b7280' }}>{isDiesel&&r.mediaSugerida?fmtN(r.mediaSugerida):'—'}</td>
                        <td style={{ padding:'9px 12px', borderBottom:'1px solid #f3f4f6', textAlign:'right' }}>
                          {perc!==null&&isDiesel?<span style={{ fontWeight:700, color:corPerc(perc) }}>{fmtN(perc,0)}%</span>:'—'}
                        </td>
                        <td style={{ padding:'9px 12px', borderBottom:'1px solid #f3f4f6', textAlign:'right', fontWeight:600 }}>{fmtR(r.vlrTotal)}</td>
                        <td style={{ padding:'9px 12px', borderBottom:'1px solid #f3f4f6', color:'#6b7280', maxWidth:160, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r.posto}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

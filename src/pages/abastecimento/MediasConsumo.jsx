import { useState, useRef, useMemo } from 'react';
import * as XLSX from 'xlsx';

/* ── helpers ── */
function excelDateToJS(serial) {
  return new Date(Math.round((serial - 25569) * 86400 * 1000));
}
const fmtMes = (ano, mes) =>
  new Date(ano, mes - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
const fmtDt = d =>
  d instanceof Date ? d.toLocaleDateString('pt-BR') : '—';
const fmtN = (v, dec = 2) =>
  typeof v === 'number' ? v.toLocaleString('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec }) : '—';
const fmtR = v =>
  typeof v === 'number' ? `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—';

const card = (label, value, sub, cor = '#1a1a2e') => (
  <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '16px 20px', minWidth: 140 }}>
    <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 6 }}>{label}</div>
    <div style={{ fontSize: 22, fontWeight: 700, color: cor }}>{value}</div>
    {sub && <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 3 }}>{sub}</div>}
  </div>
);

/* ── componente ── */
export default function MediasConsumo() {
  const [dados,       setDados]       = useState([]);
  const [arquivo,     setArquivo]     = useState('');
  const [carregando,  setCarregando]  = useState(false);
  const [motorista,   setMotorista]   = useState('');
  const [mesSel,      setMesSel]      = useState('');  // '' = todos os meses (resumo)
  const fileRef = useRef();

  /* ── leitura do Excel ── */
  async function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    setCarregando(true);
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json(ws, { header: 1 });
      const rows = raw
        .slice(1)
        .filter(r => r[0] && r[1])
        .map(r => ({
          data:           excelDateToJS(r[0]),
          motorista:      String(r[1] || '').trim(),
          placa:          r[2] || '',
          modelo:         r[3] || '',
          conjunto:       r[4] || '',
          kmInicial:      Number(r[5]) || 0,
          kmFinal:        Number(r[6]) || 0,
          distancia:      Number(r[7]) || 0,
          posto:          r[8] || '',
          cidade:         r[9] || '',
          uf:             r[10] || '',
          precoLitro:     Number(r[11]) || 0,
          litros:         Number(r[12]) || 0,
          produto:        String(r[13] || ''),
          vlrTotal:       Number(r[14]) || 0,
          mediaReal:      Number(r[15]) || 0,
          mediaSug:       Number(r[16]) || 0,
          percAtingido:   r[17] || '',
          gap:            Number(r[18]) || 0,
        }));
      setDados(rows);
      setArquivo(file.name);
      setMotorista('');
      setMesSel('');
    } catch (err) {
      alert('Erro ao ler o arquivo: ' + err.message);
    }
    setCarregando(false);
    e.target.value = '';
  }

  /* ── listas derivadas ── */
  const motoristas = useMemo(() =>
    [...new Set(dados.map(r => r.motorista))].sort(), [dados]);

  const mesesDisponiveis = useMemo(() => {
    if (!motorista) return [];
    const set = new Set(
      dados
        .filter(r => r.motorista === motorista)
        .map(r => `${r.data.getFullYear()}-${String(r.data.getMonth() + 1).padStart(2, '0')}`)
    );
    return [...set].sort();
  }, [dados, motorista]);

  /* ── dados filtrados (por motorista) ── */
  const dadosMotorista = useMemo(() =>
    motorista ? dados.filter(r => r.motorista === motorista) : [],
  [dados, motorista]);

  /* ── resumo mensal (todos os meses do motorista) ── */
  const resumoMensal = useMemo(() => {
    if (!motorista) return [];
    const map = {};
    for (const r of dadosMotorista) {
      const chave = `${r.data.getFullYear()}-${String(r.data.getMonth() + 1).padStart(2, '0')}`;
      if (!map[chave]) map[chave] = { chave, ano: r.data.getFullYear(), mes: r.data.getMonth() + 1, diesel: [], arla: [], todos: [] };
      map[chave].todos.push(r);
      if (r.produto.toLowerCase().includes('diesel')) map[chave].diesel.push(r);
      else map[chave].arla.push(r);
    }
    return Object.values(map).sort((a, b) => a.chave.localeCompare(b.chave)).map(m => {
      const totalKm      = m.diesel.reduce((s, r) => s + r.distancia, 0);
      const totalLitros  = m.diesel.reduce((s, r) => s + r.litros, 0);
      const totalGasto   = m.todos.reduce((s, r) => s + r.vlrTotal, 0);
      const mediaReal    = totalLitros > 0 ? totalKm / totalLitros : 0;
      const sugs         = m.diesel.filter(r => r.mediaSug > 0);
      const mediaSug     = sugs.length > 0 ? sugs.reduce((s, r) => s + r.mediaSug, 0) / sugs.length : 0;
      const perc         = mediaSug > 0 ? (mediaReal / mediaSug) * 100 : 0;
      return { ...m, totalKm, totalLitros, totalGasto, mediaReal, mediaSug, perc };
    });
  }, [dadosMotorista, motorista]);

  /* ── detalhe de um mês específico ── */
  const detalhe = useMemo(() => {
    if (!mesSel) return [];
    return dadosMotorista
      .filter(r => {
        const c = `${r.data.getFullYear()}-${String(r.data.getMonth() + 1).padStart(2, '0')}`;
        return c === mesSel;
      })
      .sort((a, b) => a.data - b.data);
  }, [dadosMotorista, mesSel]);

  /* ── summary do mês selecionado ── */
  const summaryMes = useMemo(() => {
    if (!mesSel) return null;
    const diesel    = detalhe.filter(r => r.produto.toLowerCase().includes('diesel'));
    const totalKm   = diesel.reduce((s, r) => s + r.distancia, 0);
    const totalLit  = diesel.reduce((s, r) => s + r.litros, 0);
    const totalGasto= detalhe.reduce((s, r) => s + r.vlrTotal, 0);
    const mediaReal = totalLit > 0 ? totalKm / totalLit : 0;
    const sugs      = diesel.filter(r => r.mediaSug > 0);
    const mediaSug  = sugs.length > 0 ? sugs.reduce((s, r) => s + r.mediaSug, 0) / sugs.length : 0;
    const perc      = mediaSug > 0 ? (mediaReal / mediaSug) * 100 : 0;
    const custoPorKm= totalKm > 0 ? totalGasto / totalKm : 0;
    return { totalKm, totalLit, totalGasto, mediaReal, mediaSug, perc, custoPorKm };
  }, [mesSel, detalhe]);

  /* ── cor do % ── */
  const corPerc = p => p >= 100 ? '#16a34a' : p >= 85 ? '#d97706' : '#dc2626';

  /* ─────────────────────────────────────────── render ── */
  return (
    <div>
      {/* cabeçalho */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, color: '#1a1a2e', margin: 0 }}>Médias de Consumo</h2>
        <p style={{ fontSize: 13, color: '#6b7280', marginTop: 2 }}>
          Relatório de consumo por motorista • filtro mensal
        </p>
      </div>

      {/* ── upload ── */}
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 20, marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={handleFile} style={{ display: 'none' }} />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={carregando}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 20px', background: '#EB3238', color: '#fff', border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}
          >
            <i className="ti ti-upload"></i>
            {carregando ? 'Lendo...' : 'Carregar Excel'}
          </button>
          {arquivo && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <i className="ti ti-file-spreadsheet" style={{ color: '#16a34a', fontSize: 18 }}></i>
              <span style={{ fontSize: 13, color: '#374151', fontWeight: 500 }}>{arquivo}</span>
              <span style={{ fontSize: 12, color: '#9ca3af' }}>— {dados.length.toLocaleString('pt-BR')} registros • {motoristas.length} motoristas</span>
            </div>
          )}
        </div>
      </div>

      {/* ── filtros ── */}
      {dados.length > 0 && (
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 20, marginBottom: 20, display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: '1 1 280px' }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>Motorista</label>
            <select
              value={motorista}
              onChange={e => { setMotorista(e.target.value); setMesSel(''); }}
              style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13, outline: 'none', background: '#fff', cursor: 'pointer' }}
            >
              <option value="">Selecionar motorista…</option>
              {motoristas.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>

          {motorista && (
            <div style={{ flex: '0 1 200px' }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>Mês (detalhe)</label>
              <select
                value={mesSel}
                onChange={e => setMesSel(e.target.value)}
                style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13, outline: 'none', background: '#fff', cursor: 'pointer' }}
              >
                <option value="">Todos os meses</option>
                {mesesDisponiveis.map(m => {
                  const [ano, mes] = m.split('-');
                  return <option key={m} value={m}>{fmtMes(Number(ano), Number(mes))}</option>;
                })}
              </select>
            </div>
          )}

          {motorista && (
            <button
              onClick={() => { setMotorista(''); setMesSel(''); }}
              style={{ padding: '9px 14px', border: '1px solid #e5e7eb', borderRadius: 8, background: '#f9fafb', fontSize: 12, color: '#6b7280', cursor: 'pointer' }}
            >
              Limpar
            </button>
          )}
        </div>
      )}

      {/* ── sem arquivo ── */}
      {dados.length === 0 && (
        <div style={{ textAlign: 'center', padding: 80, color: '#9ca3af', background: '#fff', borderRadius: 12, border: '1px dashed #d1d5db' }}>
          <i className="ti ti-file-spreadsheet" style={{ fontSize: 48, display: 'block', marginBottom: 12, color: '#d1d5db' }}></i>
          <div style={{ fontWeight: 500, marginBottom: 4 }}>Nenhum arquivo carregado</div>
          <div style={{ fontSize: 12 }}>Carregue o relatório de abastecimento em Excel para visualizar as médias de consumo</div>
        </div>
      )}

      {/* ── aguardando motorista ── */}
      {dados.length > 0 && !motorista && (
        <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af', background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb' }}>
          <i className="ti ti-user-search" style={{ fontSize: 40, display: 'block', marginBottom: 8 }}></i>
          Selecione um motorista para ver o relatório
        </div>
      )}

      {/* ── RESUMO MENSAL (sem mês selecionado) ── */}
      {motorista && !mesSel && resumoMensal.length > 0 && (
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: 8 }}>
            <i className="ti ti-chart-line" style={{ color: '#EB3238', fontSize: 16 }}></i>
            <span style={{ fontWeight: 600, fontSize: 14, color: '#1a1a2e' }}>
              Resumo mensal — {motorista.split(' ').slice(0, 2).join(' ')}
            </span>
            <span style={{ marginLeft: 'auto', fontSize: 12, color: '#9ca3af' }}>Clique em um mês para detalhar</span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  {['Mês','Distância (km)','Litros Diesel','Média Real (km/L)','Média Sug (km/L)','% Atingido','Custo Total'].map(h => (
                    <th key={h} style={{ padding: '10px 16px', textAlign: h === 'Mês' ? 'left' : 'right', fontSize: 11, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.4px', borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {resumoMensal.map(m => (
                  <tr key={m.chave}
                    onClick={() => setMesSel(m.chave)}
                    style={{ cursor: 'pointer', transition: 'background 0.15s' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#f0f9ff'}
                    onMouseLeave={e => e.currentTarget.style.background = ''}
                  >
                    <td style={{ padding: '12px 16px', borderBottom: '1px solid #f3f4f6', fontWeight: 600, color: '#1a1a2e' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <i className="ti ti-calendar" style={{ fontSize: 13, color: '#EB3238' }}></i>
                        {fmtMes(m.ano, m.mes)}
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', borderBottom: '1px solid #f3f4f6', color: '#374151' }}>{fmtN(m.totalKm, 0)} km</td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', borderBottom: '1px solid #f3f4f6', color: '#374151' }}>{fmtN(m.totalLitros)} L</td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', borderBottom: '1px solid #f3f4f6', fontWeight: 600, color: '#1a1a2e' }}>{fmtN(m.mediaReal)}</td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', borderBottom: '1px solid #f3f4f6', color: '#6b7280' }}>{fmtN(m.mediaSug)}</td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', borderBottom: '1px solid #f3f4f6' }}>
                      <span style={{ fontWeight: 700, color: corPerc(m.perc), fontSize: 13 }}>{fmtN(m.perc, 1)}%</span>
                      {/* barra visual */}
                      <div style={{ marginTop: 4, height: 4, borderRadius: 2, background: '#e5e7eb', width: 80, marginLeft: 'auto' }}>
                        <div style={{ height: '100%', borderRadius: 2, background: corPerc(m.perc), width: `${Math.min(m.perc, 100)}%` }}></div>
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', borderBottom: '1px solid #f3f4f6', fontWeight: 600, color: '#374151' }}>{fmtR(m.totalGasto)}</td>
                  </tr>
                ))}
              </tbody>
              {/* totais */}
              {resumoMensal.length > 1 && (() => {
                const totKm    = resumoMensal.reduce((s, m) => s + m.totalKm, 0);
                const totLit   = resumoMensal.reduce((s, m) => s + m.totalLitros, 0);
                const totGasto = resumoMensal.reduce((s, m) => s + m.totalGasto, 0);
                const mediaG   = totLit > 0 ? totKm / totLit : 0;
                const sugsG    = resumoMensal.filter(m => m.mediaSug > 0);
                const mediaSG  = sugsG.length > 0 ? sugsG.reduce((s, m) => s + m.mediaSug, 0) / sugsG.length : 0;
                const percG    = mediaSG > 0 ? (mediaG / mediaSG) * 100 : 0;
                return (
                  <tfoot>
                    <tr style={{ background: '#f8fafc', fontWeight: 700 }}>
                      <td style={{ padding: '12px 16px', color: '#374151' }}>TOTAL / MÉDIA GERAL</td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', color: '#1a1a2e' }}>{fmtN(totKm, 0)} km</td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', color: '#1a1a2e' }}>{fmtN(totLit)} L</td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', color: '#1a1a2e' }}>{fmtN(mediaG)}</td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', color: '#6b7280' }}>{fmtN(mediaSG)}</td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', color: corPerc(percG) }}>{fmtN(percG, 1)}%</td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', color: '#1a1a2e' }}>{fmtR(totGasto)}</td>
                    </tr>
                  </tfoot>
                );
              })()}
            </table>
          </div>
        </div>
      )}

      {/* ── DETALHE MÊS ── */}
      {motorista && mesSel && summaryMes && (
        <div>
          {/* botão voltar */}
          <button
            onClick={() => setMesSel('')}
            style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16, padding: '7px 14px', border: '1px solid #e5e7eb', borderRadius: 8, background: '#fff', fontSize: 12, color: '#374151', cursor: 'pointer' }}
          >
            <i className="ti ti-arrow-left"></i> Voltar ao resumo
          </button>

          {/* cards summary */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
            {card('Distância', `${fmtN(summaryMes.totalKm, 0)} km`)}
            {card('Litros Diesel', `${fmtN(summaryMes.totalLit)} L`)}
            {card('Média Real', `${fmtN(summaryMes.mediaReal)} km/L`, 'realizado', summaryMes.perc >= 100 ? '#16a34a' : summaryMes.perc >= 85 ? '#d97706' : '#dc2626')}
            {card('Média Sugerida', `${fmtN(summaryMes.mediaSug)} km/L`, 'referência')}
            {card('% Atingido', `${fmtN(summaryMes.perc, 1)}%`, '', corPerc(summaryMes.perc))}
            {card('Custo por km', `R$ ${fmtN(summaryMes.custoPorKm, 4)}`)}
            {card('Total Gasto', fmtR(summaryMes.totalGasto), 'diesel + arla')}
          </div>

          {/* tabela detalhe */}
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: 8 }}>
              <i className="ti ti-list-details" style={{ color: '#EB3238', fontSize: 15 }}></i>
              <span style={{ fontWeight: 600, fontSize: 13, color: '#1a1a2e' }}>
                Abastecimentos — {fmtMes(...mesSel.split('-').map(Number))}
              </span>
              <span style={{ marginLeft: 'auto', fontSize: 12, color: '#9ca3af' }}>{detalhe.length} registros</span>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    {['Data','Placa','Produto','Litros','Distância','Média Real','Média Sug','%','Vlr Total','Posto'].map(h => (
                      <th key={h} style={{ padding: '9px 12px', textAlign: ['Litros','Distância','Média Real','Média Sug','%','Vlr Total'].includes(h) ? 'right' : 'left', fontSize: 10, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.4px', borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {detalhe.map((r, i) => {
                    const isDiesel = r.produto.toLowerCase().includes('diesel');
                    const perc = r.mediaSug > 0 ? (r.mediaReal / r.mediaSug) * 100 : null;
                    return (
                      <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                        <td style={{ padding: '9px 12px', borderBottom: '1px solid #f3f4f6', color: '#374151', whiteSpace: 'nowrap' }}>{fmtDt(r.data)}</td>
                        <td style={{ padding: '9px 12px', borderBottom: '1px solid #f3f4f6', fontWeight: 600, color: '#1a1a2e' }}>{r.placa}</td>
                        <td style={{ padding: '9px 12px', borderBottom: '1px solid #f3f4f6' }}>
                          <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600, background: isDiesel ? '#eff6ff' : '#f0fdf4', color: isDiesel ? '#1d4ed8' : '#15803d' }}>
                            {isDiesel ? 'Diesel' : 'Arla'}
                          </span>
                        </td>
                        <td style={{ padding: '9px 12px', borderBottom: '1px solid #f3f4f6', textAlign: 'right', color: '#374151' }}>{fmtN(r.litros)}</td>
                        <td style={{ padding: '9px 12px', borderBottom: '1px solid #f3f4f6', textAlign: 'right', color: '#374151' }}>{r.distancia ? `${fmtN(r.distancia, 0)} km` : '—'}</td>
                        <td style={{ padding: '9px 12px', borderBottom: '1px solid #f3f4f6', textAlign: 'right', fontWeight: 600, color: '#1a1a2e' }}>{isDiesel && r.mediaReal ? fmtN(r.mediaReal) : '—'}</td>
                        <td style={{ padding: '9px 12px', borderBottom: '1px solid #f3f4f6', textAlign: 'right', color: '#6b7280' }}>{isDiesel && r.mediaSug ? fmtN(r.mediaSug) : '—'}</td>
                        <td style={{ padding: '9px 12px', borderBottom: '1px solid #f3f4f6', textAlign: 'right' }}>
                          {perc !== null && isDiesel
                            ? <span style={{ fontWeight: 700, color: corPerc(perc) }}>{fmtN(perc, 0)}%</span>
                            : '—'}
                        </td>
                        <td style={{ padding: '9px 12px', borderBottom: '1px solid #f3f4f6', textAlign: 'right', fontWeight: 600, color: '#374151' }}>{fmtR(r.vlrTotal)}</td>
                        <td style={{ padding: '9px 12px', borderBottom: '1px solid #f3f4f6', color: '#6b7280', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.posto}</td>
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

import { useState, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx-js-style';
import api from '../../services/api';
import toast from 'react-hot-toast';

const fmt    = v => `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
const fmtData = iso => iso
  ? new Date(iso.slice(0,10) + 'T12:00:00').toLocaleDateString('pt-BR')
  : '—';

const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
               'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

function labelMes(iso) {
  if (!iso) return '—';
  const d = new Date(iso.slice(0,10) + 'T12:00:00');
  return `${MESES[d.getMonth()]} ${d.getFullYear()}`;
}

function agruparPorMes(lista) {
  const grupos = {};
  for (const f of lista) {
    const chave = labelMes(f.periodoInicio);
    if (!grupos[chave]) grupos[chave] = [];
    grupos[chave].push(f);
  }
  return grupos;
}

function fileParaBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = e => resolve(e.target.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function Fechamentos() {
  const [fechamentos, setFechamentos]   = useState([]);
  const [loading, setLoading]           = useState(true);
  const [expandidos, setExpandidos]     = useState({});

  // Upload / parse
  const [parseando, setParseando]       = useState(false);
  const [preview, setPreview]           = useState(null); // dados parseados antes de salvar
  const [salvando, setSalvando]         = useState(false);
  const fileRef = useRef();

  useEffect(() => { carregar(); }, []);

  async function carregar() {
    setLoading(true);
    try {
      const { data } = await api.get('/fechamentos');
      setFechamentos(data);
    } catch { toast.error('Erro ao carregar fechamentos'); }
    finally { setLoading(false); }
  }

  async function onArquivo(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (file.type !== 'application/pdf') { toast.error('Selecione um arquivo PDF'); return; }
    setParseando(true);
    setPreview(null);
    try {
      const base64 = await fileParaBase64(file);
      const { data } = await api.post('/fechamentos/parsear', {
        arquivoBase64: base64,
        arquivoNome: file.name,
      });
      setPreview(data);
      toast.success(`${data.placas.length} placa(s) encontrada(s)`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao processar PDF');
    } finally {
      setParseando(false);
      e.target.value = '';
    }
  }

  async function salvar() {
    if (!preview || salvando) return;
    setSalvando(true);
    try {
      await api.post('/fechamentos', preview);
      toast.success('Fechamento salvo!');
      setPreview(null);
      carregar();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erro ao salvar');
    } finally { setSalvando(false); }
  }

  function exportarXlsx(f) {
    const periodo = `${fmtData(f.periodoInicio)} a ${fmtData(f.periodoFim)}`;

    // Formato idêntico ao padrão IMPORTAÇÃO ABASTECIMENTO
    const linhas = [
      // Linha 1: empresa + categorias nas colunas F, G, H
      [f.empresa, null, null, null, null, 'LUBRIFICAÇÃO', 'ABASTECIMENTO', 'LAVAGENS'],
      // Linha 2: período
      [`Período: ${periodo}`, null, null, null, null, null, null, null],
      // Linha 3: cabeçalho
      ['PLACA', 'MODELO', 'DESPESAS', 'A VISTA', 'TOTAL', null, null, null],
      // Dados: placa, modelo, valor em DESPESAS (cols D e E ficam null)
      ...f.placas.map(p => [
        p.placa,
        p.modelo || '',
        Number(p.totalDespesas),
        null,
        null,
        null, null, null,
      ]),
    ];

    const ws = XLSX.utils.aoa_to_sheet(linhas);

    // Larguras das colunas
    ws['!cols'] = [
      { wch: 12 }, // PLACA
      { wch: 28 }, // MODELO
      { wch: 16 }, // DESPESAS
      { wch: 12 }, // A VISTA
      { wch: 12 }, // TOTAL
      { wch: 14 }, // LUBRIFICAÇÃO
      { wch: 14 }, // ABASTECIMENTO
      { wch: 12 }, // LAVAGENS
    ];

    // ── Estilos ──
    const sEmpresa = {
      font: { bold: true, sz: 12, color: { rgb: 'FFFFFF' } },
      fill: { fgColor: { rgb: 'C00000' } },
      alignment: { horizontal: 'left', vertical: 'center' },
    };
    const sCategoria = {
      font: { bold: true, sz: 11, color: { rgb: 'FFFFFF' } },
      fill: { fgColor: { rgb: 'C00000' } },
      alignment: { horizontal: 'center', vertical: 'center' },
    };
    const sPeriodo = {
      font: { italic: true, sz: 10, color: { rgb: '595959' } },
      fill: { fgColor: { rgb: 'F2F2F2' } },
      alignment: { horizontal: 'left', vertical: 'center' },
    };
    const sHeader = {
      font: { bold: true, sz: 10, color: { rgb: 'FFFFFF' } },
      fill: { fgColor: { rgb: '404040' } },
      alignment: { horizontal: 'center', vertical: 'center' },
      border: {
        bottom: { style: 'thin', color: { rgb: '000000' } },
      },
    };
    const sDado = {
      font: { sz: 10 },
      border: {
        top:    { style: 'thin', color: { rgb: 'D1D5DB' } },
        bottom: { style: 'thin', color: { rgb: 'D1D5DB' } },
        left:   { style: 'thin', color: { rgb: 'D1D5DB' } },
        right:  { style: 'thin', color: { rgb: 'D1D5DB' } },
      },
    };
    const sDadoNum = { ...sDado, alignment: { horizontal: 'right' }, z: '#,##0.00' };

    // Linha 0: empresa (col A) + categorias (cols F-H)
    const setStyle = (r, c, s) => {
      const addr = XLSX.utils.encode_cell({ r, c });
      if (ws[addr]) ws[addr].s = s;
    };
    setStyle(0, 0, sEmpresa);
    [5, 6, 7].forEach(c => setStyle(0, c, sCategoria));

    // Linha 1: período
    setStyle(1, 0, sPeriodo);

    // Linha 2: cabeçalho PLACA/MODELO/DESPESAS/A VISTA/TOTAL
    [0, 1, 2, 3, 4].forEach(c => setStyle(2, c, sHeader));

    // Linhas de dados
    for (let r = 3; r < 3 + f.placas.length; r++) {
      setStyle(r, 0, sDado);
      setStyle(r, 1, sDado);
      const cellNum = ws[XLSX.utils.encode_cell({ r, c: 2 })];
      if (cellNum) { cellNum.s = sDadoNum; cellNum.z = '#,##0.00'; }
    }

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Fechamento');

    const nomeArq = `fechamento_${(f.empresa || 'exportado').replace(/\s+/g, '_').toLowerCase()}_${fmtData(f.periodoInicio).replace(/\//g, '-')}.xlsx`;
    XLSX.writeFile(wb, nomeArq);
  }

  async function excluir(id) {
    if (!window.confirm('Excluir este fechamento?')) return;
    try {
      await api.delete(`/fechamentos/${id}`);
      toast.success('Excluído');
      setFechamentos(f => f.filter(x => x.id !== id));
    } catch { toast.error('Erro ao excluir'); }
  }

  const [showDebug, setShowDebug] = useState(false);

  // ── Totais do preview ──
  const totalGeral = preview?.placas.reduce((s, p) => s + Number(p.totalDespesas), 0) ?? 0;
  const duplicatas = preview?.duplicatas ?? [];
  const linhasDebug = preview?._linhasDebug ?? [];

  return (
    <div style={{ maxWidth:1100, margin:'0 auto' }}>
      {/* Cabeçalho */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:24 }}>
        <div>
          <h1 style={{ margin:0, fontSize:22, fontWeight:700, color:'#1a1a2e' }}>Fechamentos</h1>
          <p style={{ margin:'4px 0 0', fontSize:13, color:'#9ca3af' }}>Importe o relatório de Desempenho Operacional em PDF</p>
        </div>
        <button onClick={() => fileRef.current.click()} disabled={parseando}
          style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 20px', background:'#EB3238', color:'#fff', border:'none', borderRadius:9, fontSize:13, fontWeight:600, cursor:'pointer', opacity: parseando ? 0.7 : 1 }}>
          <i className={`ti ${parseando ? 'ti-loader-2' : 'ti-file-import'}`} style={{ fontSize:17 }}></i>
          {parseando ? 'Lendo PDF...' : 'Importar PDF'}
        </button>
        <input ref={fileRef} type="file" accept=".pdf" style={{ display:'none' }} onChange={onArquivo} />
      </div>

      {/* Preview após parse */}
      {preview && (
        <div style={{ background:'#fff', borderRadius:12, border:'2px solid #EB3238', marginBottom:24, overflow:'hidden' }}>
          {/* Header preview */}
          <div style={{ background:'#fff5f5', padding:'14px 20px', borderBottom:'1px solid #fecaca', display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:12 }}>
            <div>
              <div style={{ fontSize:13, fontWeight:700, color:'#EB3238', textTransform:'uppercase', letterSpacing:'0.4px', marginBottom:4 }}>
                Prévia — confirme e salve
              </div>
              <div style={{ fontSize:14, fontWeight:600, color:'#1a1a2e' }}>{preview.empresa}</div>
              <div style={{ fontSize:12, color:'#6b7280', marginTop:2 }}>
                Período: {fmtData(preview.periodoInicio)} até {fmtData(preview.periodoFim)}
              </div>
            </div>
            {/* Cards de totais */}
            <div style={{ display:'flex', gap:14, flexWrap:'wrap' }}>
              {[
                { label:'Placas', valor: preview.placas.length, cor:'#0891b2', raw: true },
                { label:'Total Despesas', valor: fmt(totalGeral), cor:'#1a1a2e' },
              ].map(c => (
                <div key={c.label} style={{ textAlign:'center', background:'#fff', borderRadius:8, border:'1px solid #f3f4f6', padding:'8px 18px' }}>
                  <div style={{ fontSize:11, color:'#9ca3af', textTransform:'uppercase', fontWeight:600, marginBottom:2 }}>{c.label}</div>
                  <div style={{ fontSize:15, fontWeight:700, color: c.cor }}>{c.valor}</div>
                </div>
              ))}
            </div>
            <div style={{ display:'flex', gap:8 }}>
              <button onClick={() => setPreview(null)}
                style={{ padding:'8px 16px', border:'1px solid #e5e7eb', borderRadius:8, background:'#fff', fontSize:13, cursor:'pointer', color:'#6b7280' }}>
                Cancelar
              </button>
              <button onClick={salvar} disabled={salvando}
                style={{ padding:'8px 18px', border:'none', borderRadius:8, background:'#16a34a', color:'#fff', fontSize:13, fontWeight:600, cursor:'pointer', opacity: salvando ? 0.7 : 1, display:'flex', alignItems:'center', gap:6 }}>
                <i className="ti ti-device-floppy" style={{ fontSize:15 }}></i>
                {salvando ? 'Salvando...' : 'Salvar Fechamento'}
              </button>
            </div>
          </div>

          {/* ── Alerta de diesel duplicado ── */}
          {duplicatas.length > 0 && (
            <div style={{ background:'#fffbeb', borderBottom:'1px solid #fde68a', padding:'14px 20px' }}>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
                <i className="ti ti-alert-triangle" style={{ fontSize:18, color:'#d97706' }}></i>
                <span style={{ fontWeight:700, fontSize:13, color:'#92400e' }}>
                  {duplicatas.length} ocorrência(s) de Óleo Diesel duplicado detectada(s)
                </span>
                <span style={{ fontSize:12, color:'#b45309' }}>— mesmo posto, mesmo dia</span>
              </div>
              <div style={{ overflowX:'auto' }}>
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                  <thead>
                    <tr style={{ background:'#fef3c7' }}>
                      {['Placa','Fornecedor','Data','Qtde','Valor','Lançamentos'].map(h => (
                        <th key={h} style={{ padding:'7px 12px', textAlign:'left', fontSize:11, fontWeight:600, color:'#92400e', textTransform:'uppercase', borderBottom:'1px solid #fde68a' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {duplicatas.map((d, i) => (
                      <tr key={i} style={{ borderBottom:'1px solid #fef3c7' }}>
                        <td style={{ padding:'7px 12px', fontWeight:700, fontFamily:'monospace', color:'#1a1a2e' }}>{d.placa}</td>
                        <td style={{ padding:'7px 12px', color:'#374151' }}>{d.fornecedor}</td>
                        <td style={{ padding:'7px 12px', color:'#374151', whiteSpace:'nowrap' }}>{d.data}</td>
                        <td style={{ padding:'7px 12px', color:'#374151' }}>{d.qtde}</td>
                        <td style={{ padding:'7px 12px', color:'#374151' }}>{d.valor}</td>
                        <td style={{ padding:'7px 12px' }}>
                          <span style={{ background:'#fbbf24', color:'#78350f', borderRadius:20, padding:'2px 9px', fontSize:11, fontWeight:700 }}>{d.ocorrencias}x</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── DEBUG: linhas extraídas pelo pdf-parse ── */}
          {linhasDebug.length > 0 && (
            <div style={{ borderTop:'1px solid #e5e7eb' }}>
              <button onClick={() => setShowDebug(v => !v)}
                style={{ width:'100%', padding:'8px 16px', background:'#f9fafb', border:'none', textAlign:'left', cursor:'pointer', fontSize:12, color:'#6b7280', display:'flex', alignItems:'center', gap:6 }}>
                <i className={`ti ${showDebug ? 'ti-chevron-up' : 'ti-chevron-down'}`}></i>
                🐛 Debug — {linhasDebug.length} linhas extraídas do PDF (clique para ver)
              </button>
              {showDebug && (
                <div style={{ padding:'12px 16px', background:'#1e1e2e', overflowX:'auto', maxHeight:320, overflowY:'auto' }}>
                  {linhasDebug.map((l, i) => (
                    <div key={i} style={{ fontFamily:'monospace', fontSize:11, color: /diesel/i.test(l) ? '#fbbf24' : /\d{2}\/\d{2}\/\d{4}/.test(l) ? '#86efac' : '#cbd5e1', whiteSpace:'pre', marginBottom:1 }}>
                      <span style={{ color:'#64748b', marginRight:8 }}>{String(i).padStart(3,'0')}</span>{l}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tabela preview */}
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
              <thead>
                <tr style={{ background:'#f9fafb' }}>
                  {['Placa','Modelo','Total Despesas'].map(h => (
                    <th key={h} style={{ padding:'9px 16px', textAlign:'left', fontSize:11, fontWeight:600, color:'#6b7280', textTransform:'uppercase', borderBottom:'1px solid #e5e7eb' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.placas.map((p, i) => (
                  <tr key={i} style={{ borderBottom:'1px solid #f3f4f6' }}>
                    <td style={{ padding:'9px 16px', fontWeight:700, color:'#1a1a2e', fontFamily:'monospace', fontSize:14 }}>{p.placa}</td>
                    <td style={{ padding:'9px 16px', color:'#374151' }}>{p.modelo || '—'}</td>
                    <td style={{ padding:'9px 16px', fontWeight:600, color:'#1a1a2e' }}>{fmt(p.totalDespesas)}</td>
                  </tr>
                ))}
                {/* Total */}
                <tr style={{ background:'#f9fafb', fontWeight:700 }}>
                  <td colSpan={2} style={{ padding:'10px 16px', color:'#6b7280', fontSize:12 }}>TOTAL — {preview.placas.length} placa(s)</td>
                  <td style={{ padding:'10px 16px', color:'#1a1a2e' }}>{fmt(totalGeral)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Lista de fechamentos salvos */}
      {loading ? (
        <div style={{ textAlign:'center', padding:60, color:'#9ca3af' }}>Carregando...</div>
      ) : fechamentos.length === 0 ? (
        <div style={{ textAlign:'center', padding:60, color:'#9ca3af', background:'#fff', borderRadius:12, border:'1px solid #e5e7eb' }}>
          <i className="ti ti-file-report" style={{ fontSize:40, display:'block', marginBottom:8 }}></i>
          Nenhum fechamento importado ainda.
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:24 }}>
          {Object.entries(agruparPorMes(fechamentos)).map(([mes, lista]) => (
            <div key={mes}>
              {/* Separador de mês */}
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
                <span style={{ fontSize:12, fontWeight:700, color:'#EB3238', textTransform:'uppercase', letterSpacing:'0.5px' }}>{mes}</span>
                <div style={{ flex:1, height:1, background:'#f3f4f6' }} />
                <span style={{ fontSize:11, color:'#9ca3af' }}>{lista.length} fechamento(s)</span>
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {lista.map(f => {
            const totalF  = f.placas.reduce((s, p) => s + Number(p.totalDespesas), 0);
            const exp     = expandidos[f.id];
            return (
              <div key={f.id} style={{ background:'#fff', borderRadius:12, border:'1px solid #e5e7eb', overflow:'hidden' }}>
                {/* Linha principal */}
                <div style={{ padding:'14px 20px', display:'flex', alignItems:'center', gap:16, flexWrap:'wrap' }}>
                  {/* Empresa + Período */}
                  <div style={{ flex:1, minWidth:200 }}>
                    <div style={{ fontWeight:700, fontSize:14, color:'#1a1a2e' }}>{f.empresa}</div>
                    <div style={{ fontSize:12, color:'#9ca3af', marginTop:2 }}>
                      {fmtData(f.periodoInicio)} até {fmtData(f.periodoFim)}
                    </div>
                    {f.arquivoNome && (
                      <div style={{ fontSize:11, color:'#c4c4cc', marginTop:2 }}>
                        <i className="ti ti-file-type-pdf" style={{ fontSize:11 }}></i> {f.arquivoNome}
                      </div>
                    )}
                  </div>

                  {/* Métricas */}
                  <div style={{ display:'flex', gap:20, flexWrap:'wrap' }}>
                    <div style={{ textAlign:'center' }}>
                      <div style={{ fontSize:11, color:'#9ca3af', textTransform:'uppercase', fontWeight:600 }}>Placas</div>
                      <div style={{ fontSize:15, fontWeight:700, color:'#0891b2' }}>{f.placas.length}</div>
                    </div>
                    <div style={{ textAlign:'center' }}>
                      <div style={{ fontSize:11, color:'#9ca3af', textTransform:'uppercase', fontWeight:600 }}>Total Despesas</div>
                      <div style={{ fontSize:15, fontWeight:700, color:'#1a1a2e' }}>{fmt(totalF)}</div>
                    </div>
                  </div>

                  {/* Ações */}
                  <div style={{ display:'flex', gap:6 }}>
                    <button onClick={() => setExpandidos(e => ({ ...e, [f.id]: !e[f.id] }))}
                      style={{ padding:'6px 12px', border:'1px solid #e5e7eb', borderRadius:7, background: exp ? '#f0f9ff' : '#f9fafb', fontSize:12, cursor:'pointer', color: exp ? '#0891b2' : '#6b7280', display:'flex', alignItems:'center', gap:5 }}>
                      <i className={`ti ${exp ? 'ti-chevron-up' : 'ti-chevron-down'}`}></i>
                      {exp ? 'Fechar' : `Ver ${f.placas.length} placas`}
                    </button>
                    <button onClick={() => exportarXlsx(f)}
                      style={{ padding:'6px 12px', border:'1px solid #bbf7d0', borderRadius:7, background:'#f0fdf4', fontSize:12, cursor:'pointer', color:'#16a34a', display:'flex', alignItems:'center', gap:5 }}>
                      <i className="ti ti-table-export"></i> Exportar
                    </button>
                    <button onClick={() => excluir(f.id)}
                      style={{ padding:'6px 10px', border:'1px solid #fee2e2', borderRadius:7, background:'#fff5f5', fontSize:13, cursor:'pointer', color:'#dc2626' }}>
                      <i className="ti ti-trash"></i>
                    </button>
                  </div>

                  {/* Quem importou */}
                  <div style={{ fontSize:11, color:'#c4c4cc', width:'100%', marginTop:-8 }}>
                    <i className="ti ti-user-plus" style={{ fontSize:10 }}></i> {f.usuario?.nome} · {new Date(f.importadoEm).toLocaleString('pt-BR')}
                  </div>
                </div>

                {/* Tabela de placas expandida */}
                {exp && (
                  <div style={{ borderTop:'1px solid #f3f4f6' }}>
                    <div style={{ overflowX:'auto' }}>
                      <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
                        <thead>
                          <tr style={{ background:'#f9fafb' }}>
                            <th style={{ padding:'8px 16px', textAlign:'left', fontSize:11, fontWeight:600, color:'#6b7280', textTransform:'uppercase', borderBottom:'1px solid #e5e7eb' }}>#</th>
                            {['Placa','Modelo','Total Despesas'].map(h => (
                              <th key={h} style={{ padding:'8px 16px', textAlign:'left', fontSize:11, fontWeight:600, color:'#6b7280', textTransform:'uppercase', borderBottom:'1px solid #e5e7eb' }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {f.placas.map((p, i) => (
                            <tr key={p.id} style={{ borderBottom:'1px solid #f3f4f6' }}>
                              <td style={{ padding:'8px 16px', color:'#9ca3af', fontSize:11 }}>{i + 1}</td>
                              <td style={{ padding:'8px 16px', fontWeight:700, color:'#1a1a2e', fontFamily:'monospace', fontSize:13 }}>{p.placa}</td>
                              <td style={{ padding:'8px 16px', color:'#374151' }}>{p.modelo || '—'}</td>
                              <td style={{ padding:'8px 16px', fontWeight:600, color:'#1a1a2e' }}>{fmt(p.totalDespesas)}</td>
                            </tr>
                          ))}
                          {/* Total */}
                          <tr style={{ background:'#f9fafb', fontWeight:700 }}>
                            <td></td>
                            <td colSpan={2} style={{ padding:'9px 16px', color:'#6b7280', fontSize:12 }}>TOTAL</td>
                            <td style={{ padding:'9px 16px', color:'#1a1a2e' }}>{fmt(totalF)}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

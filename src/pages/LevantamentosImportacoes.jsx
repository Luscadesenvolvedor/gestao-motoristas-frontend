// v3
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

const norm = s => String(s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').trim();

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

export default function LevantamentosImportacoes() {
  const { isAdmin } = useAuth();
  const [lista, setLista]         = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [preview, setPreview]     = useState(null); // { nomeArquivo, registros, tipoPagamento, frota, semPlaca }
  const [salvando, setSalvando]   = useState(false);
  const [relatorio, setRelatorio] = useState(null); // { semPlaca: string[], totalImportados: number, nomeArquivo: string }
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
    try {
      const buf = await file.arrayBuffer();
      const wb  = XLSX.read(buf, { cellDates: true });
      const ws  = wb.Sheets[wb.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true });

      const header = (raw[0] || []).map(norm);
      const iMot = header.findIndex(h => h.includes('motorista'));
      const iVei = header.findIndex(h => h.includes('veiculo') || h.includes('placa') || h.includes('vei'));
      const iVal = header.findIndex(h => h.includes('valor'));
      const iMes = header.findIndex(h => h.includes('mes'));

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
      setPreview({ nomeArquivo: file.name, registros, tipoPagamento: '', frota: '' });
      toast.success(`${registros.length} registros lidos`);
    } catch (err) { toast.error('Erro ao ler arquivo: ' + err.message); }
    e.target.value = '';
  }

  async function handleTipoSelect(tipo) {
    const novo = { ...preview, tipoPagamento: tipo, semPlaca: null };
    setPreview(novo);
    if (tipo === 'custoFolha' && preview?.registros?.length) {
      try {
        const { data: existentes } = await api.get('/levantamentos-motoristas');
        const nomesExistentes = new Set(existentes.map(r => norm(r.motorista)));
        const nomesPlanilha = [...new Set(preview.registros.map(r => r.motorista))];
        const semPlaca = nomesPlanilha.filter(n => !nomesExistentes.has(norm(n)));
        setPreview(p => ({ ...p, semPlaca }));
      } catch { /* silencioso */ }
    }
  }

  async function salvar() {
    if (!preview) return;
    if (!preview.tipoPagamento) { toast.error('Selecione o tipo de pagamento'); return; }
    if (!preview.frota)         { toast.error('Selecione a frota'); return; }
    setSalvando(true);
    try {
      await api.post('/levantamentos-motoristas/importar', {
        nomeArquivo:   preview.nomeArquivo,
        registros:     preview.registros,
        tipoPagamento: preview.tipoPagamento,
        frota:         preview.frota,
      });
      toast.success('Importação salva!');
      // Se custo folha, mantém o relatório de não encontrados
      if (preview.tipoPagamento === 'custoFolha' && preview.semPlaca?.length > 0) {
        setRelatorio({
          semPlaca:        preview.semPlaca,
          totalImportados: [...new Set(preview.registros.map(r => r.motorista))].length,
          nomeArquivo:     preview.nomeArquivo,
        });
      }
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
          <button onClick={() => fileRef.current?.click()}
            style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 16px', background:'#EB3238', color:'#fff', border:'none', borderRadius:8, fontSize:13, fontWeight:600, cursor:'pointer' }}>
            <i className="ti ti-upload" style={{ fontSize:14 }}></i> Importar Planilha
          </button>
        </div>
      </div>

      {/* Preview */}
      {preview && (
        <div style={{ background:'#fffbeb', border:'1px solid #fde68a', borderRadius:12, padding:'16px 20px', marginBottom:20 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14 }}>
            <i className="ti ti-file-spreadsheet" style={{ fontSize:20, color:'#d97706' }}></i>
            <div>
              <div style={{ fontWeight:600, fontSize:13, color:'#92400e' }}>{preview.nomeArquivo}</div>
              <div style={{ fontSize:11, color:'#b45309' }}>{preview.registros.length} registros lidos — preencha os campos abaixo para salvar</div>
            </div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr auto auto', gap:10, alignItems:'end' }}>
            <div>
              <div style={{ fontSize:10, fontWeight:700, color:'#92400e', textTransform:'uppercase', marginBottom:4 }}>Tipo de Pagamento</div>
              <select value={preview.tipoPagamento}
                onChange={e => handleTipoSelect(e.target.value)}
                style={{ width:'100%', padding:'7px 10px', border:'1.5px solid #fbbf24', borderRadius:8, fontSize:13, background:'#fff', cursor:'pointer', outline:'none' }}>
                <option value="">— selecione —</option>
                {TIPOS.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <div style={{ fontSize:10, fontWeight:700, color:'#92400e', textTransform:'uppercase', marginBottom:4 }}>Frota</div>
              <select value={preview.frota}
                onChange={e => setPreview(p => ({ ...p, frota: e.target.value }))}
                style={{ width:'100%', padding:'7px 10px', border:'1.5px solid #fbbf24', borderRadius:8, fontSize:13, background:'#fff', cursor:'pointer', outline:'none' }}>
                <option value="">— selecione —</option>
                <option value="FROTA">FROTA</option>
                <option value="MELI">MELI</option>
              </select>
            </div>
            <button onClick={() => setPreview(null)}
              style={{ padding:'7px 14px', border:'1px solid #d1d5db', borderRadius:8, background:'#fff', fontSize:12, cursor:'pointer', whiteSpace:'nowrap' }}>
              Cancelar
            </button>
            <button onClick={salvar} disabled={salvando}
              style={{ padding:'7px 16px', border:'none', borderRadius:8, background:'#16a34a', color:'#fff', fontSize:12, fontWeight:600, cursor:'pointer', whiteSpace:'nowrap' }}>
              {salvando ? 'Salvando...' : 'Salvar no banco'}
            </button>
          </div>

          {/* Aviso de não encontrados (visível já no preview) */}
          {preview.tipoPagamento === 'custoFolha' && preview.semPlaca?.length > 0 && (
            <div style={{ marginTop:14, background:'#fef3c7', border:'1px solid #fbbf24', borderRadius:8, padding:'10px 14px' }}>
              <div style={{ fontWeight:700, fontSize:12, color:'#92400e', marginBottom:6, display:'flex', alignItems:'center', gap:6 }}>
                <i className="ti ti-alert-triangle" style={{ fontSize:14 }}></i>
                {preview.semPlaca.length} motorista(s) sem placa identificada — serão importados sem vínculo de veículo
              </div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
                {preview.semPlaca.map(n => (
                  <span key={n} style={{ padding:'2px 8px', borderRadius:20, background:'#fde68a', color:'#92400e', fontSize:11, fontWeight:600 }}>{n}</span>
                ))}
              </div>
            </div>
          )}
          {preview.tipoPagamento === 'custoFolha' && preview.semPlaca?.length === 0 && (
            <div style={{ marginTop:14, background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:8, padding:'8px 14px', fontSize:12, color:'#166534', display:'flex', alignItems:'center', gap:6 }}>
              <i className="ti ti-circle-check" style={{ fontSize:14 }}></i> Todos os motoristas foram identificados nos registros anteriores.
            </div>
          )}
        </div>
      )}

      {/* Relatório pós-importação — motoristas sem placa */}
      {relatorio && (
        <div style={{ background:'#fff', border:'1px solid #fbbf24', borderRadius:12, padding:20, marginBottom:20 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <div style={{ width:36, height:36, borderRadius:8, background:'#fef3c7', display:'flex', alignItems:'center', justifyContent:'center' }}>
                <i className="ti ti-alert-triangle" style={{ fontSize:20, color:'#d97706' }}></i>
              </div>
              <div>
                <div style={{ fontWeight:700, fontSize:14, color:'#1a1a2e' }}>Relatório de Inconsistências — {relatorio.nomeArquivo}</div>
                <div style={{ fontSize:12, color:'#6b7280', marginTop:2 }}>
                  {relatorio.semPlaca.length} de {relatorio.totalImportados} motoristas sem placa identificada nos registros anteriores
                </div>
              </div>
            </div>
            <button onClick={() => setRelatorio(null)}
              style={{ padding:'5px 12px', border:'1px solid #d1d5db', borderRadius:8, background:'#fff', fontSize:12, cursor:'pointer', color:'#6b7280' }}>
              Fechar
            </button>
          </div>
          <div style={{ background:'#fafafa', border:'1px solid #e5e7eb', borderRadius:8, overflow:'hidden' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
              <thead>
                <tr style={{ background:'#f3f4f6' }}>
                  <th style={{ padding:'8px 14px', textAlign:'left', fontSize:11, fontWeight:700, color:'#374151', textTransform:'uppercase', borderBottom:'1px solid #e5e7eb' }}>#</th>
                  <th style={{ padding:'8px 14px', textAlign:'left', fontSize:11, fontWeight:700, color:'#374151', textTransform:'uppercase', borderBottom:'1px solid #e5e7eb' }}>Motorista</th>
                  <th style={{ padding:'8px 14px', textAlign:'left', fontSize:11, fontWeight:700, color:'#374151', textTransform:'uppercase', borderBottom:'1px solid #e5e7eb' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {relatorio.semPlaca.map((nome, i) => (
                  <tr key={nome} style={{ borderBottom:'1px solid #f3f4f6', background: i%2===0?'#fff':'#fafafa' }}>
                    <td style={{ padding:'9px 14px', color:'#9ca3af', fontSize:12 }}>{i+1}</td>
                    <td style={{ padding:'9px 14px', fontWeight:600, color:'#1a1a2e' }}>{nome}</td>
                    <td style={{ padding:'9px 14px' }}>
                      <span style={{ padding:'2px 8px', borderRadius:20, fontSize:11, fontWeight:700, background:'#fef3c7', color:'#92400e', border:'1px solid #fbbf24' }}>
                        Sem placa identificada
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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

      {/* Tabela */}
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
  );
}

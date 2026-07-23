import { useState, useEffect, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import api from '../../services/api';

const fmt = v => `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
const fmtData = d => d ? new Date(d + 'T12:00:00').toLocaleDateString('pt-BR') : '—';

const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

function emDias(d) {
  const hoje = new Date(); hoje.setHours(0,0,0,0);
  return Math.ceil((new Date(d + 'T12:00:00') - hoje) / 86400000);
}

export default function RelatoriosAbastecimento() {
  const [lista, setLista] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mesesExibir, setMesesExibir] = useState(6);

  useEffect(() => {
    api.get('/notas-abastecimento')
      .then(r => setLista(r.data))
      .finally(() => setLoading(false));
  }, []);

  // Totais gerais
  const totalNotas    = lista.filter(i => i.tipo === 'nota').length;
  const totalRemessas = lista.filter(i => i.tipo === 'remessa').length;
  const totalValor    = lista.reduce((s, i) => s + Number(i.valor), 0);
  const totalPago     = lista.filter(i => i.status === 'pago').reduce((s, i) => s + Number(i.valor), 0);
  const totalPendente = lista.filter(i => i.status !== 'pago').reduce((s, i) => s + Number(i.valor), 0);
  const totalVencido  = lista.filter(i => i.status === 'vencido').reduce((s, i) => s + Number(i.valor), 0);

  // Dados por mês (últimos N meses)
  const dadosMes = useMemo(() => {
    const hoje = new Date();
    const meses = [];
    for (let i = mesesExibir - 1; i >= 0; i--) {
      const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
      const chave = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
      const label = `${MESES[d.getMonth()]}/${String(d.getFullYear()).slice(2)}`;
      const itens = lista.filter(item => {
        const v = item.dataVencimento?.slice?.(0,7);
        return v === chave;
      });
      meses.push({
        chave, label,
        nota:    itens.filter(i => i.tipo === 'nota').reduce((s,i) => s + Number(i.valor), 0),
        remessa: itens.filter(i => i.tipo === 'remessa').reduce((s,i) => s + Number(i.valor), 0),
        pago:    itens.filter(i => i.status === 'pago').reduce((s,i) => s + Number(i.valor), 0),
      });
    }
    return meses;
  }, [lista, mesesExibir]);

  // Por fornecedor
  const porFornecedor = useMemo(() => {
    const map = {};
    lista.forEach(i => {
      if (!map[i.fornecedor]) map[i.fornecedor] = { fornecedor: i.fornecedor, total: 0, count: 0, pago: 0 };
      map[i.fornecedor].total += Number(i.valor);
      map[i.fornecedor].count++;
      if (i.status === 'pago') map[i.fornecedor].pago += Number(i.valor);
    });
    return Object.values(map).sort((a,b) => b.total - a.total).slice(0,8);
  }, [lista]);

  // Próximos vencimentos (até 30 dias, não pagos)
  const proximosVenc = useMemo(() =>
    lista
      .filter(i => i.status !== 'pago')
      .map(i => ({ ...i, dias: emDias(i.dataVencimento?.slice?.(0,10)) }))
      .filter(i => i.dias <= 30)
      .sort((a,b) => a.dias - b.dias)
      .slice(0, 10)
  , [lista]);

  if (loading) return <div style={{ textAlign:'center', padding:60, color:'#9ca3af' }}>Carregando...</div>;

  return (
    <div>
      <div style={{ marginBottom:20 }}>
        <h2 style={{ fontSize:20, fontWeight:600, color:'#1a1a2e', margin:0 }}>Relatórios</h2>
        <p style={{ fontSize:13, color:'#6b7280', marginTop:2 }}>Visão consolidada de notas e remessas</p>
      </div>

      {/* Cards resumo */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:14, marginBottom:24 }}>
        {[
          { label:'Total Geral',    valor: totalValor,    cor:'#1a1a2e', icone:'ti-file-dollar', bg:'#f8fafc', sub:`${totalNotas} notas · ${totalRemessas} remessas` },
          { label:'Total Pago',     valor: totalPago,     cor:'#16a34a', icone:'ti-circle-check', bg:'#f0fdf4', sub:`${lista.filter(i=>i.status==='pago').length} registros` },
          { label:'Total Pendente', valor: totalPendente, cor: totalVencido > 0 ? '#dc2626' : '#d97706', icone: totalVencido > 0 ? 'ti-alert-triangle' : 'ti-clock', bg: totalVencido > 0 ? '#fff5f5' : '#fffbeb',
            sub: totalVencido > 0 ? `${fmt(totalVencido)} vencido` : `${lista.filter(i=>i.status!=='pago').length} registros` },
        ].map(c => (
          <div key={c.label} style={{ background:c.bg, border:`1px solid ${c.cor}22`, borderRadius:12, padding:'20px 22px' }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
              <div style={{ width:36, height:36, borderRadius:9, background:`${c.cor}18`, display:'flex', alignItems:'center', justifyContent:'center' }}>
                <i className={`ti ${c.icone}`} style={{ fontSize:18, color:c.cor }}></i>
              </div>
              <span style={{ fontSize:11, fontWeight:600, color:'#6b7280', textTransform:'uppercase', letterSpacing:'0.4px' }}>{c.label}</span>
            </div>
            <div style={{ fontSize:24, fontWeight:700, color:c.cor }}>{fmt(c.valor)}</div>
            <div style={{ fontSize:12, color:'#9ca3af', marginTop:3 }}>{c.sub}</div>
          </div>
        ))}
      </div>

      {/* Gráfico por mês */}
      <div style={{ background:'#fff', borderRadius:12, border:'1px solid #e5e7eb', padding:'20px 24px', marginBottom:20 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
          <span style={{ fontSize:14, fontWeight:600, color:'#1a1a2e' }}>Valores por Mês de Vencimento</span>
          <div style={{ display:'flex', gap:6 }}>
            {[3,6,12].map(m => (
              <button key={m} onClick={() => setMesesExibir(m)}
                style={{ padding:'4px 14px', borderRadius:20, border:`1px solid ${mesesExibir===m ? '#EB3238' : '#d1d5db'}`,
                  background: mesesExibir===m ? '#EB3238' : '#fff', color: mesesExibir===m ? '#fff' : '#374151', fontSize:12, cursor:'pointer' }}>
                {m}m
              </button>
            ))}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={dadosMes} barCategoryGap="30%" barGap={4}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="label" tick={{ fontSize:12, fill:'#6b7280' }} />
            <YAxis tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} tick={{ fontSize:11, fill:'#6b7280' }} />
            <Tooltip formatter={(v, name) => [fmt(v), name]} labelStyle={{ fontWeight:600 }} />
            <Legend wrapperStyle={{ fontSize:12 }} />
            <Bar dataKey="nota"    name="Notas"    fill="#1d4ed8" radius={[4,4,0,0]} />
            <Bar dataKey="remessa" name="Remessas" fill="#6d28d9" radius={[4,4,0,0]} />
            <Bar dataKey="pago"    name="Pagos"    fill="#16a34a" radius={[4,4,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
        {/* Por fornecedor */}
        <div style={{ background:'#fff', borderRadius:12, border:'1px solid #e5e7eb', padding:'20px 22px' }}>
          <h3 style={{ fontSize:14, fontWeight:600, color:'#1a1a2e', margin:'0 0 14px' }}>Por Fornecedor</h3>
          {porFornecedor.length === 0 ? (
            <p style={{ color:'#9ca3af', fontSize:13 }}>Nenhum dado</p>
          ) : porFornecedor.map(f => {
            const pct = totalValor > 0 ? (f.total / totalValor) * 100 : 0;
            return (
              <div key={f.fornecedor} style={{ marginBottom:12 }}>
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:4 }}>
                  <span style={{ fontWeight:500, color:'#374151' }}>{f.fornecedor}</span>
                  <span style={{ color:'#6b7280' }}>{fmt(f.total)} ({f.count})</span>
                </div>
                <div style={{ height:6, background:'#f3f4f6', borderRadius:3, overflow:'hidden' }}>
                  <div style={{ width:`${pct}%`, height:'100%', background:'#EB3238', borderRadius:3, transition:'width 0.3s' }} />
                </div>
              </div>
            );
          })}
        </div>

        {/* Próximos vencimentos */}
        <div style={{ background:'#fff', borderRadius:12, border:'1px solid #e5e7eb', padding:'20px 22px' }}>
          <h3 style={{ fontSize:14, fontWeight:600, color:'#1a1a2e', margin:'0 0 14px' }}>Vencimentos Próximos (30 dias)</h3>
          {proximosVenc.length === 0 ? (
            <p style={{ color:'#16a34a', fontSize:13 }}>✓ Nenhum vencimento nos próximos 30 dias</p>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {proximosVenc.map(item => {
                const cor = item.dias < 0 ? '#dc2626' : item.dias <= 3 ? '#d97706' : '#374151';
                const bg  = item.dias < 0 ? '#fff5f5' : item.dias <= 3 ? '#fffbeb' : '#f9fafb';
                return (
                  <div key={item.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 10px', background:bg, borderRadius:8 }}>
                    <div>
                      <div style={{ fontSize:12, fontWeight:500, color:'#374151' }}>{item.fornecedor}</div>
                      <div style={{ fontSize:11, color:'#6b7280' }}>{item.tipo === 'nota' ? 'Nota' : 'Remessa'} #{item.numero}</div>
                    </div>
                    <div style={{ textAlign:'right' }}>
                      <div style={{ fontSize:12, fontWeight:600, color:cor }}>
                        {item.dias < 0 ? `${Math.abs(item.dias)}d atrasado` : item.dias === 0 ? 'Hoje' : `${item.dias}d`}
                      </div>
                      <div style={{ fontSize:11, color:'#6b7280' }}>{fmt(item.valor)}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

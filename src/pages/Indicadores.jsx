import { useState, useEffect } from 'react';
import api from '../services/api';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart } from 'recharts';

const MESES_NOMES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const FROTAS = [
  { key:'buzin', label:'BUZIN', cor:'#EB3238' },
  { key:'lbm',   label:'LBM',   cor:'#1a1a2e' },
  { key:'meli_buzin',label:'MELI BUZIN',cor:'#f97316' },
  { key:'meli_lbm',  label:'MELI LBM',  cor:'#8b5cf6' },
];

const TIPOS_RAPIDOS = [
  { key:'fluxos', label:'Fluxos Diários', nomes:['reembolso','vale pessoal','diarias','diária','diárias'] },
  { key:'saldos', label:'Saldos', nomes:['saldo'] },
  { key:'folgas', label:'Folgas', nomes:['folga'] },
];

export default function Indicadores() {
  const [lista, setLista] = useState([]);
  const [ano, setAno] = useState(new Date().getFullYear());
  const [mes, setMes] = useState('');

  useEffect(() => { carregar(); }, [ano, mes]);

  async function carregar() {
    const { data } = await api.get('/solicitacoes');
    setLista(data.solicitacoes);
  }

  // Filtra por ano e mes se selecionado
  const listaFiltrada = lista.filter(s => {
    const d = new Date(s.data);
    if (d.getFullYear() !== ano) return false;
    if (mes && d.getMonth() + 1 !== Number(mes)) return false;
    return true;
  });

  // Totais por frota
  const totaisFrota = FROTAS.map(f => ({
    ...f,
    total: listaFiltrada.filter(s => s.motorista?.frota === f.key).reduce((acc, s) => acc + Number(s.liberado || 0), 0)
  }));

  // Totais por tipo
  const totaisTipo = TIPOS_RAPIDOS.map(t => ({
    ...t,
    total: listaFiltrada.filter(s => {
      const nome = (s.tipo?.nome || '').toLowerCase();
      return t.nomes.some(n => nome.includes(n));
    }).reduce((acc, s) => acc + Number(s.liberado || 0), 0)
  }));

  // Dados do gráfico por mês
  const dadosGrafico = MESES_NOMES.map((nome, i) => {
    const mesNum = i + 1;
    const doMes = lista.filter(s => {
      const d = new Date(s.data);
      return d.getFullYear() === ano && d.getMonth() + 1 === mesNum;
    });
    const obj = { mes: nome };
    FROTAS.forEach(f => {
      obj[f.key] = doMes.filter(s => s.motorista?.frota === f.key).reduce((acc, s) => acc + Number(s.liberado || 0), 0);
    });
    obj.total = doMes.reduce((acc, s) => acc + Number(s.liberado || 0), 0);
    return obj;
  });

  const fmt = v => `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
  const totalGeral = listaFiltrada.reduce((acc, s) => acc + Number(s.liberado || 0), 0);

  return (
    <div>
      {/* Cabeçalho */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <h2 style={{ fontSize:20, fontWeight:600, color:'#1a1a2e' }}>Indicadores</h2>
        <div style={{ display:'flex', gap:10 }}>
          <select value={ano} onChange={e=>setAno(Number(e.target.value))}
            style={{ padding:'7px 12px', border:'1px solid #d1d5db', borderRadius:8, fontSize:13 }}>
            {[2024,2025,2026,2027].map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          <select value={mes} onChange={e=>setMes(e.target.value)}
            style={{ padding:'7px 12px', border:'1px solid #d1d5db', borderRadius:8, fontSize:13 }}>
            <option value="">Todos os meses</option>
            {MESES_NOMES.map((m,i) => <option key={i} value={i+1}>{m}</option>)}
          </select>
        </div>
      </div>

      {/* Card total geral */}
      <div style={{ background:'#EB3238', borderRadius:12, padding:'16px 20px', marginBottom:20, color:'#fff' }}>
        <div style={{ fontSize:11, textTransform:'uppercase', letterSpacing:'0.5px', opacity:0.8, marginBottom:4 }}>Total Liberado</div>
        <div style={{ fontSize:28, fontWeight:700 }}>{fmt(totalGeral)}</div>
      </div>

      {/* Cards por frota */}
      <h3 style={{ fontSize:14, fontWeight:600, color:'#374151', marginBottom:10 }}>Por Frota</h3>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr 1fr', gap:12, marginBottom:24 }}>
        {totaisFrota.map(f => (
          <div key={f.key} style={{ background:'#fff', borderRadius:12, padding:'16px 20px', border:`2px solid ${f.cor}` }}>
            <div style={{ fontSize:11, textTransform:'uppercase', letterSpacing:'0.5px', color:f.cor, fontWeight:700, marginBottom:6 }}>{f.label}</div>
            <div style={{ fontSize:22, fontWeight:700, color:f.cor }}>{fmt(f.total)}</div>
            <div style={{ fontSize:11, color:'#9ca3af', marginTop:4 }}>
              {totalGeral > 0 ? `${((f.total/totalGeral)*100).toFixed(1)}% do total` : '—'}
            </div>
          </div>
        ))}
      </div>

      {/* Cards por tipo */}
      <h3 style={{ fontSize:14, fontWeight:600, color:'#374151', marginBottom:10 }}>Por Tipo</h3>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12, marginBottom:24 }}>
        {totaisTipo.map(t => (
          <div key={t.key} style={{ background:'#fff', borderRadius:12, padding:'16px 20px', border:'1px solid #e5e7eb' }}>
            <div style={{ fontSize:11, textTransform:'uppercase', letterSpacing:'0.5px', color:'#6b7280', fontWeight:600, marginBottom:6 }}>{t.label}</div>
            <div style={{ fontSize:22, fontWeight:700, color:'#1a1a2e' }}>{fmt(t.total)}</div>
            <div style={{ fontSize:11, color:'#9ca3af', marginTop:4 }}>
              {totalGeral > 0 ? `${((t.total/totalGeral)*100).toFixed(1)}% do total` : '—'}
            </div>
          </div>
        ))}
      </div>

      {/* Gráfico */}
      <h3 style={{ fontSize:14, fontWeight:600, color:'#374151', marginBottom:10 }}>Comparativo por Mês</h3>
      <div style={{ background:'#fff', borderRadius:12, border:'1px solid #e5e7eb', padding:20 }}>
        <ResponsiveContainer width="100%" height={350}>
          <ComposedChart data={dadosGrafico}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6"/>
            <XAxis dataKey="mes" fontSize={12}/>
            <YAxis fontSize={12} tickFormatter={v => `R$${(v/1000).toFixed(0)}k`}/>
            <Tooltip formatter={(value) => fmt(value)}/>
            <Legend/>
            {FROTAS.map(f => (
              <Bar key={f.key} dataKey={f.key} name={f.label} fill={f.cor} radius={[4,4,0,0]}/>
            ))}
            <Line type="monotone" dataKey="total" name="Total" stroke="#6b7280" strokeWidth={2} dot={false}/>
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
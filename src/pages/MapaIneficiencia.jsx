// frontend/src/pages/MapaIneficiencia.jsx
import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import api from '../services/api';

const fmt = v => `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

export default function MapaIneficiencia() {
  const [lista, setLista]   = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function carregar() {
      setLoading(true);
      try {
        const { data } = await api.get('/financeiro');
        setLista(data);
      } finally {
        setLoading(false);
      }
    }
    carregar();
  }, []);

  const totalNegativo   = lista.reduce((s, i) => s + Number(i.valor), 0);
  const totalDescontado = lista.reduce((s, i) => s + Number(i.valorDescontado), 0);
  const saldoPendente   = totalNegativo - totalDescontado;

  // Agrupado por mês
  const porMes = lista.reduce((acc, i) => {
    const mes = i.mesDesconto || 'Sem mês';
    if (!acc[mes]) acc[mes] = { mes, descontado: 0 };
    acc[mes].descontado += Number(i.valorDescontado);
    return acc;
  }, {});

  const dadosMes = Object.values(porMes)
    .sort((a, b) => a.mes.localeCompare(b.mes));

  // Agrupado por motorista
  const porMotorista = lista.reduce((acc, i) => {
    const id = i.motoristaId;
    if (!acc[id]) acc[id] = { nome: i.motorista?.nome || '—', valor: 0, descontado: 0 };
    acc[id].valor      += Number(i.valor);
    acc[id].descontado += Number(i.valorDescontado);
    return acc;
  }, {});

  const rankMotoristas = Object.values(porMotorista)
    .map(m => ({ ...m, saldo: m.valor - m.descontado }))
    .sort((a, b) => b.saldo - a.saldo);

  const cards = [
    { label: 'Total Negativo',   valor: totalNegativo,   cor: '#EB3238', icone: 'ti-trending-down',    bg: '#fff5f5' },
    { label: 'Valor Descontado', valor: totalDescontado, cor: '#16a34a', icone: 'ti-circle-check',     bg: '#f0fdf4' },
    { label: 'Saldo Pendente',   valor: saldoPendente,   cor: saldoPendente > 0 ? '#d97706' : '#16a34a', icone: saldoPendente > 0 ? 'ti-alert-triangle' : 'ti-circle-check', bg: saldoPendente > 0 ? '#fffbeb' : '#f0fdf4' },
  ];

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, color: '#1a1a2e' }}>Mapa de Ineficiência</h2>
        <p style={{ fontSize: 13, color: '#6b7280', marginTop: 2 }}>Visão geral dos descontos e pendências</p>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', color: '#9ca3af', padding: 60 }}>Carregando...</div>
      ) : (
        <>
          {/* Cards de totais */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
            {cards.map(c => (
              <div key={c.label} style={{ background: c.bg, border: `1px solid ${c.cor}22`, borderRadius: 14, padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: c.cor + '18', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <i className={`ti ${c.icone}`} style={{ fontSize: 20, color: c.cor }}></i>
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 500, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{c.label}</span>
                </div>
                <div style={{ fontSize: 28, fontWeight: 700, color: c.cor }}>{fmt(c.valor)}</div>
              </div>
            ))}
          </div>

          {/* Gráfico por mês */}
          {dadosMes.length > 0 && (
            <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: '20px 24px', marginBottom: 24 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#1a1a2e', marginBottom: 20 }}>Evolução por Mês de Desconto</div>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={dadosMes} barCategoryGap="30%" barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="mes" tick={{ fontSize: 12, fill: '#6b7280' }} />
                  <YAxis tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} tick={{ fontSize: 11, fill: '#6b7280' }} />
                  <Tooltip formatter={(v, name) => [fmt(v), name]} labelStyle={{ fontWeight: 600 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="descontado" name="Valor Descontado" fill="#16a34a" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

        </>
      )}
    </div>
  );
}

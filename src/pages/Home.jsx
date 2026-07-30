import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';

function saudacao(hora) {
  if (hora >= 5 && hora < 12) return { texto: 'Bom dia', icone: '☀️' };
  if (hora >= 12 && hora < 18) return { texto: 'Boa tarde', icone: '🌤️' };
  return { texto: 'Boa noite', icone: '🌙' };
}

const DIAS = ['Domingo','Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado'];
const MESES = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];

export default function Home() {
  const { usuario } = useAuth();
  const [agora, setAgora] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => setAgora(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const hora   = agora.getHours();
  const minuto = String(agora.getMinutes()).padStart(2, '0');
  const seg    = String(agora.getSeconds()).padStart(2, '0');
  const { texto, icone } = saudacao(hora);
  const diaSemana = DIAS[agora.getDay()];
  const dia       = agora.getDate();
  const mes       = MESES[agora.getMonth()];
  const ano       = agora.getFullYear();
  const nome      = usuario?.nome?.split(' ')[0] || '';

  return (
    <div style={{
      minHeight: '70vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <div style={{ textAlign: 'center' }}>

        {/* Saudação */}
        <div style={{ fontSize: 18, color: '#9ca3af', fontWeight: 500, marginBottom: 8, letterSpacing: '0.5px' }}>
          {icone} {texto}{nome ? `, ${nome}` : ''}!
        </div>

        {/* Relógio */}
        <div style={{
          fontSize: 72,
          fontWeight: 800,
          color: '#1a1a2e',
          letterSpacing: '-2px',
          lineHeight: 1,
          fontVariantNumeric: 'tabular-nums',
          marginBottom: 16,
        }}>
          {String(hora).padStart(2, '0')}
          <span style={{ color: '#EB3238', animation: 'piscar 1s step-start infinite' }}>:</span>
          {minuto}
          <span style={{ fontSize: 36, fontWeight: 600, color: '#9ca3af', marginLeft: 6 }}>
            {seg}
          </span>
        </div>

        {/* Data */}
        <div style={{ fontSize: 18, color: '#374151', fontWeight: 600 }}>
          {diaSemana}, {dia} de {mes} de {ano}
        </div>

      </div>

      <style>{`
        @keyframes piscar {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0; }
        }
      `}</style>
    </div>
  );
}

import { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';

// Coordenadas aproximadas de cada UF (centro do estado) para o mapa SVG simplificado
// Usaremos paths SVG reais do Brasil
const UF_LABELS = {
  AC:'Acre', AL:'Alagoas', AM:'Amazonas', AP:'Amapá', BA:'Bahia',
  CE:'Ceará', DF:'Distrito Federal', ES:'Espírito Santo', GO:'Goiás',
  MA:'Maranhão', MG:'Minas Gerais', MS:'Mato Grosso do Sul', MT:'Mato Grosso',
  PA:'Pará', PB:'Paraíba', PE:'Pernambuco', PI:'Piauí', PR:'Paraná',
  RJ:'Rio de Janeiro', RN:'Rio Grande do Norte', RO:'Rondônia', RR:'Roraima',
  RS:'Rio Grande do Sul', SC:'Santa Catarina', SE:'Sergipe', SP:'São Paulo',
  TO:'Tocantins',
};

// Paths SVG simplificados do mapa do Brasil (viewBox 0 0 800 900)
const BRAZIL_PATHS = {
  AC: 'M 88 430 L 108 410 L 130 415 L 148 405 L 162 420 L 155 445 L 130 450 L 108 445 Z',
  AM: 'M 88 430 L 108 410 L 130 415 L 148 405 L 170 380 L 200 365 L 230 360 L 260 370 L 275 395 L 270 430 L 250 455 L 220 470 L 190 465 L 162 450 L 155 445 L 130 450 L 108 445 Z',
  RO: 'M 162 450 L 190 465 L 220 470 L 235 490 L 220 510 L 195 515 L 170 505 L 155 485 Z',
  RR: 'M 200 365 L 230 360 L 260 345 L 280 330 L 280 360 L 260 370 L 230 360 Z',
  AP: 'M 370 310 L 390 295 L 410 300 L 415 325 L 395 335 L 370 330 Z',
  PA: 'M 270 430 L 275 395 L 260 370 L 280 360 L 310 355 L 340 345 L 370 330 L 395 335 L 415 325 L 430 340 L 440 370 L 430 400 L 410 420 L 385 435 L 355 445 L 325 450 L 300 455 L 275 455 Z',
  TO: 'M 385 435 L 410 420 L 430 400 L 440 430 L 435 460 L 420 485 L 400 500 L 380 495 L 365 475 L 360 455 Z',
  MA: 'M 430 340 L 455 330 L 480 325 L 500 335 L 505 360 L 490 380 L 465 390 L 440 385 L 430 370 L 440 370 L 430 400 L 440 370 Z',
  PI: 'M 500 335 L 525 330 L 545 340 L 550 365 L 535 385 L 510 390 L 490 380 L 505 360 Z',
  CE: 'M 545 340 L 570 335 L 590 345 L 588 370 L 568 380 L 545 375 L 535 360 L 545 340 Z',
  RN: 'M 590 345 L 615 348 L 618 368 L 600 375 L 582 368 L 588 370 Z',
  PB: 'M 582 368 L 600 375 L 618 368 L 620 385 L 600 390 L 580 385 Z',
  PE: 'M 545 375 L 568 380 L 582 368 L 580 385 L 600 390 L 620 385 L 618 405 L 590 412 L 560 408 L 540 398 L 540 385 Z',
  AL: 'M 580 385 L 600 390 L 618 405 L 608 418 L 588 415 L 576 403 Z',
  SE: 'M 576 403 L 588 415 L 600 425 L 590 435 L 575 430 L 568 418 Z',
  BA: 'M 440 385 L 465 390 L 490 380 L 510 390 L 535 385 L 540 398 L 560 408 L 590 412 L 608 418 L 600 425 L 590 435 L 575 430 L 565 450 L 555 475 L 545 500 L 530 520 L 510 528 L 490 522 L 470 510 L 455 490 L 445 465 L 435 445 L 420 430 L 400 425 L 380 430 L 365 445 L 360 455 L 365 475 L 380 495 L 400 500 L 420 485 L 435 460 L 440 430 L 430 400 L 440 385 Z',
  MG: 'M 420 530 L 440 520 L 465 515 L 490 522 L 510 528 L 530 520 L 545 535 L 540 560 L 525 580 L 505 592 L 480 595 L 455 585 L 430 572 L 415 555 Z',
  ES: 'M 545 535 L 565 530 L 578 545 L 572 565 L 555 572 L 540 560 Z',
  RJ: 'M 505 592 L 525 600 L 540 615 L 528 628 L 510 622 L 495 610 L 490 595 Z',
  SP: 'M 415 555 L 430 572 L 455 585 L 480 595 L 490 595 L 495 610 L 480 625 L 460 630 L 435 622 L 415 608 L 400 590 L 398 570 L 408 555 Z',
  PR: 'M 398 570 L 400 590 L 415 608 L 408 628 L 390 638 L 365 635 L 345 620 L 340 600 L 352 582 L 375 572 Z',
  SC: 'M 345 620 L 365 635 L 390 638 L 395 655 L 378 665 L 355 658 L 338 645 Z',
  RS: 'M 338 645 L 355 658 L 378 665 L 382 688 L 368 705 L 345 710 L 320 700 L 308 682 L 315 662 Z',
  MS: 'M 340 525 L 365 515 L 390 510 L 415 520 L 415 555 L 408 555 L 398 570 L 375 572 L 352 582 L 335 568 L 325 548 Z',
  MT: 'M 235 490 L 260 485 L 290 480 L 320 475 L 340 480 L 365 475 L 360 500 L 355 525 L 340 545 L 325 548 L 310 535 L 290 525 L 265 520 L 245 510 Z',
  GO: 'M 365 475 L 380 495 L 400 500 L 400 525 L 390 540 L 370 545 L 350 540 L 340 525 L 355 525 L 360 500 Z',
  DF: 'M 390 515 L 398 510 L 405 518 L 398 525 L 390 520 Z',
};

// Cores para percentual
function getColor(pct, maxPct) {
  if (!pct || maxPct === 0) return '#1e293b';
  const ratio = pct / maxPct;
  if (ratio > 0.8) return '#b91c1c';
  if (ratio > 0.6) return '#dc2626';
  if (ratio > 0.4) return '#ef4444';
  if (ratio > 0.25) return '#f97316';
  if (ratio > 0.1) return '#fbbf24';
  if (ratio > 0.03) return '#34d399';
  return '#1e3a2f';
}

function fmtR(v) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
}
function fmtN(v, dec = 1) {
  return Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

const FROTAS = ['FROTA', 'BAÚ'];

export default function MediasPrecoCombustivel() {
  const [frotaSel, setFrotaSel] = useState('');
  const [dados, setDados] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hovUF, setHovUF] = useState(null);
  const [tooltip, setTooltip] = useState({ x: 0, y: 0 });

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (frotaSel) params.frota = frotaSel;
      const { data } = await api.get('/medias-consumo/por-uf', { params });
      setDados(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [frotaSel]);

  useEffect(() => { carregar(); }, [carregar]);

  const maxPct = dados.length > 0 ? Math.max(...dados.map(d => d.percentual)) : 0;
  const byUF = Object.fromEntries(dados.map(d => [d.uf, d]));
  const hovData = hovUF ? byUF[hovUF] : null;
  const totalGasto = dados.reduce((a, d) => a + d.totalGasto, 0);

  return (
    <div style={{ padding: '24px 28px', fontFamily: 'Inter, sans-serif', background: '#f8fafc', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: '#1a1a2e', margin: 0 }}>Média Preço Combustível</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          {FROTAS.map(f => {
            const bgAtivo = f === 'FROTA' ? '#065f46' : '#EB3238';
            return (
              <button key={f} onClick={() => setFrotaSel(frotaSel === f ? '' : f)}
                style={{
                  padding: '6px 20px', borderRadius: 20, border: 'none', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                  background: frotaSel === f ? bgAtivo : '#f1f5f9',
                  color:      frotaSel === f ? '#fff'   : '#64748b',
                  boxShadow:  frotaSel === f ? '0 2px 8px rgba(0,0,0,0.15)' : 'none',
                }}>
                {f}
              </button>
            );
          })}
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 80, color: '#64748b' }}>Carregando...</div>
      ) : (
        <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          {/* Mapa */}
          <div style={{
            flex: '1 1 460px', background: 'linear-gradient(135deg,#1e293b 0%,#0f172a 100%)',
            borderRadius: 20, padding: 24, boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
            position: 'relative',
          }}>
            <div style={{ color: '#94a3b8', fontSize: 11, marginBottom: 12, fontWeight: 600, letterSpacing: 1 }}>
              ABASTECIMENTO POR ESTADO (% DO GASTO TOTAL)
            </div>
            <svg
              viewBox="60 290 580 470"
              style={{ width: '100%', maxHeight: 480 }}
              onMouseLeave={() => setHovUF(null)}
            >
              {Object.entries(BRAZIL_PATHS).map(([uf, d]) => {
                const info = byUF[uf];
                const pct = info?.percentual || 0;
                const fill = info ? getColor(pct, maxPct) : '#1e293b';
                const isHov = hovUF === uf;
                return (
                  <path
                    key={uf}
                    d={d}
                    fill={fill}
                    stroke={isHov ? '#fbbf24' : '#0f172a'}
                    strokeWidth={isHov ? 2.5 : 1}
                    style={{ cursor: info ? 'pointer' : 'default', transition: 'fill 0.2s' }}
                    onMouseEnter={e => {
                      if (info) {
                        setHovUF(uf);
                        const rect = e.currentTarget.closest('svg').getBoundingClientRect();
                        setTooltip({ x: e.clientX - rect.left, y: e.clientY - rect.top });
                      }
                    }}
                    onMouseMove={e => {
                      if (info) {
                        const rect = e.currentTarget.closest('svg').getBoundingClientRect();
                        setTooltip({ x: e.clientX - rect.left, y: e.clientY - rect.top });
                      }
                    }}
                  />
                );
              })}
              {/* Labels UF */}
              {Object.entries(BRAZIL_PATHS).map(([uf]) => {
                const info = byUF[uf];
                if (!info) return null;
                // calcular centróide simples: média dos pontos
                const d = BRAZIL_PATHS[uf];
                const nums = [...d.matchAll(/(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/g)];
                if (!nums.length) return null;
                const cx = nums.reduce((s, m) => s + parseFloat(m[1]), 0) / nums.length;
                const cy = nums.reduce((s, m) => s + parseFloat(m[2]), 0) / nums.length;
                return (
                  <g key={uf} style={{ pointerEvents: 'none' }}>
                    <text x={cx} y={cy - 2} textAnchor="middle" fontSize={7} fontWeight="700" fill="rgba(255,255,255,0.9)">{uf}</text>
                    <text x={cx} y={cy + 7} textAnchor="middle" fontSize={6} fill="rgba(255,255,255,0.7)">{fmtN(info.percentual, 1)}%</text>
                  </g>
                );
              })}
            </svg>

            {/* Tooltip flutuante */}
            {hovUF && hovData && (
              <div style={{
                position: 'absolute', left: tooltip.x + 12, top: tooltip.y - 10,
                background: '#1e293b', border: '1px solid #334155', borderRadius: 12,
                padding: '12px 16px', fontSize: 12, boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                minWidth: 200, pointerEvents: 'none', zIndex: 10,
              }}>
                <div style={{ fontWeight: 700, color: '#f1f5f9', fontSize: 13, marginBottom: 8 }}>
                  {hovUF} — {UF_LABELS[hovUF] || ''}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ color: '#94a3b8' }}>% do gasto</span>
                  <strong style={{ color: '#fbbf24' }}>{fmtN(hovData.percentual, 1)}%</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ color: '#94a3b8' }}>Total gasto</span>
                  <strong style={{ color: '#fb7185' }}>{fmtR(hovData.totalGasto)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ color: '#94a3b8' }}>Litros</span>
                  <strong style={{ color: '#93c5fd' }}>{fmtN(hovData.totalLitros, 0)} L</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#94a3b8' }}>Preço médio/L</span>
                  <strong style={{ color: '#34d399' }}>{fmtR(hovData.precoMedio)}</strong>
                </div>
              </div>
            )}

            {/* Legenda */}
            <div style={{ display: 'flex', gap: 6, marginTop: 16, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ color: '#64748b', fontSize: 10, marginRight: 4 }}>Gasto:</span>
              {[
                { cor: '#1e3a2f', label: '<3%' },
                { cor: '#34d399', label: '3-10%' },
                { cor: '#fbbf24', label: '10-25%' },
                { cor: '#f97316', label: '25-40%' },
                { cor: '#ef4444', label: '40-60%' },
                { cor: '#dc2626', label: '60-80%' },
                { cor: '#b91c1c', label: '>80%' },
              ].map(({ cor, label }) => (
                <div key={cor} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <div style={{ width: 10, height: 10, borderRadius: 2, background: cor }} />
                  <span style={{ fontSize: 9, color: '#64748b' }}>{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Tabela ranking */}
          <div style={{ flex: '1 1 320px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* KPI total */}
            <div style={{
              background: '#fff', borderRadius: 16, padding: '16px 20px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.07)', borderLeft: '4px solid #EB3238',
            }}>
              <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, marginBottom: 4 }}>TOTAL GASTO (TODOS OS ESTADOS)</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#1a1a2e' }}>{fmtR(totalGasto)}</div>
              <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>{dados.length} estado(s) com abastecimento</div>
            </div>

            {/* Ranking */}
            <div style={{ background: '#fff', borderRadius: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.07)', overflow: 'hidden' }}>
              <div style={{ padding: '14px 20px', borderBottom: '1px solid #f1f5f9', fontWeight: 700, fontSize: 13, color: '#1a1a2e' }}>
                Ranking por Estado
              </div>
              <div style={{ maxHeight: 460, overflowY: 'auto' }}>
                {dados.length === 0 ? (
                  <div style={{ padding: 24, color: '#94a3b8', textAlign: 'center', fontSize: 13 }}>Nenhum dado encontrado</div>
                ) : (
                  dados.map((d, i) => (
                    <div key={d.uf}
                      onMouseEnter={() => setHovUF(d.uf)}
                      onMouseLeave={() => setHovUF(null)}
                      style={{
                        padding: '12px 20px', borderBottom: '1px solid #f8fafc',
                        background: hovUF === d.uf ? '#f8fafc' : '#fff',
                        cursor: 'default', transition: 'background 0.15s',
                      }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{
                            width: 26, height: 26, borderRadius: 8, background: getColor(d.percentual, maxPct),
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 10, fontWeight: 800, color: '#fff',
                          }}>{i + 1}</div>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 13, color: '#1a1a2e' }}>{d.uf}</div>
                            <div style={{ fontSize: 10, color: '#94a3b8' }}>{UF_LABELS[d.uf] || ''}</div>
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontWeight: 700, fontSize: 13, color: '#EB3238' }}>{fmtN(d.percentual, 1)}%</div>
                          <div style={{ fontSize: 10, color: '#64748b' }}>{fmtR(d.totalGasto)}</div>
                        </div>
                      </div>
                      {/* Barra de progresso */}
                      <div style={{ height: 4, background: '#f1f5f9', borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{
                          height: '100%', borderRadius: 4,
                          width: `${(d.percentual / maxPct) * 100}%`,
                          background: getColor(d.percentual, maxPct),
                          transition: 'width 0.5s ease',
                        }} />
                      </div>
                      <div style={{ display: 'flex', gap: 16, marginTop: 6, fontSize: 10, color: '#94a3b8' }}>
                        <span>{fmtN(d.totalLitros, 0)} L</span>
                        <span>R$/L: {fmtR(d.precoMedio)}</span>
                        <span>{d.totalRegistros} reg.</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

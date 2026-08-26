import { useState, useEffect, useCallback, useRef } from 'react';
import * as d3 from 'd3';
import api from '../../services/api';

const UF_LABELS = {
  AC:'Acre', AL:'Alagoas', AM:'Amazonas', AP:'Amapá', BA:'Bahia',
  CE:'Ceará', DF:'Distrito Federal', ES:'Espírito Santo', GO:'Goiás',
  MA:'Maranhão', MG:'Minas Gerais', MS:'Mato Grosso do Sul', MT:'Mato Grosso',
  PA:'Pará', PB:'Paraíba', PE:'Pernambuco', PI:'Piauí', PR:'Paraná',
  RJ:'Rio de Janeiro', RN:'Rio Grande do Norte', RO:'Rondônia', RR:'Roraima',
  RS:'Rio Grande do Sul', SC:'Santa Catarina', SE:'Sergipe', SP:'São Paulo',
  TO:'Tocantins',
};

const FROTAS = ['FROTA', 'BAÚ'];
const GEOJSON_URL = 'https://raw.githubusercontent.com/codeforamerica/click_that_hood/master/public/data/brazil-states.geojson';
const W = 520, H = 560;
const EX = 7, EY = 13; // extrusion offset

function getTopColor(pct, maxPct) {
  if (!pct || !maxPct) return '#1e3a5f';
  const t = pct / maxPct;
  if (t > 0.75) return '#b91c1c';
  if (t > 0.55) return '#dc2626';
  if (t > 0.38) return '#ea580c';
  if (t > 0.22) return '#f97316';
  if (t > 0.10) return '#fbbf24';
  if (t > 0.03) return '#34d399';
  return '#1d4b6a';
}
function getSideColor(pct, maxPct) {
  if (!pct || !maxPct) return '#0a1525';
  const t = pct / maxPct;
  if (t > 0.75) return '#7f1d1d';
  if (t > 0.55) return '#991b1b';
  if (t > 0.38) return '#9a3412';
  if (t > 0.22) return '#b45309';
  if (t > 0.10) return '#d97706';
  if (t > 0.03) return '#059669';
  return '#0c2d42';
}
function fmtR(v) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
}
function fmtN(v, dec = 1) {
  return Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

export default function MediasPrecoCombustivel() {
  const [frotaSel, setFrotaSel] = useState('');
  const [dados, setDados] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statePaths, setStatePaths] = useState([]); // [{ sigla, d, centroid }]
  const [geoLoading, setGeoLoading] = useState(true);
  const [hovUF, setHovUF] = useState(null);
  const [mouse, setMouse] = useState({ x: 0, y: 0 });
  const containerRef = useRef();

  // Fetch + project GeoJSON once
  useEffect(() => {
    fetch(GEOJSON_URL)
      .then(r => r.json())
      .then(geo => {
        const proj = d3.geoMercator().fitSize([W, H], geo);
        const pathGen = d3.geoPath().projection(proj);
        const paths = geo.features
          .map(f => ({
            sigla: (f.properties.sigla || '').toUpperCase(),
            d: pathGen(f),
            centroid: pathGen.centroid(f),
          }))
          .filter(p => p.sigla && p.d);
        setStatePaths(paths);
        setGeoLoading(false);
      })
      .catch(() => setGeoLoading(false));
  }, []);

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

  const byUF = Object.fromEntries(dados.map(d => [d.uf, d]));
  const maxPct = dados.length > 0 ? Math.max(...dados.map(d => d.percentual)) : 1;
  const totalGasto = dados.reduce((a, d) => a + d.totalGasto, 0);
  const hovData = hovUF ? byUF[hovUF] : null;

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

      <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        {/* ─── Mapa 3D ─── */}
        <div
          ref={containerRef}
          style={{
            flex: '1 1 460px',
            background: 'linear-gradient(160deg, #060d1a 0%, #0f172a 50%, #060d1a 100%)',
            borderRadius: 20,
            padding: '24px 20px 28px',
            boxShadow: '0 12px 48px rgba(0,0,0,0.45)',
            position: 'relative',
            overflow: 'hidden',
          }}
          onMouseMove={e => {
            if (!containerRef.current) return;
            const rect = containerRef.current.getBoundingClientRect();
            setMouse({ x: e.clientX - rect.left, y: e.clientY - rect.top });
          }}
        >
          {/* dot grid bg */}
          <div style={{
            position: 'absolute', inset: 0, opacity: 0.035,
            backgroundImage: 'radial-gradient(#60a5fa 1px, transparent 1px)',
            backgroundSize: '28px 28px', pointerEvents: 'none',
          }} />

          <div style={{ color: '#475569', fontSize: 10, marginBottom: 14, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase' }}>
            Abastecimento por Estado — % do gasto total
          </div>

          {/* 3D perspective wrapper */}
          <div style={{ perspective: '1000px', perspectiveOrigin: '50% 0%' }}>
            {geoLoading ? (
              <div style={{ height: 380, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569', fontSize: 13 }}>
                Carregando mapa...
              </div>
            ) : (
              <svg
                viewBox={`0 0 ${W + EX + 4} ${H + EY + 4}`}
                style={{
                  width: '100%',
                  display: 'block',
                  transform: 'rotateX(32deg) scale(1.06)',
                  transformOrigin: '50% 24%',
                }}
                onMouseLeave={() => setHovUF(null)}
              >
                <defs>
                  <filter id="mapShadow" x="-10%" y="-10%" width="120%" height="130%">
                    <feDropShadow dx="0" dy="5" stdDeviation="5" floodColor="#000" floodOpacity="0.55" />
                  </filter>
                </defs>

                {/* ── Extrusion / side layer (drawn first) ── */}
                <g filter="url(#mapShadow)">
                  {statePaths.map(({ sigla, d }) => {
                    const info = byUF[sigla];
                    return (
                      <path
                        key={`side-${sigla}`}
                        d={d}
                        transform={`translate(${EX}, ${EY})`}
                        fill={getSideColor(info?.percentual, maxPct)}
                        stroke="#03070f"
                        strokeWidth={1}
                      />
                    );
                  })}
                </g>

                {/* ── Top face layer ── */}
                {statePaths.map(({ sigla, d, centroid }) => {
                  const info = byUF[sigla];
                  const isHov = hovUF === sigla;
                  const [cx, cy] = centroid || [0, 0];
                  const validC = !isNaN(cx) && !isNaN(cy);
                  return (
                    <g key={`top-${sigla}`}>
                      <path
                        d={d}
                        fill={isHov ? '#e0f2fe' : getTopColor(info?.percentual, maxPct)}
                        stroke={isHov ? '#7dd3fc' : '#03070f'}
                        strokeWidth={isHov ? 1.6 : 0.5}
                        style={{ cursor: 'pointer', transition: 'fill 0.18s' }}
                        onMouseEnter={() => setHovUF(sigla)}
                        onMouseLeave={() => setHovUF(null)}
                      />
                      {validC && (
                        <g style={{ pointerEvents: 'none' }}>
                          <text x={cx} y={cy - 1} textAnchor="middle" fontSize={7.5} fontWeight="800"
                            fill={isHov ? '#0284c7' : 'rgba(255,255,255,0.95)'}>
                            {sigla}
                          </text>
                          {info && (
                            <text x={cx} y={cy + 9} textAnchor="middle" fontSize={5.5} fontWeight="600"
                              fill={isHov ? '#0284c7' : 'rgba(255,255,255,0.65)'}>
                              {fmtN(info.percentual, 1)}%
                            </text>
                          )}
                        </g>
                      )}
                    </g>
                  );
                })}
              </svg>
            )}
          </div>

          {/* Floating tooltip */}
          {hovUF && hovData && (
            <div style={{
              position: 'absolute',
              left: Math.min(mouse.x + 16, 260),
              top: Math.max(mouse.y - 90, 50),
              background: 'rgba(2,8,23,0.97)',
              border: '1px solid #1e3a5f',
              borderRadius: 14,
              padding: '14px 18px',
              fontSize: 12,
              boxShadow: '0 12px 40px rgba(0,0,0,0.6)',
              minWidth: 210,
              pointerEvents: 'none',
              zIndex: 30,
            }}>
              <div style={{ fontWeight: 800, color: '#f0f9ff', fontSize: 13, marginBottom: 10 }}>
                {hovUF} — {UF_LABELS[hovUF] || ''}
              </div>
              {[
                { label: '% do gasto',    val: `${fmtN(hovData.percentual, 1)}%`, color: '#fbbf24' },
                { label: 'Total gasto',   val: fmtR(hovData.totalGasto),           color: '#fb7185' },
                { label: 'Total litros',  val: `${fmtN(hovData.totalLitros, 0)} L`, color: '#93c5fd' },
                { label: 'Preço médio/L', val: fmtR(hovData.precoMedio),            color: '#34d399' },
                { label: 'Registros',     val: hovData.totalRegistros,              color: '#a78bfa' },
              ].map(({ label, val, color }) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, marginBottom: 5 }}>
                  <span style={{ color: '#64748b' }}>{label}</span>
                  <strong style={{ color }}>{val}</strong>
                </div>
              ))}
            </div>
          )}

          {/* Gradient legend */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12 }}>
            <span style={{ color: '#475569', fontSize: 9, fontWeight: 700 }}>BAIXO</span>
            <div style={{
              flex: 1, height: 6, borderRadius: 4,
              background: 'linear-gradient(to right, #1d4b6a, #34d399, #fbbf24, #f97316, #ea580c, #dc2626, #b91c1c)',
            }} />
            <span style={{ color: '#475569', fontSize: 9, fontWeight: 700 }}>ALTO</span>
          </div>
        </div>

        {/* ─── Right panel ─── */}
        <div style={{ flex: '1 1 280px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* KPI */}
          <div style={{
            background: '#fff', borderRadius: 16, padding: '18px 20px',
            boxShadow: '0 2px 12px rgba(0,0,0,0.07)', borderLeft: '4px solid #EB3238',
          }}>
            <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 700, letterSpacing: 1, marginBottom: 6 }}>TOTAL GASTO</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: '#1a1a2e' }}>{loading ? '—' : fmtR(totalGasto)}</div>
            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>{dados.length} estado(s) com abastecimento</div>
          </div>

          {/* Ranking */}
          <div style={{ background: '#fff', borderRadius: 16, boxShadow: '0 2px 12px rgba(0,0,0,0.07)', overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid #f1f5f9', fontWeight: 700, fontSize: 13, color: '#1a1a2e' }}>
              Ranking por Estado
            </div>
            <div style={{ maxHeight: 500, overflowY: 'auto' }}>
              {loading ? (
                <div style={{ padding: 24, color: '#94a3b8', textAlign: 'center', fontSize: 13 }}>Carregando...</div>
              ) : dados.length === 0 ? (
                <div style={{ padding: 24, color: '#94a3b8', textAlign: 'center', fontSize: 13 }}>Nenhum dado encontrado</div>
              ) : dados.map((d, i) => (
                <div key={d.uf}
                  onMouseEnter={() => setHovUF(d.uf)}
                  onMouseLeave={() => setHovUF(null)}
                  style={{
                    padding: '10px 20px', borderBottom: '1px solid #f8fafc',
                    background: hovUF === d.uf ? '#f0f9ff' : '#fff',
                    cursor: 'default', transition: 'background 0.15s',
                  }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{
                        width: 26, height: 26, borderRadius: 8,
                        background: getTopColor(d.percentual, maxPct),
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 10, fontWeight: 800, color: '#fff', flexShrink: 0,
                      }}>{i + 1}</div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 13, color: '#1a1a2e' }}>{d.uf}</div>
                        <div style={{ fontSize: 10, color: '#94a3b8' }}>{UF_LABELS[d.uf] || ''}</div>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 13, color: '#EB3238' }}>{fmtN(d.percentual, 1)}%</div>
                      <div style={{ fontSize: 10, color: '#64748b' }}>{fmtR(d.totalGasto)}</div>
                    </div>
                  </div>
                  <div style={{ height: 4, background: '#f1f5f9', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', borderRadius: 4,
                      width: `${(d.percentual / maxPct) * 100}%`,
                      background: getTopColor(d.percentual, maxPct),
                      transition: 'width 0.5s ease',
                    }} />
                  </div>
                  <div style={{ display: 'flex', gap: 12, marginTop: 4, fontSize: 10, color: '#94a3b8' }}>
                    <span>{fmtN(d.totalLitros, 0)} L</span>
                    <span>R$/L: {fmtR(d.precoMedio)}</span>
                    <span>{d.totalRegistros} reg.</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

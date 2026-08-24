import { useCallback, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import './VehicleSelector.css';

// Quantos carros aparecem para cada lado do selecionado (0 = só o centro)
const MAX_VISIBLE_OFFSET = 2;
const SLOT_SPACING = 220;
const EDGE_TRAVEL = 260;
const EDGE_X = (MAX_VISIBLE_OFFSET + 1) * SLOT_SPACING + EDGE_TRAVEL;

// Paleta de cores para o glow de cada veículo
const GLOW_COLORS = [
  '#4f8ef7', '#f76c4f', '#4ff7a0', '#f7e24f',
  '#c44ff7', '#4ff7f0', '#f7a04f', '#f74f8e',
];

function scaleForOffset(offset) {
  const d = Math.abs(offset);
  if (d === 0) return 1.18;
  if (d === 1) return 0.82;
  return 0.62;
}

function opacityForOffset(offset) {
  const d = Math.abs(offset);
  if (d === 0) return 1;
  if (d === 1) return 0.55;
  return 0.28;
}

// Offset circular mais curto (permite dar a volta no carrossel)
function shortestSignedOffset(index, selectedIndex, count) {
  let diff = index - selectedIndex;
  diff = ((diff % count) + count) % count;
  if (diff > count / 2) diff -= count;
  return diff;
}

const springTransition = { type: 'spring', stiffness: 300, damping: 32, mass: 0.9 };
const exitTransition   = { duration: 0.32, ease: 'easeIn' };

const slotVariants = {
  initial: (custom) => ({
    x: custom.direction === 1 ? EDGE_X : -EDGE_X,
    opacity: 0,
    scale: 0.5,
  }),
  animate: (custom) => ({
    x: custom.offset * SLOT_SPACING,
    opacity: opacityForOffset(custom.offset),
    scale: scaleForOffset(custom.offset),
    transition: springTransition,
  }),
  exit: (direction) => ({
    x: direction === 1 ? -EDGE_X : EDGE_X,
    opacity: 0,
    scale: 0.5,
    transition: exitTransition,
  }),
};

const infoVariants = {
  initial: (direction) => ({ opacity: 0, y: direction === 1 ? 14 : -14 }),
  animate: { opacity: 1, y: 0, transition: { duration: 0.25, ease: 'easeOut' } },
  exit: (direction) => ({
    opacity: 0,
    y: direction === 1 ? -14 : 14,
    transition: { duration: 0.18, ease: 'easeIn' },
  }),
};

/**
 * Props:
 *   vehicles     — array de { id, placa, modelo, ano, cor, imagem }
 *   onUpload     — (veiculo, file) => void
 *   onRemoveImg  — (veiculo) => void
 *   onDelete     — (veiculo) => void
 *   uploadingId  — id do veículo cujo upload está em andamento
 */
export default function VehicleSelector({
  vehicles,
  onUpload,
  onRemoveImg,
  onDelete,
  uploadingId,
}) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [direction, setDirection]         = useState(1);

  const count = vehicles.length;

  // Garante que o índice não fique fora dos bounds quando veículos são removidos
  const safeIndex = Math.min(selectedIndex, Math.max(0, count - 1));
  const selectedVehicle = vehicles[safeIndex];

  const goTo = useCallback(
    (nextIndex, dir) => {
      setDirection(dir);
      setSelectedIndex(((nextIndex % count) + count) % count);
    },
    [count]
  );

  const handleNext = useCallback(() => goTo(safeIndex + 1,  1), [goTo, safeIndex]);
  const handlePrev = useCallback(() => goTo(safeIndex - 1, -1), [goTo, safeIndex]);

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'ArrowRight') handleNext();
      if (e.key === 'ArrowLeft')  handlePrev();
    },
    [handleNext, handlePrev]
  );

  const visibleVehicles = useMemo(() => {
    return vehicles
      .map((vehicle, index) => ({
        vehicle,
        index,
        offset: shortestSignedOffset(index, safeIndex, count),
      }))
      .filter((item) => Math.abs(item.offset) <= MAX_VISIBLE_OFFSET);
  }, [vehicles, safeIndex, count]);

  if (!selectedVehicle) return null;

  return (
    <div className="vehicle-selector" onKeyDown={handleKeyDown} tabIndex={0}>
      <div className="vehicle-selector__backdrop" aria-hidden="true" />

      {/* Palco dos carros */}
      <div className="vehicle-selector__stage">
        <button
          type="button"
          className="vehicle-selector__arrow"
          onClick={handlePrev}
          disabled={count <= 1}
          aria-label="Veículo anterior"
        >
          ‹
        </button>

        <div className="vehicle-selector__track">
          <AnimatePresence initial={false} custom={direction}>
            {visibleVehicles.map(({ vehicle, index, offset }) => {
              const isSelected  = offset === 0;
              const glowColor   = GLOW_COLORS[index % GLOW_COLORS.length];
              const isUploading = uploadingId === vehicle.id;

              return (
                <motion.div
                  key={vehicle.id}
                  className={`vehicle-slot${isSelected ? ' vehicle-slot--selected' : ''}`}
                  style={{ zIndex: 100 - Math.abs(offset) }}
                  custom={{ offset, direction }}
                  variants={slotVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  onClick={() => {
                    if (!isSelected) goTo(index, offset > 0 ? 1 : -1);
                  }}
                >
                  <div className="vehicle-slot__glow" style={{ background: glowColor }} />

                  {isUploading ? (
                    <div className="vehicle-slot__placeholder">
                      <i className="ti ti-loader-2"></i>
                      <span>Salvando...</span>
                    </div>
                  ) : vehicle.imagem ? (
                    <img
                      src={vehicle.imagem}
                      alt={vehicle.modelo || vehicle.placa}
                      className="vehicle-slot__image"
                      draggable={false}
                    />
                  ) : (
                    <div className="vehicle-slot__placeholder">
                      <i className="ti ti-car"></i>
                      {isSelected && <span>Adicionar foto</span>}
                    </div>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>

        <button
          type="button"
          className="vehicle-selector__arrow"
          onClick={handleNext}
          disabled={count <= 1}
          aria-label="Próximo veículo"
        >
          ›
        </button>
      </div>

      {/* Info do veículo selecionado */}
      <div className="vehicle-selector__info">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={selectedVehicle.id}
            className="vehicle-info"
            custom={direction}
            variants={infoVariants}
            initial="initial"
            animate="animate"
            exit="exit"
          >
            {/* Placa estilizada */}
            <div className="vehicle-info__plate">
              <div className="vehicle-info__plate-br">BR</div>
              <div className="vehicle-info__plate-text">{selectedVehicle.placa}</div>
            </div>

            <div className="vehicle-info__name">
              {selectedVehicle.modelo || <span style={{ opacity: 0.4, fontWeight: 400 }}>Modelo não informado</span>}
            </div>

            {(selectedVehicle.ano || selectedVehicle.cor) && (
              <div className="vehicle-info__meta">
                {[selectedVehicle.ano, selectedVehicle.cor].filter(Boolean).join(' · ')}
              </div>
            )}

            {/* Ações */}
            <div className="vehicle-info__actions">
              <label className="vehicle-info__upload-label">
                <input
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={(e) => onUpload?.(selectedVehicle, e.target.files[0])}
                />
                <i className="ti ti-camera"></i>
                {selectedVehicle.imagem ? 'Trocar foto' : 'Adicionar foto'}
              </label>

              {selectedVehicle.imagem && (
                <button
                  type="button"
                  className="vehicle-info__btn"
                  onClick={() => onRemoveImg?.(selectedVehicle)}
                >
                  <i className="ti ti-photo-off"></i> Remover foto
                </button>
              )}

              <button
                type="button"
                className="vehicle-info__btn vehicle-info__btn--danger"
                onClick={() => onDelete?.(selectedVehicle)}
              >
                <i className="ti ti-trash"></i> Excluir
              </button>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Dots */}
      {count > 1 && (
        <div className="vehicle-selector__dots">
          {vehicles.map((v, i) => (
            <button
              key={v.id}
              type="button"
              aria-label={`Selecionar ${v.placa}`}
              className={`vehicle-dot${i === safeIndex ? ' vehicle-dot--active' : ''}`}
              onClick={() => goTo(i, i > safeIndex ? 1 : -1)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

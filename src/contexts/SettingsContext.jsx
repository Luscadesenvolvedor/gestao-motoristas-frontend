import { createContext, useContext, useState, useEffect } from 'react';

const DEFAULT = {
  tema:            'claro',       // 'claro' | 'escuro'
  fonte:           'media',       // 'pequena' | 'media' | 'grande'
  densidade:       'normal',      // 'compacta' | 'normal' | 'confortavel'
  abaPadrao:       '',            // ex: 'solicitacoes'
  frotaPadrao:     '',            // 'buzin' | 'lbm' | 'meli' | ''
  confirmarExclusao: true,
};

const SettingsContext = createContext(null);

function aplicarNoDOM(s) {
  document.documentElement.setAttribute('data-theme',   s.tema);
  document.documentElement.setAttribute('data-font',    s.fonte);
  document.documentElement.setAttribute('data-density', s.densidade);
}

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(() => {
    try {
      const saved = localStorage.getItem('app_settings');
      const merged = { ...DEFAULT, ...(saved ? JSON.parse(saved) : {}) };
      aplicarNoDOM(merged);
      return merged;
    } catch {
      aplicarNoDOM(DEFAULT);
      return DEFAULT;
    }
  });

  useEffect(() => {
    localStorage.setItem('app_settings', JSON.stringify(settings));
    aplicarNoDOM(settings);
  }, [settings]);

  function update(key, value) {
    setSettings(prev => ({ ...prev, [key]: value }));
  }

  function resetar() {
    setSettings(DEFAULT);
  }

  return (
    <SettingsContext.Provider value={{ settings, update, resetar }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings deve ser usado dentro de SettingsProvider');
  return ctx;
}

/** Substitui window.confirm respeitando a preferência do usuário */
export function useConfirmar() {
  const { settings } = useSettings();
  return function confirmar(msg) {
    if (!settings.confirmarExclusao) return true;
    return window.confirm(msg);
  };
}

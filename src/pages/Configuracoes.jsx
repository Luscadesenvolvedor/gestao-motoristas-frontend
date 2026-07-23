import { useSettings } from '../contexts/SettingsContext';
import { useAuth } from '../contexts/AuthContext';

const MENUS_DISPONIVEIS = [
  { path: 'solicitacoes', label: 'Solicitações',        recurso: 'solicitacoes' },
  { path: 'motoristas',   label: 'Motoristas',          recurso: 'motoristas' },
  { path: 'folgas',       label: 'Folgas',              recurso: 'folgas' },
  { path: 'ferias',       label: 'Férias',              recurso: 'ferias' },
  { path: 'agendamentos', label: 'Agendamento',         recurso: 'agendamentos' },
  { path: 'exclusoes',    label: 'Exclusão de Vales',   recurso: 'exclusoes' },
  { path: 'financeiro',   label: 'Controle Financeiro', recurso: 'financeiro' },
  { path: 'levantamentos',label: 'Levantamentos',       recurso: 'levantamentos' },
  { path: 'indicadores',  label: 'Indicadores',         recurso: 'solicitacoes' },
  { path: 'mapa-ineficiencia', label: 'Mapa de Ineficiência', recurso: 'financeiro' },
  { path: 'usuarios',     label: 'Usuários',            recurso: 'usuarios' },
];

function Secao({ titulo, descricao, children }) {
  return (
    <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', padding: '24px 28px', marginBottom: 20 }}>
      <div style={{ marginBottom: 20 }}>
        <h3 style={{ fontSize: 15, fontWeight: 600, color: '#1a1a2e', margin: 0 }}>{titulo}</h3>
        {descricao && <p style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>{descricao}</p>}
      </div>
      {children}
    </div>
  );
}

function BotaoOpcao({ ativo, onClick, icone, label, descricao }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '12px 16px', borderRadius: 10, cursor: 'pointer',
        border: ativo ? '2px solid #EB3238' : '2px solid #e5e7eb',
        background: ativo ? '#fff5f5' : '#fff',
        flex: 1, textAlign: 'left', transition: 'all 0.15s',
      }}
    >
      <div style={{
        width: 36, height: 36, borderRadius: 9, flexShrink: 0,
        background: ativo ? '#EB323818' : '#f3f4f6',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <i className={`ti ${icone}`} style={{ fontSize: 18, color: ativo ? '#EB3238' : '#9ca3af' }}></i>
      </div>
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: ativo ? '#EB3238' : '#374151' }}>{label}</div>
        {descricao && <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{descricao}</div>}
      </div>
      {ativo && (
        <div style={{ marginLeft: 'auto', width: 18, height: 18, borderRadius: '50%', background: '#EB3238', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <i className="ti ti-check" style={{ fontSize: 11, color: '#fff' }}></i>
        </div>
      )}
    </button>
  );
}

function Toggle({ ativo, onChange, label, descricao }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 0', borderBottom: '1px solid #f3f4f6' }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 500, color: '#374151' }}>{label}</div>
        {descricao && <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{descricao}</div>}
      </div>
      <button
        onClick={() => onChange(!ativo)}
        style={{
          width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
          background: ativo ? '#EB3238' : '#d1d5db',
          position: 'relative', flexShrink: 0, transition: 'background 0.2s',
        }}
      >
        <div style={{
          width: 18, height: 18, borderRadius: '50%', background: '#fff',
          position: 'absolute', top: 3,
          left: ativo ? 23 : 3,
          transition: 'left 0.2s',
          boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
        }} />
      </button>
    </div>
  );
}

export default function Configuracoes() {
  const { settings, update, resetar } = useSettings();
  const { usuario, pode } = useAuth();

  const menusPermitidos = MENUS_DISPONIVEIS.filter(m => pode(m.recurso, 'leitura'));

  return (
    <div style={{ maxWidth: 760 }}>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, color: '#1a1a2e', margin: 0 }}>Configurações</h2>
        <p style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>
          Preferências pessoais — salvas no seu navegador, não afetam outros usuários.
        </p>
      </div>

      {/* Aparência */}
      <Secao titulo="Aparência" descricao="Personalize o visual da aplicação.">

        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>Tema</div>
          <div style={{ display: 'flex', gap: 12 }}>
            <BotaoOpcao
              ativo={settings.tema === 'claro'}
              onClick={() => update('tema', 'claro')}
              icone="ti-sun"
              label="Claro"
              descricao="Interface padrão com fundo branco"
            />
            <BotaoOpcao
              ativo={settings.tema === 'escuro'}
              onClick={() => update('tema', 'escuro')}
              icone="ti-moon"
              label="Escuro"
              descricao="Reduz o cansaço visual à noite"
            />
          </div>
        </div>

        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>Tamanho de fonte</div>
          <div style={{ display: 'flex', gap: 12 }}>
            <BotaoOpcao
              ativo={settings.fonte === 'pequena'}
              onClick={() => update('fonte', 'pequena')}
              icone="ti-letter-a"
              label="Pequena"
              descricao="88% do tamanho padrão"
            />
            <BotaoOpcao
              ativo={settings.fonte === 'media'}
              onClick={() => update('fonte', 'media')}
              icone="ti-letter-a"
              label="Média"
              descricao="Tamanho padrão"
            />
            <BotaoOpcao
              ativo={settings.fonte === 'grande'}
              onClick={() => update('fonte', 'grande')}
              icone="ti-letter-a"
              label="Grande"
              descricao="113% do tamanho padrão"
            />
          </div>
        </div>

        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>Densidade das tabelas</div>
          <div style={{ display: 'flex', gap: 12 }}>
            <BotaoOpcao
              ativo={settings.densidade === 'compacta'}
              onClick={() => update('densidade', 'compacta')}
              icone="ti-layout-rows"
              label="Compacta"
              descricao="Mais linhas visíveis"
            />
            <BotaoOpcao
              ativo={settings.densidade === 'normal'}
              onClick={() => update('densidade', 'normal')}
              icone="ti-layout-rows"
              label="Normal"
              descricao="Padrão"
            />
            <BotaoOpcao
              ativo={settings.densidade === 'confortavel'}
              onClick={() => update('densidade', 'confortavel')}
              icone="ti-layout-rows"
              label="Confortável"
              descricao="Maior espaçamento"
            />
          </div>
        </div>
      </Secao>

      {/* Navegação */}
      <Secao titulo="Navegação" descricao="Defina qual aba abre automaticamente ao entrar no sistema.">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <button
            onClick={() => update('abaPadrao', '')}
            style={{
              padding: '10px 14px', borderRadius: 8, border: '2px solid ' + (settings.abaPadrao === '' ? '#EB3238' : '#e5e7eb'),
              background: settings.abaPadrao === '' ? '#fff5f5' : '#fff',
              fontSize: 13, fontWeight: settings.abaPadrao === '' ? 600 : 400,
              color: settings.abaPadrao === '' ? '#EB3238' : '#374151',
              cursor: 'pointer', textAlign: 'left',
            }}
          >
            Automático (primeira aba com acesso)
          </button>
          {menusPermitidos.map(m => (
            <button
              key={m.path}
              onClick={() => update('abaPadrao', m.path)}
              style={{
                padding: '10px 14px', borderRadius: 8, border: '2px solid ' + (settings.abaPadrao === m.path ? '#EB3238' : '#e5e7eb'),
                background: settings.abaPadrao === m.path ? '#fff5f5' : '#fff',
                fontSize: 13, fontWeight: settings.abaPadrao === m.path ? 600 : 400,
                color: settings.abaPadrao === m.path ? '#EB3238' : '#374151',
                cursor: 'pointer', textAlign: 'left',
              }}
            >
              {m.label}
            </button>
          ))}
        </div>
      </Secao>

      {/* Solicitações */}
      <Secao titulo="Solicitações" descricao="Preferências específicas da aba de solicitações.">
        <div style={{ marginBottom: 4 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>Frota pré-selecionada</div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {[
              { val: '', label: 'Nenhuma (todas)' },
              { val: 'buzin', label: 'BUZIN' },
              { val: 'lbm',   label: 'LBM' },
              { val: 'meli',  label: 'MELI' },
            ].map(op => (
              <button
                key={op.val}
                onClick={() => update('frotaPadrao', op.val)}
                style={{
                  padding: '8px 20px', borderRadius: 20, border: '2px solid ' + (settings.frotaPadrao === op.val ? '#EB3238' : '#e5e7eb'),
                  background: settings.frotaPadrao === op.val ? '#EB3238' : '#fff',
                  color: settings.frotaPadrao === op.val ? '#fff' : '#374151',
                  fontSize: 13, fontWeight: 500, cursor: 'pointer',
                }}
              >
                {op.label}
              </button>
            ))}
          </div>
        </div>
      </Secao>

      {/* Comportamento */}
      <Secao titulo="Comportamento">
        <Toggle
          ativo={settings.confirmarExclusao}
          onChange={v => update('confirmarExclusao', v)}
          label="Confirmar antes de excluir"
          descricao="Exibe um diálogo de confirmação antes de deletar registros"
        />
      </Secao>

      {/* Resetar */}
      <div style={{ textAlign: 'right', marginTop: 8 }}>
        <button
          onClick={() => { if (window.confirm('Restaurar todas as configurações para o padrão?')) resetar(); }}
          style={{ padding: '8px 20px', borderRadius: 8, border: '1px solid #e5e7eb', background: '#fff', fontSize: 13, color: '#6b7280', cursor: 'pointer' }}
        >
          Restaurar padrões
        </button>
      </div>
    </div>
  );
}

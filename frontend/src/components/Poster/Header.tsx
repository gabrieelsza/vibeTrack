import React, { useEffect, useState } from 'react';
import {
  Camera,
  Download,
  History,
  LogOut,
  Menu,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useNetwork } from '../../contexts/NetworkContext';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface HeaderProps {
  activeTab: 'analyze' | 'history';
  onChangeTab: (tab: 'analyze' | 'history') => void;
  editionLabel?: string;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onChangeTab,
  editionLabel = 'Nº 01 · EDIÇÃO FOTO',
}) => {
  const { user, logout } = useAuth();
  const { isOnline, simulatedOffline, toggleSimulatedOffline } = useNetwork();
  const [menuOpen, setMenuOpen] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installFeedback, setInstallFeedback] = useState<string | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = async () => {
    if (installPrompt) {
      await installPrompt.prompt();
      setInstallPrompt(null);
      setInstallFeedback(null);
    } else {
      setInstallFeedback(
        'Para instalar: use o menu do navegador e toque em "Adicionar à tela inicial" ou no ícone de instalação na barra de endereço.'
      );
    }
  };

  return (
    <header className="pt-3">
      {/* Linha principal do cabeçalho fiel ao pôster de referência */}
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => {
            onChangeTab('analyze');
            setMenuOpen(false);
          }}
          className="inline-flex min-h-[44px] items-center font-display text-lg font-black uppercase tracking-tight text-poster-red focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-poster-red"
        >
          VIBETRACK
        </button>

        <div className="flex items-center gap-2">
          <span className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-poster-ink">
            {activeTab === 'history' ? 'Nº 01 · ACERVO' : editionLabel}
          </span>

          {user && (
            <button
              type="button"
              onClick={() => setMenuOpen((prev) => !prev)}
              aria-expanded={menuOpen}
              aria-label={menuOpen ? 'Fechar menu da edição' : 'Abrir menu, histórico e conta'}
              className="flex h-11 w-11 items-center justify-center rounded-full border border-poster-border bg-poster-paper text-poster-ink transition hover:border-poster-red hover:text-poster-red focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-poster-red"
            >
              {menuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          )}
        </div>
      </div>

      {/* Barra rápida discreta de navegação (sempre visível para 1 toque) */}
      {user && (
        <div className="mt-1 flex flex-wrap items-center justify-between gap-2 border-b border-poster-border pb-2.5 text-[10px] font-bold uppercase tracking-[0.14em] text-poster-muted">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => onChangeTab('analyze')}
              className={`min-h-[34px] rounded-full px-3 py-1 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-poster-red ${
                activeTab === 'analyze'
                  ? 'bg-poster-red text-poster-cream'
                  : 'bg-poster-paper text-poster-ink hover:border-poster-red'
              }`}
            >
              Pôster
            </button>
            <button
              type="button"
              onClick={() => onChangeTab('history')}
              className={`min-h-[34px] rounded-full px-3 py-1 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-poster-red ${
                activeTab === 'history'
                  ? 'bg-poster-red text-poster-cream'
                  : 'bg-poster-paper text-poster-ink hover:border-poster-red'
              }`}
            >
              Histórico
            </button>
          </div>
        </div>
      )}

      {/* Gaveta / Menu Retrô Discreto (Histórico, Instalar App, Simular Offline, Conta) */}
      {user && menuOpen && (
        <div className="mt-2 rounded-2xl border-2 border-poster-ink bg-poster-paper p-3.5 shadow-polaroid">
          <div className="flex items-center justify-between border-b border-poster-border pb-2.5">
            <div>
              <p className="text-[9px] font-extrabold uppercase tracking-[0.2em] text-poster-red">
                EXPEDIENTE DO ASSINANTE
              </p>
              <p className="truncate text-xs font-bold text-poster-ink">{user.name}</p>
              <p className="truncate text-[11px] text-poster-muted">{user.email}</p>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                onChangeTab('analyze');
                setMenuOpen(false);
              }}
              className={`flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-[11px] font-bold uppercase tracking-wider transition ${
                activeTab === 'analyze'
                  ? 'border-poster-red bg-poster-red text-poster-cream'
                  : 'border-poster-border bg-poster-cream text-poster-ink hover:border-poster-red'
              }`}
            >
              <Camera className="h-3.5 w-3.5" />
              <span>Nova Foto</span>
            </button>

            <button
              type="button"
              onClick={() => {
                onChangeTab('history');
                setMenuOpen(false);
              }}
              className={`flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-[11px] font-bold uppercase tracking-wider transition ${
                activeTab === 'history'
                  ? 'border-poster-red bg-poster-red text-poster-cream'
                  : 'border-poster-border bg-poster-cream text-poster-ink hover:border-poster-red'
              }`}
            >
              <History className="h-3.5 w-3.5" />
              <span>Histórico</span>
            </button>

            <button
              type="button"
              onClick={handleInstallClick}
              className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-poster-border bg-poster-cream px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-poster-ink transition hover:border-poster-red hover:text-poster-red"
            >
              <Download className="h-3.5 w-3.5 text-poster-red" />
              <span>Instalar App</span>
            </button>

            <button
              type="button"
              onClick={toggleSimulatedOffline}
              className={`flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-[11px] font-bold uppercase tracking-wider transition ${
                !isOnline || simulatedOffline
                  ? 'border-poster-red bg-poster-redLight text-poster-red'
                  : 'border-poster-border bg-poster-cream text-poster-ink hover:border-poster-red'
              }`}
            >
              {!isOnline ? (
                <>
                  <WifiOff className="h-3.5 w-3.5 text-poster-red" />
                  <span>Offline Ativo</span>
                </>
              ) : (
                <>
                  <Wifi className="h-3.5 w-3.5 text-poster-red" />
                  <span>Sinal Online</span>
                </>
              )}
            </button>
          </div>

          {installFeedback && (
            <p className="mt-2.5 rounded-xl border border-poster-border bg-poster-cream p-2.5 text-[11px] leading-snug text-poster-ink">
              {installFeedback}
            </p>
          )}

          <div className="mt-3 flex items-center justify-end border-t border-poster-border pt-2.5">
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                logout();
              }}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-wider text-poster-red transition hover:bg-poster-redLight"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Sair da Conta</span>
            </button>
          </div>
        </div>
      )}
    </header>
  );
};

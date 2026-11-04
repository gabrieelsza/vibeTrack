import React, { useState } from 'react';
import { OfflineBanner } from './components/Layout/OfflineBanner';
import { CheckerDivider } from './components/Poster/CheckerDivider';
import { Header } from './components/Poster/Header';
import { AudioPlayerProvider } from './contexts/AudioPlayerContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { NetworkProvider } from './contexts/NetworkContext';
import { AuthPage } from './pages/AuthPage';
import { HistoryPage } from './pages/HistoryPage';
import { HomeAnalysisPage } from './pages/HomeAnalysisPage';

const AppContent: React.FC = () => {
  const { user, loading } = useAuth();
  const [activeTab, setActiveTab] = useState<'analyze' | 'history'>('analyze');

  if (loading) {
    return (
      <div className="min-h-screen bg-poster-cream text-poster-ink">
        <div className="mx-auto flex min-h-screen w-full max-w-[420px] flex-col justify-center px-5 py-10">
          <CheckerDivider animated />
          <p className="mt-4 text-center font-display text-sm uppercase tracking-wider text-poster-red">
            CARREGANDO VIBETRACK...
          </p>
        </div>
      </div>
    );
  }

  // Acesso obrigatório com conta identificada (RF-001)
  if (!user) {
    return <AuthPage />;
  }

  return (
    <div className="min-h-screen bg-poster-cream text-poster-ink">
      {/* Coluna única centralizada estilo Pôster / Zine Retrô (largura máxima ~420px) */}
      <div className="mx-auto min-h-screen w-full max-w-[420px] px-5 pb-12 pt-4">
        {/* 1. Faixa xadrez no topo */}
        <CheckerDivider />

        {/* 2. Cabeçalho: logo "VIBETRACK" em vermelho à esquerda; "Nº 01 · EDIÇÃO FOTO" à direita */}
        <Header activeTab={activeTab} onChangeTab={setActiveTab} />

        {/* Aviso de Modo Offline caso desconectado (RF-010) */}
        <OfflineBanner onGoToHistory={() => setActiveTab('history')} />

        <main className="mt-2">
          {activeTab === 'analyze' ? <HomeAnalysisPage /> : <HistoryPage />}
        </main>
      </div>
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <NetworkProvider>
      <AuthProvider>
        <AudioPlayerProvider>
          <AppContent />
        </AudioPlayerProvider>
      </AuthProvider>
    </NetworkProvider>
  );
};

export default App;

import React from 'react';
import { WifiOff } from 'lucide-react';
import { useNetwork } from '../../contexts/NetworkContext';

interface OfflineBannerProps {
  onGoToHistory?: () => void;
}

export const OfflineBanner: React.FC<OfflineBannerProps> = ({ onGoToHistory }) => {
  const { isOnline, simulatedOffline, toggleSimulatedOffline } = useNetwork();

  if (isOnline) return null;

  return (
    <div className="my-3 rounded-2xl border-2 border-poster-red bg-poster-redLight p-3 text-poster-ink">
      <div className="flex flex-col gap-2 text-xs">
        <div className="flex items-start gap-2">
          <WifiOff className="mt-0.5 h-4 w-4 shrink-0 text-poster-red" />
          <p className="leading-snug">
            <strong className="font-display uppercase tracking-wide text-poster-red">
              Edição Offline:
            </strong>{' '}
            Novas análises exigem conexão ativa, mas seu <strong>Histórico</strong> salvo continua
            disponível para consulta.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {onGoToHistory && (
            <button
              type="button"
              onClick={onGoToHistory}
              className="min-h-[38px] rounded-full bg-poster-red px-3.5 py-1.5 font-display text-[10px] uppercase tracking-wider text-poster-cream transition hover:bg-poster-redDark"
            >
              Ver Histórico Salvo
            </button>
          )}
          {simulatedOffline && (
            <button
              type="button"
              onClick={toggleSimulatedOffline}
              className="min-h-[38px] rounded-full border border-poster-red bg-poster-cream px-3.5 py-1.5 font-display text-[10px] uppercase tracking-wider text-poster-red transition hover:bg-white"
            >
              Restabelecer Sinal
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

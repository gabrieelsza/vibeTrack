import React, { useState } from 'react';
import { ExternalLink, Info, Pause, Play, Share2 } from 'lucide-react';
import { useAudioPlayer } from '../../contexts/AudioPlayerContext';
import { MusicRecommendation } from '../../types';
import { getTrackInitials } from '../../utils/poster.utils';

interface TrackListItemProps {
  track: MusicRecommendation;
  isFallback?: boolean;
  onShareTrack: (track: MusicRecommendation) => void;
}

export const TrackListItem: React.FC<TrackListItemProps> = ({
  track,
  isFallback = false,
  onShareTrack,
}) => {
  const { activeTrack, isPlaying, progressPercent, togglePlay } = useAudioPlayer();
  const [showReason, setShowReason] = useState(false);

  const isThisTrackActive = activeTrack?.id === track.id;
  const isThisTrackPlaying = isThisTrackActive && isPlaying;
  const initials = getTrackInitials(track.title);

  return (
    <div className="border-b border-poster-border py-3.5 transition-colors">
      <div className="flex items-center gap-3.5">
        {/* Ícone quadrado vermelho com sigla creme e base xadrez */}
        <div
          aria-hidden="true"
          className="relative flex h-12 w-12 shrink-0 flex-col items-center justify-center overflow-hidden rounded-xl bg-poster-red text-poster-cream shadow-sm"
        >
          <span className="pb-2 font-display text-sm font-black uppercase leading-none tracking-tight">
            {initials}
          </span>
          <div className="checker-strip-sm absolute inset-x-0 bottom-0" />
        </div>

        {/* Título, Artista e Rótulo de Preview / Corte */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <h4
              title={track.title}
              className="truncate font-display text-sm font-black uppercase tracking-tight text-poster-ink sm:text-[15px]"
            >
              {track.title}
            </h4>
            {isFallback && (
              <span className="rounded-full border border-poster-red/40 bg-poster-redLight px-2 py-0.5 text-[8px] font-extrabold uppercase tracking-wider text-poster-red">
                SUGESTÃO POPULAR
              </span>
            )}
          </div>

          <p className="mt-0.5 truncate text-xs text-poster-muted">
            <span className="font-medium text-poster-ink/85">{track.artist}</span>
            <span className="mx-1.5 text-poster-muted">•</span>
            <span className="font-semibold text-poster-red">
              {track.bestCut
                ? track.bestCut
                : track.hasPreview
                ? isThisTrackPlaying
                  ? `Tocando (${progressPercent}%)`
                  : 'Preview 30s'
                : 'Preview indisponível agora'}
            </span>
          </p>

          {/* Ações discretas: Motivo da IA (RF-005), Ouvir Completa e Compartilhar Card (RF-009) */}
          <div className="mt-1.5 flex flex-wrap items-center gap-3 text-[10px] font-bold uppercase tracking-wider text-poster-muted">
            <button
              type="button"
              onClick={() => setShowReason((prev) => !prev)}
              aria-expanded={showReason}
              className="inline-flex items-center gap-1 text-poster-ink/75 underline-offset-2 hover:text-poster-red hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-poster-red"
            >
              <Info className="h-3 w-3 text-poster-red" />
              <span>{showReason ? 'Ocultar motivo' : isFallback ? 'Sobre a faixa' : 'Por que combina'}</span>
            </button>

            <button
              type="button"
              onClick={() => onShareTrack(track)}
              className="inline-flex items-center gap-1 text-poster-ink/75 underline-offset-2 hover:text-poster-red hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-poster-red"
            >
              <Share2 className="h-3 w-3 text-poster-red" />
              <span>Card</span>
            </button>

            <a
              href={track.externalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-poster-ink/75 underline-offset-2 hover:text-poster-red hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-poster-red"
            >
              <ExternalLink className="h-3 w-3 text-poster-red" />
              <span>Completa</span>
            </a>
          </div>
        </div>

        {/* Botão Circular Vermelho de Play à direita (>= 44px de área de toque) */}
        {track.hasPreview && track.previewUrl ? (
          <button
            type="button"
            onClick={() => togglePlay(track)}
            aria-label={
              isThisTrackPlaying
                ? `Pausar prévia de 30 segundos de ${track.title}`
                : `Reproduzir prévia de 30 segundos de ${track.title}`
            }
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-poster-red text-poster-cream shadow-sm transition hover:bg-poster-redDark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-poster-red"
          >
            {isThisTrackPlaying ? (
              <Pause className="h-4 w-4 fill-current" />
            ) : (
              <Play className="ml-0.5 h-4 w-4 fill-current" />
            )}
          </button>
        ) : (
          <a
            href={track.externalUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Prévia indisponível. Ouvir ${track.title} completa externamente`}
            title="Trecho indisponível para reprodução direta — ouvir faixa completa"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 border-poster-red bg-poster-cream text-poster-red transition hover:bg-poster-red hover:text-poster-cream focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-poster-red"
          >
            <ExternalLink className="h-4 w-4" />
          </a>
        )}
      </div>

      {/* Barra de progresso fina quando a faixa está ativa */}
      {isThisTrackActive && track.hasPreview && (
        <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-poster-border">
          <div
            className="h-full bg-poster-red transition-all duration-200"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      )}

      {/* Justificativa da IA expansível (RF-005) */}
      {showReason && (
        <div className="mt-2.5 rounded-xl border border-poster-border bg-poster-paper px-3 py-2 text-xs leading-relaxed text-poster-ink">
          <span className="font-bold uppercase tracking-wider text-poster-red">
            {isFallback ? 'Modo Fallback: ' : 'Leitura da IA: '}
          </span>
          {track.reason}
        </div>
      )}
    </div>
  );
};

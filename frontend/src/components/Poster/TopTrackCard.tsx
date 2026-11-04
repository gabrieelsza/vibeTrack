import React, { useState } from 'react';
import { ExternalLink, Info, Pause, Play, Share2 } from 'lucide-react';
import { useAudioPlayer } from '../../contexts/AudioPlayerContext';
import { MusicRecommendation } from '../../types';
import { getTrackInitials } from '../../utils/poster.utils';

interface TopTrackCardProps {
  track: MusicRecommendation;
  isFallback?: boolean;
  onShareTrack: (track: MusicRecommendation) => void;
}

export const TopTrackCard: React.FC<TopTrackCardProps> = ({
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
    <div className="flex h-full flex-col justify-between rounded-[26px] bg-poster-red p-4 text-poster-cream shadow-poster">
      <div>
        <div className="flex items-center justify-between gap-2">
          <span className="inline-block rounded-full bg-poster-redDark px-2.5 py-0.5 text-[9px] font-extrabold uppercase tracking-[0.2em] text-poster-cream">
            {isFallback ? 'SUGESTÃO POPULAR' : 'MÚSICA IDEAL'}
          </span>
        </div>

        {/* Ícone quadrado creme com sigla em vermelho e base xadrez */}
        <div
          aria-hidden="true"
          className="relative mt-2.5 flex h-14 w-14 flex-col items-center justify-center overflow-hidden rounded-xl bg-poster-cream text-poster-red shadow-sm"
        >
          <span className="pb-2 font-display text-lg font-black uppercase leading-none tracking-tight">
            {initials}
          </span>
          <div className="checker-strip-sm absolute inset-x-0 bottom-0" />
        </div>

        {/* Nome da música e artista */}
        <h2
          title={track.title}
          className="mt-3 truncate font-display text-base font-black uppercase leading-tight tracking-tight text-white sm:text-lg"
        >
          {track.title}
        </h2>
        <p title={track.artist} className="mt-0.5 truncate text-xs font-medium text-poster-cream/90">
          {track.artist}
        </p>

        {/* Exibe "Melhor corte" apenas se a API fornecer; caso contrário, não inventa dados */}
        {track.bestCut && (
          <p className="mt-2 text-[11px] font-extrabold text-white">
            Melhor corte: {track.bestCut}
          </p>
        )}
      </div>

      {/* Controle de Play de 30s ou Atenuação Sonora (RF-006) */}
      <div className="mt-3 pt-1">
        {track.hasPreview && track.previewUrl ? (
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => togglePlay(track)}
              aria-label={
                isThisTrackPlaying
                  ? `Pausar prévia de 30 segundos de ${track.title}`
                  : `Reproduzir prévia de 30 segundos de ${track.title}`
              }
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-poster-cream text-poster-red shadow-sm transition hover:scale-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              {isThisTrackPlaying ? (
                <Pause className="h-4 w-4 fill-current" />
              ) : (
                <Play className="ml-0.5 h-4 w-4 fill-current" />
              )}
            </button>
            <div className="min-w-0 flex-1">
              <span className="block font-display text-[10px] font-black uppercase tracking-[0.14em] text-white">
                {isThisTrackPlaying ? `TOCANDO · ${progressPercent}%` : 'PREVIEW 30S'}
              </span>
              {isThisTrackActive && (
                <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-poster-redDark">
                  <div
                    className="h-full bg-poster-cream transition-all duration-200"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-1.5">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-poster-cream/90">
              Preview indisponível agora
            </span>
            <a
              href={track.externalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-full bg-poster-cream px-3 py-2 font-display text-[10px] uppercase tracking-wider text-poster-red shadow-sm transition hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              <span>OUVIR COMPLETA</span>
            </a>
          </div>
        )}

        {/* Ações secundárias compactas: Motivo da IA (RF-005), Ouvir externa e Card (RF-009) */}
        <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-poster-cream/20 pt-2">
          <button
            type="button"
            onClick={() => setShowReason((prev) => !prev)}
            aria-expanded={showReason}
            aria-label={`Ver motivo da escolha para ${track.title}`}
            className="inline-flex min-h-[32px] items-center gap-1 rounded-full bg-poster-redDark/80 px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-poster-cream transition hover:bg-poster-redDark focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
          >
            <Info className="h-3 w-3" />
            <span>{showReason ? 'OCULTAR' : 'MOTIVO'}</span>
          </button>

          <button
            type="button"
            onClick={() => onShareTrack(track)}
            aria-label={`Compartilhar card da música ${track.title}`}
            className="inline-flex min-h-[32px] items-center gap-1 rounded-full bg-poster-redDark/80 px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-poster-cream transition hover:bg-poster-redDark focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
          >
            <Share2 className="h-3 w-3" />
            <span>CARD</span>
          </button>

          <a
            href={track.externalUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Ouvir ${track.title} completa em plataforma externa`}
            className="inline-flex min-h-[32px] items-center gap-1 rounded-full bg-poster-redDark/80 px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-poster-cream transition hover:bg-poster-redDark focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
          >
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>

        {showReason && (
          <p className="mt-2 rounded-xl bg-poster-redDark/90 p-2.5 text-[11px] leading-snug text-poster-cream">
            {track.reason}
          </p>
        )}
      </div>
    </div>
  );
};

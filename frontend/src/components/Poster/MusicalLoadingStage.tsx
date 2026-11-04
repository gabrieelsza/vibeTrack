import React, { useEffect, useState } from 'react';
import { CheckerDivider } from './CheckerDivider';

export const LOADING_STAGE_MESSAGES = [
  'Observando sua foto...',
  'Sentindo o clima...',
  'Escolhendo o ritmo...',
  'Procurando as músicas...',
  'Afinando os detalhes...',
] as const;

interface MusicalLoadingStageProps {
  photoSrc?: string | null;
  caption?: string;
  isRetrying429?: boolean;
  retryCountdownSeconds?: number | null;
}

export const MusicalLoadingStage: React.FC<MusicalLoadingStageProps> = ({
  photoSrc,
  caption = 'REVELANDO VIBE',
  isRetrying429 = false,
  retryCountdownSeconds = null,
}) => {
  const [stageIndex, setStageIndex] = useState<number>(0);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState<boolean>(() => {
    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }
    return false;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handleChange = (event: MediaQueryListEvent) => {
      setPrefersReducedMotion(event.matches);
    };
    mediaQuery.addEventListener?.('change', handleChange);
    return () => {
      mediaQuery.removeEventListener?.('change', handleChange);
    };
  }, []);

  useEffect(() => {
    if (isRetrying429) return;
    const interval = window.setInterval(() => {
      setStageIndex((prev) => (prev + 1) % LOADING_STAGE_MESSAGES.length);
    }, 2000);

    return () => window.clearInterval(interval);
  }, [isRetrying429]);

  const activeMessage = isRetrying429
    ? 'Está tocando muita música por aqui, tentando de novo...'
    : LOADING_STAGE_MESSAGES[stageIndex];

  const liveAnnouncement =
    isRetrying429 && retryCountdownSeconds && retryCountdownSeconds > 0
      ? `${activeMessage} Nova tentativa em ${retryCountdownSeconds} segundos.`
      : activeMessage;

  return (
    <section
      aria-busy="true"
      aria-label="Processando análise musical da fotografia"
      className="my-5 space-y-5"
    >
      {/* Região acessível anunciando cada etapa em tempo real */}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {liveAnnouncement}
      </div>

      <div className="flex flex-col gap-6 items-center sm:grid-cols-[48%_1fr]">
        {/* Bloco Esquerdo: Polaroid com Disco de Vinil Girando Atrás e Notas Musicais Subindo */}
        <div className="relative mx-auto flex w-full max-w-[235px] items-center justify-center py-3">
          {/* Notas musicais flutuantes (ocultas se prefers-reduced-motion estiver ativo) */}
          {!prefersReducedMotion && (
            <>
              <span
                aria-hidden="true"
                className="musical-note-1 pointer-events-none absolute -top-2 left-2 z-20 select-none font-display text-2xl font-black text-poster-red"
              >
                ♪
              </span>
              <span
                aria-hidden="true"
                className="musical-note-2 pointer-events-none absolute -top-3 right-3 z-20 select-none font-display text-xl font-black text-poster-ink"
              >
                ♫
              </span>
              <span
                aria-hidden="true"
                className="musical-note-3 pointer-events-none absolute bottom-3 right-0 z-20 select-none font-display text-2xl font-black text-poster-red"
              >
                ♪
              </span>
            </>
          )}

          {/* Disco de Vinil Retrô em SVG puro girando atrás da Polaroid */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-5 top-1/2 z-0 h-36 w-36 -translate-y-1/2 sm:-right-6 sm:h-40 sm:w-40"
          >
            <svg
              viewBox="0 0 120 120"
              className={`h-full w-full drop-shadow-md ${
                prefersReducedMotion ? '' : 'vinyl-spin'
              }`}
            >
              {/* Corpo do vinil */}
              <circle cx="60" cy="60" r="56" fill="#141413" stroke="#E5DEC9" strokeWidth="1.5" />
              {/* Sulcos concêntricos */}
              <circle cx="60" cy="60" r="48" fill="none" stroke="#292524" strokeWidth="1" />
              <circle cx="60" cy="60" r="41" fill="none" stroke="#292524" strokeWidth="1" />
              <circle cx="60" cy="60" r="34" fill="none" stroke="#292524" strokeWidth="1" />
              {/* Reflexo diagonal sutil */}
              <path
                d="M60 60 L22 22 A54 54 0 0 1 42 10 Z"
                fill="rgba(253, 249, 243, 0.08)"
              />
              <path
                d="M60 60 L98 98 A54 54 0 0 1 78 110 Z"
                fill="rgba(253, 249, 243, 0.08)"
              />
              {/* Selo central vermelho e creme estilo retrô */}
              <circle cx="60" cy="60" r="20" fill="#B91C1C" stroke="#FDF9F3" strokeWidth="2" />
              <path d="M42 60 H78" stroke="#FDF9F3" strokeWidth="1.5" strokeDasharray="3 2" />
              <circle cx="60" cy="60" r="5" fill="#FDF9F3" stroke="#141413" strokeWidth="1.5" />
            </svg>
          </div>

          {/* Moldura Polaroid à frente do vinil */}
          <div className="relative z-10 w-[172px] -rotate-3 rounded-[4px] border border-poster-border bg-white p-2.5 pb-4 shadow-polaroid">
            <div className="relative aspect-[1/1.05] w-full overflow-hidden bg-poster-paper">
              {photoSrc ? (
                <img
                  src={photoSrc}
                  alt="Sua fotografia em análise"
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-poster-paper text-poster-red">
                  <span className="font-display text-2xl">♪ ♫</span>
                </div>
              )}
              <div className="absolute inset-0 bg-poster-red/10 mix-blend-multiply" />
            </div>
            <p className="mt-2.5 truncate px-1 text-center font-sans text-[9px] font-extrabold uppercase tracking-[0.2em] text-poster-ink">
              {caption}
            </p>
          </div>
        </div>

        {/* Bloco Direito: Cartão Vermelho Retrô com Fita Cassete, Equalizador e Etapa */}
        <div className="flex min-h-[245px] flex-col justify-between rounded-[26px] bg-poster-red p-4 text-poster-cream shadow-poster">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[9px] font-extrabold uppercase tracking-[0.22em] text-poster-cream/90">
              {isRetrying429 ? 'SINAL CONGESTIONADO · RETRY' : `ETAPA 0${stageIndex + 1} DE 05`}
            </span>

            {/* Equalizador gráfico pulsante em SVG/CSS puro */}
            <div
              aria-hidden="true"
              className="flex h-6 items-end gap-1 rounded-full bg-poster-redDark px-2.5 py-1"
            >
              <span
                className={`inline-block h-3.5 w-1 rounded-full bg-poster-cream ${
                  prefersReducedMotion ? '' : 'eq-bar eq-bar-1'
                }`}
              />
              <span
                className={`inline-block h-4 w-1 rounded-full bg-poster-cream ${
                  prefersReducedMotion ? '' : 'eq-bar eq-bar-2'
                }`}
              />
              <span
                className={`inline-block h-3 w-1 rounded-full bg-poster-cream ${
                  prefersReducedMotion ? '' : 'eq-bar eq-bar-3'
                }`}
              />
              <span
                className={`inline-block h-4 w-1 rounded-full bg-poster-cream ${
                  prefersReducedMotion ? '' : 'eq-bar eq-bar-4'
                }`}
              />
              <span
                className={`inline-block h-3.5 w-1 rounded-full bg-poster-cream ${
                  prefersReducedMotion ? '' : 'eq-bar eq-bar-5'
                }`}
              />
            </div>
          </div>

          {/* Fita Cassete Retrô em SVG puro */}
          <div aria-hidden="true" className="my-2 flex items-center gap-3">
            <svg
              viewBox="0 0 140 86"
              className="h-14 w-24 shrink-0 rounded-lg shadow-sm"
            >
              <rect
                x="2"
                y="2"
                width="136"
                height="82"
                rx="10"
                fill="#FDF9F3"
                stroke="#141413"
                strokeWidth="3"
              />
              <rect x="12" y="11" width="116" height="44" rx="5" fill="#B91C1C" />
              <rect
                x="26"
                y="22"
                width="88"
                height="24"
                rx="12"
                fill="#141413"
                stroke="#FDF9F3"
                strokeWidth="2"
              />
              {/* Bobina esquerda */}
              <g className={prefersReducedMotion ? '' : 'cassette-reel-spin'}>
                <circle cx="44" cy="34" r="7.5" fill="#FDF9F3" />
                <circle cx="44" cy="34" r="3" fill="#141413" />
              </g>
              {/* Bobina direita */}
              <g className={prefersReducedMotion ? '' : 'cassette-reel-spin'}>
                <circle cx="96" cy="34" r="7.5" fill="#FDF9F3" />
                <circle cx="96" cy="34" r="3" fill="#141413" />
              </g>
              {/* Base trapezoidal da fita */}
              <path
                d="M28 82 L36 63 H104 L112 82 Z"
                fill="#F4EDE2"
                stroke="#141413"
                strokeWidth="2.5"
              />
            </svg>

            <div className="min-w-0 flex-1">
              <p className="font-display text-sm font-black uppercase leading-snug tracking-wide text-white sm:text-base">
                {activeMessage}
              </p>

              {isRetrying429 && retryCountdownSeconds !== null && retryCountdownSeconds > 0 && (
                <div className="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-poster-cream px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-poster-red">
                  <span>Tentando em {retryCountdownSeconds}s</span>
                </div>
              )}
            </div>
          </div>

          {/* Indicador visual das 5 etapas */}
          <div className="space-y-1.5">
            <div className="grid grid-cols-5 gap-1.5" aria-hidden="true">
              {LOADING_STAGE_MESSAGES.map((_, idx) => {
                const completedOrCurrent = isRetrying429 || idx <= stageIndex;
                return (
                  <div
                    key={idx}
                    className={`h-1.5 rounded-full transition-colors duration-300 ${
                      completedOrCurrent ? 'bg-poster-cream' : 'bg-poster-redDark'
                    }`}
                  />
                );
              })}
            </div>

            <span className="block font-display text-[10px] uppercase tracking-wider text-poster-cream/90">
              {isRetrying429
                ? 'AGUARDANDO JANELA DA BANDA...'
                : 'SINTONIZANDO FREQUÊNCIAS DA FOTO...'}
            </span>
          </div>
        </div>
      </div>

      {/* Faixa xadrez animada (estática se prefers-reduced-motion estiver ativo) */}
      <CheckerDivider animated={!prefersReducedMotion} />
    </section>
  );
};

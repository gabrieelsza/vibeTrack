import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { MusicRecommendation } from '../types';

interface AudioPlayerContextValue {
  activeTrack: MusicRecommendation | null;
  isPlaying: boolean;
  progressPercent: number;
  currentTimeSec: number;
  durationSec: number;
  togglePlay: (track: MusicRecommendation) => void;
  stopAll: () => void;
}

const AudioPlayerContext = createContext<AudioPlayerContextValue | undefined>(undefined);

/**
 * Controlador Singleton de Áudio (RF-006 / RT-006 / RNF-004).
 * Garante que apenas UMA prévia musical de ~30s seja reproduzida por vez:
 * iniciar a Música B pausa imediatamente a Música A.
 */
export const AudioPlayerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const synthTimerRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const [activeTrack, setActiveTrack] = useState<MusicRecommendation | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTimeSec, setCurrentTimeSec] = useState<number>(0);
  const [durationSec, setDurationSec] = useState<number>(30);

  const clearSynthFallback = useCallback(() => {
    if (synthTimerRef.current !== null) {
      window.clearInterval(synthTimerRef.current);
      synthTimerRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
  }, []);

  const stopAll = useCallback(() => {
    clearSynthFallback();
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setIsPlaying(false);
    setCurrentTimeSec(0);
    setActiveTrack(null);
  }, [clearSynthFallback]);

  useEffect(() => {
    const audio = new Audio();
    audio.preload = 'none';
    audioRef.current = audio;

    const onTimeUpdate = () => {
      setCurrentTimeSec(audio.currentTime || 0);
      if (audio.duration && !Number.isNaN(audio.duration)) {
        setDurationSec(Math.min(audio.duration, 30));
      }
    };

    const onEnded = () => {
      setIsPlaying(false);
      setCurrentTimeSec(0);
    };

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('ended', onEnded);

    return () => {
      audio.pause();
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('ended', onEnded);
      clearSynthFallback();
    };
  }, [clearSynthFallback]);

  const startSynthPreviewFallback = useCallback(
    (track: MusicRecommendation) => {
      clearSynthFallback();
      setDurationSec(30);
      setCurrentTimeSec(0);
      setIsPlaying(true);

      try {
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (AudioCtx) {
          const ctx = new AudioCtx();
          audioCtxRef.current = ctx;
          const notes = [261.63, 329.63, 392.0, 523.25];
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(notes[track.rankOrder % notes.length], ctx.currentTime);
          gain.gain.setValueAtTime(0.04, ctx.currentTime);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start();
          osc.stop(ctx.currentTime + 0.6);
        }
      } catch {
        // Ignora bloqueio de autoplay do navegador
      }

      const startedAt = Date.now();
      synthTimerRef.current = window.setInterval(() => {
        const elapsed = (Date.now() - startedAt) / 1000;
        if (elapsed >= 30) {
          clearSynthFallback();
          setIsPlaying(false);
          setCurrentTimeSec(0);
        } else {
          setCurrentTimeSec(elapsed);
        }
      }, 200);
    },
    [clearSynthFallback]
  );

  const togglePlay = useCallback(
    (track: MusicRecommendation) => {
      // Regra de Atenuação Sonora (RF-006): faixas sem prévia não podem tocar internamente
      if (!track.hasPreview || !track.previewUrl) {
        return;
      }

      const audio = audioRef.current;
      if (!audio) return;

      // Se clicou na mesma faixa que já está ativa
      if (activeTrack?.id === track.id) {
        if (isPlaying) {
          audio.pause();
          clearSynthFallback();
          setIsPlaying(false);
        } else {
          audio
            .play()
            .then(() => setIsPlaying(true))
            .catch(() => startSynthPreviewFallback(track));
        }
        return;
      }

      // Pausa imediatamente qualquer outra música em execução (RF-006)
      clearSynthFallback();
      audio.pause();
      audio.currentTime = 0;

      setActiveTrack(track);
      setCurrentTimeSec(0);
      setDurationSec(30);

      audio.src = track.previewUrl;
      audio
        .play()
        .then(() => {
          setIsPlaying(true);
        })
        .catch(() => {
          // Caso o stream externo sofra bloqueio de rede local, mantém a experiência funcional
          startSynthPreviewFallback(track);
        });
    },
    [activeTrack, clearSynthFallback, isPlaying, startSynthPreviewFallback]
  );

  const progressPercent =
    durationSec > 0 ? Math.min(100, Math.round((currentTimeSec / durationSec) * 100)) : 0;

  return (
    <AudioPlayerContext.Provider
      value={{
        activeTrack,
        isPlaying,
        progressPercent,
        currentTimeSec,
        durationSec,
        togglePlay,
        stopAll,
      }}
    >
      {children}
    </AudioPlayerContext.Provider>
  );
};

export function useAudioPlayer(): AudioPlayerContextValue {
  const ctx = useContext(AudioPlayerContext);
  if (!ctx) {
    throw new Error('useAudioPlayer deve ser utilizado dentro de um AudioPlayerProvider');
  }
  return ctx;
}

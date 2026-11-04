import React, { useCallback, useEffect, useState } from 'react';
import { Calendar, ChevronDown, ChevronUp, History, Trash2 } from 'lucide-react';
import { CheckerDivider } from '../components/Poster/CheckerDivider';
import { PolaroidPhoto } from '../components/Poster/PolaroidPhoto';
import { TitleHero } from '../components/Poster/TitleHero';
import { TopTrackCard } from '../components/Poster/TopTrackCard';
import { TrackListItem } from '../components/Poster/TrackListItem';
import { ShareCardModal } from '../components/Share/ShareCardModal';
import { useAudioPlayer } from '../contexts/AudioPlayerContext';
import { useAuth } from '../contexts/AuthContext';
import { useNetwork } from '../contexts/NetworkContext';
import { apiService } from '../services/api.service';
import { offlineCacheService } from '../services/offline-cache.service';
import { MusicRecommendation, PhotoAnalysis } from '../types';
import { formatPolaroidCaption } from '../utils/poster.utils';

export const HistoryPage: React.FC = () => {
  const { user } = useAuth();
  const { isOnline } = useNetwork();
  const { stopAll } = useAudioPlayer();

  const [analyses, setAnalyses] = useState<PhotoAnalysis[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [shareModalData, setShareModalData] = useState<{
    analysis: PhotoAnalysis;
    track: MusicRecommendation;
  } | null>(null);

  const loadHistory = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const cached = offlineCacheService.loadAnalyses(user.id);
    if (cached.length > 0) {
      setAnalyses(cached);
      setExpandedId((prev) => prev || cached[0].id);
    }

    if (!isOnline) {
      setLoading(false);
      return;
    }

    try {
      const res = await apiService.listAnalyses();
      setAnalyses(res.analyses);
      offlineCacheService.saveAnalyses(user.id, res.analyses);
      if (res.analyses.length > 0) {
        setExpandedId((prev) => prev || res.analyses[0].id);
      }
    } catch {
      // Mantém dados do cache offline caso ocorra oscilação
    } finally {
      setLoading(false);
    }
  }, [isOnline, user]);

  useEffect(() => {
    loadHistory();
    return () => stopAll();
  }, [loadHistory, stopAll]);

  const handleConfirmDelete = async (analysisId: string) => {
    if (!user) return;
    setDeletingId(analysisId);
    stopAll();

    try {
      if (isOnline) {
        await apiService.deleteAnalysis(analysisId);
      }
      const updated = offlineCacheService.removeAnalysis(user.id, analysisId);
      setAnalyses(updated);
      setConfirmDeleteId(null);
    } catch {
      // Ignora erro
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-5">
      <TitleHero
        line1="MEU"
        line2="ACERVO"
        subtitle={`Você possui ${analyses.length} ${
          analyses.length === 1 ? 'edição salva' : 'edições salvas'
        } (sincronizadas inclusive para consulta offline).`}
      />

      {loading && analyses.length === 0 ? (
        <div className="space-y-4 py-6">
          <CheckerDivider animated />
          <p className="text-center font-display text-xs uppercase tracking-wider text-poster-red">
            CARREGANDO ACERVO DE EDIÇÕES...
          </p>
        </div>
      ) : analyses.length === 0 ? (
        <div className="rounded-[26px] border-2 border-poster-border bg-poster-paper p-8 text-center">
          <History className="mx-auto mb-3 h-8 w-8 text-poster-red" />
          <h3 className="font-display text-sm uppercase tracking-wide text-poster-ink">
            NENHUMA FOTO REVELADA AINDA
          </h3>
          <p className="mt-1 text-xs text-poster-muted">
            Volte ao pôster principal e envie sua primeira foto para guardar suas trilhas aqui.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {analyses.map((item, index) => {
            const isExpanded = expandedId === item.id;
            const topTrack = item.recommendations[0];
            const otherTracks = item.recommendations.slice(1);
            const formattedDate = new Date(item.createdAt).toLocaleString('pt-BR', {
              day: '2-digit',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit',
            });

            return (
              <article
                key={item.id}
                className="overflow-hidden rounded-[26px] border-2 border-poster-ink bg-poster-paper p-4 shadow-polaroid"
              >
                {/* Cabeçalho da Edição no Acervo */}
                <div className="flex items-center justify-between gap-2 border-b border-poster-border pb-3">
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-poster-red px-2.5 py-0.5 font-display text-[10px] uppercase text-poster-cream">
                      ED. #{analyses.length - index}
                    </span>
                    <span className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-poster-muted">
                      <Calendar className="h-3 w-3 text-poster-red" />
                      {formattedDate}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {confirmDeleteId === item.id ? (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          disabled={deletingId === item.id}
                          onClick={() => handleConfirmDelete(item.id)}
                          className="min-h-[36px] rounded-full bg-poster-red px-3 py-1 font-display text-[10px] uppercase text-poster-cream"
                        >
                          {deletingId === item.id ? '...' : 'Confirmar'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(null)}
                          className="min-h-[36px] rounded-full border border-poster-ink bg-poster-cream px-2.5 py-1 text-[10px] font-bold uppercase text-poster-ink"
                        >
                          Não
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(item.id)}
                        aria-label="Excluir esta análise do histórico"
                        className="flex h-10 w-10 items-center justify-center rounded-full border border-poster-border bg-poster-cream text-poster-ink transition hover:border-poster-red hover:text-poster-red"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => setExpandedId(isExpanded ? null : item.id)}
                      aria-expanded={isExpanded}
                      className="inline-flex min-h-[40px] items-center gap-1 rounded-full border border-poster-ink bg-poster-cream px-3 py-1.5 font-display text-[10px] uppercase tracking-wider text-poster-ink transition hover:border-poster-red hover:text-poster-red"
                    >
                      <span>{isExpanded ? 'Fechar' : 'Abrir Pôster'}</span>
                      {isExpanded ? (
                        <ChevronUp className="h-3.5 w-3.5" />
                      ) : (
                        <ChevronDown className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Resumo compacto quando recolhido */}
                {!isExpanded && (
                  <div
                    onClick={() => setExpandedId(item.id)}
                    className="mt-3 flex cursor-pointer items-center gap-3.5"
                  >
                    <img
                      src={item.imageThumbnail}
                      alt="Miniatura da foto"
                      className="h-16 w-16 shrink-0 -rotate-2 rounded border-4 border-white object-cover shadow-sm"
                    />
                    <div className="min-w-0 flex-1">
                      {topTrack && (
                        <p className="truncate font-display text-sm uppercase text-poster-red">
                          ★ {topTrack.title} — {topTrack.artist}
                        </p>
                      )}
                      <p className="mt-0.5 line-clamp-2 text-xs text-poster-ink">
                        {item.vibeSummary}
                      </p>
                    </div>
                  </div>
                )}

                {/* Pôster Completo quando expandido */}
                {isExpanded && topTrack && (
                  <div className="mt-4 space-y-4">
                    <div className="grid grid-cols-[46%_1fr] items-stretch gap-3">
                      <div className="flex flex-col justify-center">
                        <PolaroidPhoto
                          imageSrc={item.imageThumbnail}
                          caption={formatPolaroidCaption(item.preferences)}
                        />
                      </div>
                      <TopTrackCard
                        track={topTrack}
                        onShareTrack={(t) => setShareModalData({ analysis: item, track: t })}
                      />
                    </div>

                    <p className="rounded-xl border border-poster-border bg-poster-cream p-3 text-xs leading-relaxed text-poster-ink">
                      <strong className="font-display uppercase text-poster-red">Vibe: </strong>
                      {item.vibeSummary}
                    </p>

                    {otherTracks.length > 0 && (
                      <>
                        <CheckerDivider />
                        <div>
                          <h4 className="mb-1 text-[10px] font-extrabold uppercase tracking-[0.22em] text-poster-ink">
                            TAMBÉM COMBINA
                          </h4>
                          <div className="divide-y divide-poster-border">
                            {otherTracks.map((track) => (
                              <TrackListItem
                                key={track.id}
                                track={track}
                                onShareTrack={(t) =>
                                  setShareModalData({ analysis: item, track: t })
                                }
                              />
                            ))}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      {shareModalData && (
        <ShareCardModal
          analysis={shareModalData.analysis}
          track={shareModalData.track}
          onClose={() => setShareModalData(null)}
        />
      )}
    </div>
  );
};

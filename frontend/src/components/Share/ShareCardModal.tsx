import React, { useEffect, useRef, useState } from 'react';
import { Download, Share2, X } from 'lucide-react';
import { MusicRecommendation, PhotoAnalysis } from '../../types';
import { formatPolaroidCaption, getTrackInitials } from '../../utils/poster.utils';
import { CheckerDivider } from '../Poster/CheckerDivider';

interface ShareCardModalProps {
  analysis: PhotoAnalysis;
  track: MusicRecommendation;
  onClose: () => void;
}

function wrapCanvasText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines: number
): number {
  const words = text.split(' ');
  let line = '';
  let currentY = y;
  let linesCount = 0;

  for (let n = 0; n < words.length; n++) {
    const testLine = line + words[n] + ' ';
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && n > 0) {
      linesCount++;
      if (linesCount >= maxLines) {
        ctx.fillText(line.trim() + '...', x, currentY);
        return currentY + lineHeight;
      }
      ctx.fillText(line.trim(), x, currentY);
      line = words[n] + ' ';
      currentY += lineHeight;
    } else {
      line = testLine;
    }
  }

  if (line.trim()) {
    ctx.fillText(line.trim(), x, currentY);
    currentY += lineHeight;
  }
  return currentY;
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawCheckerStrip(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  squareSize: number
) {
  const cols = Math.ceil(width / squareSize);
  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < cols; col++) {
      ctx.fillStyle = (row + col) % 2 === 0 ? '#B91C1C' : '#FDF9F3';
      const drawW = Math.min(squareSize, width - col * squareSize);
      if (drawW > 0) {
        ctx.fillRect(x + col * squareSize, y + row * squareSize, drawW, squareSize);
      }
    }
  }
}

/**
 * Modal de Geração Nativa do Card Pôster Retrô via HTML5 Canvas API (RF-009 / RT-009).
 */
export const ShareCardModal: React.FC<ShareCardModalProps> = ({ analysis, track, onClose }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [rendering, setRendering] = useState(true);
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function renderCard() {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const W = 1080;
      const H = 1350;
      canvas.width = W;
      canvas.height = H;

      // 1. Fundo Creme Pôster (#FDF9F3)
      ctx.fillStyle = '#FDF9F3';
      ctx.fillRect(0, 0, W, H);

      // 2. Faixa xadrez no topo
      drawCheckerStrip(ctx, 72, 54, W - 144, 16);

      // 3. Cabeçalho VIBETRACK + Nº 01 · EDIÇÃO FOTO
      ctx.fillStyle = '#B91C1C';
      ctx.font = '900 42px "Archivo Black", "Rubik", sans-serif';
      ctx.fillText('VIBETRACK', 72, 142);

      ctx.fillStyle = '#141413';
      ctx.font = 'bold 20px "Rubik", sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText('Nº 01 · EDIÇÃO FOTO', W - 72, 136);
      ctx.textAlign = 'left';

      // 4. Título Gigante: QUAL É / A FOTO?
      ctx.fillStyle = '#B91C1C';
      ctx.font = '900 112px "Archivo Black", "Rubik", sans-serif';
      ctx.fillText('QUAL É', 72, 275);
      ctx.fillText('A FOTO?', 72, 385);

      // 5. Bloco Esquerdo: Polaroid inclinada (-3deg)
      ctx.save();
      ctx.translate(275, 675);
      ctx.rotate((-3 * Math.PI) / 180);

      ctx.shadowColor = 'rgba(20, 20, 19, 0.18)';
      ctx.shadowBlur = 28;
      ctx.shadowOffsetY = 12;
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(-195, -230, 390, 470);
      ctx.shadowColor = 'transparent';

      ctx.strokeStyle = '#E5DEC9';
      ctx.lineWidth = 2;
      ctx.strokeRect(-195, -230, 390, 470);

      try {
        const userImg = await new Promise<HTMLImageElement>((resolve, reject) => {
          const im = new Image();
          im.onload = () => resolve(im);
          im.onerror = reject;
          im.src = analysis.imageThumbnail;
        });

        ctx.save();
        ctx.beginPath();
        ctx.rect(-172, -206, 344, 356);
        ctx.clip();

        const imgRatio = userImg.width / userImg.height;
        const boxW = 344;
        const boxH = 356;
        const boxRatio = boxW / boxH;
        let drawW = boxW;
        let drawH = boxH;
        let offsetX = -172;
        let offsetY = -206;

        if (imgRatio > boxRatio) {
          drawW = boxH * imgRatio;
          offsetX = -172 - (drawW - boxW) / 2;
        } else {
          drawH = boxW / imgRatio;
          offsetY = -206 - (drawH - boxH) / 2;
        }
        ctx.drawImage(userImg, offsetX, offsetY, drawW, drawH);
        ctx.restore();
      } catch {
        ctx.fillStyle = '#F4EDE2';
        ctx.fillRect(-172, -206, 344, 356);
      }

      const caption = formatPolaroidCaption(analysis.preferences).slice(0, 26);
      ctx.fillStyle = '#141413';
      ctx.font = 'bold 20px "Rubik", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(caption, 0, 198);
      ctx.textAlign = 'left';
      ctx.restore();

      // 6. Bloco Direito: Cartão Vermelho MÚSICA IDEAL
      const cardX = 505;
      const cardY = 440;
      const cardW = 503;
      const cardH = 470;

      ctx.fillStyle = '#B91C1C';
      drawRoundedRect(ctx, cardX, cardY, cardW, cardH, 48);
      ctx.fill();

      ctx.fillStyle = '#FDF9F3';
      ctx.font = 'bold 20px "Rubik", sans-serif';
      ctx.fillText('MÚSICA IDEAL', cardX + 42, cardY + 58);

      // Ícone quadrado branco com sigla e base xadrez
      const iconX = cardX + 42;
      const iconY = cardY + 84;
      const iconSize = 112;
      ctx.save();
      drawRoundedRect(ctx, iconX, iconY, iconSize, iconSize, 22);
      ctx.clip();
      ctx.fillStyle = '#FDF9F3';
      ctx.fillRect(iconX, iconY, iconSize, iconSize);
      drawCheckerStrip(ctx, iconX, iconY + iconSize - 24, iconSize, 12);
      ctx.fillStyle = '#B91C1C';
      ctx.font = '900 42px "Archivo Black", "Rubik", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(getTrackInitials(track.title), iconX + iconSize / 2, iconY + 58);
      ctx.textAlign = 'left';
      ctx.restore();

      // Nome da música e artista
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '900 38px "Archivo Black", "Rubik", sans-serif';
      const titleText =
        track.title.length > 20 ? track.title.slice(0, 19).toUpperCase() + '…' : track.title.toUpperCase();
      ctx.fillText(titleText, cardX + 42, cardY + 258);

      ctx.fillStyle = '#FDF9F3';
      ctx.font = '500 28px "Rubik", sans-serif';
      ctx.fillText(track.artist.slice(0, 28), cardX + 42, cardY + 302);

      // Botão Play decorativo + PREVIEW 30S
      ctx.fillStyle = '#FDF9F3';
      ctx.beginPath();
      ctx.arc(cardX + 82, cardY + 392, 40, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#B91C1C';
      ctx.beginPath();
      ctx.moveTo(cardX + 74, cardY + 376);
      ctx.lineTo(cardX + 98, cardY + 392);
      ctx.lineTo(cardX + 74, cardY + 408);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#FFFFFF';
      ctx.font = '900 22px "Archivo Black", "Rubik", sans-serif';
      ctx.fillText('PREVIEW 30S', cardX + 142, cardY + 400);

      // 7. Divisor xadrez
      drawCheckerStrip(ctx, 72, 965, W - 144, 16);

      // 8. Justificativa da IA e Vibe
      ctx.fillStyle = '#141413';
      ctx.font = 'bold 22px "Rubik", sans-serif';
      ctx.fillText('LEITURA DA VIBE & CURADORIA:', 72, 1045);

      ctx.fillStyle = '#57534E';
      ctx.font = '500 26px "Rubik", sans-serif';
      wrapCanvasText(ctx, `"${track.reason}"`, 72, 1092, W - 144, 38, 3);

      // 9. Rodapé Pílula Vermelha
      ctx.fillStyle = '#B91C1C';
      drawRoundedRect(ctx, 72, 1225, W - 144, 76, 38);
      ctx.fill();

      ctx.fillStyle = '#FDF9F3';
      ctx.font = '900 24px "Archivo Black", "Rubik", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('VIBETRACK · SUA FOTO EM MÚSICA', W / 2, 1272);
      ctx.textAlign = 'left';

      if (!cancelled) {
        setRendering(false);
      }
    }

    renderCard();
    return () => {
      cancelled = true;
    };
  }, [analysis, track]);

  const handleDownloadPng = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    const safeTitle = track.title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    link.download = `vibetrack-poster-${safeTitle}.png`;
    link.href = dataUrl;
    link.click();
    setShareFeedback('Pôster salvo em PNG no seu aparelho!');
  };

  const handleNativeShare = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.toBlob(async (blob) => {
      if (!blob) return;
      const file = new File([blob], 'vibetrack-poster.png', { type: 'image/png' });

      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({
            title: `VibeTrack: ${track.title} - ${track.artist}`,
            text: `Pôster VibeTrack da minha foto: ${track.title} (${track.artist})`,
            files: [file],
          });
          setShareFeedback('Pôster compartilhado com sucesso!');
          return;
        } catch {
          // Fallback para download
        }
      }

      handleDownloadPng();
    }, 'image/png');
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Card compartilhável da música ${track.title}`}
      className="fixed inset-0 z-50 flex items-center justify-center bg-poster-ink/75 p-4"
    >
      <div className="relative flex max-h-[92vh] w-full max-w-[400px] flex-col overflow-hidden rounded-[26px] border-2 border-poster-ink bg-poster-cream shadow-polaroid">
        <CheckerDivider />

        {/* Cabeçalho do Modal */}
        <div className="flex items-center justify-between border-b border-poster-border px-4 py-3">
          <div>
            <span className="block text-[9px] font-extrabold uppercase tracking-[0.2em] text-poster-red">
              EDIÇÃO PÔSTER · COMPARTILHAR
            </span>
            <h3 className="truncate font-display text-sm uppercase text-poster-ink">
              {track.title}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar modal de compartilhamento"
            className="flex h-11 w-11 items-center justify-center rounded-full border border-poster-border bg-poster-paper text-poster-ink transition hover:border-poster-red hover:text-poster-red"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Preview do Canvas */}
        <div className="flex-1 overflow-y-auto p-4 text-center">
          <div className="mx-auto max-w-[280px] overflow-hidden rounded-xl border-2 border-poster-ink shadow-polaroid">
            <canvas ref={canvasRef} className="h-auto w-full bg-poster-cream" />
          </div>
          {rendering && (
            <p className="mt-2 text-xs font-bold uppercase tracking-wider text-poster-muted">
              Imprimindo pôster em alta resolução...
            </p>
          )}
          {shareFeedback && (
            <p className="mt-3 rounded-full border border-poster-red bg-poster-redLight px-3 py-1.5 text-xs font-bold text-poster-red">
              {shareFeedback}
            </p>
          )}
        </div>

        {/* Rodapé de Ações */}
        <div className="grid grid-cols-2 gap-2 border-t border-poster-border bg-poster-paper p-3.5">
          <button
            type="button"
            onClick={handleDownloadPng}
            className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-full border-2 border-poster-ink bg-poster-cream px-3 py-2 font-display text-[11px] uppercase tracking-wider text-poster-ink transition hover:border-poster-red hover:text-poster-red"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Baixar PNG</span>
          </button>
          <button
            type="button"
            onClick={handleNativeShare}
            className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-full bg-poster-red px-3 py-2 font-display text-[11px] uppercase tracking-wider text-poster-cream shadow-poster transition hover:bg-poster-redDark"
          >
            <Share2 className="h-3.5 w-3.5" />
            <span>Compartilhar</span>
          </button>
        </div>
      </div>
    </div>
  );
};

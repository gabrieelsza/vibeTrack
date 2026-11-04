import React from 'react';
import { Camera } from 'lucide-react';

interface PolaroidPhotoProps {
  imageSrc?: string | null;
  caption?: string;
  alt?: string;
  onClick?: () => void;
  actionLabel?: string;
}

export const PolaroidPhoto: React.FC<PolaroidPhotoProps> = ({
  imageSrc,
  caption = 'SEM DICA',
  alt = 'Fotografia em moldura Polaroid',
  onClick,
  actionLabel,
}) => {
  const content = (
    <div className="mx-auto w-full max-w-[195px] -rotate-3 rounded-[4px] border border-poster-border/80 bg-white p-2.5 pb-5 shadow-polaroid transition-transform duration-200 hover:-rotate-1">
      <div className="relative aspect-[1/1.06] w-full overflow-hidden bg-poster-paper">
        {imageSrc ? (
          <img src={imageSrc} alt={alt} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-3 text-center text-poster-red">
            <Camera className="h-8 w-8 stroke-[2.2]" />
            <span className="font-display text-[11px] uppercase leading-tight tracking-wide">
              TOQUE PARA ESCOLHER FOTO
            </span>
          </div>
        )}
        {actionLabel && (
          <span className="absolute bottom-1.5 right-1.5 rounded bg-poster-ink/80 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-poster-cream">
            {actionLabel}
          </span>
        )}
      </div>

      <p
        title={caption}
        className="mt-3 truncate px-1 text-center font-sans text-[9px] font-extrabold uppercase tracking-[0.2em] text-poster-ink"
      >
        {caption || 'SEM DICA'}
      </p>
    </div>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={actionLabel || 'Selecionar ou alterar fotografia'}
        className="block w-full text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-poster-red"
      >
        {content}
      </button>
    );
  }

  return content;
};

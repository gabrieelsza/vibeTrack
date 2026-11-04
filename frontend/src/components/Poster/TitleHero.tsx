import React from 'react';

interface TitleHeroProps {
  line1?: string;
  line2?: string;
  subtitle?: string;
  className?: string;
}

export const TitleHero: React.FC<TitleHeroProps> = ({
  line1 = 'QUAL É',
  line2 = 'A FOTO?',
  subtitle,
  className = '',
}) => {
  return (
    <div className={`my-4 ${className}`.trim()}>
      <h1 className="font-display text-[3.25rem] font-black uppercase leading-[0.9] tracking-[-0.03em] text-poster-red sm:text-[3.65rem]">
        <span className="block">{line1}</span>
        <span className="block">{line2}</span>
      </h1>
      {subtitle && (
        <p className="mt-2 text-xs font-medium leading-relaxed text-poster-muted">{subtitle}</p>
      )}
    </div>
  );
};

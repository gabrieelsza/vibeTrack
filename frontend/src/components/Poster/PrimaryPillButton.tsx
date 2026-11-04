import React from 'react';

interface PrimaryPillButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: React.ReactNode;
  variant?: 'primary' | 'outline';
  children: React.ReactNode;
}

export const PrimaryPillButton: React.FC<PrimaryPillButtonProps> = ({
  icon,
  variant = 'primary',
  children,
  className = '',
  type = 'button',
  ...rest
}) => {
  const baseClasses =
    'flex min-h-[52px] w-full items-center justify-center gap-2.5 rounded-full px-6 py-3.5 font-display text-sm uppercase tracking-[0.08em] transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-poster-red disabled:cursor-not-allowed disabled:opacity-50';

  const variantClasses =
    variant === 'primary'
      ? 'bg-poster-red text-poster-cream shadow-poster hover:bg-poster-redDark active:scale-[0.99]'
      : 'border-2 border-poster-red bg-poster-cream text-poster-red hover:bg-poster-redLight/60 active:scale-[0.99]';

  return (
    <button type={type} className={`${baseClasses} ${variantClasses} ${className}`.trim()} {...rest}>
      {icon && <span className="shrink-0">{icon}</span>}
      <span>{children}</span>
    </button>
  );
};

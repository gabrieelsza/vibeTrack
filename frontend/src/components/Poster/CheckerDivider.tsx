import React from 'react';

interface CheckerDividerProps {
  animated?: boolean;
  className?: string;
}

export const CheckerDivider: React.FC<CheckerDividerProps> = ({
  animated = false,
  className = '',
}) => {
  return (
    <div
      aria-hidden="true"
      className={`${animated ? 'checker-strip-animated' : 'checker-strip'} ${className}`.trim()}
    />
  );
};

import React from 'react';

export type LabelVariant = 'parenthesised' | 'uppercase' | 'brass';

interface LabelProps {
  children: React.ReactNode;
  variant?: LabelVariant;
  className?: string;
  as?: 'span' | 'p' | 'div';
}

export const Label: React.FC<LabelProps> = ({
  children,
  variant = 'uppercase',
  className = '',
  as: Component = 'span',
}) => {
  let styleClasses = '';
  switch (variant) {
    case 'parenthesised':
      styleClasses = 'font-serif italic text-muted text-ui tracking-normal';
      break;
    case 'uppercase':
      styleClasses = 'font-sans text-[11px] uppercase tracking-label text-muted font-normal';
      break;
    case 'brass':
      styleClasses = 'font-sans text-[11px] uppercase tracking-label text-brass-text font-medium';
      break;
  }

  return <Component className={`${styleClasses} ${className}`}>{children}</Component>;
};


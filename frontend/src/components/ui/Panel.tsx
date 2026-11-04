import React from 'react';

interface PanelProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'surface' | 'raised' | 'moss';
  padded?: boolean;
  children: React.ReactNode;
}

export const Panel: React.FC<PanelProps> = ({
  variant = 'surface',
  padded = true,
  children,
  className = '',
  ...props
}) => {
  let variantClasses = '';
  switch (variant) {
    case 'surface':
      variantClasses = 'bg-surface text-ink border border-hairline';
      break;
    case 'raised':
      variantClasses = 'bg-raised text-ink border border-hairline';
      break;
    case 'moss':
      variantClasses = 'bg-moss text-moss-text border border-hairline/20';
      break;
  }

  const paddingClass = padded ? 'p-6 md:p-8' : '';

  return (
    <div
      className={`rounded-control ${variantClasses} ${paddingClass} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};


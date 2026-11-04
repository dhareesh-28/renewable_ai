import React from 'react';

interface DisplayNumberProps {
  value: React.ReactNode;
  unit?: string;
  captionLine1: string;
  captionLine2?: string;
  align?: 'left' | 'center' | 'right';
  size?: 'xl' | 'lg' | 'md';
  className?: string;
}

export const DisplayNumber: React.FC<DisplayNumberProps> = ({
  value,
  unit,
  captionLine1,
  captionLine2,
  align = 'left',
  size = 'xl',
  className = '',
}) => {
  const alignClasses =
    align === 'center' ? 'items-center text-center' : align === 'right' ? 'items-end text-right' : 'items-start text-left';

  let valueSizeClass = 'text-[72px] md:text-[88px] leading-[0.95]';
  if (size === 'lg') {
    valueSizeClass = 'text-[56px] md:text-[68px] leading-[0.95]';
  } else if (size === 'md') {
    valueSizeClass = 'text-[40px] md:text-[48px] leading-[1.0]';
  }

  return (
    <div className={`inline-flex flex-col ${alignClasses} ${className}`}>
      <div className="flex items-baseline gap-1.5 font-serif font-light text-ink tracking-tight">
        <span className={`${valueSizeClass} tabular-nums select-all font-light`}>
          {value}
        </span>
        {unit && (
          <span className="font-serif italic text-lg md:text-xl text-muted font-normal">
            {unit}
          </span>
        )}
      </div>
      <div className="mt-2 text-caption text-muted font-sans leading-tight">
        <div>{captionLine1}</div>
        {captionLine2 && <div>{captionLine2}</div>}
      </div>
    </div>
  );
};


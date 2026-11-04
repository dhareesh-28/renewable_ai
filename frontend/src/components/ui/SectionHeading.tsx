import React from 'react';
import { Label } from './Label';

interface SectionHeadingProps {
  eyebrow?: string;
  eyebrowVariant?: 'parenthesised' | 'uppercase' | 'brass';
  title: string;
  subtitle?: string;
  align?: 'left' | 'center';
  className?: string;
}

export const SectionHeading: React.FC<SectionHeadingProps> = ({
  eyebrow,
  eyebrowVariant = 'parenthesised',
  title,
  subtitle,
  align = 'left',
  className = '',
}) => {
  const isCenter = align === 'center';

  return (
    <div className={`flex flex-col gap-3 ${isCenter ? 'items-center text-center' : 'items-start text-left'} ${className}`}>
      {eyebrow && <Label variant={eyebrowVariant}>{eyebrow}</Label>}
      <h2 className="text-h2 font-serif text-ink tracking-tight font-light leading-[1.1]">
        {title}
      </h2>
      {subtitle && (
        <p className="text-muted text-body max-w-2xl font-normal leading-relaxed mt-1">
          {subtitle}
        </p>
      )}
    </div>
  );
};


import React, { forwardRef } from 'react';

export type BadgeVariant =
  | 'solar'
  | 'battery'
  | 'grid'
  | 'load'
  | 'fault'
  | 'neutral'
  | 'brass';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ children, variant = 'neutral', className = '', ...props }, ref) => {
    let styleClasses = '';
    switch (variant) {
      case 'solar':
        styleClasses = 'bg-[#D9941E]/10 text-[#A66E11] border-[#D9941E]/30';
        break;
      case 'battery':
        styleClasses = 'bg-[#3F8F6B]/10 text-[#2C6A4F] border-[#3F8F6B]/30';
        break;
      case 'grid':
        styleClasses = 'bg-[#5F7A8C]/10 text-[#435968] border-[#5F7A8C]/30';
        break;
      case 'load':
        styleClasses = 'bg-[#8A8578]/10 text-[#615D53] border-[#8A8578]/30';
        break;
      case 'fault':
        styleClasses = 'bg-[#C4513F]/10 text-[#A53A2A] border-[#C4513F]/30';
        break;
      case 'brass':
        styleClasses = 'bg-[#B08D57]/10 text-[#8A6A38] border-[#B08D57]/30';
        break;
      case 'neutral':
      default:
        styleClasses = 'bg-surface text-muted border-hairline';
        break;
    }

    return (
      <span
        ref={ref}
        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-sans font-medium tracking-tight border ${styleClasses} ${className}`}
        {...props}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-current shrink-0" />
        <span>{children}</span>
      </span>
    );
  }
);

Badge.displayName = 'Badge';

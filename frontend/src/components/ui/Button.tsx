import React, { forwardRef } from 'react';
import { ArrowUpRight } from 'lucide-react';

export type ButtonVariant = 'primary' | 'light' | 'outline' | 'text';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  showArrow?: boolean;
  children: React.ReactNode;
}

export const PillButton = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      showArrow = true,
      children,
      className = '',
      disabled,
      ...props
    },
    ref
  ) => {
    const baseClasses =
      'group inline-flex items-center justify-center gap-2 rounded-full px-6 py-2.5 text-ui tracking-tight transition-all duration-200 select-none cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed';

    let variantClasses = '';
    switch (variant) {
      case 'primary':
        variantClasses =
          'bg-ink text-bg hover:bg-[#2C3330] active:scale-[0.98] border border-transparent';
        break;
      case 'light':
        variantClasses =
          'bg-raised text-ink hover:bg-surface active:scale-[0.98] border border-hairline/60 shadow-sm';
        break;
      case 'outline':
        variantClasses =
          'bg-transparent text-ink border border-hairline hover:border-ink hover:bg-surface/50 active:scale-[0.98]';
        break;
      case 'text':
        variantClasses =
          'relative bg-transparent text-ink px-1 py-1 rounded-none hover:text-ink/80 after:content-[""] after:absolute after:bottom-0 after:left-0 after:w-full after:h-[1px] after:bg-ink after:scale-x-0 after:origin-right hover:after:scale-x-100 hover:after:origin-left after:transition-transform after:duration-300';
        break;
    }

    return (
      <button
        ref={ref}
        className={`${baseClasses} ${variantClasses} ${className}`}
        disabled={disabled}
        {...props}
      >
        <span>{children}</span>
        {showArrow && variant !== 'text' && (
          <ArrowUpRight
            size={14}
            className="transition-transform duration-200 group-hover:translate-x-1 group-hover:-translate-y-1 shrink-0"
          />
        )}
      </button>
    );
  }
);

PillButton.displayName = 'PillButton';

export const TextLink = forwardRef<
  HTMLAnchorElement,
  React.AnchorHTMLAttributes<HTMLAnchorElement> & { children: React.ReactNode; showArrow?: boolean }
>(({ children, showArrow = true, className = '', ...props }, ref) => {
  return (
    <a
      ref={ref}
      className={`group relative inline-flex items-center gap-1.5 text-ui text-ink cursor-pointer pb-0.5 after:content-[""] after:absolute after:bottom-0 after:left-0 after:w-full after:h-[1px] after:bg-ink after:scale-x-100 after:transition-transform after:duration-200 hover:after:scale-x-0 ${className}`}
      {...props}
    >
      <span>{children}</span>
      {showArrow && (
        <ArrowUpRight
          size={13}
          className="transition-transform duration-200 group-hover:translate-x-1 group-hover:-translate-y-1"
        />
      )}
    </a>
  );
});

TextLink.displayName = 'TextLink';

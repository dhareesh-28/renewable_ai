import React from 'react';
import { motion } from 'framer-motion';

export interface ToggleItem<T extends string> {
  value: T;
  label: string;
}

interface TextToggleProps<T extends string> {
  items: ToggleItem<T>[];
  value: T;
  onChange: (value: T) => void;
  layoutId?: string;
  separator?: string;
  className?: string;
  size?: 'sm' | 'md';
}

export function TextToggle<T extends string>({
  items,
  value,
  onChange,
  layoutId = 'activeTextUnderline',
  separator = '·',
  className = '',
  size = 'md',
}: TextToggleProps<T>) {
  const sizeClasses = size === 'sm' ? 'text-[11px] py-1' : 'text-ui py-1.5';

  return (
    <div className={`inline-flex items-center gap-2 select-none ${className}`}>
      {items.map((item, index) => {
        const isActive = item.value === value;
        return (
          <React.Fragment key={item.value}>
            <button
              type="button"
              onClick={() => onChange(item.value)}
              className={`relative cursor-pointer transition-colors duration-200 ${sizeClasses} ${
                isActive ? 'text-ink font-medium' : 'text-muted hover:text-ink font-normal'
              }`}
            >
              <span>{item.label}</span>
              {isActive && (
                <motion.div
                  layoutId={layoutId}
                  className="absolute bottom-0 left-0 right-0 h-[1.5px] bg-ink"
                  transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                />
              )}
            </button>
            {index < items.length - 1 && (
              <span className="text-muted/60 text-caption select-none">{separator}</span>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}


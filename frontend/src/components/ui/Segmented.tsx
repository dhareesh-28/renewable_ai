import { motion } from 'framer-motion';

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
}

interface SegmentedProps<T extends string> {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  layoutId?: string;
  className?: string;
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  layoutId = 'segmentedPillIndicator',
  className = '',
}: SegmentedProps<T>) {
  return (
    <div
      className={`inline-flex items-center p-1 bg-surface border border-hairline rounded-full select-none ${className}`}
      role="radiogroup"
    >
      {options.map((opt) => {
        const isActive = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={isActive}
            onClick={() => onChange(opt.value)}
            className={`relative px-4 py-1.5 text-ui rounded-full transition-colors cursor-pointer focus:outline-none ${
              isActive ? 'text-ink font-medium' : 'text-muted hover:text-ink'
            }`}
          >
            {isActive && (
              <motion.div
                layoutId={layoutId}
                className="absolute inset-0 bg-raised border border-hairline/80 rounded-full shadow-sm -z-0"
                transition={{ type: 'spring', stiffness: 500, damping: 35 }}
              />
            )}
            <span className="relative z-10">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}

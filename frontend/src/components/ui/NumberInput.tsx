import React from 'react';

interface NumberInputProps {
  label?: string;
  value: number;
  onChange: (val: number) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  className?: string;
}

export const NumberInput: React.FC<NumberInputProps> = ({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  unit,
  className = '',
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    if (!isNaN(val)) {
      if (min !== undefined && val < min) return;
      if (max !== undefined && val > max) return;
      onChange(val);
    }
  };

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {label && (
        <label className="text-[11px] uppercase tracking-label text-muted font-normal select-none">
          {label}
        </label>
      )}
      <div className="relative inline-flex items-center">
        <input
          type="number"
          value={value}
          onChange={handleChange}
          min={min}
          max={max}
          step={step}
          className="w-full px-3.5 py-2 text-ui text-ink bg-raised border border-hairline rounded-control tabular-nums focus:outline-none focus:border-ink transition-colors pr-10"
        />
        {unit && (
          <span className="absolute right-3 text-caption text-muted font-sans pointer-events-none select-none">
            {unit}
          </span>
        )}
      </div>
    </div>
  );
};


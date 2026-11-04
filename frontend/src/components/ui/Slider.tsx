import React from 'react';
import * as RadixSlider from '@radix-ui/react-slider';

interface SliderProps {
  label: string;
  value: number;
  onValueChange: (val: number) => void;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  className?: string;
}

export const Slider: React.FC<SliderProps> = ({
  label,
  value,
  onValueChange,
  min,
  max,
  step = 0.5,
  unit = '',
  className = '',
}) => {
  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <div className="flex items-center justify-between text-ui">
        <span className="text-[11px] uppercase tracking-label text-muted font-normal select-none">
          {label}
        </span>
        <span className="font-sans text-ui text-ink tabular-nums font-medium">
          {value.toFixed(1)} {unit && <span className="text-muted text-caption font-normal">{unit}</span>}
        </span>
      </div>

      <RadixSlider.Root
        className="relative flex items-center select-none touch-none w-full h-5 cursor-pointer"
        value={[value]}
        onValueChange={(vals) => onValueChange(vals[0] ?? value)}
        min={min}
        max={max}
        step={step}
      >
        <RadixSlider.Track className="relative bg-hairline grow rounded-full h-[2px]">
          <RadixSlider.Range className="absolute bg-ink rounded-full h-full" />
        </RadixSlider.Track>
        <RadixSlider.Thumb
          className="block w-4 h-4 bg-raised border border-ink rounded-full shadow-sm hover:scale-110 focus:outline-none focus:scale-110 transition-transform duration-150"
          aria-label={label}
        />
      </RadixSlider.Root>
    </div>
  );
};


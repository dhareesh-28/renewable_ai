import React from 'react';
import { Label } from './Label';

interface StatProps {
  label: string;
  value: string | number;
  unit?: string;
  delta?: {
    value: string | number;
    positive?: boolean;
    label?: string;
  };
  colorAccent?: 'solar' | 'battery' | 'grid' | 'load' | 'fault' | 'default';
  className?: string;
}

export const Stat: React.FC<StatProps> = ({
  label,
  value,
  unit,
  delta,
  colorAccent = 'default',
  className = '',
}) => {
  let accentBar = '';
  switch (colorAccent) {
    case 'solar':
      accentBar = 'border-l-2 border-l-solar';
      break;
    case 'battery':
      accentBar = 'border-l-2 border-l-battery';
      break;
    case 'grid':
      accentBar = 'border-l-2 border-l-grid';
      break;
    case 'load':
      accentBar = 'border-l-2 border-l-load';
      break;
    case 'fault':
      accentBar = 'border-l-2 border-l-fault';
      break;
    default:
      accentBar = 'border-l-2 border-l-transparent';
  }

  return (
    <div className={`p-4 bg-surface border border-hairline rounded-control ${accentBar} ${className}`}>
      <Label variant="uppercase" className="block mb-1.5 text-muted">
        {label}
      </Label>
      <div className="flex items-baseline gap-1.5 font-serif">
        <span className="text-h3 font-light text-ink tabular-nums">{value}</span>
        {unit && <span className="font-serif italic text-ui text-muted">{unit}</span>}
      </div>
      {delta && (
        <div className="mt-1 flex items-center gap-1.5 text-caption font-sans">
          <span
            className={`font-medium tabular-nums ${
              delta.positive === true
                ? 'text-battery'
                : delta.positive === false
                ? 'text-fault'
                : 'text-muted'
            }`}
          >
            {delta.positive === true ? '+' : ''}
            {delta.value}
          </span>
          {delta.label && <span className="text-muted">{delta.label}</span>}
        </div>
      )}
    </div>
  );
};


import React from 'react';
import { Calendar } from 'lucide-react';

interface DateRangePickerProps {
  startDate: string;
  endDate: string;
  onRangeChange: (start: string, end: string) => void;
  className?: string;
}

export const DateRangePicker: React.FC<DateRangePickerProps> = ({
  startDate,
  endDate,
  onRangeChange,
  className = '',
}) => {
  // Format dates for display
  const cleanStart = startDate.split(' ')[0] ?? '';
  const cleanEnd = endDate.split(' ')[0] ?? '';

  return (
    <div className={`inline-flex items-center gap-2 p-1.5 bg-raised border border-hairline rounded-control text-ui ${className}`}>
      <div className="flex items-center gap-1.5 px-2 text-muted">
        <Calendar size={14} />
      </div>

      <div className="flex items-center gap-2">
        <input
          type="date"
          value={cleanStart}
          min="2026-01-01"
          max="2026-12-31"
          onChange={(e) => {
            const newStart = e.target.value;
            onRangeChange(newStart, endDate);
          }}
          className="bg-transparent text-ink font-sans text-ui outline-none cursor-pointer tabular-nums"
        />
        <span className="text-muted/60 select-none">→</span>
        <input
          type="date"
          value={cleanEnd}
          min="2026-01-01"
          max="2026-12-31"
          onChange={(e) => {
            const newEnd = e.target.value;
            onRangeChange(startDate, newEnd);
          }}
          className="bg-transparent text-ink font-sans text-ui outline-none cursor-pointer tabular-nums"
        />
      </div>
    </div>
  );
};


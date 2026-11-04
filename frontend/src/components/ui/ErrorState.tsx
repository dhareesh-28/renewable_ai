import React from 'react';
import { PillButton } from './Button';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  className?: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'Encountered an anomaly',
  message,
  onRetry,
  className = '',
}) => {
  return (
    <div
      className={`flex flex-col items-center justify-center p-8 md:p-12 text-center border border-fault/30 rounded-frame bg-surface/60 ${className}`}
    >
      <div className="w-10 h-10 rounded-full bg-fault/10 text-fault flex items-center justify-center mb-4">
        <AlertCircle size={20} />
      </div>
      <h3 className="text-h3 font-serif font-light text-ink">{title}</h3>
      <p className="text-muted text-body max-w-md mt-2 mb-6 font-normal">
        {message}
      </p>
      {onRetry && (
        <PillButton variant="outline" onClick={onRetry} showArrow={false}>
          <span className="inline-flex items-center gap-2">
            <RefreshCw size={14} />
            <span>Retry Operation</span>
          </span>
        </PillButton>
      )}
    </div>
  );
};


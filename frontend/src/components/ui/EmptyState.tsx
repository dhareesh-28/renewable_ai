import React from 'react';
import { PillButton } from './Button';

interface EmptyStateProps {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  actionLabel,
  onAction,
  className = '',
}) => {
  return (
    <div
      className={`flex flex-col items-center justify-center p-12 text-center border border-dashed border-hairline rounded-frame bg-surface/40 ${className}`}
    >
      <h3 className="text-h3 font-serif font-light text-ink">{title}</h3>
      <p className="text-muted text-body max-w-md mt-2 mb-6 font-normal">
        {description}
      </p>
      {actionLabel && onAction && (
        <PillButton variant="primary" onClick={onAction}>
          {actionLabel}
        </PillButton>
      )}
    </div>
  );
};


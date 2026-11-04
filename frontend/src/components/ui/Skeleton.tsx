import React from 'react';

interface SkeletonProps {
  className?: string;
  variant?: 'rectangular' | 'circular' | 'text';
  width?: string | number;
  height?: string | number;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  className = '',
  variant = 'rectangular',
  width,
  height,
}) => {
  let shapeClass = 'rounded-control';
  if (variant === 'circular') shapeClass = 'rounded-full';
  if (variant === 'text') shapeClass = 'rounded-[3px] h-4 my-1';

  return (
    <div
      className={`animate-pulse bg-hairline/60 ${shapeClass} ${className}`}
      style={{
        width: width !== undefined ? (typeof width === 'number' ? `${width}px` : width) : undefined,
        height: height !== undefined ? (typeof height === 'number' ? `${height}px` : height) : undefined,
      }}
    />
  );
};


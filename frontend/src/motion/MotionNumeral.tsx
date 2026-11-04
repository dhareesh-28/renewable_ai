import React, { useEffect, useState, useRef } from 'react';
import { useInView } from 'framer-motion';
import { useReducedMotion } from './useReducedMotion';

interface MotionNumeralProps {
  value: number;
  decimals?: number;
  unit?: string;
  captionLine1: string;
  captionLine2?: string;
  staggerIndex?: number;
  size?: 'xl' | 'lg' | 'md';
  align?: 'left' | 'center' | 'right';
  className?: string;
}

export const MotionNumeral: React.FC<MotionNumeralProps> = ({
  value,
  decimals = 0,
  unit,
  captionLine1,
  captionLine2,
  staggerIndex = 0,
  size = 'xl',
  align = 'left',
  className = '',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(containerRef, { once: true, amount: 0.3 });
  const reducedMotion = useReducedMotion();

  const [displayValue, setDisplayValue] = useState<number>(reducedMotion ? value : 0);
  const [opacity, setOpacity] = useState<number>(reducedMotion ? 1 : 0.25);
  const hasAnimatedRef = useRef<boolean>(false);

  useEffect(() => {
    // If reduced motion is requested, show immediately
    if (reducedMotion) {
      setDisplayValue(value);
      setOpacity(1);
      hasAnimatedRef.current = true;
      return;
    }

    // Never re-animate on data refetch
    if (hasAnimatedRef.current) {
      setDisplayValue(value);
      setOpacity(1);
      return;
    }

    if (!isInView) return;

    hasAnimatedRef.current = true;
    let animId: number;
    const startTime = performance.now() + staggerIndex * 250;
    const totalDuration = 2000; // 2000ms

    const updateFrame = (now: number) => {
      if (now < startTime) {
        animId = requestAnimationFrame(updateFrame);
        return;
      }

      const elapsed = now - startTime;
      const progress = Math.min(elapsed / totalDuration, 1);

      // Opacity fades from 0.25 to 1.0
      setOpacity(0.25 + 0.75 * progress);

      // Linear for first 85% of time, ease-out on the last 15%
      let valueProgress = 0;
      if (progress <= 0.85) {
        // Linear up to 0.85
        valueProgress = progress;
      } else {
        // Ease out between 0.85 and 1.0
        const subProgress = (progress - 0.85) / 0.15; // 0 to 1
        const easeSub = 1 - Math.pow(1 - subProgress, 2); // quadratic ease-out
        valueProgress = 0.85 + 0.15 * easeSub;
      }

      setDisplayValue(value * valueProgress);

      if (progress < 1) {
        animId = requestAnimationFrame(updateFrame);
      } else {
        setDisplayValue(value);
        setOpacity(1);
      }
    };

    animId = requestAnimationFrame(updateFrame);

    return () => cancelAnimationFrame(animId);
  }, [isInView, value, staggerIndex, reducedMotion]);

  const alignClasses =
    align === 'center'
      ? 'items-center text-center'
      : align === 'right'
      ? 'items-end text-right'
      : 'items-start text-left';

  let valueSizeClass = 'text-[72px] md:text-[88px] leading-[0.95]';
  if (size === 'lg') {
    valueSizeClass = 'text-[56px] md:text-[68px] leading-[0.95]';
  } else if (size === 'md') {
    valueSizeClass = 'text-[40px] md:text-[48px] leading-[1.0]';
  }

  return (
    <div
      ref={containerRef}
      style={{ opacity, willChange: 'opacity' }}
      className={`inline-flex flex-col transition-opacity duration-300 ${alignClasses} ${className}`}
    >
      <div className="flex items-baseline gap-1.5 font-serif font-light text-ink tracking-tight">
        <span className={`${valueSizeClass} tabular-nums select-all font-light`}>
          {displayValue.toFixed(decimals)}
        </span>
        {unit && (
          <span className="font-serif italic text-lg md:text-xl text-muted font-normal">
            {unit}
          </span>
        )}
      </div>
      <div className="mt-2 text-caption text-muted font-sans leading-tight">
        <div>{captionLine1}</div>
        {captionLine2 && <div>{captionLine2}</div>}
      </div>
    </div>
  );
};


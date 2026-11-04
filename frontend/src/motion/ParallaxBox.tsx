import React, { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { useReducedMotion } from './useReducedMotion';

interface ParallaxBoxProps {
  children: React.ReactNode;
  speed?: 0.85 | 1.15;
  className?: string;
}

export const ParallaxBox: React.FC<ParallaxBoxProps> = ({
  children,
  speed = 0.85,
  className = '',
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  });

  // Range +60px to -60px for 0.85x (drifts down-to-up slower than scroll),
  // or -60px to +60px for 1.15x (drifts faster than scroll)
  const range = speed === 0.85 ? [60, -60] : [-60, 60];
  const y = useTransform(scrollYProgress, [0, 1], range);

  return (
    <div ref={ref} className={`relative ${className}`}>
      <motion.div
        style={{
          y: reducedMotion ? 0 : y,
          willChange: reducedMotion ? 'auto' : 'transform',
        }}
        className="w-full h-full"
      >
        {children}
      </motion.div>
    </div>
  );
};


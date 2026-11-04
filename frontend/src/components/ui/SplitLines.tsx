import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { LUXURY_EASE } from '../../motion';

interface SplitLinesProps {
  lines: string[];
  className?: string;
  lineClassName?: string;
  delay?: number;
}

export const SplitLines: React.FC<SplitLinesProps> = ({
  lines,
  className = '',
  lineClassName = '',
  delay = 0,
}) => {
  const shouldReduceMotion = useReducedMotion();

  if (shouldReduceMotion) {
    return (
      <div className={className}>
        {lines.map((line, idx) => (
          <div key={idx} className={lineClassName}>
            {line}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={className}>
      {lines.map((line, idx) => (
        <div key={idx} className="overflow-hidden py-0.5">
          <motion.div
            initial={{ y: '110%', opacity: 0 }}
            whileInView={{ y: '0%', opacity: 1 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{
              duration: 0.9,
              delay: delay + idx * 0.12,
              ease: LUXURY_EASE,
            }}
            className={lineClassName}
          >
            {line}
          </motion.div>
        </div>
      ))}
    </div>
  );
};


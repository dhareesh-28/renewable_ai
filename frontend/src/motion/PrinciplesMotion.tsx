import React, { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { LUXURY_EASE, TIMING } from './constants';
import { useReducedMotion } from './useReducedMotion';
import { Label } from '../components/ui/Label';

export interface PrincipleTile {
  num: string;
  title: string;
  text: string;
}

interface PrinciplesMotionProps {
  tiles: PrincipleTile[];
}

export const PrinciplesMotion: React.FC<PrinciplesMotionProps> = ({ tiles }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start end', 'center center'],
  });

  // Background dim overlay fades from 0 to 28% (at most 30%) so it reads as a clear photo
  const overlayOpacity = useTransform(scrollYProgress, [0, 0.8], [0.1, 0.28]);

  return (
    <div ref={containerRef} className="relative w-full overflow-hidden rounded-[16px] p-6 sm:p-8 md:p-10 border border-hairline/60">
      {/* Background Architectural Real Photo */}
      <div className="absolute inset-0 pointer-events-none -z-10 overflow-hidden">
        <img
          src="/images/principles.webp"
          alt="Architectural principles"
          loading="lazy"
          className="w-full h-full object-cover object-center select-none"
        />
        {/* Light ink overlay (at most 30%) */}
        <motion.div
          style={{
            opacity: reducedMotion ? 0.25 : overlayOpacity,
            willChange: reducedMotion ? 'auto' : 'opacity',
          }}
          className="absolute inset-0 bg-[#1B1F1D]"
        />
      </div>

      {/* Four Ivory Tiles Staggered by 140ms with 32px Rise */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 relative z-10">
        {tiles.map((tile, idx) => (
          <motion.div
            key={tile.num}
            initial={
              reducedMotion
                ? { opacity: 1, y: 0 }
                : { opacity: 0, y: TIMING.tileRise }
            }
            whileInView={
              reducedMotion
                ? { opacity: 1, y: 0 }
                : { opacity: 1, y: 0 }
            }
            viewport={{ once: true, amount: 0.15 }}
            transition={{
              duration: reducedMotion ? 0.2 : 0.8,
              delay: reducedMotion ? 0 : idx * TIMING.tileStagger,
              ease: LUXURY_EASE,
            }}
            className="p-6 md:p-7 bg-[#FAF7F2]/90 backdrop-blur-[8px] border border-hairline rounded-[16px] shadow-sm flex flex-col justify-between"
          >
            <div>
              <Label variant="parenthesised">{tile.num}</Label>
              <h3 className="font-serif italic text-xl font-normal text-ink mt-2 mb-2">
                {tile.title}
              </h3>
            </div>
            <p className="text-caption text-[#424641] font-sans leading-relaxed mt-2">
              {tile.text}
            </p>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

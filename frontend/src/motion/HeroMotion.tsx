import React, { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { BRAND_NAME } from '../brand';
import { LUXURY_EASE, TIMING } from './constants';
import { useReducedMotion } from './useReducedMotion';

interface HeroMotionProps {
  children?: React.ReactNode;
}

export const HeroMotion: React.FC<HeroMotionProps> = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();

  // Scroll tracking for Hero Exit
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start start', 'end start'],
  });

  // Hero Exit transforms:
  // 1. Photo frame clip-path bottom value rises from 0% to 85%
  const bottomInset = useTransform(scrollYProgress, [0, 0.85], ['0%', '85%']);
  const clipPathStyle = useTransform(
    bottomInset,
    (val) => `inset(0 0 ${val} 0 round 16px)`
  );

  // 2. Wordmark translates up more slowly so it stays visible longer
  const wordmarkY = useTransform(scrollYProgress, [0, 1], ['0px', '-120px']);

  // 3. Right side text fades out slightly faster
  const rightTextOpacity = useTransform(scrollYProgress, [0, 0.5], [1, 0]);

  // Break wordmark into letter groups for staggered entrance
  const letterGroups = React.useMemo(() => {
    // E.g. "HELIOS" -> ["HE", "LI", "OS"]
    const name = BRAND_NAME;
    const groups: string[] = [];
    for (let i = 0; i < name.length; i += 2) {
      groups.push(name.slice(i, i + 2));
    }
    return groups;
  }, []);

  return (
    <div
      ref={containerRef}
      id="hero"
      className="relative w-full"
      style={{
        height: reducedMotion ? '100svh' : '150svh',
        zIndex: 5,
      }}
    >
      <div
        className="sticky top-0 w-full h-[100svh] p-4 sm:p-5 md:p-6 box-border bg-bg flex flex-col justify-center"
      >
        <motion.div
          style={{
            clipPath: reducedMotion ? undefined : clipPathStyle,
            willChange: reducedMotion ? 'auto' : 'clip-path',
          }}
          className="relative w-full h-full rounded-[16px] overflow-hidden border border-hairline/60 bg-ink"
        >
          {/* Architectural Daylight Hero Photo with 1.06 to 1.0 scale */}
          <motion.div
            initial={{ scale: reducedMotion ? 1 : 1.06 }}
            animate={{ scale: 1 }}
            transition={{
              duration: reducedMotion ? 0.3 : TIMING.heroImageScale,
              ease: LUXURY_EASE,
            }}
            className="w-full h-full"
          >
            <img
              src="/images/hero.webp"
              alt="Solar residence architecture"
              loading="eager"
              // @ts-expect-error fetchPriority standard attribute
              fetchpriority="high"
              decoding="async"
              className="w-full h-full object-cover object-center select-none"
            />
          </motion.div>

          {/* Thin top scrim for Nav legibility */}
          <div className="absolute top-0 left-0 right-0 h-36 pointer-events-none bg-gradient-to-b from-[rgba(27,31,29,0.85)] via-[rgba(27,31,29,0.50)] to-transparent" />

          {/* Soft ink scrim only over the bottom 45% of the photo */}
          <div className="absolute bottom-0 left-0 right-0 h-[45%] pointer-events-none bg-gradient-to-t from-[rgba(27,31,29,0.88)] via-[rgba(27,31,29,0.52)] to-transparent" />

          {/* Bottom Left: Wordmark rises in groups of letters (Single H1 on Home page) */}
          <motion.h1
            style={{ y: reducedMotion ? 0 : wordmarkY }}
            aria-label={`${BRAND_NAME} — Renewable Energy Architecture`}
            className="absolute bottom-6 left-6 md:bottom-12 md:left-14 z-10 flex items-baseline overflow-hidden select-none m-0 p-0 font-normal"
          >
            {letterGroups.map((group, idx) => (
              <div key={idx} className="overflow-hidden py-1">
                <motion.span
                  initial={{ y: reducedMotion ? 0 : '110%', opacity: reducedMotion ? 1 : 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{
                    duration: reducedMotion ? 0.3 : 0.9,
                    delay: reducedMotion ? 0 : 0.2 + idx * TIMING.heroWordmarkStagger,
                    ease: LUXURY_EASE,
                  }}
                  className="font-serif font-light text-white text-[clamp(90px,18vw,280px)] leading-[0.85] tracking-[-0.02em] drop-shadow-sm inline-block"
                >
                  {group}
                </motion.span>
              </div>
            ))}
          </motion.h1>

          {/* Bottom Right: Tagline, Sans Paragraph & Scroll Cue */}
          <motion.div
            style={{ opacity: reducedMotion ? 1 : rightTextOpacity }}
            className="absolute bottom-6 right-6 md:bottom-12 md:right-14 z-10 max-w-[260px] sm:max-w-xs md:max-w-sm text-right flex flex-col items-end gap-2.5 md:gap-3 text-white"
          >
            <p className="font-serif italic text-lg md:text-xl text-white/95 leading-snug font-normal drop-shadow-sm">
              Renewable energy, managed with foresight.
            </p>
            <p className="text-ui text-white/80 font-light leading-relaxed hidden sm:block">
              Machine learning solar forecasting, dual-method fault diagnostics, and
              linear-programming battery storage optimization for architectural microgrids.
            </p>
            <div className="flex items-center gap-3 text-[11px] uppercase tracking-label text-white/70 pt-2 select-none">
              <span>SCROLL</span>
              <div className="w-12 h-[1px] bg-white/40" />
            </div>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
};

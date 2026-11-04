import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { LUXURY_EASE, TIMING } from './constants';
import { useReducedMotion } from './useReducedMotion';
import { PillButton } from '../components/ui/Button';
import { Play, Pause } from 'lucide-react';

export interface ShowcaseModuleItem {
  id: number;
  title: string;
  label: string;
  desc: string;
  path: string;
  chart: React.ReactNode;
}

interface ShowcaseCarouselProps {
  modules: ShowcaseModuleItem[];
}

export const ShowcaseCarousel: React.FC<ShowcaseCarouselProps> = ({ modules }) => {
  const navigate = useNavigate();
  const reducedMotion = useReducedMotion();
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const nextSlide = useCallback(() => {
    setActiveIndex((prev) => (prev + 1) % modules.length);
  }, [modules.length]);

  // Auto-advance every 3500ms
  useEffect(() => {
    if (reducedMotion || isPaused) return;

    const timer = setInterval(nextSlide, TIMING.carouselInterval);
    return () => clearInterval(timer);
  }, [nextSlide, isPaused, reducedMotion]);

  // Pause when tab is hidden
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) {
        setIsPaused(true);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  // Indices for left, centre, right
  const leftIndex = (activeIndex + modules.length - 1) % modules.length;
  const rightIndex = (activeIndex + 1) % modules.length;
  const activeModule = modules[activeIndex] ?? modules[0];

  return (
    <div
      ref={containerRef}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onFocusCapture={() => setIsPaused(true)}
      onBlurCapture={() => setIsPaused(false)}
      className="relative w-full select-none"
    >
      {/* Top Header Row with (Our modules), Pagination and Pause/Play Button */}
      <div className="flex items-center justify-between mb-8 max-w-[1320px] mx-auto">
        <span className="font-serif italic text-muted text-sm tracking-normal">
          (OUR MODULES)
        </span>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            {modules.map((m, idx) => {
              const isSelected = activeIndex === idx;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setActiveIndex(idx)}
                  className={`font-serif text-sm transition-colors cursor-pointer px-1 py-0.5 ${
                    isSelected
                      ? 'text-ink font-medium underline underline-offset-4'
                      : 'text-muted hover:text-ink'
                  }`}
                  aria-label={`Select module ${idx + 1}`}
                >
                  ({idx + 1})
                </button>
              );
            })}
          </div>

          {/* Visible Pause / Play Toggle Button */}
          <button
            type="button"
            onClick={() => setIsPaused(!isPaused)}
            aria-label={isPaused ? 'Resume Carousel Auto-Advance' : 'Pause Carousel Auto-Advance'}
            className="p-1.5 rounded-full text-muted hover:text-ink hover:bg-surface border border-hairline transition-colors cursor-pointer"
          >
            {isPaused ? <Play size={13} /> : <Pause size={13} />}
          </button>
        </div>
      </div>

      {/* Overlapping Centred Display Title with Masked Line Swap */}
      <div className="relative text-center z-20 pointer-events-none -mb-10 md:-mb-14 overflow-hidden h-24 md:h-28 flex items-center justify-center">
        <AnimatePresence mode="wait">
          <motion.h2
            key={activeModule.title}
            initial={reducedMotion ? { opacity: 0 } : { y: '105%', opacity: 0 }}
            animate={reducedMotion ? { opacity: 1 } : { y: '0%', opacity: 1 }}
            exit={reducedMotion ? { opacity: 0 } : { y: '-105%', opacity: 0 }}
            transition={{
              duration: reducedMotion ? TIMING.reducedFade : 0.7,
              ease: LUXURY_EASE,
            }}
            className="text-display font-serif font-light text-ink tracking-tight uppercase select-none opacity-90 drop-shadow-sm px-4"
          >
            {activeModule.title}
          </motion.h2>
        </AnimatePresence>
      </div>

      {/* Carousel composition matching the reference frame:
          Center panel is large & tall; Left & Right panels are tall and partly cropped by section edges */}
      <div className="relative w-full flex items-center justify-center overflow-hidden py-4 -mx-4 sm:-mx-6 px-4 sm:px-6">
        <div className="flex items-center justify-center gap-6 md:gap-8 w-full max-w-[1500px]">
          
          {/* Left Panel (Flanking card, partly cropped, clickable) */}
          <div
            onClick={() => setActiveIndex(leftIndex)}
            className="w-[280px] md:w-[340px] lg:w-[380px] h-[460px] flex-shrink-0 bg-surface border border-hairline rounded-control p-5 overflow-hidden cursor-pointer hover:border-ink/40 transition-all opacity-70 hover:opacity-100 hidden sm:flex flex-col justify-between"
            style={{ transform: 'scale(0.94)', transformOrigin: 'center right' }}
            title={`View ${modules[leftIndex]?.title}`}
          >
            <div className="flex items-center justify-between pb-2 border-b border-hairline/60">
              <span className="text-[11px] uppercase tracking-label text-muted font-normal">
                {modules[leftIndex]?.title}
              </span>
              <span className="text-[11px] text-muted font-serif italic">
                (Click to focus)
              </span>
            </div>
            <div className="w-full flex-grow py-3 flex items-center justify-center overflow-hidden pointer-events-none">
              {modules[leftIndex]?.chart}
            </div>
            <div className="pt-2 border-t border-hairline/60 text-caption text-muted truncate">
              {modules[leftIndex]?.label}
            </div>
          </div>

          {/* Centre Panel (Taller, Scale 1.0, Primary Focus) */}
          <div className="w-full max-w-[620px] h-[520px] flex-shrink-0 bg-raised border border-hairline rounded-control p-6 md:p-8 flex flex-col justify-between shadow-sm relative z-10 transition-transform duration-500">
            <div className="flex items-center justify-between pb-3 border-b border-hairline/60">
              <span className="text-[11px] uppercase tracking-label text-ink font-medium">
                {activeModule.label}
              </span>
              <span className="text-caption text-muted font-sans">
                Module {activeIndex + 1} of {modules.length}
              </span>
            </div>

            {/* Animated Active Chart Display */}
            <div className="w-full flex-grow py-3 flex items-center justify-center overflow-hidden">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeModule.id}
                  initial={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
                  transition={{
                    duration: reducedMotion ? TIMING.reducedFade : TIMING.carouselTransition,
                    ease: LUXURY_EASE,
                  }}
                  className="w-full h-full"
                >
                  {activeModule.chart}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Bottom Card Summary & Action */}
            <div className="pt-4 border-t border-hairline/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <p className="text-caption text-muted max-w-sm leading-relaxed">
                {activeModule.desc}
              </p>
              <PillButton
                variant="primary"
                onClick={() => navigate(activeModule.path)}
              >
                Open Module
              </PillButton>
            </div>
          </div>

          {/* Right Panel (Flanking card, partly cropped, clickable) */}
          <div
            onClick={() => setActiveIndex(rightIndex)}
            className="w-[280px] md:w-[340px] lg:w-[380px] h-[460px] flex-shrink-0 bg-surface border border-hairline rounded-control p-5 overflow-hidden cursor-pointer hover:border-ink/40 transition-all opacity-70 hover:opacity-100 hidden sm:flex flex-col justify-between"
            style={{ transform: 'scale(0.94)', transformOrigin: 'center left' }}
            title={`View ${modules[rightIndex]?.title}`}
          >
            <div className="flex items-center justify-between pb-2 border-b border-hairline/60">
              <span className="text-[11px] uppercase tracking-label text-muted font-normal">
                {modules[rightIndex]?.title}
              </span>
              <span className="text-[11px] text-muted font-serif italic">
                (Click to focus)
              </span>
            </div>
            <div className="w-full flex-grow py-3 flex items-center justify-center overflow-hidden pointer-events-none">
              {modules[rightIndex]?.chart}
            </div>
            <div className="pt-2 border-t border-hairline/60 text-caption text-muted truncate">
              {modules[rightIndex]?.label}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

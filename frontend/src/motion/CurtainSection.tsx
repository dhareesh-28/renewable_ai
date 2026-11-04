import React, { useRef, useState, useEffect } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { useReducedMotion } from './useReducedMotion';

interface CurtainSectionProps {
  id: string;
  children: React.ReactNode;
  zIndex?: number;
  isLast?: boolean;
  wipeDistance?: number;
  className?: string;
  contentClassName?: string;
}

export const CurtainSection: React.FC<CurtainSectionProps> = ({
  id,
  children,
  zIndex = 1,
  isLast = false,
  wipeDistance = 500,
  className = '',
  contentClassName = '',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();

  const [sectionHeight, setSectionHeight] = useState<number>(0);
  const [windowHeight, setWindowHeight] = useState<number>(900);

  // ResizeObserver + font load listener
  useEffect(() => {
    const measure = () => {
      if (contentRef.current) {
        setSectionHeight(contentRef.current.offsetHeight);
      }
      setWindowHeight(window.innerHeight);
    };

    measure();

    let ro: ResizeObserver | null = null;
    if (contentRef.current && typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => measure());
      ro.observe(contentRef.current);
    }

    window.addEventListener('resize', measure);
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(measure);
    }

    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, []);

  // Calculate pinning rule:
  // If section <= 100svh, top: 0
  // If section > 100svh, top: calc(100svh - sectionHeight)
  const isTall = sectionHeight > windowHeight;
  const stickyTop = isTall ? windowHeight - sectionHeight : 0;

  // Track scroll through the container to wipe out
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['end end', 'end start'],
  });

  // Animate clip-path from inset(0 0 0 0 round 16px) to inset(0 0 100% 0 round 16px)
  const clipBottom = useTransform(scrollYProgress, [0, 1], ['0%', '100%']);
  const clipPath = useTransform(
    clipBottom,
    (val) => `inset(0 0 ${val} 0 round 16px)`
  );

  // Container height adds wipeDistance so the user has scroll headroom to lift the curtain
  const containerHeight = isLast || reducedMotion ? 'auto' : `${sectionHeight + wipeDistance}px`;

  return (
    <div
      ref={containerRef}
      id={id}
      style={{
        height: containerHeight,
        zIndex,
        position: 'relative',
      }}
      className={`w-full ${className}`}
    >
      <motion.div
        ref={contentRef}
        style={{
          position: isLast || reducedMotion ? 'relative' : 'sticky',
          top: isLast || reducedMotion ? undefined : stickyTop,
          clipPath: isLast || reducedMotion ? undefined : clipPath,
          willChange: reducedMotion ? 'auto' : 'clip-path',
        }}
        className={`w-full bg-bg ${contentClassName}`}
      >
        {children}
      </motion.div>
    </div>
  );
};


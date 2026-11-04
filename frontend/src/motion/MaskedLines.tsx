import React, { useRef, useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { LUXURY_EASE, TIMING } from './constants';
import { useReducedMotion } from './useReducedMotion';

interface MaskedLinesProps {
  text: string;
  as?: 'h1' | 'h2' | 'h3' | 'p' | 'div';
  className?: string;
  lineClassName?: string;
}

interface ParsedWord {
  text: string;
  isItalic: boolean;
}

export const MaskedLines: React.FC<MaskedLinesProps> = ({
  text,
  as: Component = 'div',
  className = '',
  lineClassName = '',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();
  const [lines, setLines] = useState<ParsedWord[][]>([]);
  // First paint visible under reduced motion
  const [isRevealed, setIsRevealed] = useState<boolean>(Boolean(reducedMotion));

  // Parse words with markdown italic markers like *word*
  const parseWords = useCallback((raw: string): ParsedWord[] => {
    const tokens: ParsedWord[] = [];
    const parts = raw.split(/(\*[^*]+\*)/g);
    for (const part of parts) {
      if (!part) continue;
      if (part.startsWith('*') && part.endsWith('*')) {
        const italicWords = part.slice(1, -1).split(/\s+/);
        for (const w of italicWords) {
          if (w) tokens.push({ text: w, isItalic: true });
        }
      } else {
        const romanWords = part.split(/\s+/);
        for (const w of romanWords) {
          if (w) tokens.push({ text: w, isItalic: false });
        }
      }
    }
    return tokens;
  }, []);

  const allWords = React.useMemo(() => parseWords(text), [text, parseWords]);
  const plainText = React.useMemo(() => text.replace(/\*/g, ''), [text]);

  const calculateLines = useCallback(() => {
    if (!containerRef.current || allWords.length === 0) return;

    const container = containerRef.current;
    const computedStyle = window.getComputedStyle(container);
    const containerWidth = container.clientWidth;
    if (containerWidth <= 0) return;

    // Temporary offscreen measurement div
    const measurer = document.createElement('div');
    measurer.style.position = 'absolute';
    measurer.style.visibility = 'hidden';
    measurer.style.pointerEvents = 'none';
    measurer.style.width = `${containerWidth}px`;
    measurer.style.font = computedStyle.font;
    measurer.style.fontSize = computedStyle.fontSize;
    measurer.style.fontFamily = computedStyle.fontFamily;
    measurer.style.letterSpacing = computedStyle.letterSpacing;
    measurer.style.lineHeight = computedStyle.lineHeight;
    measurer.style.whiteSpace = 'normal';
    measurer.style.wordBreak = 'break-word';
    document.body.appendChild(measurer);

    const calculated: ParsedWord[][] = [];
    let currentLine: ParsedWord[] = [];

    // Measure line heights by appending words
    for (let i = 0; i < allWords.length; i++) {
      const word = allWords[i];
      if (!word) continue;

      const testLine = [...currentLine, word];

      // Measure with testLine
      measurer.innerHTML = testLine
        .map((w) => (w.isItalic ? `<em>${w.text}</em>` : w.text))
        .join(' ');
      const testHeight = measurer.clientHeight;

      if (currentLine.length === 0) {
        currentLine.push(word);
      } else {
        // Measure previous line alone
        measurer.innerHTML = currentLine
          .map((w) => (w.isItalic ? `<em>${w.text}</em>` : w.text))
          .join(' ');
        const prevHeight = measurer.clientHeight;

        if (testHeight > prevHeight) {
          calculated.push(currentLine);
          currentLine = [word];
        } else {
          currentLine.push(word);
        }
      }
    }

    if (currentLine.length > 0) {
      calculated.push(currentLine);
    }

    document.body.removeChild(measurer);
    setLines(calculated);
  }, [allWords]);

  useEffect(() => {
    calculateLines();

    let timeoutId: number;
    const handleResize = () => {
      clearTimeout(timeoutId);
      timeoutId = window.setTimeout(calculateLines, 150);
    };

    window.addEventListener('resize', handleResize);
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(calculateLines);
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(timeoutId);
    };
  }, [calculateLines]);

  // Viewport detection + 1.2s Failsafe
  useEffect(() => {
    if (reducedMotion) {
      setIsRevealed(true);
      return;
    }

    // 1. IntersectionObserver
    let observer: IntersectionObserver | null = null;
    const checkBounding = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      if (rect.top < window.innerHeight && rect.bottom > 0) {
        setIsRevealed(true);
      }
    };

    if (containerRef.current && typeof IntersectionObserver !== 'undefined') {
      observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              setIsRevealed(true);
              observer?.disconnect();
              break;
            }
          }
        },
        { threshold: 0.05, rootMargin: '100px 0px 100px 0px' }
      );
      observer.observe(containerRef.current);
    }

    // 2. Scroll and immediate bounding check
    checkBounding();
    window.addEventListener('scroll', checkBounding, { passive: true });

    // 3. Failsafe: if an element has been mounted / in viewport for >1.2s without revealing, reveal it
    const failsafe = window.setTimeout(() => {
      setIsRevealed(true);
    }, 1200);

    return () => {
      observer?.disconnect();
      window.removeEventListener('scroll', checkBounding);
      clearTimeout(failsafe);
    };
  }, [reducedMotion]);

  return (
    <Component
      ref={containerRef as unknown as React.Ref<never>}
      aria-label={plainText}
      className={`relative ${className}`}
    >
      {lines.length === 0 ? (
        // First-paint / fallback before offscreen line split
        <div className="overflow-hidden py-0.5">
          <motion.div
            initial={reducedMotion ? { opacity: 1 } : { opacity: 0, y: isRevealed ? '0%' : '105%' }}
            animate={reducedMotion ? { opacity: 1 } : { opacity: isRevealed ? 1 : 0, y: isRevealed ? '0%' : '105%' }}
            transition={{ duration: TIMING.lineRevealDuration, ease: LUXURY_EASE }}
            className={lineClassName}
          >
            {allWords.map((w, i) => (
              <span key={i} className={w.isItalic ? 'font-serif italic font-normal' : ''}>
                {w.text}{' '}
              </span>
            ))}
          </motion.div>
        </div>
      ) : (
        lines.map((lineWords, lineIdx) => (
          <div key={lineIdx} className="overflow-hidden py-0.5" aria-hidden="true">
            <motion.div
              initial={
                reducedMotion
                  ? { opacity: 1, y: '0%' }
                  : { y: '105%', opacity: 0 }
              }
              animate={
                reducedMotion || isRevealed
                  ? { y: '0%', opacity: 1 }
                  : { y: '105%', opacity: 0 }
              }
              transition={{
                duration: reducedMotion ? 0.2 : TIMING.lineRevealDuration,
                delay: reducedMotion ? 0 : lineIdx * TIMING.lineStagger,
                ease: LUXURY_EASE,
              }}
              className={lineClassName}
            >
              {lineWords.map((word, wordIdx) => (
                <span
                  key={wordIdx}
                  className={word.isItalic ? 'font-serif italic font-normal' : ''}
                >
                  {word.text}
                  {wordIdx < lineWords.length - 1 ? ' ' : ''}
                </span>
              ))}
            </motion.div>
          </div>
        ))
      )}
    </Component>
  );
};

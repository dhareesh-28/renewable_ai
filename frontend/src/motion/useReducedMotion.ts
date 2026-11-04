import { useReducedMotion as useFramerReducedMotion } from 'framer-motion';

export function useReducedMotion(): boolean {
  const reduced = useFramerReducedMotion();
  return Boolean(reduced);
}


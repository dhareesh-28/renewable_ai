import { Variants, Transition } from 'framer-motion';
import { LUXURY_EASE } from './constants';

export const MOTION_TRANSITION: Transition = {
  duration: 0.8,
  ease: LUXURY_EASE,
};

export const REVEAL_VARIANTS: Variants = {
  hidden: {
    opacity: 0,
    y: 24,
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: MOTION_TRANSITION,
  },
};

export const STAGGER_CONTAINER: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.09,
      delayChildren: 0.05,
    },
  },
};

export const HERO_IMAGE_VARIANTS: Variants = {
  initial: {
    scale: 1.06,
    opacity: 0.95,
  },
  animate: {
    scale: 1.0,
    opacity: 1,
    transition: {
      duration: 1.6,
      ease: LUXURY_EASE,
    },
  },
};

export const LETTER_GROUP_VARIANTS: Variants = {
  hidden: {
    opacity: 0,
    y: '100%',
  },
  visible: {
    opacity: 1,
    y: '0%',
    transition: {
      duration: 0.9,
      ease: LUXURY_EASE,
    },
  },
};

export const MENU_OVERLAY_VARIANTS: Variants = {
  closed: {
    opacity: 0,
    y: '-100%',
    transition: {
      duration: 0.6,
      ease: LUXURY_EASE,
    },
  },
  open: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.7,
      ease: LUXURY_EASE,
    },
  },
};

export const MENU_ITEM_VARIANTS: Variants = {
  closed: {
    opacity: 0,
    y: 20,
  },
  open: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
      ease: LUXURY_EASE,
    },
  },
};

export const SIDE_SHEET_VARIANTS: Variants = {
  closed: {
    x: '100%',
    transition: {
      duration: 0.45,
      ease: LUXURY_EASE,
    },
  },
  open: {
    x: '0%',
    transition: {
      duration: 0.55,
      ease: LUXURY_EASE,
    },
  },
};


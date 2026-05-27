import { useEffect, useRef } from 'react';

interface GsapStaggerOptions {
  selector?: string;
  delay?: number;
  duration?: number;
  stagger?: number;
  y?: number;
  ease?: string;
  enabled?: boolean;
}

/**
 * Lightweight GSAP entrance animation hook for `[data-gsap-item]` children.
 * Content remains visible by default; the hook only animates after GSAP loads
 * and the user has not requested reduced motion.
 */
export function useGsapStagger<T extends HTMLElement = HTMLElement>(options: GsapStaggerOptions = {}) {
  const {
    selector = '[data-gsap-item]',
    delay = 0,
    duration = 0.5,
    stagger = 0.06,
    y = 14,
    ease = 'power2.out',
    enabled = true,
  } = options;

  const ref = useRef<T | null>(null);

  useEffect(() => {
    if (!enabled || !ref.current) return;
    if (typeof window === 'undefined') return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

    const root = ref.current;
    let cancelled = false;
    let cleanup: (() => void) | null = null;

    void import('gsap')
      .then((mod) => {
        if (cancelled) return;
        const gsap = mod.gsap ?? mod.default;
        if (!gsap?.fromTo) return;
        const targets = Array.from(root.querySelectorAll<HTMLElement>(selector));
        if (targets.length === 0) return;
        const tween = gsap.fromTo(
          targets,
          { autoAlpha: 0, y },
          { autoAlpha: 1, y: 0, duration, stagger, ease, delay, clearProps: 'transform,opacity,visibility' },
        );
        cleanup = () => {
          try {
            tween.kill?.();
          } catch {
            /* noop */
          }
        };
      })
      .catch(() => {
        /* GSAP unavailable; content stays visible by default. */
      });

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [selector, delay, duration, stagger, y, ease, enabled]);

  return ref;
}

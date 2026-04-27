import { useEffect, useRef, useState } from "react";

interface Options {
  onRefresh: () => Promise<void> | void;
  threshold?: number; // px to trigger
  maxPull?: number;   // px clamp
  enabled?: boolean;
}

/**
 * Mobile-friendly pull-to-refresh.
 * Activates only when the page is scrolled to the top and the user drags down
 * with a single touch. Works on touch devices (iOS Safari, Android Chrome).
 */
export function usePullToRefresh({
  onRefresh,
  threshold = 70,
  maxPull = 120,
  enabled = true,
}: Options) {
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef<number | null>(null);
  const tracking = useRef(false);

  useEffect(() => {
    if (!enabled) return;

    const onTouchStart = (e: TouchEvent) => {
      if (refreshing) return;
      // Only start when scrolled to top
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      if (scrollTop > 0) return;
      if (e.touches.length !== 1) return;
      startY.current = e.touches[0].clientY;
      tracking.current = true;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!tracking.current || startY.current === null || refreshing) return;
      const delta = e.touches[0].clientY - startY.current;
      if (delta <= 0) {
        setPull(0);
        return;
      }
      // Resistance curve
      const eased = Math.min(maxPull, delta * 0.5);
      setPull(eased);
      if (eased > 5 && e.cancelable) {
        e.preventDefault(); // prevent rubber-band so the indicator feels owned
      }
    };

    const onTouchEnd = async () => {
      if (!tracking.current) return;
      tracking.current = false;
      const distance = pull;
      startY.current = null;
      if (distance >= threshold && !refreshing) {
        setRefreshing(true);
        setPull(threshold);
        try {
          await onRefresh();
        } finally {
          setRefreshing(false);
          setPull(0);
        }
      } else {
        setPull(0);
      }
    };

    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    window.addEventListener("touchcancel", onTouchEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [enabled, refreshing, pull, threshold, maxPull, onRefresh]);

  return { pull, refreshing, threshold };
}

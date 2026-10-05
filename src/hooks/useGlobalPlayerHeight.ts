import { useEffect, useState } from "react";
import { useAudioPlayer } from "@/contexts/AudioPlayerContext";

/**
 * How many pixels at the bottom of the viewport the global audio player is
 * covering, so a page can keep its own bottom-anchored controls clear of it.
 *
 * Why a measurement and not a constant:
 *
 * The player is `fixed bottom-0 z-40` and `GlobalAudioPlayer` renders after
 * <Routes>, so it paints on top of every page. z-index cannot fix that from
 * inside a page — `PageLayout` wraps its children in `relative z-10`, which
 * opens a stacking context, so any z-index set within a page is scoped under
 * that context and the whole context still loses to the player's root-level
 * z-40. Moving the page's own element is the only thing that works.
 *
 * And the height is not a number anyone can hardcode: the player is
 * drag-resizable, and it has two implementations (`GaplessPlayerBar` by
 * default, `AudioPlayer` on the legacy engine) of different heights.
 *
 * This was extracted from `VersionPicker`, where it was written to stop the
 * player burying the Keep bar. `Messages` needs exactly the same thing for its
 * composer, and a second copy of a measurement this fiddly is a silent
 * divergence waiting to happen — the same shape as the duplicated
 * archive-notes encoder and the two player bars. One implementation, asserted
 * by `globalPlayerHeightSingleSource.test.ts`.
 *
 * Returns 0 when no player is mounted.
 */
export const useGlobalPlayerHeight = (): number => {
  const [playerHeight, setPlayerHeight] = useState(0);
  // The player mounts and unmounts with playback, so re-attach when it changes.
  const { playingSlot } = useAudioPlayer();

  useEffect(() => {
    const el = document.querySelector("[data-global-player]");
    if (!el) {
      setPlayerHeight(0);
      return;
    }

    /**
     * The player's own box is not the whole obstruction. Its error banner
     * ("That song isn't on this tape") is `absolute -top-12`, so it hangs ~48px
     * ABOVE the root and getBoundingClientRect().height does not see it — it
     * covered the Keep button whenever a tape turned out not to contain the
     * song. Measure from the highest edge anything in the player reaches.
     */
    const measure = () => {
      let top = el.getBoundingClientRect().top;
      for (const child of el.querySelectorAll("*")) {
        const r = child.getBoundingClientRect();
        if (r.height > 0 && r.top < top) top = r.top;
      }
      setPlayerHeight(Math.max(0, window.innerHeight - top));
    };
    measure();

    // Size alone is not enough: the banner is an absolutely-positioned child,
    // so it appears without changing the root's height. Watch the subtree too.
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    const mo = new MutationObserver(measure);
    mo.observe(el, { childList: true, subtree: true, attributes: true });
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      mo.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [playingSlot]);

  return playerHeight;
};

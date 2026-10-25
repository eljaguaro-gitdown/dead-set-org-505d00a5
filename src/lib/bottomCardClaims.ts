import { useEffect, useSyncExternalStore } from "react";

/**
 * One card at the bottom of the screen at a time.
 *
 * The install banner is `fixed bottom-0 z-50` and appears on every mobile
 * visit a second after load — the same corner, the same z-index, and later in
 * the DOM than the cards that answer something the fan just did: "digging
 * through the crates", "oops, that one won't play", "it's fixed". Seen on a
 * 375px phone: the banner sat over the oops card's sign-in line and the tape
 * it offered. A card about what you just did outranks a pitch to install the
 * app, so those cards claim the bottom and the banner yields while any claim
 * is held. It comes back when they go.
 */
const claims = new Set<string>();
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

/** Hold the bottom of the screen while `active`. */
export const useClaimBottom = (id: string, active: boolean): void => {
  useEffect(() => {
    if (!active) return;
    claims.add(id);
    emit();
    return () => {
      claims.delete(id);
      emit();
    };
  }, [id, active]);
};

/** True while any card holds the bottom. */
export const useBottomClaimed = (): boolean =>
  useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },
    () => claims.size > 0,
    () => false,
  );

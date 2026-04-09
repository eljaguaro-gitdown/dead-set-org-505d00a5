import { useEffect, useRef } from "react";

/**
 * Plays the Shakedown Street audio signature once per session
 * on the user's first interaction with the page.
 */
export const useAudioSignature = () => {
  const playedRef = useRef(false);

  useEffect(() => {
    if (sessionStorage.getItem("deadset-sig-played")) {
      playedRef.current = true;
      return;
    }

    const play = () => {
      if (playedRef.current) return;
      playedRef.current = true;
      sessionStorage.setItem("deadset-sig-played", "1");

      const audio = new Audio("/audio/shakedown-signature.mp3");
      audio.volume = 0.35;
      audio.play().catch(() => {});
    };

    document.addEventListener("click", play, { once: true });
    document.addEventListener("touchstart", play, { once: true });

    return () => {
      document.removeEventListener("click", play);
      document.removeEventListener("touchstart", play);
    };
  }, []);
};

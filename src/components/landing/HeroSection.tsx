import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { trackCtaClick } from "@/lib/trackCtaClick";
import { supabase } from "@/integrations/supabase/client";
import { useAudioPlayer, type PlayableSlot } from "@/contexts/AudioPlayerContext";

// Daily community spotlight — server picks one public setlist per UTC day,
// rotating fairly so every public setlist gets a turn. See get_hero_spotlight().
interface HeroSpotlight {
  id: string;
  title: string;
  creatorName: string;
  songCount: number;
  yearsLabel: string | null;
}

// Tiny silent WAV (44 bytes) used to "unlock" iOS Safari audio inside the
// user gesture. Without this, async work in playSingle (awaiting Archive.org
// resolution) breaks the gesture chain and iOS refuses to autoplay later.
const SILENT_WAV =
  "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAVFYAAFRWAAABAAgAZGF0YQAAAAA=";

// Props kept for backward-compat with Index.tsx — unused in the new editorial hero.
interface FeaturedSetlist {
  id: string;
  title: string;
  creator_id: string;
  era_id: string | null;
  upvote_count: number;
  play_count: number;
  creator_name?: string;
  era_name?: string;
  song_count?: number;
}

interface HeroSectionProps {
  showReturningSignIn?: boolean;
  featured?: FeaturedSetlist[];
}

const BUILDER_ROUTE = "/builder?wizard=true";

const HeroSection = (_props: HeroSectionProps) => {
  const navigate = useNavigate();
  const [communityCount, setCommunityCount] = useState<number | null>(null);
  const [spotlight, setSpotlight] = useState<HeroSpotlight | null>(null);
  const [heroLoading, setHeroLoading] = useState(false);
  const { playSetlist, playingSlot, stopPlayback, activeSetlistId } = useAudioPlayer();
  const isHeroPlaying = !!spotlight && activeSetlistId === spotlight.id && !!playingSlot;

  // Pull a live count of public community setlists to give the secondary CTA real pull.
  useEffect(() => {
    let cancelled = false;
    supabase
      .from("setlists")
      .select("id", { count: "exact", head: true })
      .eq("is_public", true)
      .then(({ count }) => {
        if (!cancelled && typeof count === "number") setCommunityCount(count);
      });
    return () => { cancelled = true; };
  }, []);

  // Daily rotating community spotlight.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: spot } = await supabase.rpc("get_hero_spotlight");
      const setlistId = Array.isArray(spot) && spot[0]?.setlist_id;
      if (!setlistId) return;

      const [{ data: sl }, { data: slotRows }] = await Promise.all([
        supabase.from("setlists").select("id, title, creator_id").eq("id", setlistId).maybeSingle(),
        supabase.from("setlist_slots").select("notes").eq("setlist_id", setlistId),
      ]);
      if (cancelled || !sl) return;

      const { data: profile } = await supabase
        .from("profiles").select("display_name").eq("user_id", sl.creator_id).maybeSingle();

      // Extract distinct years from "From YYYY-MM-DD …" notes for the meta line.
      const years = new Set<string>();
      (slotRows ?? []).forEach((r: { notes: string | null }) => {
        const m = r.notes?.match(/From\s+(\d{4})-/);
        if (m) years.add(m[1]);
      });
      const yearsLabel = years.size >= 2
        ? Array.from(years).sort().join(" · ")
        : years.size === 1 ? Array.from(years)[0] : null;

      if (cancelled) return;
      setSpotlight({
        id: sl.id,
        title: sl.title,
        creatorName: profile?.display_name ?? "A Deadhead",
        songCount: slotRows?.length ?? 0,
        yearsLabel,
      });
    })();
    return () => { cancelled = true; };
  }, []);

  const handleCta = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    trackCtaClick("hero_meet_cosmic_charlie", BUILDER_ROUTE);
    navigate(BUILDER_ROUTE);
  };

  const handleHeroPlay = async () => {
    if (!spotlight) return;
    if (isHeroPlaying) {
      stopPlayback();
      return;
    }
    try {
      const unlock = new Audio(SILENT_WAV);
      unlock.volume = 0;
      void unlock.play().catch(() => {});
    } catch {
      // best effort
    }
    trackCtaClick("hero_now_spinning_play", "audio");
    setHeroLoading(true);
    try {
      const { data: slots, error } = await supabase
        .from("setlist_slots")
        .select(
          "id, set_number, position, segue_to_next, song_id, notable_version_id, songs(id, title), notable_versions(id, song_id, show_date, archive_org_url, venue, city, era_id, rating, description)"
        )
        .eq("setlist_id", spotlight.id)
        .order("set_number")
        .order("position");
      if (error) throw error;
      const playable: PlayableSlot[] = (slots ?? [])
        .filter((s: any) => s.songs)
        .map((s: any) => ({
          id: s.id,
          song: { id: s.songs.id, title: s.songs.title },
          version: s.notable_versions ?? null,
          setNumber: s.set_number,
          position: s.position,
          segueToNext: s.segue_to_next ?? false,
          directTrackUrl: null,
        }));
      if (playable.length === 0) return;
      await playSetlist(playable, spotlight.id);
    } catch (err) {
      console.error("[Hero] playback failed", err);
    } finally {
      setHeroLoading(false);
    }
  };

  return (
    <>
      {/* Scoped editorial-hero styles. Tokens are local on purpose so the rest of the
          site's design system is untouched. */}
      <style>{`
        .ds-hero {
          --bg-deep: #0a0a0a;
          --bg-plaque: #0f0e08;
          --text-primary: #e8e4d0;
          --text-soft: #b0ac9a;
          --text-eyebrow: #b09e78;
          --accent-gold: #c9a84c;
          --accent-warm: #d4b558;
          --rule-faint: #2a2410;
          --rule-gold-30: rgba(201, 168, 76, 0.30);
          --rule-gold-40: rgba(201, 168, 76, 0.40);

          position: relative;
          width: 100%;
          min-height: 100dvh;
          background: var(--bg-deep);
          color: var(--text-primary);
          padding: 24px 24px 56px;
          overflow: hidden;
          isolation: isolate;
          font-family: 'DM Sans', system-ui, -apple-system, sans-serif;
        }
        @media (min-width: 640px) {
          .ds-hero { padding: 32px 40px 64px; }
        }
        @media (min-width: 960px) {
          .ds-hero { padding: 36px 60px 72px; }
        }

        /* Atmosphere — radial warmth */
        .ds-hero::before {
          content: "";
          position: absolute; inset: 0;
          background: radial-gradient(ellipse 80% 50% at 50% 35%,
            rgba(201, 168, 76, 0.04) 0%, transparent 60%);
          pointer-events: none; z-index: 0;
        }
        /* Atmosphere — film grain */
        .ds-hero::after {
          content: "";
          position: absolute; inset: 0;
          background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.78  0 0 0 0 0.72  0 0 0 0 0.55  0 0 0 0.5 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>");
          opacity: 0.5;
          mix-blend-mode: screen;
          pointer-events: none; z-index: 0;
        }

        .ds-hero__logo {
          position: relative; z-index: 2;
          display: inline-flex; align-items: center; gap: 10px;
        }
        .ds-hero__logo-mark {
          width: 22px; height: 22px;
          animation: ds-reel-spin 60s linear infinite;
          color: var(--accent-gold);
        }
        @keyframes ds-reel-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .ds-hero__logo-word {
          font-family: 'Playfair Display', Georgia, serif;
          font-weight: 700;
          font-style: normal;
          color: var(--accent-gold);
          text-transform: uppercase;
          letter-spacing: 0.10em;
          font-size: 16px;
          line-height: 1;
        }

        .ds-hero__content {
          position: relative; z-index: 1;
          margin: 0 auto;
          max-width: 560px;
          display: flex; flex-direction: column; align-items: center;
          text-align: center;
          padding-top: 28px;
        }
        @media (min-width: 640px) {
          .ds-hero__content { padding-top: 40px; }
        }

        .ds-hero__content > * {
          opacity: 0;
          transform: translateY(10px);
          animation: ds-rise 1s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
        }
        .ds-hero__content > *:nth-child(1) { animation-delay: 0.10s; }
        .ds-hero__content > *:nth-child(2) { animation-delay: 0.40s; }
        .ds-hero__content > *:nth-child(3) { animation-delay: 0.70s; }
        .ds-hero__content > *:nth-child(4) { animation-delay: 1.05s; }
        .ds-hero__content > *:nth-child(5) { animation-delay: 1.30s; }
        .ds-hero__content > *:nth-child(6) { animation-delay: 1.50s; }
        .ds-hero__content > *:nth-child(7) { animation-delay: 1.70s; }
        @keyframes ds-rise {
          to { opacity: 1; transform: translateY(0); }
        }

        .ds-hero__headline {
          font-family: 'Playfair Display', Georgia, serif;
          font-style: italic;
          font-weight: 400;
          color: var(--accent-gold);
          line-height: 1.18;
          font-size: 32px;
          margin: 0;
          max-width: 18em;
        }
        @media (min-width: 640px) { .ds-hero__headline { font-size: 48px; } }
        @media (min-width: 960px) { .ds-hero__headline { font-size: 56px; } }

        .ds-hero__chase {
          font-family: 'Playfair Display', Georgia, serif;
          font-style: italic;
          font-weight: 400;
          color: var(--text-primary);
          line-height: 1.55;
          font-size: 18px;
          margin: 24px 0 0;
          max-width: 24em;
        }
        @media (min-width: 640px) { .ds-hero__chase { font-size: 22px; margin-top: 28px; } }
        @media (min-width: 960px) { .ds-hero__chase { font-size: 24px; } }

        .ds-hero__stage {
          position: relative;
          width: 100%;
          max-width: 380px;
          aspect-ratio: 1 / 1;
          margin: 40px auto 0;
        }
        @media (min-width: 640px) {
          .ds-hero__stage { max-width: 440px; margin-top: 48px; }
        }
        @media (min-width: 960px) {
          .ds-hero__stage { max-width: 480px; }
        }

        .ds-hero__stage::before {
          content: "";
          position: absolute; inset: -8%;
          background: radial-gradient(circle at 50% 50%,
            rgba(201, 168, 76, 0.10) 0%,
            rgba(201, 168, 76, 0.04) 35%,
            transparent 70%);
          pointer-events: none;
          z-index: 0;
        }

        .ds-hero__portrait {
          position: relative;
          z-index: 1;
          width: 100%; height: 100%;
          background-image: image-set(
            url('/cosmic-charlie.webp') type('image/webp'),
            url('/cosmic-charlie.jpg') type('image/jpeg')
          );
          background-image: -webkit-image-set(
            url('/cosmic-charlie.webp') type('image/webp'),
            url('/cosmic-charlie.jpg') type('image/jpeg')
          );
          background-size: cover;
          background-position: center 35%;
          background-repeat: no-repeat;
          -webkit-mask-image: radial-gradient(circle at 50% 45%,
            #000 0%, #000 38%,
            rgba(0,0,0,0.92) 50%,
            rgba(0,0,0,0.6) 65%,
            rgba(0,0,0,0.2) 80%,
            transparent 95%);
          mask-image: radial-gradient(circle at 50% 45%,
            #000 0%, #000 38%,
            rgba(0,0,0,0.92) 50%,
            rgba(0,0,0,0.6) 65%,
            rgba(0,0,0,0.2) 80%,
            transparent 95%);
          animation: ds-charlie-breathe 9s ease-in-out infinite;
          transform-origin: 50% 45%;
        }
        @keyframes ds-charlie-breathe {
          0%, 100% { transform: scale(1); }
          50%      { transform: scale(1.018); }
        }

        .ds-hero__nameplate {
          margin-top: 8px;
          display: flex; flex-direction: column; align-items: center; gap: 8px;
        }
        .ds-hero__charlie-eyebrow {
          font-family: 'JetBrains Mono', ui-monospace, Menlo, monospace;
          font-size: 10px;
          letter-spacing: 0.28em;
          text-transform: uppercase;
          color: var(--text-eyebrow);
        }
        @media (min-width: 640px) { .ds-hero__charlie-eyebrow { font-size: 11px; } }
        .ds-hero__charlie-name {
          font-family: 'Playfair Display', Georgia, serif;
          font-style: italic;
          font-weight: 700;
          color: var(--accent-gold);
          font-size: 22px;
          line-height: 1.1;
        }
        @media (min-width: 640px) { .ds-hero__charlie-name { font-size: 26px; } }

        .ds-hero__cta-wrap {
          margin-top: 36px;
          width: 100%;
          display: flex; flex-direction: column; align-items: center; gap: 12px;
        }
        .ds-hero__cta-eyebrow {
          font-family: 'JetBrains Mono', ui-monospace, Menlo, monospace;
          font-size: 11px;
          letter-spacing: 0.26em;
          text-transform: uppercase;
          color: var(--text-eyebrow);
        }
        .ds-hero__cta-button {
          display: inline-flex; align-items: center; justify-content: center;
          height: 56px;
          width: 100%;
          max-width: 320px;
          background: var(--accent-gold);
          color: #0a0a0a;
          font-family: 'DM Sans', system-ui, sans-serif;
          font-weight: 500;
          font-size: 17px;
          border-radius: 2px;
          text-decoration: none;
          transition: background-color 0.2s ease, transform 0.05s ease;
          letter-spacing: 0.01em;
        }
        .ds-hero__cta-button:hover { background: var(--accent-warm); }
        .ds-hero__cta-button:active { transform: translateY(1px); }
        .ds-hero__cta-button:focus-visible {
          outline: 2px solid var(--accent-warm);
          outline-offset: 3px;
        }
        .ds-hero__cta-caption {
          font-family: 'JetBrains Mono', ui-monospace, Menlo, monospace;
          font-size: 12px;
          color: var(--accent-gold);
          opacity: 0.7;
          margin: 0;
          text-transform: lowercase;
        }

        .ds-hero__cta-divider {
          display: flex; align-items: center; gap: 12px;
          width: 100%; max-width: 320px;
          margin-top: 20px;
          color: var(--text-eyebrow);
          font-family: 'JetBrains Mono', ui-monospace, Menlo, monospace;
          font-size: 10px;
          letter-spacing: 0.3em;
          text-transform: uppercase;
        }
        .ds-hero__cta-divider::before,
        .ds-hero__cta-divider::after {
          content: "";
          flex: 1;
          height: 1px;
          background: var(--rule-gold-30);
        }

        .ds-hero__cta-secondary {
          position: relative;
          display: inline-flex; align-items: center; justify-content: center; gap: 12px;
          height: 60px;
          width: 100%;
          max-width: 320px;
          background: linear-gradient(180deg, rgba(201, 168, 76, 0.10), rgba(201, 168, 76, 0.04));
          color: var(--accent-warm);
          font-family: 'DM Sans', system-ui, sans-serif;
          font-weight: 600;
          font-size: 16px;
          border: 1px solid var(--accent-gold);
          border-radius: 4px;
          text-decoration: none;
          transition: background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease;
          letter-spacing: 0.01em;
          box-shadow: 0 0 0 rgba(201, 168, 76, 0);
          overflow: hidden;
        }
        .ds-hero__cta-secondary::before {
          content: "";
          position: absolute; inset: 0;
          background: radial-gradient(120% 80% at 50% 100%, rgba(201, 168, 76, 0.18), transparent 70%);
          opacity: 0.7;
          pointer-events: none;
          animation: ds-hero-pulse 3.6s ease-in-out infinite;
        }
        @keyframes ds-hero-pulse {
          0%, 100% { opacity: 0.45; }
          50% { opacity: 0.85; }
        }
        .ds-hero__cta-secondary:hover {
          background: linear-gradient(180deg, rgba(201, 168, 76, 0.20), rgba(201, 168, 76, 0.08));
          border-color: var(--accent-warm);
          color: var(--accent-warm);
          transform: translateY(-1px);
          box-shadow: 0 6px 24px rgba(201, 168, 76, 0.18);
        }
        .ds-hero__cta-secondary:focus-visible {
          outline: 2px solid var(--accent-warm);
          outline-offset: 3px;
        }
        .ds-hero__cta-secondary-arrow {
          display: inline-block;
          transition: transform 0.2s ease;
        }
        .ds-hero__cta-secondary:hover .ds-hero__cta-secondary-arrow {
          transform: translateX(3px);
        }
        .ds-hero__cta-eq {
          display: inline-flex; align-items: flex-end; gap: 2px;
          height: 14px;
          position: relative; z-index: 1;
        }
        .ds-hero__cta-eq span {
          width: 2px;
          background: var(--accent-warm);
          border-radius: 1px;
          animation: ds-hero-eq 1.1s ease-in-out infinite;
          transform-origin: bottom;
        }
        .ds-hero__cta-eq span:nth-child(1) { animation-delay: 0s; height: 6px; }
        .ds-hero__cta-eq span:nth-child(2) { animation-delay: 0.18s; height: 12px; }
        .ds-hero__cta-eq span:nth-child(3) { animation-delay: 0.32s; height: 8px; }
        .ds-hero__cta-eq span:nth-child(4) { animation-delay: 0.5s; height: 14px; }
        @keyframes ds-hero-eq {
          0%, 100% { transform: scaleY(0.5); }
          50% { transform: scaleY(1); }
        }
        .ds-hero__cta-count {
          display: inline-flex; align-items: center; gap: 6px;
          margin-top: 10px;
          font-family: 'JetBrains Mono', ui-monospace, Menlo, monospace;
          font-size: 11px;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: var(--accent-gold);
        }
        .ds-hero__cta-count-dot {
          width: 6px; height: 6px; border-radius: 999px;
          background: var(--accent-warm);
          box-shadow: 0 0 8px rgba(201, 168, 76, 0.7);
          animation: ds-hero-pulse 2s ease-in-out infinite;
        }

        .ds-hero__credit {
          margin-top: 56px;
          width: 100%;
          background: var(--bg-plaque);
          border-top: 1px solid var(--rule-gold-40);
          border-bottom: 1px solid var(--rule-gold-40);
          padding: 28px 20px;
          display: flex; flex-direction: column; align-items: center; gap: 14px;
        }
        @media (min-width: 640px) { .ds-hero__credit { padding: 32px 28px; } }

        .ds-hero__credit-eyebrow {
          font-family: 'JetBrains Mono', ui-monospace, Menlo, monospace;
          font-size: 11px;
          letter-spacing: 0.22em;
          text-transform: uppercase;
          color: var(--text-eyebrow);
        }
        .ds-hero__credit-attribution {
          font-family: 'Playfair Display', Georgia, serif;
          font-style: italic;
          font-weight: 400;
          font-size: 18px;
          line-height: 1.45;
          color: var(--text-primary);
          margin: 0;
        }
        @media (min-width: 640px) { .ds-hero__credit-attribution { font-size: 22px; } }

        .ds-hero__archive-link {
          color: var(--accent-gold);
          text-decoration: none;
          border-bottom: 1px solid var(--rule-gold-40);
          padding-bottom: 1px;
          transition: color 0.2s ease, border-color 0.2s ease;
          white-space: nowrap;
        }
        .ds-hero__archive-link:hover { color: var(--accent-warm); border-color: var(--accent-warm); }
        .ds-hero__arrow {
          display: inline-block;
          margin-left: 2px;
          transition: transform 0.2s ease;
        }
        .ds-hero__archive-link:hover .ds-hero__arrow {
          transform: translate(2px, -2px);
        }
        .ds-hero__credit-body {
          font-family: 'DM Sans', system-ui, sans-serif;
          font-weight: 300;
          font-size: 14px;
          line-height: 1.65;
          color: var(--text-soft);
          margin: 0;
          max-width: 38em;
        }
        @media (min-width: 640px) { .ds-hero__credit-body { font-size: 15px; } }

        .ds-hero__tagline {
          margin-top: 36px;
          font-family: 'Caveat', cursive;
          font-style: italic;
          font-size: 20px;
          line-height: 1.2;
          color: var(--text-primary);
        }
        @media (min-width: 640px) { .ds-hero__tagline { font-size: 22px; } }

        /* Subhead — clarifies what the site actually does. */
        .ds-hero__subhead {
          font-family: 'DM Sans', system-ui, sans-serif;
          font-weight: 400;
          font-size: 14px;
          line-height: 1.55;
          color: var(--text-soft);
          margin: 18px 0 0;
          max-width: 30em;
          letter-spacing: 0.01em;
        }
        @media (min-width: 640px) { .ds-hero__subhead { font-size: 15px; } }
        .ds-hero__subhead strong {
          color: var(--text-primary);
          font-weight: 500;
        }

        /* Now Spinning cassette — the proof-by-music block. */
        .ds-hero__cassette {
          width: 100%;
          max-width: 420px;
          margin: 32px auto 0;
          background: linear-gradient(180deg, #14110a 0%, #0d0b06 100%);
          border: 1px solid var(--rule-gold-40);
          border-radius: 8px;
          padding: 18px 18px 16px;
          display: flex;
          align-items: center;
          gap: 16px;
          text-align: left;
          box-shadow: 0 12px 36px rgba(0,0,0,0.5), inset 0 1px 0 rgba(201,168,76,0.08);
          position: relative;
          overflow: hidden;
        }
        @media (min-width: 640px) {
          .ds-hero__cassette { padding: 22px 22px 20px; gap: 20px; }
        }
        .ds-hero__cassette-eyebrow-row {
          position: absolute;
          top: 8px; left: 18px; right: 18px;
          display: flex; justify-content: space-between; align-items: center;
          font-family: 'JetBrains Mono', ui-monospace, Menlo, monospace;
          font-size: 10px;
          letter-spacing: 0.24em;
          text-transform: uppercase;
          color: var(--text-eyebrow);
        }
        .ds-hero__cassette-live {
          display: inline-flex; align-items: center; gap: 6px;
          color: var(--accent-gold);
        }
        .ds-hero__cassette-live-dot {
          width: 6px; height: 6px; border-radius: 999px;
          background: var(--accent-warm);
          box-shadow: 0 0 8px rgba(201, 168, 76, 0.7);
          animation: ds-hero-pulse 2s ease-in-out infinite;
        }
        .ds-hero__play-btn {
          flex-shrink: 0;
          width: 64px; height: 64px;
          border-radius: 999px;
          background: var(--accent-gold);
          color: #0a0a0a;
          border: none;
          display: inline-flex; align-items: center; justify-content: center;
          cursor: pointer;
          transition: background-color 0.15s ease, transform 0.05s ease, box-shadow 0.2s ease;
          box-shadow: 0 6px 20px rgba(201, 168, 76, 0.35);
          margin-top: 12px;
        }
        @media (min-width: 640px) {
          .ds-hero__play-btn { width: 72px; height: 72px; }
        }
        .ds-hero__play-btn:hover { background: var(--accent-warm); }
        .ds-hero__play-btn:active { transform: scale(0.96); }
        .ds-hero__play-btn:focus-visible {
          outline: 2px solid var(--accent-warm);
          outline-offset: 4px;
        }
        .ds-hero__play-btn svg { width: 26px; height: 26px; }
        .ds-hero__cassette-meta {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 4px;
          margin-top: 14px;
        }
        .ds-hero__cassette-song {
          font-family: 'Playfair Display', Georgia, serif;
          font-style: italic;
          font-weight: 700;
          font-size: 18px;
          line-height: 1.2;
          color: var(--accent-gold);
          margin: 0;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        @media (min-width: 640px) { .ds-hero__cassette-song { font-size: 20px; } }
        .ds-hero__cassette-show {
          font-family: 'DM Sans', system-ui, sans-serif;
          font-size: 13px;
          line-height: 1.4;
          color: var(--text-primary);
          margin: 0;
        }
        .ds-hero__cassette-venue {
          font-family: 'DM Sans', system-ui, sans-serif;
          font-size: 12px;
          line-height: 1.4;
          color: var(--text-soft);
          margin: 0;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .ds-hero__cassette-hint {
          margin-top: 10px;
          font-family: 'JetBrains Mono', ui-monospace, Menlo, monospace;
          font-size: 11px;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: var(--text-eyebrow);
          text-align: center;
        }

        @media (prefers-reduced-motion: reduce) {
          .ds-hero__logo-mark,
          .ds-hero__portrait { animation: none !important; }
          .ds-hero__content > * {
            animation: none !important;
            opacity: 1 !important;
            transform: none !important;
          }
        }
      `}</style>

      <section className="ds-hero" aria-label="Welcome to Dead Set">
        <div className="ds-hero__logo">
          <svg
            className="ds-hero__logo-mark"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.25" />
            <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.25" />
            <circle cx="12" cy="12" r="0.9" fill="currentColor" />
            <line x1="12" y1="2.5" x2="12" y2="5" stroke="currentColor" strokeWidth="1" />
            <line x1="12" y1="19" x2="12" y2="21.5" stroke="currentColor" strokeWidth="1" />
            <line x1="2.5" y1="12" x2="5" y2="12" stroke="currentColor" strokeWidth="1" />
            <line x1="19" y1="12" x2="21.5" y2="12" stroke="currentColor" strokeWidth="1" />
          </svg>
          <span className="ds-hero__logo-word">Dead Set</span>
        </div>

        <div className="ds-hero__content">
          <h1 className="ds-hero__headline">Every Deadhead knows the feeling.</h1>

          <p className="ds-hero__subhead">
            Build setlists from <strong>thousands of live recordings</strong> on
            the Internet Archive. Press play — no signup required.
          </p>

          <p className="ds-hero__chase">
            That song. That night. That version you'll never forget —
            and the next one waiting to be found, inhaled, and passed on.
          </p>

          {/* Now Spinning — proof-by-music. One tap, one ear, you're in. */}
          <div className="ds-hero__cassette" role="group" aria-label={`Now Spinning — ${HERO_SETLIST_TITLE}`}>
            <div className="ds-hero__cassette-eyebrow-row" aria-hidden="true">
              <span className="ds-hero__cassette-live">
                <span className="ds-hero__cassette-live-dot" />
                {isHeroPlaying ? "Now Spinning" : heroLoading ? "Cueing up…" : "Press Play"}
              </span>
              <span>18 SONGS · 7 YEARS</span>
            </div>

            <button
              type="button"
              onClick={handleHeroPlay}
              disabled={heroLoading}
              className="ds-hero__play-btn"
              aria-label={isHeroPlaying ? `Pause ${HERO_SETLIST_TITLE}` : `Play ${HERO_SETLIST_TITLE}`}
            >
              {isHeroPlaying ? (
                <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <rect x="6" y="5" width="4" height="14" rx="1" />
                  <rect x="14" y="5" width="4" height="14" rx="1" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M8 5.14v13.72c0 .79.87 1.27 1.54.85l10.79-6.86a1 1 0 0 0 0-1.7L9.54 4.29A1 1 0 0 0 8 5.14z" />
                </svg>
              )}
            </button>

            <div className="ds-hero__cassette-meta">
              <p className="ds-hero__cassette-song">{HERO_SETLIST_TITLE}</p>
              <p className="ds-hero__cassette-show">{HERO_SETLIST_DATE}</p>
              <p className="ds-hero__cassette-venue">{HERO_SETLIST_VENUE}</p>
            </div>
          </div>
          <p className="ds-hero__cassette-hint">
            {isHeroPlaying ? "the music never stops" : "one date, seven decades of Dead"}
          </p>

          <div className="ds-hero__stage" aria-hidden="true">
            <div
              className="ds-hero__portrait"
              role="img"
              aria-label="Cosmic Charlie, your way in"
            />
          </div>

          <div className="ds-hero__nameplate">
            <div className="ds-hero__charlie-eyebrow">your way in</div>
            <div className="ds-hero__charlie-name">Cosmic Charlie</div>
          </div>

          <div className="ds-hero__cta-wrap">
            <div className="ds-hero__cta-eyebrow">Need a Miracle?</div>
            <a
              href={BUILDER_ROUTE}
              onClick={handleCta}
              className="ds-hero__cta-button"
            >
              Meet Cosmic Charlie
            </a>
            <p className="ds-hero__cta-caption">he's been waiting for you</p>

            <div className="ds-hero__cta-divider" aria-hidden="true">
              <span>or</span>
            </div>

            <a
              href="/browse"
              onClick={(e) => {
                e.preventDefault();
                trackCtaClick("hero_browse_community", "/browse");
                navigate("/browse");
              }}
              className="ds-hero__cta-secondary"
            >
              <span className="ds-hero__cta-eq" aria-hidden="true">
                <span /><span /><span /><span />
              </span>
              <span>Browse Community Setlists</span>
              <span className="ds-hero__cta-secondary-arrow" aria-hidden="true">→</span>
            </a>
            <p className="ds-hero__cta-count">
              <span className="ds-hero__cta-count-dot" aria-hidden="true" />
              {communityCount !== null
                ? `${communityCount.toLocaleString()} setlists spinning now`
                : "what other heads are spinning"}
            </p>
          </div>

          <aside
            className="ds-hero__credit"
            aria-label="A love letter to the Internet Archive"
          >
            <div className="ds-hero__credit-eyebrow">A love letter to</div>
            <p className="ds-hero__credit-attribution">
              the tapers, the traders, and the{" "}
              <a
                href="https://archive.org/details/GratefulDead"
                className="ds-hero__archive-link"
                target="_blank"
                rel="noopener noreferrer"
              >
                Internet Archive<span className="ds-hero__arrow">↗</span>
              </a>
              .
            </p>
            <p className="ds-hero__credit-body">
              Without their fifty years of devotion, none of this would exist.
              The music lives at archive.org — and the tradition lives in the sharing.
              Dead Set is just one more way to pass it on.
            </p>
          </aside>

          <p className="ds-hero__tagline">Wake. Now. Discover.</p>
        </div>
      </section>
    </>
  );
};

export default HeroSection;

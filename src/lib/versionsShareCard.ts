/**
 * The image a song's versions page posts to Instagram.
 *
 * Drawn on a canvas rather than screenshotted, because the page is a reading
 * surface and a feed is not: at thumbnail size a screenshot of cards and
 * chips is mush. What survives being scrolled past is the thing people
 * already respond to on the page — the song's name, and the span from the
 * first time they played it to the last.
 *
 * 1080x1350 is Instagram's tallest feed size. It crops safely to a square
 * and sits inside a story without reframing, so one asset covers both.
 */

export interface CardNight {
  date: string;
  venue?: string | null;
  city?: string | null;
}

export interface VersionsCardInput {
  songTitle: string;
  timesPlayed?: number | null;
  firstPlayed?: string | null;
  lastPlayed?: string | null;
  /** The nights on the page — dots on the rail, and the list beneath it. */
  nights?: CardNight[];
}

/**
 * Canvas does NOT trigger font loading. Drawing with a family the document has
 * not already loaded silently falls back, which is how the first render of
 * this card came out in Times instead of Sancreek and nobody would have known
 * until it was on Instagram. Load them explicitly, and carry on with the
 * fallbacks if the network says no.
 */
const FACES = [
  "104px 'Sancreek'",
  "62px 'IBM Plex Mono'",
  "52px 'Caveat'",
  "34px 'Special Elite'",
  "26px 'DM Sans'",
];

export const loadCardFonts = async (): Promise<void> => {
  if (typeof document === "undefined" || !document.fonts) return;
  await Promise.all(
    FACES.map((f) => document.fonts.load(f).catch(() => undefined)),
  );
};

const W = 1080;
const H = 1350;

/** The brand, as the canvas needs it — index.css is HSL and ctx wants hex. */
const INK = "#23221f";
const MAROON = "#471414";
const MAROON_DEEP = "#2b0b0b";
const CREAM = "#f4ecd6";
const GOLD = "#d4af37";
const BLUE = "#2f4f7f";
const CLAY = "#c24a33";

const yearOf = (d?: string | null) => (d ? Number(d.slice(0, 4)) : null);

const fmt = (d?: string | null): string | null => {
  if (!d) return null;
  const parsed = new Date(`${d.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return d;
  return parsed.toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric", timeZone: "UTC",
  });
};

/** Shrink until it fits. A long title must never run off the card. */
const fitText = (
  ctx: CanvasRenderingContext2D,
  text: string,
  family: string,
  startPx: number,
  maxWidth: number,
  minPx = 40,
): number => {
  let px = startPx;
  ctx.font = `${px}px ${family}`;
  while (ctx.measureText(text).width > maxWidth && px > minPx) {
    px -= 4;
    ctx.font = `${px}px ${family}`;
  }
  return px;
};

/**
 * Render the card. Returns a PNG data URL, or null where there is no canvas
 * to draw on (a test runner, an old browser) — the caller falls back to a
 * caption-only share rather than failing.
 */
export const renderVersionsCard = (input: VersionsCardInput): string | null => {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  // ── ground ──
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, MAROON);
  bg.addColorStop(1, MAROON_DEEP);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // ── the cream sheet, the way every reading surface in the app looks ──
  const M = 72;
  const cardY = 150;
  const cardH = H - cardY - 210;
  ctx.fillStyle = CREAM;
  ctx.fillRect(M, cardY, W - M * 2, cardH);
  ctx.strokeStyle = "rgba(35,34,31,0.18)";
  ctx.lineWidth = 2;
  ctx.strokeRect(M, cardY, W - M * 2, cardH);

  // ── masthead ──
  ctx.fillStyle = CREAM;
  ctx.font = "34px 'Special Elite', 'Courier Prime', monospace";
  ctx.letterSpacing = "6px";
  ctx.textAlign = "center";
  ctx.fillText("DEAD-SET.ORG", W / 2, 90);
  ctx.letterSpacing = "0px";

  const innerL = M + 56;
  const innerW = W - (M + 56) * 2;
  let y = cardY + 110;

  ctx.textAlign = "left";
  ctx.fillStyle = CLAY;
  ctx.font = "26px 'Special Elite', 'Courier Prime', monospace";
  ctx.letterSpacing = "5px";
  ctx.fillText("EVERY VERSION WORTH KNOWING", innerL, y);
  ctx.letterSpacing = "0px";

  // ── the song ──
  y += 100;
  const titlePx = fitText(ctx, input.songTitle, "'Sancreek', 'Playfair Display', serif", 104, innerW, 48);
  ctx.fillStyle = INK;
  ctx.font = `${titlePx}px 'Sancreek', 'Playfair Display', serif`;
  ctx.fillText(input.songTitle, innerL, y);

  // ── the life of it ──
  y += 86;
  if (input.timesPlayed != null) {
    ctx.fillStyle = INK;
    ctx.font = "62px 'IBM Plex Mono', ui-monospace, monospace";
    const n = String(input.timesPlayed);
    ctx.fillText(n, innerL, y);
    const nW = ctx.measureText(n).width;
    ctx.fillStyle = "rgba(35,34,31,0.65)";
    ctx.font = "28px 'Special Elite', 'Courier Prime', monospace";
    ctx.letterSpacing = "4px";
    ctx.fillText("TIMES", innerL + nW + 18, y);
    ctx.letterSpacing = "0px";
  }

  // ── first played to last played, the thing people actually love ──
  const first = fmt(input.firstPlayed);
  const last = fmt(input.lastPlayed);
  if (first && last) {
    y += 96;
    ctx.fillStyle = CLAY;
    ctx.font = "24px 'Special Elite', 'Courier Prime', monospace";
    ctx.letterSpacing = "4px";
    ctx.fillText("FIRST TIME PLAYED", innerL, y);
    ctx.textAlign = "right";
    ctx.fillText("LAST TIME PLAYED", innerL + innerW, y);
    ctx.letterSpacing = "0px";

    y += 62;
    ctx.fillStyle = BLUE;
    ctx.font = "52px 'Caveat', cursive";
    ctx.textAlign = "left";
    ctx.fillText(first, innerL, y);
    ctx.textAlign = "right";
    ctx.fillText(last, innerL + innerW, y);
    ctx.textAlign = "left";

    // the rail
    y += 54;
    ctx.strokeStyle = "rgba(35,34,31,0.3)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(innerL, y);
    ctx.lineTo(innerL + innerW, y);
    ctx.stroke();

    ctx.fillStyle = CLAY;
    ctx.fillRect(innerL - 2, y - 18, 6, 36);
    ctx.fillRect(innerL + innerW - 4, y - 18, 6, 36);

    const startYear = yearOf(input.firstPlayed);
    const endYear = yearOf(input.lastPlayed);
    if (startYear && endYear && endYear > startYear) {
      const span = endYear - startYear;
      const railYears = (input.nights ?? [])
        .map((n) => yearOf(n.date))
        .filter((n): n is number => n != null);
      for (const yr of railYears) {
        if (yr < startYear || yr > endYear) continue;
        const x = innerL + ((yr - startYear) / span) * innerW;
        ctx.beginPath();
        ctx.arc(x, y, 13, 0, Math.PI * 2);
        ctx.fillStyle = BLUE;
        ctx.fill();
      }
    }
  }

  // ── the nights ──
  // The first draft left the bottom half of the card empty cream. On a page
  // whose promise is "every version worth knowing", the versions are the
  // thing worth printing.
  // How many rows actually fit, rather than a guessed slice: five overflowed
  // the card and the last night rendered half-clipped through the bottom edge.
  const ROW_H = 76;
  const cardBottom = cardY + cardH;
  const nights = (input.nights ?? []).filter((n) => n.date);
  if (nights.length) {
    y += 92;
    ctx.fillStyle = CLAY;
    ctx.font = "24px 'Special Elite', 'Courier Prime', monospace";
    ctx.letterSpacing = "4px";
    ctx.fillText("NIGHTS WORTH THE EVENING", innerL, y);
    ctx.letterSpacing = "0px";

    y += 24;
    for (const n of nights) {
      // Stop before the edge. A row that does not fit is not drawn at all.
      if (y + ROW_H + 30 > cardBottom) break;
      y += ROW_H;
      ctx.fillStyle = BLUE;
      ctx.font = "46px 'Caveat', cursive";
      const dateStr = fmt(n.date) ?? n.date;
      ctx.fillText(dateStr, innerL, y);
      const dW = ctx.measureText(dateStr).width;

      const place = [n.venue, n.city].filter(Boolean).join(" · ");
      if (place) {
        ctx.fillStyle = "rgba(35,34,31,0.62)";
        ctx.font = "25px 'Special Elite', 'Courier Prime', monospace";
        const maxPlace = innerW - dW - 28;
        let label = place;
        while (ctx.measureText(label).width > maxPlace && label.length > 4) {
          label = label.slice(0, -2);
        }
        if (label !== place) label = `${label}…`;
        ctx.fillText(label, innerL + dW + 28, y);
      }

      ctx.strokeStyle = "rgba(35,34,31,0.12)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(innerL, y + 22);
      ctx.lineTo(innerL + innerW, y + 22);
      ctx.stroke();
    }
  }

  // ── the credit, never buried ──
  ctx.textAlign = "center";
  ctx.fillStyle = GOLD;
  ctx.font = "30px 'Special Elite', 'Courier Prime', monospace";
  ctx.letterSpacing = "3px";
  ctx.fillText("PICK A SONG YOU LOVE", W / 2, H - 132);
  ctx.letterSpacing = "0px";

  ctx.fillStyle = "rgba(244,236,214,0.72)";
  ctx.font = "26px 'DM Sans', system-ui, sans-serif";
  ctx.fillText(
    "Built on the shoulders of the tapers, the traders & the Internet Archive",
    W / 2,
    H - 78,
  );

  return canvas.toDataURL("image/png");
};

import { useRef, useEffect, useCallback } from "react";

/* ── Era palettes ── */
const ERA_PALETTES = {
  primal: { label: "1965–1969", name: "The Acid Years", bg: "#EEE9DB", primary: "#B22B30", accent: "#EB9926", sub: "#7D6129" },
  golden: { label: "1970–1974", name: "The Golden Road", bg: "#F4F1E5", primary: "#1E4F8E", accent: "#D6A826", sub: "#665523" },
  hiatus: { label: "1975–1979", name: "The Comeback", bg: "#EAF0E4", primary: "#266133", accent: "#C98B2B", sub: "#47692B" },
  eighties: { label: "1980–1989", name: "The Long Strange Trip", bg: "#E5EAF1", primary: "#2B3699", accent: "#C73530", sub: "#333D85" },
  nineties: { label: "1990–1995", name: "The Final Years", bg: "#F0E8DF", primary: "#823026", accent: "#336630", sub: "#703320" },
} as const;

type EraKey = keyof typeof ERA_PALETTES;

function getEra(year: number): EraKey {
  if (year <= 1969) return "primal";
  if (year <= 1974) return "golden";
  if (year <= 1979) return "hiatus";
  if (year <= 1989) return "eighties";
  return "nineties";
}

/* ── State designs ── */
const STATE_DESIGNS: Record<string, { full: string; topColor: string }> = {
  CA: { full: "CALIFORNIA", topColor: "#B82232" },
  NY: { full: "NEW YORK", topColor: "#1E3880" },
  OR: { full: "OREGON", topColor: "#266133" },
  TX: { full: "TEXAS", topColor: "#992626" },
  OH: { full: "OHIO", topColor: "#384F8E" },
  MA: { full: "MASSACHUSETTS", topColor: "#264287" },
  IL: { full: "ILLINOIS", topColor: "#264287" },
  CO: { full: "COLORADO", topColor: "#266133" },
  WA: { full: "WASHINGTON", topColor: "#264260" },
  GA: { full: "GEORGIA", topColor: "#8E2626" },
  NJ: { full: "NEW JERSEY", topColor: "#264287" },
  PA: { full: "PENNSYLVANIA", topColor: "#264287" },
  NC: { full: "NORTH CAROLINA", topColor: "#264287" },
  MD: { full: "MARYLAND", topColor: "#992626" },
  CT: { full: "CONNECTICUT", topColor: "#264287" },
  INTL: { full: "CALIFORNIA", topColor: "#B82232" },
};

const STATE_MAP: Record<string, string> = {
  California: "CA", "New York": "NY", Oregon: "OR", Texas: "TX",
  Ohio: "OH", Massachusetts: "MA", Illinois: "IL", Colorado: "CO",
  Washington: "WA", Georgia: "GA", "New Jersey": "NJ", Pennsylvania: "PA",
  "North Carolina": "NC", Maryland: "MD", Connecticut: "CT",
};

function getStateCode(venueState: string): string {
  return STATE_MAP[venueState] ?? venueState ?? "INTL";
}

/* ── Plate text formatting ── */
const STOP_WORDS = new Set(["OF", "THE", "IN", "AT", "A", "AN", "AND", "TO", "FOR", "ON"]);

function formatPlateText(name: string): [string, string | null] {
  const words = name.toUpperCase().split(/\s+/).filter(w => !STOP_WORDS.has(w));
  if (words.length >= 2) {
    return [words[0].slice(0, 6), words[1].slice(0, 5)];
  }
  return [words[0]?.slice(0, 8) || "DEAD", null];
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

/* ── Hex to rgba helper ── */
function hexRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/* ── Canvas draw ── */
function drawPlate(
  canvas: HTMLCanvasElement,
  era: typeof ERA_PALETTES[EraKey],
  state: typeof STATE_DESIGNS["CA"],
  plateLeft: string,
  plateRight: string | null,
  showDate: string,
  venueName: string,
  eraYear: number,
) {
  const W = canvas.width;
  const H = canvas.height;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, W, H);

  const r = 28 * (W / 1400);

  // 1 — Drop shadow
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.16)";
  ctx.shadowOffsetX = 8 * (W / 1400);
  ctx.shadowOffsetY = 8 * (W / 1400);
  ctx.shadowBlur = 16 * (W / 1400);
  ctx.beginPath();
  ctx.roundRect(0, 0, W, H, r);
  ctx.fillStyle = era.bg;
  ctx.fill();
  ctx.restore();

  // 2 — Plate body
  ctx.beginPath();
  ctx.roundRect(0, 0, W, H, r);
  ctx.fillStyle = era.bg;
  ctx.fill();

  // 3 — Emboss edges
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(0, 0, W, H, r);
  ctx.clip();
  const emboss = 3.5 * (W / 1400);
  ctx.strokeStyle = "rgba(255,255,255,0.38)";
  ctx.lineWidth = emboss;
  ctx.beginPath();
  ctx.moveTo(0, H); ctx.lineTo(0, 0); ctx.lineTo(W, 0);
  ctx.stroke();
  ctx.strokeStyle = "rgba(0,0,0,0.14)";
  ctx.beginPath();
  ctx.moveTo(W, 0); ctx.lineTo(W, H); ctx.lineTo(0, H);
  ctx.stroke();
  ctx.restore();

  // 4 — Inner recess
  const inset = 14 * (W / 1400);
  ctx.beginPath();
  ctx.roundRect(inset, inset, W - inset * 2, H - inset * 2, 18 * (W / 1400));
  ctx.fillStyle = "rgba(0,0,0,0.035)";
  ctx.fill();

  // 5 — Sunrise arc
  const sunR = H * 0.285;
  const sunCx = W / 2;
  const sunCy = H * 0.22;
  const grad = ctx.createRadialGradient(sunCx, sunCy, 0, sunCx, sunCy, sunR);
  grad.addColorStop(0, hexRgba(era.accent, 0.32));
  grad.addColorStop(1, hexRgba(era.accent, 0));
  ctx.save();
  ctx.beginPath();
  ctx.arc(sunCx, sunCy, sunR, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.restore();

  // 6 — Three horizontal rules
  const ruleAlphas = [0.78, 0.50, 0.28];
  const ruleWidths = [5, 3.2, 1.8];
  const ruleYs = [0.202, 0.227, 0.252];
  ruleYs.forEach((yPct, i) => {
    ctx.strokeStyle = hexRgba(era.accent, ruleAlphas[i]);
    ctx.lineWidth = ruleWidths[i] * (W / 1400);
    ctx.beginPath();
    ctx.moveTo(W * 0.052, H * yPct);
    ctx.lineTo(W * 0.948, H * yPct);
    ctx.stroke();
  });

  // 7 — State name
  const stateFont = Math.round(H * 0.092);
  ctx.font = `700 ${stateFont}px "Playfair Display", serif`;
  ctx.fillStyle = state.topColor;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(state.full, W / 2, H * 0.162);

  // 8 — Screw holes
  const screwPositions = [
    [W * 0.068, H * 0.49],
    [W * 0.932, H * 0.49],
    [W * 0.068, H * 0.84],
    [W * 0.932, H * 0.84],
  ];
  screwPositions.forEach(([x, y]) => {
    const sr = H * 0.026;
    ctx.beginPath();
    ctx.arc(x, y, sr, 0, Math.PI * 2);
    ctx.fillStyle = hexRgba(era.primary, 0.08);
    ctx.fill();
    ctx.strokeStyle = hexRgba(era.primary, 0.12);
    ctx.lineWidth = 1;
    ctx.stroke();
    // slot
    ctx.beginPath();
    ctx.moveTo(x - sr * 0.5, y);
    ctx.lineTo(x + sr * 0.5, y);
    ctx.strokeStyle = hexRgba(era.primary, 0.18);
    ctx.lineWidth = 2 * (W / 1400);
    ctx.stroke();
  });

  // 9 + 10 — Main plate text with lightning bolt
  const mainFontSize = Math.round(H * 0.295);
  ctx.font = `700 ${mainFontSize}px "Playfair Display", serif`;
  ctx.fillStyle = hexRgba(era.primary, 0.93);
  ctx.textBaseline = "alphabetic";
  const mainY = H * 0.765;

  if (plateRight) {
    const leftWidth = ctx.measureText(plateLeft).width;
    const rightWidth = ctx.measureText(plateRight).width;
    const boltW = mainFontSize * 0.35;
    const totalW = leftWidth + boltW + rightWidth;
    const startX = (W - totalW) / 2;

    ctx.textAlign = "left";
    ctx.fillText(plateLeft, startX, mainY);

    // Lightning bolt
    const boltX = startX + leftWidth + boltW / 2;
    const boltSize = mainFontSize * 0.5;
    drawBolt(ctx, boltX, mainY - mainFontSize * 0.4, boltSize, hexRgba(era.accent, 0.88));

    ctx.fillStyle = hexRgba(era.primary, 0.93);
    ctx.fillText(plateRight, startX + leftWidth + boltW, mainY);
  } else {
    ctx.textAlign = "center";
    ctx.fillText(plateLeft, W / 2, mainY);
  }

  // 11 — Bottom tagline
  const tagFontSize = Math.round(H * 0.048);
  ctx.font = `italic 400 ${tagFontSize}px "Playfair Display", serif`;
  ctx.fillStyle = hexRgba(era.sub, 0.82);
  ctx.textAlign = "center";
  const tagline = showDate && venueName ? `${formatDate(showDate)}  ·  ${venueName}` : venueName || "";
  ctx.fillText(tagline, W / 2, H * 0.893);

  // 12 — Era label top-right
  const eraFontSize = Math.round(H * 0.035);
  ctx.font = `400 ${eraFontSize}px "JetBrains Mono", monospace`;
  ctx.fillStyle = hexRgba(era.primary, 0.28);
  ctx.textAlign = "right";
  ctx.fillText(era.label, W * 0.96, H * 0.06);

  // 12b — "DEAD SET" branding bottom-left
  const brandFontSize = Math.round(H * 0.03);
  ctx.font = `600 ${brandFontSize}px "JetBrains Mono", monospace`;
  ctx.fillStyle = hexRgba(era.primary, 0.22);
  ctx.textAlign = "left";
  ctx.letterSpacing = `${brandFontSize * 0.3}px`;
  ctx.fillText("DEAD SET", W * 0.04, H * 0.96);
  ctx.letterSpacing = "0px";

  // 13 — Plate wear (scratches)
  for (let i = 0; i < 55; i++) {
    const sx = Math.random() * W;
    const sy = Math.random() * H;
    const len = 4 + Math.random() * 18;
    const angle = Math.random() * Math.PI;
    ctx.strokeStyle = hexRgba(era.primary, 0.02 + Math.random() * 0.03);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(sx + Math.cos(angle) * len * (W / 1400), sy + Math.sin(angle) * len * (W / 1400));
    ctx.stroke();
  }
}

/* ── Lightning bolt glyph ── */
function drawBolt(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number, color: string) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  // Classic stealie bolt shape
  const s = size / 2;
  ctx.moveTo(cx - s * 0.1, cy - s);
  ctx.lineTo(cx + s * 0.5, cy - s);
  ctx.lineTo(cx + s * 0.05, cy - s * 0.05);
  ctx.lineTo(cx + s * 0.45, cy - s * 0.05);
  ctx.lineTo(cx - s * 0.1, cy + s);
  ctx.lineTo(cx - s * 0.1, cy + s);
  ctx.lineTo(cx + s * 0.05, cy + s * 0.1);
  ctx.lineTo(cx - s * 0.4, cy + s * 0.1);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/* ── Component ── */
export interface ShowPlateProps {
  showDate?: string;
  venueName?: string;
  venueState?: string;
  setlistName: string;
  size?: "full" | "thumb";
  onImageReady?: (dataUrl: string) => void;
}

const ShowPlate = ({ showDate = "", venueName = "", venueState = "", setlistName, size = "full", onImageReady }: ShowPlateProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const W = size === "full" ? 1400 : 700;
    const H = size === "full" ? 700 : 350;
    canvas.width = W;
    canvas.height = H;

    const year = showDate ? new Date(showDate + "T00:00:00").getFullYear() : 1977;
    const era = ERA_PALETTES[getEra(year)];
    const stateCode = getStateCode(venueState);
    const state = STATE_DESIGNS[stateCode] || STATE_DESIGNS.INTL;
    const [left, right] = formatPlateText(setlistName);

    drawPlate(canvas, era, state, left, right, showDate, venueName, year);

    if (onImageReady) {
      onImageReady(canvas.toDataURL("image/png"));
    }
  }, [showDate, venueName, venueState, setlistName, size, onImageReady]);

  useEffect(() => {
    // Wait for fonts to load
    document.fonts.ready.then(draw);
  }, [draw]);

  return (
    <div className="relative w-full" style={{ aspectRatio: "2/1" }}>
      <canvas
        ref={canvasRef}
        className="w-full h-full rounded-lg"
        style={{ boxShadow: "0 0 60px rgba(201,158,64,0.12)" }}
      />
    </div>
  );
};

export default ShowPlate;
export { ERA_PALETTES, getEra, STATE_DESIGNS, getStateCode, formatPlateText };

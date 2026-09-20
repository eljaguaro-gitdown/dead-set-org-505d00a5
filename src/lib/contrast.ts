/**
 * WCAG contrast maths, for asserting colour choices in tests.
 *
 * This exists because a caption on the share poster shipped at 3.79:1 and the
 * first attempt to describe the problem measured it against the wrong
 * background — the page's near-black rather than the cream J-card the text
 * actually sits on. A ratio is only meaningful as a pair, so the helpers take
 * both colours and the test reads the background out of index.css rather than
 * restating it.
 */

/** Parse `hsl(28 20% 44%)` / `28 20% 44%` into [h, s, l]. */
export function parseHsl(value: string): [number, number, number] {
  const match = value.match(
    /(-?[\d.]+)\s*,?\s*(-?[\d.]+)%\s*,?\s*(-?[\d.]+)%/,
  );
  if (!match) throw new Error(`Not an HSL colour: ${value}`);
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

/** HSL (h in degrees, s and l in percent) to sRGB channels in 0..1. */
export function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const sat = s / 100;
  const light = l / 100;
  const a = sat * Math.min(light, 1 - light);
  const channel = (n: number) => {
    const k = (n + h / 30) % 12;
    return light - a * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1)));
  };
  return [channel(0), channel(8), channel(4)];
}

export function relativeLuminance([r, g, b]: [number, number, number]): number {
  const lin = (c: number) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** WCAG 2.1 contrast ratio between two HSL colour strings. */
export function contrastRatio(foreground: string, background: string): number {
  const fg = relativeLuminance(hslToRgb(...parseHsl(foreground)));
  const bg = relativeLuminance(hslToRgb(...parseHsl(background)));
  const [lighter, darker] = fg > bg ? [fg, bg] : [bg, fg];
  return (lighter + 0.05) / (darker + 0.05);
}

/** AA for normal-size text. Large text (>=24px, or >=18.66px bold) needs 3. */
export const AA_NORMAL_TEXT = 4.5;

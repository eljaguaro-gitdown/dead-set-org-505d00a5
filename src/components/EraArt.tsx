// Era-specific Grateful Dead iconography — the "decode-able" border art from
// DESIGN.md / the GDTS brief. Simple hand-line motifs (a dancing bear, a
// terrapin, a rose, a lightning bolt, the steal-your-face skull) tinted to each
// touring era's color, so a ticket's border changes with the concert's era.

type Motif = "bolt" | "rose" | "bear" | "terrapin" | "syf";

const ERA_MOTIF: Record<string, Motif> = {
  "Primal Dead": "bolt",
  "'72 Europe": "rose",
  "Wall of Sound": "bolt",
  "Terrapin Era": "terrapin",
  "'80s Dead": "bear",
  "Brent Era": "bear",
  "Vince Era": "rose",
};

const ERA_COLOR_VAR: Record<string, string> = {
  "Primal Dead": "--dead-red",
  "'72 Europe": "--dead-blue",
  "Wall of Sound": "--dead-orange",
  "Terrapin Era": "--dead-gold",
  "'80s Dead": "--dead-pink",
  "Brent Era": "--dead-green",
  "Vince Era": "--dead-purple",
};

const matchEra = <T,>(era: string | null | undefined, table: Record<string, T>, fallback: T): T => {
  if (era) {
    for (const key of Object.keys(table)) {
      if (era.toLowerCase().includes(key.toLowerCase())) return table[key];
    }
  }
  return fallback;
};

const motifFor = (era?: string | null): Motif => matchEra(era, ERA_MOTIF, "syf");
const colorVarFor = (era?: string | null): string => matchEra(era, ERA_COLOR_VAR, "--primary");

const SHAPES: Record<Motif, JSX.Element> = {
  bolt: <path d="M13.2 2 L6 13 H11 L9.5 22 L18 9.5 H12.6 Z" fill="currentColor" />,
  rose: (
    <g fill="currentColor">
      <circle cx="12" cy="12" r="2.1" />
      <circle cx="12" cy="7.2" r="2.4" />
      <circle cx="16.6" cy="10.6" r="2.4" />
      <circle cx="14.8" cy="16.1" r="2.4" />
      <circle cx="9.2" cy="16.1" r="2.4" />
      <circle cx="7.4" cy="10.6" r="2.4" />
    </g>
  ),
  bear: (
    <g fill="currentColor">
      <circle cx="8.4" cy="6" r="1.5" />
      <circle cx="15.6" cy="6" r="1.5" />
      <circle cx="12" cy="8.2" r="3.3" />
      <rect x="8.4" y="10.6" width="7.2" height="7" rx="3.1" />
      <rect x="8.2" y="15.8" width="2.5" height="4.4" rx="1.25" />
      <rect x="13.3" y="15.8" width="2.5" height="4.4" rx="1.25" />
    </g>
  ),
  terrapin: (
    <g fill="currentColor">
      <ellipse cx="11.5" cy="13" rx="6.2" ry="4.3" />
      <circle cx="18.4" cy="12" r="1.7" />
      <ellipse cx="7" cy="17" rx="1.5" ry="1.05" />
      <ellipse cx="16.5" cy="17" rx="1.5" ry="1.05" />
      <ellipse cx="6" cy="11" rx="1.3" ry="1.05" />
      <ellipse cx="16.8" cy="9.6" rx="1.3" ry="1.05" />
    </g>
  ),
  syf: (
    <g>
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M12.7 4.2 L9 12 H11.6 L11 19.8 L15 11.2 H12.4 Z" fill="currentColor" />
    </g>
  ),
};

/** A single era motif, tinted to the era color. */
export const EraMotif = ({
  era,
  size = 20,
  className = "",
}: {
  era?: string | null;
  size?: number;
  className?: string;
}) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    className={className}
    style={{ color: `hsl(var(${colorVarFor(era)}))` }}
    aria-hidden="true"
  >
    {SHAPES[motifFor(era)]}
  </svg>
);

/** A decorative border strip — a row of the era's motif, fading at the ends. */
export const EraBorder = ({
  era,
  count = 7,
  size = 15,
  className = "",
}: {
  era?: string | null;
  count?: number;
  size?: number;
  className?: string;
}) => (
  <div
    className={`flex items-center justify-center gap-3 ${className}`}
    style={{ color: `hsl(var(${colorVarFor(era)}) / 0.85)` }}
    aria-hidden="true"
  >
    {Array.from({ length: count }).map((_, i) => (
      <svg
        key={i}
        viewBox="0 0 24 24"
        width={size}
        height={size}
        style={{ opacity: 0.45 + 0.55 * (1 - Math.abs(i - (count - 1) / 2) / ((count - 1) / 2 || 1)) }}
      >
        {SHAPES[motifFor(era)]}
      </svg>
    ))}
  </div>
);

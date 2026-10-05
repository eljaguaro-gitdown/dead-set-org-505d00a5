interface PageLayoutProps {
  children: React.ReactNode;
  className?: string;
  /** Lighter background layers for Builder which needs more readability */
  minimal?: boolean;
  /**
   * Pin the page to exactly one viewport and never scroll the document.
   *
   * The default is `min-h-screen`, which lets a page grow as tall as its
   * content — right for nearly everything, and wrong for a page whose own
   * bottom-anchored control has to stay on screen. Messages is the case: its
   * composer is the last child of a flex column, so with a growable wrapper it
   * sat below the fold and could only be reached by scrolling.
   *
   * Uses `dvh`, not `vh`. On mobile `100vh` is the LARGE viewport — the height
   * with the browser toolbars retracted — so a `100vh` box is taller than what
   * you can actually see whenever the toolbars are showing, and its last child
   * hides behind them. `100dvh` tracks the viewport that is really there.
   */
  fullHeight?: boolean;
}

const PageLayout = ({ children, className = "", fullHeight = false }: PageLayoutProps) => {
  return (
    <div
      className={`grain-overlay bg-background flex flex-col relative ${
        fullHeight ? "h-dvh overflow-hidden" : "min-h-screen"
      } ${className}`}
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      {/* Gold radial glow — subtle warmth from above */}
      <div
        className="fixed inset-0 pointer-events-none z-0"
        style={{
          backgroundImage:
            "radial-gradient(ellipse at 50% 10%, hsl(40 65% 52% / 0.06) 0%, transparent 55%)",
        }}
      />
      {/* Content */}
      {/* min-h-0 lets a flex-1 child actually shrink: without it a flex item's
          default min-height:auto floors it at its content height, the column
          grows past the viewport, and the bottom-most child is pushed off. */}
      <div
        className={`relative z-10 flex flex-col ${
          fullHeight ? "h-full min-h-0" : "min-h-screen"
        }`}
      >
        {children}
      </div>
    </div>
  );
};

export default PageLayout;

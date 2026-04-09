interface PageLayoutProps {
  children: React.ReactNode;
  className?: string;
  /** Lighter background layers for Builder which needs more readability */
  minimal?: boolean;
}

const PageLayout = ({ children, className = "" }: PageLayoutProps) => {
  return (
    <div className={`grain-overlay min-h-screen bg-background flex flex-col relative ${className}`} style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
      {/* Gold radial glow — subtle warmth from above */}
      <div
        className="fixed inset-0 pointer-events-none z-0"
        style={{
          backgroundImage:
            "radial-gradient(ellipse at 50% 10%, hsl(40 65% 52% / 0.06) 0%, transparent 55%)",
        }}
      />
      {/* Content */}
      <div className="relative z-10 flex flex-col min-h-screen">{children}</div>
    </div>
  );
};

export default PageLayout;

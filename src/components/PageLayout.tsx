import tieDyeBg from "@/assets/tie-dye-bg.jpg";
import cassetteBg from "@/assets/cassette-collection.jpg";

interface PageLayoutProps {
  children: React.ReactNode;
  className?: string;
  /** Lighter background layers for Builder which needs more readability */
  minimal?: boolean;
}

const PageLayout = ({ children, className = "", minimal = false }: PageLayoutProps) => {
  if (minimal) {
    return (
      <div className={`grain-overlay min-h-screen bg-background flex flex-col relative ${className}`}>
        {/* Subtle tie-dye wash */}
        <div
          className="fixed inset-0 pointer-events-none z-0"
          style={{
            backgroundImage: `url(${tieDyeBg})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            opacity: 0.15,
            filter: "saturate(0.5) blur(3px)",
          }}
        />
        {/* Faint cassette texture */}
        <div
          className="fixed inset-0 pointer-events-none z-[1]"
          style={{
            backgroundImage: `url(${cassetteBg})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            opacity: 0.06,
          }}
        />
        <div className="relative z-10 flex flex-col min-h-screen">{children}</div>
      </div>
    );
  }

  return (
    <div className={`grain-overlay min-h-screen flex flex-col relative overflow-hidden ${className}`}>
      {/* Layer 1: Cassette tape collection — the soul, visible and warm */}
      <div
        className="fixed inset-0 pointer-events-none z-0"
        style={{
          backgroundImage: `url(${cassetteBg})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          opacity: 0.35,
        }}
      />

      {/* Layer 2: Tie-dye wash at 50% — colorful but pushed back */}
      <div
        className="fixed inset-0 pointer-events-none z-[1]"
        style={{
          backgroundImage: `url(${tieDyeBg})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          opacity: 0.18,
          filter: "saturate(0.5) blur(2px)",
          mixBlendMode: "overlay",
        }}
      />

      {/* Layer 3: Warm semi-transparent overlay for readability */}
      <div
        className="fixed inset-0 pointer-events-none z-[2] bg-background"
        style={{
          opacity: 0.7,
        }}
      />

      {/* Content */}
      <div className="relative z-10 flex flex-col min-h-screen">{children}</div>
    </div>
  );
};

export default PageLayout;

import tieDyeBg from "@/assets/tie-dye-bg.jpg";
import cassetteBg from "@/assets/cassette-collection.jpg";

interface PageLayoutProps {
  children: React.ReactNode;
  className?: string;
  /** Skip the layered background (e.g. for Builder which needs full control) */
  minimal?: boolean;
}

const PageLayout = ({ children, className = "", minimal = false }: PageLayoutProps) => {
  if (minimal) {
    return (
      <div className={`grain-overlay min-h-screen bg-background flex flex-col relative ${className}`}>
        {/* Tie-dye bleed through even in minimal */}
        <div
          className="fixed inset-0 pointer-events-none z-0"
          style={{
            backgroundImage: `url(${tieDyeBg})`,
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
    <div className={`grain-overlay min-h-screen bg-background flex flex-col relative overflow-hidden ${className}`}>
      {/* Layer 1: Tie-dye at 50% opacity — warm, pushed back */}
      <div
        className="fixed inset-0 pointer-events-none z-0"
        style={{
          backgroundImage: `url(${tieDyeBg})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          opacity: 0.12,
          filter: "saturate(0.6) blur(2px)",
        }}
      />

      {/* Layer 2: Cassette collection on top — the soul of the culture */}
      <div
        className="fixed inset-0 pointer-events-none z-[1]"
        style={{
          backgroundImage: `url(${cassetteBg})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          opacity: 0.08,
          mixBlendMode: "luminosity",
        }}
      />

      {/* Layer 3: Dark overlay to keep content readable */}
      <div
        className="fixed inset-0 pointer-events-none z-[2]"
        style={{
          background: "radial-gradient(ellipse at center, hsl(var(--background) / 0.85), hsl(var(--background) / 0.95))",
        }}
      />

      {/* Content */}
      <div className="relative z-10 flex flex-col min-h-screen">{children}</div>
    </div>
  );
};

export default PageLayout;

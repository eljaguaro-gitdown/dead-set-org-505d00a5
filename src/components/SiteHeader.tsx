import { useNavigate } from "react-router-dom";
import StealYourFace from "@/components/StealYourFace";

interface SiteHeaderProps {
  children?: React.ReactNode;
  /** Show the large prominent logo treatment */
  large?: boolean;
}

const SiteHeader = ({ children, large = false }: SiteHeaderProps) => {
  const navigate = useNavigate();

  return (
    <header className="border-b border-border/50 px-4 sm:px-6 py-3 flex items-center justify-between">
      <button
        onClick={() => navigate("/")}
        className="flex items-center gap-3 group"
      >
        <StealYourFace size={large ? 48 : 36} />
        <span
          className={`font-display text-foreground tracking-wide transition-colors group-hover:text-primary ${
            large ? "text-2xl sm:text-3xl" : "text-xl sm:text-2xl"
          }`}
        >
          Dead Set
        </span>
      </button>
      {children && (
        <div className="flex items-center gap-2 sm:gap-4">{children}</div>
      )}
    </header>
  );
};

export default SiteHeader;

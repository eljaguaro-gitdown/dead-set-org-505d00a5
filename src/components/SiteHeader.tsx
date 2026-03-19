import { useNavigate } from "react-router-dom";
import StealYourFace from "@/components/StealYourFace";

interface SiteHeaderProps {
  children?: React.ReactNode;
  large?: boolean;
}

const SiteHeader = ({ children, large = false }: SiteHeaderProps) => {
  const navigate = useNavigate();

  return (
    <header className="border-b border-border/50 px-5 sm:px-8 py-4 flex items-center justify-between">
      <button
        onClick={() => navigate("/")}
        className="flex items-center gap-4 group"
      >
        <StealYourFace size={large ? 64 : 48} />
        <span
          className={`font-display text-foreground tracking-wide transition-colors group-hover:text-primary ${
            large ? "text-3xl sm:text-4xl" : "text-2xl sm:text-3xl"
          }`}
        >
          Dead Set
        </span>
      </button>
      {children && (
        <div className="flex items-center gap-3 sm:gap-5">{children}</div>
      )}
    </header>
  );
};

export default SiteHeader;

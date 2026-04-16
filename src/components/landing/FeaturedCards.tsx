import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";

interface FeaturedSetlist {
  id: string;
  title: string;
  creator_id: string;
  era_id: string | null;
  upvote_count: number;
  play_count: number;
  creator_name?: string;
  era_name?: string;
  song_count?: number;
}

interface FeaturedCardsProps {
  setlists: FeaturedSetlist[];
}

/** Inline preview cards for the hero — shows top 3 on mobile */
const FeaturedCards = ({ setlists }: FeaturedCardsProps) => {
  const navigate = useNavigate();
  const visible = setlists.slice(0, 3);

  if (visible.length === 0) return null;

  return (
    <div className="w-full max-w-lg mx-auto">
      <div className="flex gap-3 overflow-x-auto scrollbar-hide snap-x snap-mandatory pb-1 px-1">
        {visible.map((s, i) => (
          <motion.button
            key={s.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 + i * 0.08 }}
            onClick={() => navigate(`/setlist/${s.id}`)}
            className="flex-shrink-0 w-[160px] sm:w-[180px] snap-start border border-border bg-card/60 backdrop-blur-sm rounded-xl p-3 text-left hover:border-primary/40 hover:-translate-y-0.5 transition-all duration-200 group"
          >
            <h4 className="font-display text-sm font-bold text-foreground truncate group-hover:text-primary transition-colors leading-snug">
              {s.title}
            </h4>
            <Link
              to={`/user/${s.creator_id}`}
              onClick={(e) => e.stopPropagation()}
              className="font-body text-sm text-muted-foreground mt-0.5 truncate block hover:text-primary transition-colors"
            >
              {s.creator_name}
            </Link>
            <div className="flex items-center gap-2 mt-2">
              {s.era_name && (
                <span className="px-1.5 py-0.5 text-[10px] font-mono rounded border border-primary/20 text-primary/70 tracking-wider uppercase">
                  {s.era_name}
                </span>
              )}
              <span className="text-[10px] font-mono text-muted-foreground/60">
                {s.song_count} songs
              </span>
            </div>
          </motion.button>
        ))}
      </div>
    </div>
  );
};

export default FeaturedCards;

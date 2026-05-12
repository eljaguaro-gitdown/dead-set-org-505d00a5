import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Play } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface SetlistPreview {
  id: string;
  title: string;
  creatorName: string;
  thumbnailUrl: string;
}

interface Props {
  setlistId: string;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

/**
 * Lightweight inline preview of a shared setlist inside a chat bubble.
 * Pulls minimal metadata; the thumbnail comes from the og-image edge
 * function (SVG) which is already cached for crawlers.
 */
const SetlistMessageCard = ({ setlistId }: Props) => {
  const navigate = useNavigate();
  const [preview, setPreview] = useState<SetlistPreview | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const { data: setlist } = await supabase
        .from("setlists")
        .select("id, title, creator_id, is_public")
        .eq("id", setlistId)
        .maybeSingle();

      if (cancelled) return;
      if (!setlist) {
        setNotFound(true);
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("user_id", setlist.creator_id)
        .maybeSingle();

      if (cancelled) return;
      setPreview({
        id: setlist.id,
        title: setlist.title || "Untitled Setlist",
        creatorName: profile?.display_name || "A Deadhead",
        thumbnailUrl: `${SUPABASE_URL}/functions/v1/og-image?id=${setlist.id}&format=image`,
      });
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [setlistId]);

  if (notFound) return null;

  if (!preview) {
    return (
      <div className="w-full max-w-[280px] rounded-xl border border-border bg-card/60 animate-pulse h-24" />
    );
  }

  return (
    <button
      onClick={() => navigate(`/setlist/${preview.id}`)}
      className="group block w-full max-w-[280px] text-left rounded-xl overflow-hidden border border-border bg-card hover:border-primary/50 transition-colors"
    >
      <div className="aspect-[16/9] bg-background overflow-hidden relative">
        <img
          src={preview.thumbnailUrl}
          alt={preview.title}
          loading="lazy"
          className="w-full h-full object-cover"
        />
        <span className="absolute bottom-2 right-2 w-9 h-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform">
          <Play className="w-4 h-4 fill-current ml-0.5" />
        </span>
      </div>
      <div className="p-3">
        <p className="font-display text-sm text-foreground line-clamp-1">
          {preview.title}
        </p>
        <p className="text-[11px] font-body text-muted-foreground mt-0.5">
          by {preview.creatorName} · Open setlist →
        </p>
      </div>
    </button>
  );
};

export default SetlistMessageCard;

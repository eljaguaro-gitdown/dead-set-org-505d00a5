import { useMemo } from "react";
import { Play, Pause } from "lucide-react";
import { useAudioPlayer, type PlayableSlot } from "@/contexts/AudioPlayerContext";

interface FeaturedTrack {
  title: string;
  venue: string;
  date: string;
  archiveUrl: string;
}

const FEATURED_TRACKS: FeaturedTrack[] = [
  { title: "Scarlet Begonias", venue: "Barton Hall, Cornell", date: "5/8/77", archiveUrl: "https://archive.org/details/gd1977-05-08.sbd.hicks.4982.sbeok.shnf" },
  { title: "Dark Star", venue: "Fillmore West", date: "2/27/69", archiveUrl: "https://archive.org/details/gd69-02-27.sbd.owen.9815.sbeok.shnf" },
  { title: "Eyes of the World", venue: "Englishtown, NJ", date: "9/3/77", archiveUrl: "https://archive.org/details/gd1977-09-03.sbd.hicks.4988.sbeok.shnf" },
  { title: "Sugaree", venue: "Hartford", date: "5/28/77", archiveUrl: "https://archive.org/details/gd1977-05-28.sbd.hicks.4984.sbeok.shnf" },
  { title: "Estimated Prophet", venue: "Winterland", date: "12/31/78", archiveUrl: "https://archive.org/details/gd1978-12-31.sbd.unknown.12580.sbeok.shnf" },
  { title: "China Cat Sunflower → I Know You Rider", venue: "Lyceum, London", date: "5/26/72", archiveUrl: "https://archive.org/details/gd1972-05-26.sbd.hollister.174.sbeok.shnf" },
  { title: "Morning Dew", venue: "Barton Hall, Cornell", date: "5/8/77", archiveUrl: "https://archive.org/details/gd1977-05-08.sbd.hicks.4982.sbeok.shnf" },
  { title: "Help on the Way → Slipknot!", venue: "Blues for Allah era", date: "1975", archiveUrl: "https://archive.org/details/gd1975-08-13.sbd.hicks.4962.sbeok.shnf" },
];

const AmbientPlayer = () => {
  const { playSingle, playingSlot, stopPlayback } = useAudioPlayer();

  const track = useMemo(() => {
    return FEATURED_TRACKS[Math.floor(Math.random() * FEATURED_TRACKS.length)];
  }, []);

  const isThisTrackPlaying = playingSlot?.song?.title?.toLowerCase().includes(track.title.split("→")[0].trim().toLowerCase()) ?? false;

  const handleToggle = () => {
    if (isThisTrackPlaying) {
      stopPlayback();
      return;
    }

    const slot: PlayableSlot = {
      id: `ambient-${track.title}`,
      song: { id: `ambient-song`, title: track.title },
      version: {
        id: `ambient-version`,
        song_id: `ambient-song`,
        show_date: track.date,
        venue: track.venue,
        archive_org_url: track.archiveUrl,
        description: null,
        city: null,
        era_id: null,
        rating: null,
      },
      setNumber: 1,
      position: 0,
      segueToNext: false,
    };

    playSingle(slot);
  };

  return (
    <button
      onClick={handleToggle}
      className="flex items-center gap-3 group cursor-pointer py-2 px-3 rounded-full border border-primary/10 hover:border-primary/25 bg-card/30 backdrop-blur-sm transition-all"
      aria-label={isThisTrackPlaying ? "Pause" : "Play featured track"}
    >
      {/* Play/Pause icon */}
      <div className="w-7 h-7 rounded-full bg-primary/15 flex items-center justify-center group-hover:bg-primary/25 transition-colors">
        {isThisTrackPlaying ? (
          <Pause className="w-3 h-3 text-primary fill-primary" />
        ) : (
          <Play className="w-3 h-3 text-primary fill-primary ml-0.5" />
        )}
      </div>

      {/* Waveform bars */}
      <div className="flex items-end gap-[2px] h-3.5">
        {[1, 2, 3, 4].map((i) => (
          <span
            key={i}
            className={`w-[2px] rounded-full bg-primary/60 ${
              isThisTrackPlaying ? "animate-eq" : ""
            }`}
            style={{
              height: isThisTrackPlaying ? undefined : `${4 + (i % 3) * 3}px`,
              animationDelay: isThisTrackPlaying ? `${i * 0.12}s` : undefined,
            }}
          />
        ))}
      </div>

      {/* Track info */}
      <span className="text-base sm:text-lg font-body text-primary group-hover:text-primary/90 transition-colors whitespace-nowrap">
        <span className="font-semibold">{track.title}</span>
        <span className="text-muted-foreground mx-1.5">—</span>
        <span className="text-[hsl(var(--dead-cream))]">{track.venue}, {track.date}</span>
      </span>
    </button>
  );
};

export default AmbientPlayer;

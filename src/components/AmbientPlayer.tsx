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
  // ── 1960s: Primal era ──
  { title: "Dark Star", venue: "Fillmore West", date: "2/27/69", archiveUrl: "https://archive.org/details/gd69-02-27.sbd.owen.9815.sbeok.shnf" },
  { title: "St. Stephen", venue: "Fillmore West", date: "2/28/69", archiveUrl: "https://archive.org/details/gd1969-02-28.sbd.miller.32638.flac16" },
  { title: "Alligator → Drums → Caution", venue: "Carousel Ballroom", date: "3/29/68", archiveUrl: "https://archive.org/details/gd1968-03-29.sbd.miller.87393.flac16" },

  // ── Early 70s: Wall of Sound ──
  { title: "China Cat Sunflower → I Know You Rider", venue: "Lyceum, London", date: "5/26/72", archiveUrl: "https://archive.org/details/gd1972-05-26.sbd.hollister.174.sbeok.shnf" },
  { title: "Playing in the Band", venue: "Veneta, OR", date: "8/27/72", archiveUrl: "https://archive.org/details/gd1972-08-27.sbd.miller.89340.flac16" },
  { title: "Bird Song", venue: "Veneta, OR", date: "8/27/72", archiveUrl: "https://archive.org/details/gd1972-08-27.sbd.miller.89340.flac16" },
  { title: "Dark Star", venue: "Winterland", date: "11/11/73", archiveUrl: "https://archive.org/details/gd1973-11-11.sbd.miller.89341.flac16" },
  { title: "Eyes of the World", venue: "Winterland", date: "10/18/74", archiveUrl: "https://archive.org/details/gd1974-10-18.sbd.miller.89364.flac16" },
  { title: "Here Comes Sunshine", venue: "Kezar Stadium", date: "5/26/73", archiveUrl: "https://archive.org/details/gd1973-05-26.sbd.hollister.23937.sbeok.shnf" },
  { title: "Weather Report Suite", venue: "Winterland", date: "11/10/73", archiveUrl: "https://archive.org/details/gd1973-11-10.sbd.miller.89340.flac16" },

  // ── The legendary '77 ──
  { title: "Scarlet Begonias", venue: "Barton Hall, Cornell", date: "5/8/77", archiveUrl: "https://archive.org/details/gd1977-05-08.sbd.hicks.4982.sbeok.shnf" },
  { title: "Morning Dew", venue: "Barton Hall, Cornell", date: "5/8/77", archiveUrl: "https://archive.org/details/gd1977-05-08.sbd.hicks.4982.sbeok.shnf" },
  { title: "Sugaree", venue: "Hartford", date: "5/28/77", archiveUrl: "https://archive.org/details/gd1977-05-28.sbd.hicks.4984.sbeok.shnf" },
  { title: "Eyes of the World", venue: "Englishtown, NJ", date: "9/3/77", archiveUrl: "https://archive.org/details/gd1977-09-03.sbd.hicks.4988.sbeok.shnf" },
  { title: "Terrapin Station", venue: "Winterland", date: "12/31/78", archiveUrl: "https://archive.org/details/gd1978-12-31.sbd.unknown.12580.sbeok.shnf" },
  { title: "Estimated Prophet", venue: "Winterland", date: "12/31/78", archiveUrl: "https://archive.org/details/gd1978-12-31.sbd.unknown.12580.sbeok.shnf" },

  // ── Blues for Allah / Hiatus gems ──
  { title: "Help on the Way → Slipknot!", venue: "Great American Music Hall", date: "8/13/75", archiveUrl: "https://archive.org/details/gd1975-08-13.sbd.hicks.4962.sbeok.shnf" },
  { title: "The Music Never Stopped", venue: "Great American Music Hall", date: "8/13/75", archiveUrl: "https://archive.org/details/gd1975-08-13.sbd.hicks.4962.sbeok.shnf" },
  { title: "Franklin's Tower", venue: "Lindley Meadows", date: "9/28/75", archiveUrl: "https://archive.org/details/gd1975-09-28.sbd.miller.89369.flac16" },

  // ── Early 80s: Brent era ──
  { title: "Althea", venue: "Nassau Coliseum", date: "5/6/81", archiveUrl: "https://archive.org/details/gd1981-05-06.nak300.wise.19285.flac16" },
  { title: "Shakedown Street", venue: "Warfield Theatre", date: "10/14/80", archiveUrl: "https://archive.org/details/gd1980-10-14.sbd.unknown.19384.sbeok.shnf" },
  { title: "Fire on the Mountain", venue: "Red Rocks", date: "7/8/78", archiveUrl: "https://archive.org/details/gd1978-07-08.sbd.hicks.4975.sbeok.shnf" },
  { title: "Bertha", venue: "Radio City Music Hall", date: "10/31/80", archiveUrl: "https://archive.org/details/gd1980-10-31.sbd.miller.89396.flac16" },
  { title: "Deal", venue: "Hampton Coliseum", date: "3/22/85", archiveUrl: "https://archive.org/details/gd1985-03-22.sbd.miller.87390.flac16" },

  // ── Late 80s / 90s: Deep late-era gems ──
  { title: "Standing on the Moon", venue: "Shoreline", date: "6/21/89", archiveUrl: "https://archive.org/details/gd1989-06-21.sbd.miller.87398.flac16" },
  { title: "Wharf Rat", venue: "Boston Garden", date: "9/20/91", archiveUrl: "https://archive.org/details/gd1991-09-20.sbd.miller.87399.flac16" },
  { title: "So Many Roads", venue: "Soldier Field", date: "7/9/95", archiveUrl: "https://archive.org/details/gd1995-07-09.sbd.miller.89407.flac16" },
  { title: "Box of Rain", venue: "Soldier Field", date: "7/9/95", archiveUrl: "https://archive.org/details/gd1995-07-09.sbd.miller.89407.flac16" },
  { title: "Ripple", venue: "Winterland", date: "10/19/74", archiveUrl: "https://archive.org/details/gd1974-10-19.sbd.miller.89365.flac16" },
  { title: "Brokedown Palace", venue: "Winterland", date: "12/31/78", archiveUrl: "https://archive.org/details/gd1978-12-31.sbd.unknown.12580.sbeok.shnf" },
  { title: "Stella Blue", venue: "Oakland Coliseum", date: "12/31/81", archiveUrl: "https://archive.org/details/gd1981-12-31.sbd.miller.87395.flac16" },
  { title: "Cassidy", venue: "Frost Amphitheatre", date: "10/9/82", archiveUrl: "https://archive.org/details/gd1982-10-09.sbd.miller.87396.flac16" },
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

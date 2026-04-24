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
  { title: "Dark Star", venue: "Fillmore West", date: "2/27/69", archiveUrl: "https://archive.org/details/gd1969-02-27.132573.sbd.16track.healy-latvala-wise.flac16" },
  { title: "St. Stephen", venue: "Fillmore West", date: "2/28/69", archiveUrl: "https://archive.org/details/gd1969-02-28.132672.sbd.multi.track.healy-latvala-wise.flac16" },
  { title: "Alligator → Drums → Caution", venue: "Carousel Ballroom", date: "3/29/68", archiveUrl: "https://archive.org/details/gd68-03-29.aud.cotsman.6029.sbeok.shnf" },

  // ── Early 70s: Wall of Sound ──
  { title: "China Cat Sunflower → I Know You Rider", venue: "Lyceum, London", date: "5/26/72", archiveUrl: "https://archive.org/details/gd1972-05-26.sbd.smith.94452.sbeok.flac16" },
  { title: "Playing in the Band", venue: "Veneta, OR", date: "8/27/72", archiveUrl: "https://archive.org/details/gd72-08-27.sbd.orf.3328.sbeok.shnf" },
  { title: "Bird Song", venue: "Veneta, OR", date: "8/27/72", archiveUrl: "https://archive.org/details/gd72-08-27.sbd.orf.3328.sbeok.shnf" },
  { title: "Dark Star", venue: "Winterland", date: "11/11/73", archiveUrl: "https://archive.org/details/gd73-11-11.sbd.schlissel.14105.sbeok.shnf" },
  { title: "Eyes of the World", venue: "Winterland", date: "10/18/74", archiveUrl: "https://archive.org/details/gd1974-10-18.176647.sony.ecm250.falanga.menke.miller.clugston.flac2496" },
  { title: "Here Comes Sunshine", venue: "Kezar Stadium", date: "5/26/73", archiveUrl: "https://archive.org/details/gd1973-05-26.sbd.cribbs-ashley.81854.sbeok.flac16" },
  { title: "Weather Report Suite", venue: "Winterland", date: "11/10/73", archiveUrl: "https://archive.org/details/gd1973-11-10.140704.set1p.set2p.sbd.pcm.miller.clugston.flac1644" },

  // ── The legendary '77 ──
  { title: "Scarlet Begonias", venue: "Barton Hall, Cornell", date: "5/8/77", archiveUrl: "https://archive.org/details/gd1977-05-08.152379.aud.petrunis.flac2448" },
  { title: "Morning Dew", venue: "Barton Hall, Cornell", date: "5/8/77", archiveUrl: "https://archive.org/details/gd1977-05-08.152379.aud.petrunis.flac2448" },
  { title: "Sugaree", venue: "Hartford", date: "5/28/77", archiveUrl: "https://archive.org/details/gd1977-05-28.aud.wise.goodbear.77267.sbeok.flac16" },
  { title: "Eyes of the World", venue: "Englishtown, NJ", date: "9/3/77", archiveUrl: "https://archive.org/details/gd77-09-03.sbd.unk.276.sbefixed.shnf" },
  { title: "Terrapin Station", venue: "Winterland", date: "12/31/78", archiveUrl: "https://archive.org/details/gd78-12-31.sbd.ashley.1667.sbeok.shnf" },
  { title: "Estimated Prophet", venue: "Winterland", date: "12/31/78", archiveUrl: "https://archive.org/details/gd78-12-31.sbd.ashley.1667.sbeok.shnf" },

  // ── Blues for Allah / Hiatus gems ──
  { title: "Help on the Way → Slipknot!", venue: "Great American Music Hall", date: "8/13/75", archiveUrl: "https://archive.org/details/gd1975-08-13.155570.FM.flegel.flac1644" },
  { title: "The Music Never Stopped", venue: "Great American Music Hall", date: "8/13/75", archiveUrl: "https://archive.org/details/gd1975-08-13.155570.FM.flegel.flac1644" },
  { title: "Franklin's Tower", venue: "Lindley Meadows", date: "9/28/75", archiveUrl: "https://archive.org/details/gd1975-09-28.aud.gofob.86250.flac16" },

  // ── Early 80s: Brent era ──
  { title: "Althea", venue: "Nassau Coliseum", date: "5/6/81", archiveUrl: "https://archive.org/details/gd1981-05-06.139786.set2.fob.unknown.streeter.miller.clugston.flac2496" },
  { title: "Shakedown Street", venue: "Warfield Theatre", date: "10/14/80", archiveUrl: "https://archive.org/details/gd1980-10-14.137560.sbd.miller.flac1648" },
  { title: "Fire on the Mountain", venue: "Red Rocks", date: "7/8/78", archiveUrl: "https://archive.org/details/gd1978-07-08.sbd.tobin.91871.flac16" },
  { title: "Bertha", venue: "Radio City Music Hall", date: "10/31/80", archiveUrl: "https://archive.org/details/gd1980-10-31.132278.aud.sony.ecm-280.flac24" },
  { title: "Deal", venue: "Hampton Coliseum", date: "3/22/85", archiveUrl: "https://archive.org/details/gd1985-03-22.140838.Bryant.Miller.Noel.t-flac2496" },

  // ── Late 80s / 90s: Deep late-era gems ──
  { title: "Standing on the Moon", venue: "Shoreline", date: "6/21/89", archiveUrl: "https://archive.org/details/gd1989-06-21.151620.UltraMatrix.sbd.cm.miller.t.flac16" },
  { title: "Wharf Rat", venue: "Boston Garden", date: "9/20/91", archiveUrl: "https://archive.org/details/gd1991-09-20.172562.me88.mc.rogosa.flac1644" },
  { title: "So Many Roads", venue: "Soldier Field", date: "7/9/95", archiveUrl: "https://archive.org/details/gd95-07-09.sbd.7233.sbeok.shnf" },
  { title: "Box of Rain", venue: "Soldier Field", date: "7/9/95", archiveUrl: "https://archive.org/details/gd95-07-09.sbd.7233.sbeok.shnf" },
  { title: "Ripple", venue: "Winterland", date: "10/19/74", archiveUrl: "https://archive.org/details/gd1974-10-19.sbd.dfinney.228.shnf" },
  { title: "Brokedown Palace", venue: "Winterland", date: "12/31/78", archiveUrl: "https://archive.org/details/gd78-12-31.sbd.ashley.1667.sbeok.shnf" },
  { title: "Stella Blue", venue: "Oakland Coliseum", date: "12/31/81", archiveUrl: "https://archive.org/details/gd1981-12-31.sbd.unknown.14686.shnf" },
  { title: "Cassidy", venue: "Frost Amphitheatre", date: "10/9/82", archiveUrl: "https://archive.org/details/gd1982-10-09.sbd.miller.110621.flac16" },
];

const AmbientPlayer = () => {
  const { playSingle, playingSlot, stopPlayback, playlistMode } = useAudioPlayer();

  const ambientTrack = useMemo(() => {
    return FEATURED_TRACKS[Math.floor(Math.random() * FEATURED_TRACKS.length)];
  }, []);

  // When the global player is active (setlist or single from anywhere), mirror it here.
  // Otherwise show the rotating ambient archive pick. Reverts automatically on stop.
  const isMirroringGlobal = !!playingSlot;

  const display = isMirroringGlobal
    ? {
        title: playingSlot.song.title,
        venue: playingSlot.version?.venue || "Archive.org",
        date: playingSlot.version?.show_date || "",
      }
    : {
        title: ambientTrack.title,
        venue: ambientTrack.venue,
        date: ambientTrack.date,
      };

  // While mirroring, treat as playing. Otherwise only true if THIS ambient track happens to be the one playing.
  const isPlaying = isMirroringGlobal
    ? true
    : (playingSlot?.song?.title?.toLowerCase().includes(ambientTrack.title.split("→")[0].trim().toLowerCase()) ?? false);

  const handleToggle = () => {
    // Direct control: if anything is playing globally (setlist or single), stop it.
    if (isMirroringGlobal) {
      stopPlayback();
      return;
    }

    // Otherwise start the ambient archive track.
    const slot: PlayableSlot = {
      id: `ambient-${ambientTrack.title}`,
      song: { id: `ambient-song`, title: ambientTrack.title },
      version: {
        id: `ambient-version`,
        song_id: `ambient-song`,
        show_date: ambientTrack.date,
        venue: ambientTrack.venue,
        archive_org_url: ambientTrack.archiveUrl,
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

  const labelPrefix = isMirroringGlobal
    ? (playlistMode ? "From your setlist" : "Now playing")
    : null;

  return (
    <button
      onClick={handleToggle}
      className="flex items-center gap-3 group cursor-pointer py-2 px-3 rounded-full border border-primary/10 hover:border-primary/25 bg-card/30 backdrop-blur-sm transition-all max-w-full"
      aria-label={isPlaying ? "Pause" : "Play featured track"}
      title={isMirroringGlobal ? "Stop playback" : "Play featured track"}
    >
      {/* Play/Pause icon */}
      <div className="w-7 h-7 rounded-full bg-primary/15 flex items-center justify-center group-hover:bg-primary/25 transition-colors shrink-0">
        {isPlaying ? (
          <Pause className="w-3 h-3 text-primary fill-primary" />
        ) : (
          <Play className="w-3 h-3 text-primary fill-primary ml-0.5" />
        )}
      </div>

      {/* Waveform bars */}
      <div className="flex items-end gap-[2px] h-3.5 shrink-0">
        {[1, 2, 3, 4].map((i) => (
          <span
            key={i}
            className={`w-[2px] rounded-full bg-primary/60 ${
              isPlaying ? "animate-eq" : ""
            }`}
            style={{
              height: isPlaying ? undefined : `${4 + (i % 3) * 3}px`,
              animationDelay: isPlaying ? `${i * 0.12}s` : undefined,
            }}
          />
        ))}
      </div>

      {/* Track info */}
      <span className="text-base sm:text-lg font-body text-primary group-hover:text-primary/90 transition-colors truncate min-w-0">
        {labelPrefix && (
          <span className="text-[10px] uppercase tracking-[0.15em] text-primary/60 mr-2 font-mono">
            {labelPrefix}
          </span>
        )}
        <span className="font-semibold">{display.title}</span>
        {(display.venue || display.date) && (
          <>
            <span className="text-muted-foreground mx-1.5">—</span>
            <span className="text-[hsl(var(--dead-cream))]">
              {display.venue}{display.venue && display.date ? ", " : ""}{display.date}
            </span>
          </>
        )}
      </span>
    </button>
  );
};

export default AmbientPlayer;

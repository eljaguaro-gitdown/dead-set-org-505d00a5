import { useAudioPlayer } from "@/contexts/AudioPlayerContext";
import AudioPlayer from "@/components/AudioPlayer";
import GaplessPlayerBar from "@/components/GaplessPlayerBar";

/**
 * Engine switch (see src/lib/player/engineFlag.ts):
 * - "gapless" (default): one persistent Queue behind the context; the bar is
 *   a pure UI shell. No remount between tracks — this is what makes segues
 *   seamless.
 * - "legacy": the pre-swap remount-per-track player, kept intact and
 *   switchable via localStorage player_engine="legacy" for a full release.
 */
const GlobalAudioPlayer = () => {
  const { playingSlot, playlistMode, playlistIndex, playlistSlots, stopPlayback, advancePlaylist, activeSetlistId, transport } = useAudioPlayer();

  if (!playingSlot?.version?.archive_org_url) return null;

  if (transport.engine === "gapless") {
    return <GaplessPlayerBar />;
  }

  return (
    <AudioPlayer
      key={playingSlot.id}
      archiveUrl={playingSlot.version.archive_org_url}
      songTitle={playingSlot.song.title}
      showDate={playingSlot.version.show_date}
      venue={playingSlot.version.venue}
      autoPlay={true}
      singleTrackMode={playlistMode}
      directTrackUrl={playingSlot.directTrackUrl}
      onClose={stopPlayback}
      onEnded={playlistMode ? () => advancePlaylist(1) : undefined}
      playlistInfo={playlistMode ? { current: playlistIndex + 1, total: playlistSlots.length } : null}
      onNext={playlistMode ? () => advancePlaylist(1) : undefined}
      onPrev={playlistMode ? () => advancePlaylist(-1) : undefined}
      activeSetlistId={activeSetlistId}
    />
  );
};

export default GlobalAudioPlayer;

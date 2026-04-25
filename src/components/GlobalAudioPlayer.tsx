import { useAudioPlayer } from "@/contexts/AudioPlayerContext";
import AudioPlayer from "@/components/AudioPlayer";

const GlobalAudioPlayer = () => {
  const { playingSlot, playlistMode, playlistIndex, playlistSlots, stopPlayback, advancePlaylist, activeSetlistId } = useAudioPlayer();

  if (!playingSlot?.version?.archive_org_url) return null;

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

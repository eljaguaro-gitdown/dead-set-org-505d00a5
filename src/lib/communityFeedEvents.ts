export const COMMUNITY_FEED_OPTIMISTIC_INSERT = "community-feed:optimistic-insert";

export interface CommunityFeedSetlist {
  id: string;
  title: string;
  creator_id: string;
  era_id: string | null;
  upvote_count: number;
  play_count: number;
  creator_name?: string;
  era_name?: string;
  song_count?: number;
  created_at: string;
}

export const emitCommunityFeedOptimisticInsert = (setlist: CommunityFeedSetlist) => {
  if (typeof window === "undefined") return;

  window.dispatchEvent(
    new CustomEvent<CommunityFeedSetlist>(COMMUNITY_FEED_OPTIMISTIC_INSERT, {
      detail: setlist,
    })
  );
};
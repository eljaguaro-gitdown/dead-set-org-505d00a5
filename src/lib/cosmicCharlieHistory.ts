// Local persistence + visitor-id helpers for Cosmic Charlie variety.
// Server-side history is the source of truth (table: cosmic_charlie_history),
// but we mirror to localStorage so guests + page-refreshes still get variety
// instantly without a round-trip.

const STORAGE_KEY = "ds_cosmic_charlie_recent_v1";
const MAX_TITLES = 60;

export function getVisitorId(): string | null {
  try {
    return localStorage.getItem("ds_visitor_id");
  } catch {
    return null;
  }
}

export function loadRecentSongs(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((t) => typeof t === "string") : [];
  } catch {
    return [];
  }
}

export function appendRecentSongs(titles: string[]): string[] {
  const current = loadRecentSongs();
  const merged = [...new Set([...titles, ...current])].slice(0, MAX_TITLES);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
  } catch {
    // ignore
  }
  return merged;
}

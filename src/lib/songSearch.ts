/**
 * Token-based song title search. Filler words ("and", "the", "of", ...) are
 * stripped so queries like "and we bid you goodnight" still match
 * "We Bid You Goodnight". A direct substring match always wins.
 */
const STOP_WORDS = new Set([
  "a", "an", "and", "the", "of", "my", "you", "to", "in", "on",
]);

export const normalizeTitle = (s: string): string =>
  s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();

export const tokenizeQuery = (query: string): string[] => {
  const norm = normalizeTitle(query);
  return norm.split(" ").filter((t) => t && !STOP_WORDS.has(t));
};

export const matchesSongQuery = (title: string, query: string): boolean => {
  const normTitle = normalizeTitle(title);
  const normQuery = normalizeTitle(query);
  if (!normQuery) return true;
  if (normTitle.includes(normQuery)) return true;
  const tokens = tokenizeQuery(query);
  if (tokens.length === 0) return normTitle.includes(normQuery);
  return tokens.every((t) => normTitle.includes(t));
};

export const filterSongsByQuery = <T extends { title: string }>(
  songs: T[],
  query: string,
): T[] => songs.filter((s) => matchesSongQuery(s.title, query));

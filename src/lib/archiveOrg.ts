/**
 * Archive.org Grateful Dead collection lookup.
 * Searches the public API for the highest-rated recording of a given song
 * and returns the archive.org details URL.
 */

const cache = new Map<string, string | null>();
const inflight = new Map<string, Promise<string | null>>();

export async function findArchiveRecording(songTitle: string): Promise<string | null> {
  const key = songTitle.toLowerCase().trim();
  if (cache.has(key)) return cache.get(key)!;
  if (inflight.has(key)) return inflight.get(key)!;

  const promise = (async () => {
    try {
      const query = encodeURIComponent(`collection:GratefulDead "${songTitle}"`);
      const url = `https://archive.org/advancedsearch.php?q=${query}&fl=identifier,date,avg_rating&sort[]=avg_rating+desc&output=json&rows=1`;
      const res = await fetch(url);
      if (!res.ok) {
        cache.set(key, null);
        return null;
      }
      const data = await res.json();
      const doc = data?.response?.docs?.[0];
      const result = doc ? `https://archive.org/details/${doc.identifier}` : null;
      cache.set(key, result);
      return result;
    } catch {
      cache.set(key, null);
      return null;
    } finally {
      inflight.delete(key);
    }
  })();

  inflight.set(key, promise);
  return promise;
}

/**
 * Batch lookup for multiple songs. Runs in parallel with a concurrency limit.
 */
export async function findArchiveRecordings(
  songTitles: string[]
): Promise<Map<string, string | null>> {
  const results = new Map<string, string | null>();
  const CONCURRENCY = 4;

  for (let i = 0; i < songTitles.length; i += CONCURRENCY) {
    const batch = songTitles.slice(i, i + CONCURRENCY);
    const batchResults = await Promise.all(
      batch.map(async (title) => {
        const url = await findArchiveRecording(title);
        return [title, url] as const;
      })
    );
    batchResults.forEach(([title, url]) => results.set(title, url));
  }

  return results;
}

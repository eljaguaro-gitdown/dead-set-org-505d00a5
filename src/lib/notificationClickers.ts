/**
 * Grouping notification CTA clicks by the person who made them.
 *
 * The clicks live in `share_events` with `share_type = 'cta_click'` and a
 * `channel` of `announcement:<id>` or `comment_notif:<id>`. Every row already
 * carries the `user_id` — the admin page counted uniques from it but never
 * resolved it, so it could say "1 unique" and not who. Names come from
 * `profiles`, which grants `display_name` to authenticated clients; email
 * lives in `auth.users` and is not readable from the browser, so it is not
 * shown here.
 */

export interface ClickRecord {
  created_at: string;
  channel: string;
  user_id: string | null;
  visitor_id: string | null;
}

export interface Clicker {
  /** Stable identity for React keys: the user id, else the visitor id. */
  key: string;
  userId: string | null;
  label: string;
  isAnonymous: boolean;
  announcements: number;
  comments: number;
  total: number;
  /** ISO timestamp of their most recent click. */
  lastClick: string;
}

const shortId = (id: string) => id.slice(0, 8);

export function groupClickers(
  rows: ClickRecord[],
  names: Record<string, string | null>,
): Clicker[] {
  const byPerson = new Map<string, Clicker>();

  for (const row of rows) {
    const key = row.user_id || row.visitor_id;
    if (!key) continue; // no identity of any kind — nothing to attribute

    const existing = byPerson.get(key);
    const entry: Clicker =
      existing ??
      {
        key,
        userId: row.user_id,
        // A signed-in clicker with no profile row still beats showing a raw
        // uuid with no hint of what it is.
        label: row.user_id
          ? names[row.user_id] || `Signed-in · ${shortId(row.user_id)}`
          : `Anonymous · ${shortId(key)}`,
        isAnonymous: !row.user_id,
        announcements: 0,
        comments: 0,
        total: 0,
        lastClick: row.created_at,
      };

    if (row.channel.startsWith("announcement:")) entry.announcements++;
    else if (row.channel.startsWith("comment_notif:")) entry.comments++;
    entry.total++;
    if (row.created_at > entry.lastClick) entry.lastClick = row.created_at;

    byPerson.set(key, entry);
  }

  return [...byPerson.values()].sort(
    (a, b) => b.total - a.total || b.lastClick.localeCompare(a.lastClick),
  );
}

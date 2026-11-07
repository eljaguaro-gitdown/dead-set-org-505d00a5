# Tape index seed

`2026-11-07.json` is the first backfill of `public.tape_index`, resolved by
`scripts/tape-index/backfill.ts` with the same resolver `index-tapes` runs. It covers
every song's first and last night, the catalog versions, public setlist slots, the
reported nights, and every song's undated answer: 691 nights, 697 rows.

It was loaded into production by the database itself: `net.http_get` on this file's
raw URL at a fixed commit, then a JSON insert. A second load is inert, because rows
upsert on `(song_id, show_date, identifier)`. After that the hourly `tape-index-refresh`
job keeps the index current and fills private setlists. This file is history, not
configuration: nothing reads it at runtime.

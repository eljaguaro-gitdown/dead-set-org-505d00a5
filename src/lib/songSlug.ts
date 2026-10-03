/**
 * Songs have no slug column, so a shareable version-picker URL derives one
 * from the title. Resolution is slug → song by comparing derived slugs, which
 * keeps the URL readable ( /versions/shakedown-street ) without a migration.
 */
export const songSlug = (title: string): string =>
  title
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

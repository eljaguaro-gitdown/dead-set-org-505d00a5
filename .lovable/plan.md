## Problem

When a user opens a shared setlist link (e.g., from a text message), they land on `/setlist/:id` in a fresh browser tab with **no prior history**. The Back button at the top-left of `SetlistPoster.tsx` calls `navigate(-1)`, which does nothing (or stays on the same page) because there's no entry to go back to. Recipients of shared links get stranded.

## Fix

In `src/pages/SetlistPoster.tsx` (line 309), make the Back button history-aware:

- If there's real in-app history (user navigated here from another page in the app), go back via `navigate(-1)`.
- If they landed here cold (shared link, direct paste, new tab), send them to the landing page (`/`).

### Detection approach

Use `window.history.length` combined with a sentinel set on first in-app navigation. The simplest reliable check:

```ts
const cameFromInApp = (location.key !== "default");
// React Router sets location.key to "default" only for the very first entry
// in this tab's history stack — i.e., the user opened the link directly.

const handleBack = () => {
  if (cameFromInApp) {
    navigate(-1);
  } else {
    navigate("/");
  }
};
```

`useLocation()` is already imported. We just need to read `location.key` and swap the inline `onClick`.

### Optional polish

Update the label/icon so cold-landers see "Home" instead of "Back" — clearer affordance for first-time visitors arriving from a shared link:

```tsx
<button onClick={handleBack} ...>
  <ArrowLeft className="w-4 h-4" /> {cameFromInApp ? "Back" : "Home"}
</button>
```

## Files changed

- `src/pages/SetlistPoster.tsx` — replace the inline `navigate(-1)` with the history-aware handler described above.

## Out of scope

- No changes to the share flow, the `/setlist/:id` route itself, or the `ReturnToSetlistPill`. The shared link works correctly; only the back affordance is broken.

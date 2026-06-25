# Deadhead Archives — Visual Identity

The governing visual constitution for Dead Set. Supersedes the visual/brand
rules in `dead-set-field-guide.md` (the field guide's **voice** rules — taper
language, community-is-hero, never "AI" — still hold). When a UI decision and
this document disagree, this document wins.

## 1. Core Visual Laws

- **Anti-Digital.** If a UI element looks like it came from a standard SaaS
  component library, it is incorrect. Avoid standard rounded corners, standard
  shadows, and thin "perfect" UI lines.
- **Tactile Hierarchy.** Depth comes from layers of paper texture and physical
  weight, not box-shadows. Every major container should feel like a physical
  object — a ticket, an envelope, a card.
- **The "Imperfection" Rule.** All borders and containers should have a slight
  jitter or rough-edge path. Avoid 100% straight, pixel-perfect alignment.

## 2. Typography Strategy — the "Deadhead Archives" font stack

Balance psychedelic organic complexity (titles) against utilitarian archival
clarity (data). The tension between the ornate header and the typewriter data
*is* the brand.

| Role | Font | Why |
|---|---|---|
| **Titles / Logos** | `UnifrakturMaguntia` | Intricate, dense, "magical" — the quasi-gothic flair of 60s concert hand-lettering. Hero titles + playlist names. |
| **Section Headers** | `Sancreek` | Wild-west / Victorian, tactile, perfectly imperfect — early Dead promo art. Era-specific section dividers. |
| **Setlist / Ticket Data** | `Special Elite` | The "ticket stub" workhorse — a vintage typewriter / manual press. Grounds the psychedelia in archival reality. |
| **UI / Navigation** | `IBM Plex Mono` | Clean, technical, slightly human — long track lists and search results without looking like a sterile modern app. |

**Priority rule:** Always use `Special Elite` for any element representing a
physical record, ticket, or archive document. Use `IBM Plex Mono` for
functional UI interactions (search, lists, nav).

**Anti-flat techniques:**
- *Special Elite (ticket data):* `letter-spacing: 0.05em`; `text-transform:
  uppercase` for dates and venues; mimic ink bleed with `opacity: 0.85` or a
  faint `text-shadow: 1px 1px 0 rgba(0,0,0,0.1)`.
- *Sancreek / UnifrakturMaguntia (headers):* color them in the Deep Amber or
  Velvet Maroon accents — never a default web color. A slight
  `transform: skew(-5deg)` (or a `textPath` curve) gives hand-drawn instability.
- *Hybrid pairing:* ornate header (Sancreek) over utilitarian body
  (IBM Plex Mono) is the signature contrast.

## 3. The "Anti-Counterfeit" UI System (style tokens)

- **Surfaces.** `background-image` with subtle noise, grain, or high-res paper
  scan overlays. Never solid `#FFFFFF` or flat grays.
- **Active states.** Tapping a "ticket" triggers a physical animation — a slight
  3D `rotateX` or a "click" depression.
- **Buttons.** Subtle metallic foil gradient, e.g.
  `linear-gradient(135deg, #d4af37, #f3e5ab, #b8860b)`.
- **Dividers.** Never a plain `<hr/>`. Use perforated styles
  (`border-top: 2px dashed #888`) to mimic tear-off ticket stubs.

## 4. Constraint Checklist

1. **No full-width containers.** All content floats on a background color —
   Deep Amber `#C68642` or Velvet Maroon `#4A0404`.
2. **Tear-off rows.** Every list item (setlist track) is styled as a perforated
   "tear-off" row.
3. **Era color-tinting on imagery.** Tint photos/art to the concert's era via
   `filter: sepia(0.5) hue-rotate(<deg>)` to match 1970s vs 1990s color
   temperature.

## Palette reference

| Token | Value | Role |
|---|---|---|
| Velvet maroon | `#4A0404` | Canvas / deep ground |
| Deep amber | `#C68642` | Canvas (warm alt) / accent |
| Parchment | `#EAD9B4` | Floating paper objects |
| Gold foil | `#D4AF37 → #F3E5AB → #B8860B` | Button foil gradient |
| Clay vermilion | `#C24A33` | Action / now-playing |
| Dusty sage | `#6E7E55` | Era tag / secondary |
| Tie-dye | rainbow (concentric, screen-print) | Stamps, seals, the SYF |

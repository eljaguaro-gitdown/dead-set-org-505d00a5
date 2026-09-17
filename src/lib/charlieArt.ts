import cosmicCharlieFull from "@/assets/cosmic-charlie.jpg";
import cosmicCharlieMark from "@/assets/cosmic-charlie-mark.jpg";

/**
 * Matt Leunig's Cosmic Charlie comes as a square illustration: the figure sits
 * in the middle, framed by roughly 20% of mandala border on every side. That
 * framing is the point of the piece at display size — and it destroys him at
 * mark size. Inside a 28px circle the border is most of the disc, the face
 * lands at about 14px, and the whole thing reads as a blue-grey smudge rather
 * than a character. (Steal Your Face got away with 28px because a
 * high-contrast logo survives being tiny; a hand-drawn portrait does not.)
 *
 * So there are two crops of one piece of art, chosen by render size:
 * the full illustration where the mandala can be seen, and a crop centred on
 * the face where it cannot. Same character either way; below the threshold you
 * simply get closer to him.
 *
 * The threshold is 88 because that is where the evidence put it. Rendering
 * both versions side by side at 28/36/40/48/56/60/64/72/80 px, the face crop
 * reads better at every one of them — even at 72px the full illustration is
 * still about a third mandala with a smallish figure in the middle. 88px is
 * the welcome wizard's hero avatar, the one place whose job is to show Matt
 * Leunig's artwork rather than to identify the app, so that is where the full
 * piece takes over. The full illustration is still doing plenty of work
 * elsewhere: the landing hero, the email art, the podcast page and the iOS
 * lock-screen artwork all use it directly and are untouched by this.
 *
 * If this reads wrong on a real screen, it is one number.
 */
export const CHARLIE_MARK_MAX_PX = 88;

export function charlieArtFor(size: number): string {
  return size < CHARLIE_MARK_MAX_PX ? cosmicCharlieMark : cosmicCharlieFull;
}

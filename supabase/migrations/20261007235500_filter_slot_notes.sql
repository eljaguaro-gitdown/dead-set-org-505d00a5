-- Run what a fan wrote on a setlist slot through the house-rules filter.
--
-- App Store guideline 1.2 asks for a way to filter objectionable material
-- before it is posted. 20260930120000_ugc_safety_pass.sql put the filter on
-- setlist titles and descriptions, comments, messages, chat and display names,
-- but not on setlist_slots.notes. Slot notes stayed private enough to skip
-- until the community Songbook issue (/songbook/:slug) began printing them, one
-- per night, on a public page. The app-side half is encodeArchiveNotes in
-- src/hooks/useSetlist.ts, which drops a failing note before any write.
--
-- A slot's notes column is not plain prose. When the slot holds an Archive
-- recording it starts with a JSON line ({"__archive":true, show_date, venue,
-- archive_org_url, rating, note}) and the fan's own text follows a newline.
-- Only the parts a person reads are checked: the note, the venue and the fan's
-- text. The url, date and rating are left out on purpose. The filter undoes
-- leetspeak (4 -> a, 5 -> s, 0 -> o), so an Archive identifier that happened
-- to contain ".f4g." would read as a slur and fail a whole guide's save.
-- Checked on production before writing this: 0 of 2,713 slots with notes match,
-- on the human text or on the raw blob.
--
-- Replay-safe: CREATE OR REPLACE and DROP TRIGGER IF EXISTS, no data touched.

BEGIN;

-- The human-readable text of a slot's notes, the same text the app renders.
-- A blob that fails to parse is rendered as plain text (decodeArchiveNotes
-- leaves it untouched), so it is checked whole here too.
CREATE OR REPLACE FUNCTION public.slot_notes_text(p_notes text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v_nl int;
  v_first text;
  v_rest text;
  v_meta jsonb;
BEGIN
  -- left(), not LIKE: `_` is a LIKE wildcard, and the marker is "__archive".
  IF p_notes IS NULL OR left(p_notes, 17) <> '{"__archive":true' THEN
    RETURN p_notes;
  END IF;

  v_nl := position(E'\n' IN p_notes);
  IF v_nl > 0 THEN
    v_first := left(p_notes, v_nl - 1);
    v_rest := substr(p_notes, v_nl + 1);
  ELSE
    v_first := p_notes;
    v_rest := NULL;
  END IF;

  BEGIN
    v_meta := v_first::jsonb;
  EXCEPTION WHEN others THEN
    RETURN p_notes;
  END;

  RETURN concat_ws(E'\n', v_meta ->> 'note', v_meta ->> 'venue', v_rest);
END;
$$;

-- Same error as reject_objectionable_text(), so the client maps it the same
-- way. On UPDATE an unchanged note is skipped, so a note that predates the
-- filter never blocks a move or a segue change.
CREATE OR REPLACE FUNCTION public.reject_objectionable_slot_notes()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.notes IS NOT DISTINCT FROM NEW.notes THEN
    RETURN NEW;
  END IF;
  IF public.is_objectionable(public.slot_notes_text(NEW.notes)) THEN
    RAISE EXCEPTION 'objectionable_content'
      USING ERRCODE = 'check_violation',
            DETAIL = 'setlist_slots.notes';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS filter_objectionable_text ON public.setlist_slots;
CREATE TRIGGER filter_objectionable_text
  BEFORE INSERT OR UPDATE OF notes ON public.setlist_slots
  FOR EACH ROW EXECUTE FUNCTION public.reject_objectionable_slot_notes();

COMMIT;

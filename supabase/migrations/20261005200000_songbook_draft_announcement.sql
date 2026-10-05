-- Draft an announcement when a song first enters the Songbook, and tell an
-- admin it is waiting. Draft only. Nothing here sends itself to the community.
--
-- APPLIED MANUALLY on 2026-10-05 via the Lovable query_database tool against
-- the production database. Idempotent (OR REPLACE / DROP IF EXISTS) and safe
-- to replay.
--
-- WHY A TRIGGER AND NOT CLIENT CODE
-- Two different screens create a listening guide — the Version Picker and
-- Cosmic Charlie's Version Explorer — and on 2026-10-05 exactly one of them
-- filed the Songbook entry, so ric neil's Eyes of the World guide saved
-- perfectly and the shelf never heard about it. Putting the announcement in a
-- client path would repeat that mistake one layer up. `songbook_entries` is
-- the one place every path must pass through, so the trigger goes there.
--
-- WHY published = false
-- The column DEFAULTS TO TRUE, so this writes false explicitly; getting that
-- wrong would broadcast to every signed-in reader the instant a row appears.
-- The announcements SELECT policy is `published = true OR has_role(admin)`, so
-- an unpublished row is visible to admins only — the draft is already private
-- by construction, and a human publishes it by flipping one flag in /admin.
--
-- WHY A CEILING
-- 226 songs are in the catalog and the repertoire is ~523, so if the community
-- fills the shelf this fires hundreds of times. Announcing each one
-- individually is right while entries are RARE and becomes noise when they are
-- not. Past DRAFT_CEILING the trigger stops drafting and says so in the
-- postgres log; the intended replacement is a weekly "new on the shelf"
-- roundup, which nobody has built yet. The ceiling is the reminder.

create or replace function public.draft_songbook_announcement()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'extensions', 'vault'
as $function$
declare
  DRAFT_CEILING constant int := 20;

  v_song_title   text;
  v_contributor  text;
  v_slot_count   int;
  v_entry_count  int;
  v_author       uuid;
  v_title        text;
  v_body         text;
  v_guide_url    text;
  v_nights       text;

  v_service_key  text;
  v_function_url text;
  v_auth_header  jsonb;
  v_admin        record;
begin
  select count(*) into v_entry_count from public.songbook_entries;
  if v_entry_count > DRAFT_CEILING then
    raise notice 'draft_songbook_announcement: % entries exceeds ceiling %, not drafting. Time for the weekly roundup.',
      v_entry_count, DRAFT_CEILING;
    return NEW;
  end if;

  select s.title into v_song_title from public.songs s where s.id = NEW.song_id;
  select coalesce(nullif(trim(p.display_name), ''), 'a Deadhead')
    into v_contributor
    from public.profiles p where p.user_id = NEW.creator_id;
  v_contributor := coalesce(v_contributor, 'a Deadhead');

  -- Counted, never assumed. A number printed beside a credit is a claim about
  -- the thing itself, and the only honest source is the guide's own slots.
  select count(*) into v_slot_count
    from public.setlist_slots sl where sl.setlist_id = NEW.setlist_id;

  -- "1 night deep" reads wrong and "0 nights deep" would be a lie, so the
  -- clause only appears when it is both true and worth saying.
  v_nights := case when v_slot_count >= 2
                   then v_slot_count::text || ' nights deep, '
                   else '' end;

  select ur.user_id into v_author
    from public.user_roles ur
   where ur.role = 'admin'::public.app_role
   order by ur.user_id
   limit 1;

  -- author_id is NOT NULL and there is nobody sensible to attribute a draft to
  -- if the project has no admin. Skip rather than fail the contribution: the
  -- reader's guide saving is more important than the announcement.
  if v_author is null then
    raise warning 'draft_songbook_announcement: no admin to own the draft; skipping';
    return NEW;
  end if;

  v_guide_url := 'https://dead-set.org/setlist/' || NEW.setlist_id::text;

  -- Voice note: community is the hero, so the headline is the person's doing,
  -- not the Songbook's. The Archive credit is in the body and not buried.
  -- Nothing names the machinery that produced the guide.
  v_title := 'Somebody mapped ' || v_song_title;
  v_body :=
    'Hey Now — nobody had written anything down for ' || v_song_title ||
    '. Now somebody has. ' || v_contributor || ' built the first guide for it, ' ||
    v_nights || 'and it''s on the shelf for everyone. That''s how the Songbook ' ||
    'fills: one head at a time, passing on what they found. The tapes are there ' ||
    'because tapers and traders put them on the Internet Archive — the map ' ||
    'through them is ours to make. Thanks, ' || v_contributor || '.';

  insert into public.announcements (author_id, title, body, cta_label, cta_url, published)
  values (v_author, v_title, v_body, 'Hear it', v_guide_url, false);

  -- Tell the admins a draft is waiting. Best-effort: a mail failure must never
  -- roll back somebody's Songbook entry.
  select decrypted_secret into v_service_key
    from vault.decrypted_secrets where name = 'email_queue_service_role_key' limit 1;
  select decrypted_secret into v_function_url
    from vault.decrypted_secrets where name = 'send_transactional_email_url' limit 1;

  if v_service_key is null or v_function_url is null then
    raise warning 'draft_songbook_announcement: missing vault secret(s); draft written, no notification sent';
    return NEW;
  end if;

  v_auth_header := jsonb_build_object(
    'Content-Type', 'application/json',
    'Authorization', 'Bearer ' || v_service_key
  );

  for v_admin in
    select u.email
      from public.user_roles ur
      join auth.users u on u.id = ur.user_id
     where ur.role = 'admin'::public.app_role
       and u.email is not null
  loop
    begin
      perform net.http_post(
        url := v_function_url,
        headers := v_auth_header,
        body := jsonb_build_object(
          'templateName', 'songbook-draft-notification',
          'recipientEmail', v_admin.email,
          -- Keyed per entry per address. Idempotency is ENFORCED as of
          -- 20261005180000, so a retry cannot produce a second alert.
          'idempotencyKey', 'songbook-draft-' || NEW.id::text || '-' || v_admin.email,
          'templateData', jsonb_build_object(
            'songTitle', v_song_title,
            'contributorName', v_contributor,
            'slotCount', v_slot_count,
            'draftTitle', v_title,
            'draftBody', v_body,
            'guideUrl', v_guide_url
          )
        )
      );
    exception when others then
      raise warning 'draft_songbook_announcement: notify failed for %: %', v_admin.email, SQLERRM;
    end;
  end loop;

  return NEW;
end;
$function$;

drop trigger if exists on_songbook_entry_drafts_announcement on public.songbook_entries;
create trigger on_songbook_entry_drafts_announcement
  after insert on public.songbook_entries
  for each row execute function public.draft_songbook_announcement();

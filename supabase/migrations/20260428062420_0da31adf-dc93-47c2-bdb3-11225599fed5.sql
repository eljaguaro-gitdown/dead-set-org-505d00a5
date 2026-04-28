CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_name text;
  v_local text;
  v_pool text[] := ARRAY[
    'Sugar Magnolia','Brokedown Pilgrim','Ramble On Rose','Cosmic Charlie',
    'Loose Lucy','Tennessee Jed','Scarlet Begonia','Dire Wolf',
    'Uncle John','Mountain Jam','Stagger Lee','Fire on the Mountain',
    'Wharf Rat','Iko Wanderer','Bertha Skye','Eyes of the World',
    'China Cat','Sunshine Daydream','Friend of the Devil','Box of Rain',
    'Casey Jones','St. Stephen','High Time','Truckin Pilgrim',
    'Althea','Estimated Prophet','Terrapin','Brown-Eyed Woman'
  ];
  v_looks_autogen boolean;
BEGIN
  v_name := NULLIF(trim(COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name'
  )), '');

  v_local := split_part(NEW.email, '@', 1);

  -- Detect Apple private relay or other opaque local-parts:
  -- private-relay addresses, or a local-part that is ≥8 chars with no vowels
  -- and only letters/numbers (typical for hash-style identifiers).
  v_looks_autogen := (
    NEW.email ILIKE '%@privaterelay.appleid.com'
    OR (
      length(v_local) >= 8
      AND v_local ~ '^[a-z0-9]+$'
      AND v_local !~ '[aeiou]'
    )
  );

  IF v_name IS NULL AND v_looks_autogen THEN
    v_name := v_pool[1 + (floor(random() * array_length(v_pool, 1))::int)]
      || ' ' || lpad((floor(random() * 9000) + 1000)::text, 4, '0');
  ELSIF v_name IS NULL THEN
    v_name := v_local;
  END IF;

  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, v_name);

  RETURN NEW;
END;
$function$;
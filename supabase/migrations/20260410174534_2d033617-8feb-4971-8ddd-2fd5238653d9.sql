
-- Section 01: Share Your Set
CREATE TABLE public.insider_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  favorite_show text,
  favorite_songs text,
  personal_take text,
  handle text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.insider_shares ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit a share" ON public.insider_shares
  FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "Admins can view shares" ON public.insider_shares
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- Section 02: Bug Log
CREATE TABLE public.insider_bugs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location text,
  description text NOT NULL,
  repeats boolean,
  severity text,
  device text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.insider_bugs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit a bug" ON public.insider_bugs
  FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "Admins can view bugs" ON public.insider_bugs
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- Section 03: Wish List
CREATE TABLE public.insider_wishlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  top_request text,
  what_works text,
  bigger_picture text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.insider_wishlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit a wish" ON public.insider_wishlist
  FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "Admins can view wishes" ON public.insider_wishlist
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

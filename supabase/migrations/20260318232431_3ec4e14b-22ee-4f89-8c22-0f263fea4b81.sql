
-- Create eras table
CREATE TABLE public.eras (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  year_start INTEGER NOT NULL,
  year_end INTEGER NOT NULL,
  description TEXT
);

ALTER TABLE public.eras ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Eras are readable by everyone" ON public.eras FOR SELECT USING (true);

-- Create typical_set_position enum
CREATE TYPE public.set_position AS ENUM ('opener', 'early', 'mid', 'late', 'closer', 'encore');

-- Create songs table
CREATE TABLE public.songs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  first_played TEXT,
  last_played TEXT,
  times_played INTEGER DEFAULT 0,
  is_jam_vehicle BOOLEAN DEFAULT false,
  typical_set_position public.set_position,
  tags TEXT[] DEFAULT '{}'
);

ALTER TABLE public.songs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Songs are readable by everyone" ON public.songs FOR SELECT USING (true);

-- Create notable_versions table
CREATE TABLE public.notable_versions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  song_id UUID NOT NULL REFERENCES public.songs(id) ON DELETE CASCADE,
  show_date TEXT NOT NULL,
  venue TEXT,
  city TEXT,
  description TEXT,
  archive_org_url TEXT,
  era_id UUID REFERENCES public.eras(id),
  rating INTEGER DEFAULT 3 CHECK (rating >= 1 AND rating <= 5)
);

ALTER TABLE public.notable_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Notable versions are readable by everyone" ON public.notable_versions FOR SELECT USING (true);

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create setlists table
CREATE TABLE public.setlists (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  creator_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Untitled Setlist',
  era_id UUID REFERENCES public.eras(id),
  is_collaborative BOOLEAN DEFAULT false,
  is_public BOOLEAN DEFAULT false,
  share_token TEXT UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.setlists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can create setlists" ON public.setlists FOR INSERT WITH CHECK (auth.uid() = creator_id);
CREATE POLICY "Users can update own setlists" ON public.setlists FOR UPDATE USING (auth.uid() = creator_id);
CREATE POLICY "Users can delete own setlists" ON public.setlists FOR DELETE USING (auth.uid() = creator_id);

-- Create collaborator_role enum
CREATE TYPE public.collaborator_role AS ENUM ('owner', 'editor', 'viewer');

-- Create collaborators table
CREATE TABLE public.collaborators (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  setlist_id UUID NOT NULL REFERENCES public.setlists(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.collaborator_role NOT NULL DEFAULT 'editor',
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (setlist_id, user_id)
);

ALTER TABLE public.collaborators ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Collaborators can view their collaborations" ON public.collaborators FOR SELECT USING (auth.uid() = user_id OR setlist_id IN (SELECT id FROM public.setlists WHERE creator_id = auth.uid()));
CREATE POLICY "Setlist owners can add collaborators" ON public.collaborators FOR INSERT WITH CHECK (setlist_id IN (SELECT id FROM public.setlists WHERE creator_id = auth.uid()));
CREATE POLICY "Setlist owners can remove collaborators" ON public.collaborators FOR DELETE USING (setlist_id IN (SELECT id FROM public.setlists WHERE creator_id = auth.uid()));

-- Setlists viewable policy (includes collaborators and public)
CREATE POLICY "Viewable setlists" ON public.setlists FOR SELECT USING (
  is_public = true 
  OR auth.uid() = creator_id 
  OR id IN (SELECT setlist_id FROM public.collaborators WHERE user_id = auth.uid())
);

-- Create setlist_slots table
CREATE TABLE public.setlist_slots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  setlist_id UUID NOT NULL REFERENCES public.setlists(id) ON DELETE CASCADE,
  set_number INTEGER NOT NULL CHECK (set_number IN (1, 2, 3)),
  position INTEGER NOT NULL,
  song_id UUID NOT NULL REFERENCES public.songs(id),
  notable_version_id UUID REFERENCES public.notable_versions(id),
  added_by_user_id UUID REFERENCES auth.users(id),
  notes TEXT,
  segue_to_next BOOLEAN DEFAULT false
);

ALTER TABLE public.setlist_slots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Slots viewable with setlist" ON public.setlist_slots FOR SELECT USING (
  setlist_id IN (SELECT id FROM public.setlists WHERE is_public = true OR creator_id = auth.uid())
  OR setlist_id IN (SELECT setlist_id FROM public.collaborators WHERE user_id = auth.uid())
);
CREATE POLICY "Slots editable by owner or collaborator" ON public.setlist_slots FOR INSERT WITH CHECK (
  setlist_id IN (SELECT id FROM public.setlists WHERE creator_id = auth.uid())
  OR setlist_id IN (SELECT setlist_id FROM public.collaborators WHERE user_id = auth.uid() AND role IN ('owner', 'editor'))
);
CREATE POLICY "Slots updatable by owner or collaborator" ON public.setlist_slots FOR UPDATE USING (
  setlist_id IN (SELECT id FROM public.setlists WHERE creator_id = auth.uid())
  OR setlist_id IN (SELECT setlist_id FROM public.collaborators WHERE user_id = auth.uid() AND role IN ('owner', 'editor'))
);
CREATE POLICY "Slots deletable by owner or collaborator" ON public.setlist_slots FOR DELETE USING (
  setlist_id IN (SELECT id FROM public.setlists WHERE creator_id = auth.uid())
  OR setlist_id IN (SELECT setlist_id FROM public.collaborators WHERE user_id = auth.uid() AND role IN ('owner', 'editor'))
);

-- Enable realtime on key tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.setlist_slots;
ALTER PUBLICATION supabase_realtime ADD TABLE public.collaborators;

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_setlists_updated_at
  BEFORE UPDATE ON public.setlists
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed eras
INSERT INTO public.eras (name, year_start, year_end, description) VALUES
  ('Primal Dead', 1965, 1969, 'The formative years — acid tests, Haight-Ashbury, and the birth of the jam'),
  ('Americana Peak', 1970, 1974, 'Workingman''s Dead through Mars Hotel — the golden age of songwriting'),
  ('Hiatus & Return', 1975, 1977, 'The hiatus, Blues for Allah, and the triumphant return with Terrapin Station'),
  ('Shakedown Street', 1978, 1979, 'Egypt, Shakedown Street, and the disco-tinged Dead'),
  ('Go to Nassau', 1980, 1983, 'Brent Mydland era begins — tighter jams and new energy'),
  ('Touch of Grey', 1984, 1989, 'In the Dark, mainstream success, and stadium shows'),
  ('Final Run', 1990, 1995, 'Vince Welnick era, Without a Net, and the farewell');

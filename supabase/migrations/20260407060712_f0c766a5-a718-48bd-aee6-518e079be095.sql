-- Add length constraints to page_visits to prevent abuse
ALTER TABLE public.page_visits
  ADD CONSTRAINT page_visits_visitor_id_length CHECK (char_length(visitor_id) <= 64),
  ADD CONSTRAINT page_visits_page_path_length CHECK (char_length(page_path) <= 512),
  ADD CONSTRAINT page_visits_user_agent_length CHECK (char_length(user_agent) <= 1024);
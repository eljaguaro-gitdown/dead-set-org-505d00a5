
DROP POLICY "Anyone can update own assignment" ON public.ab_test_assignments;

CREATE POLICY "Visitors can update own assignment"
  ON public.ab_test_assignments
  FOR UPDATE
  TO anon, authenticated
  USING (visitor_id = current_setting('request.headers', true)::json->>'x-visitor-id' OR (auth.uid() IS NOT NULL AND user_id = auth.uid()))
  WITH CHECK (true);

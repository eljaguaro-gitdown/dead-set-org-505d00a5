CREATE POLICY "Admins can read send log"
ON public.email_send_log FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can read suppressed emails"
ON public.suppressed_emails FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
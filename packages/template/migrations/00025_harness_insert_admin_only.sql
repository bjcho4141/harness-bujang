-- Harden the harness_messages INSERT policy to admin-only.
--
-- This replaces any earlier permissive INSERT policy (e.g., authenticated-only)
-- with a strict admin check. Run this only after 00010.

DROP POLICY IF EXISTS harness_admin_insert ON public.harness_messages;

CREATE POLICY harness_admin_insert
  ON public.harness_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
        AND users.role = 'admin'
    )
  );

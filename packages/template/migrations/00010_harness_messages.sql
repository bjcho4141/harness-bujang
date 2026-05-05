-- harness_messages: chat-room messages for the Harness-Bujang multi-agent system
--
-- This migration assumes Postgres + a `users` table with a `role` column ('admin' / etc.).
-- If your schema differs, replace the `EXISTS (...)` predicates with your own admin check.
--
-- Idempotent: uses CREATE TABLE IF NOT EXISTS + DROP POLICY IF EXISTS.

CREATE TABLE IF NOT EXISTS public.harness_messages (
  id          text        PRIMARY KEY,
  "timestamp" timestamptz NOT NULL DEFAULT now(),
  "from"      text        NOT NULL,
  "to"        text        NOT NULL,
  type        text        NOT NULL CHECK (type IN ('command', 'feedback', 'info', 'report')),
  message     text        NOT NULL,
  severity    text        CHECK (severity IS NULL OR severity IN ('info', 'warning', 'error')),
  data        jsonb,
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS harness_messages_timestamp_idx
  ON public.harness_messages ("timestamp" DESC);

CREATE INDEX IF NOT EXISTS harness_messages_from_to_idx
  ON public.harness_messages ("from", "to");

-- Enable Row Level Security
ALTER TABLE public.harness_messages ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- Policies
-- ---------------------------------------------------------------------------
-- Admins can SELECT all messages.
-- Adjust the EXISTS subquery below to match your project's admin definition.

DROP POLICY IF EXISTS admin_select_harness_messages ON public.harness_messages;
CREATE POLICY admin_select_harness_messages
  ON public.harness_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
        AND users.role = 'admin'
    )
  );

-- Initial INSERT policy (further hardened by 00025).
DROP POLICY IF EXISTS admin_insert_harness_messages ON public.harness_messages;
CREATE POLICY admin_insert_harness_messages
  ON public.harness_messages FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
        AND users.role = 'admin'
    )
  );

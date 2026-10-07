/*
# Create Odylian workspace data

1. New Tables
- `chat_messages` stores shared public chat messages with a display name and message body.
- `user_preferences` stores per-account theme, search engine, and browser preferences.
- `user_bookmarks` stores per-account saved browser links.
- `user_history` stores per-account visited browser pages.
2. Security
- Row Level Security is enabled on every table.
- Chat is intentionally shared for the public chat room, while account data is owner-scoped.
- Each table has separate SELECT, INSERT, UPDATE, and DELETE policies.
3. Important Notes
- Account-owned rows default their owner to the signed-in account.
- Chat is available without sign-in so the room is usable immediately.
*/

CREATE TABLE IF NOT EXISTS public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name text NOT NULL,
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 500),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  theme text NOT NULL DEFAULT 'midnight',
  search_engine text NOT NULL DEFAULT 'Google',
  accent text NOT NULL DEFAULT 'cyan',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

CREATE TABLE IF NOT EXISTS public.user_bookmarks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  url text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  url text NOT NULL,
  visited_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_bookmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read chat messages" ON public.chat_messages;
CREATE POLICY "Public can read chat messages" ON public.chat_messages FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "Public can send chat messages" ON public.chat_messages;
CREATE POLICY "Public can send chat messages" ON public.chat_messages FOR INSERT TO anon, authenticated WITH CHECK (char_length(body) BETWEEN 1 AND 500);
DROP POLICY IF EXISTS "Public can edit chat messages" ON public.chat_messages;
CREATE POLICY "Public can edit chat messages" ON public.chat_messages FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (char_length(body) BETWEEN 1 AND 500);
DROP POLICY IF EXISTS "Public can delete chat messages" ON public.chat_messages;
CREATE POLICY "Public can delete chat messages" ON public.chat_messages FOR DELETE TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Users can read own preferences" ON public.user_preferences;
CREATE POLICY "Users can read own preferences" ON public.user_preferences FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can create own preferences" ON public.user_preferences;
CREATE POLICY "Users can create own preferences" ON public.user_preferences FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own preferences" ON public.user_preferences;
CREATE POLICY "Users can update own preferences" ON public.user_preferences FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete own preferences" ON public.user_preferences;
CREATE POLICY "Users can delete own preferences" ON public.user_preferences FOR DELETE TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can read own bookmarks" ON public.user_bookmarks;
CREATE POLICY "Users can read own bookmarks" ON public.user_bookmarks FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can create own bookmarks" ON public.user_bookmarks;
CREATE POLICY "Users can create own bookmarks" ON public.user_bookmarks FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own bookmarks" ON public.user_bookmarks;
CREATE POLICY "Users can update own bookmarks" ON public.user_bookmarks FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete own bookmarks" ON public.user_bookmarks;
CREATE POLICY "Users can delete own bookmarks" ON public.user_bookmarks FOR DELETE TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can read own history" ON public.user_history;
CREATE POLICY "Users can read own history" ON public.user_history FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can create own history" ON public.user_history;
CREATE POLICY "Users can create own history" ON public.user_history FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own history" ON public.user_history;
CREATE POLICY "Users can update own history" ON public.user_history FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete own history" ON public.user_history;
CREATE POLICY "Users can delete own history" ON public.user_history FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS chat_messages_created_at_idx ON public.chat_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS user_bookmarks_user_id_idx ON public.user_bookmarks(user_id);
CREATE INDEX IF NOT EXISTS user_history_user_id_idx ON public.user_history(user_id, visited_at DESC);
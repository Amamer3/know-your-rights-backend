-- Optional columns so match_constitution_articles() can use COALESCE(...) on every install.
-- Safe to run on legacy (supabase_schema.sql) or greenfield (001); IF NOT EXISTS is idempotent.

ALTER TABLE public.constitution_articles
  ADD COLUMN IF NOT EXISTS chapter_title TEXT;

ALTER TABLE public.constitution_articles
  ADD COLUMN IF NOT EXISTS article_content TEXT;

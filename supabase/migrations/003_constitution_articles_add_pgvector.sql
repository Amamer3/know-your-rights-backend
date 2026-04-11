-- Run this if your project was created from supabase_schema.sql (no embedding / full_text).
-- Afterwards: Supabase Dashboard → Settings → API → "Reload schema" (or wait ~1 min).

CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE public.constitution_articles
  ADD COLUMN IF NOT EXISTS embedding vector(1536);

ALTER TABLE public.constitution_articles
  ADD COLUMN IF NOT EXISTS full_text TEXT;

UPDATE public.constitution_articles
SET full_text = article_content
WHERE full_text IS NULL AND article_content IS NOT NULL;

-- Speed up vector search (safe if table is empty)
CREATE INDEX IF NOT EXISTS constitution_articles_embedding_idx
  ON public.constitution_articles
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100)
  WHERE embedding IS NOT NULL;

-- Constitution vector search only. Safe to run when only `constitution_articles` (+ pgvector) exists.
-- For uploaded PDF chunks, run 004_rpc_match_document_chunks.sql after 001_backend_upgrade.sql.

CREATE OR REPLACE FUNCTION match_constitution_articles(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 5
)
RETURNS TABLE (
  id uuid,
  article_number int,
  article_title text,
  chapter text,
  full_text text,
  similarity float
)
LANGUAGE sql STABLE AS $$
  SELECT
    ca.id,
    ca.article_number,
    ca.article_title::text,
    COALESCE(ca.chapter_title, ca.chapter::text)::text AS chapter,
    COALESCE(ca.full_text, ca.article_content)::text AS full_text,
    (1 - (ca.embedding <=> query_embedding))::float AS similarity
  FROM constitution_articles ca
  WHERE ca.embedding IS NOT NULL
    AND (1 - (ca.embedding <=> query_embedding)) > match_threshold
  ORDER BY ca.embedding <=> query_embedding
  LIMIT match_count;
$$;

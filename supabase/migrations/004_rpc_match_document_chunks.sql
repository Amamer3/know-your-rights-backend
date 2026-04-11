-- Requires `document_chunks` from 001_backend_upgrade.sql. Run this AFTER 001 (and after any reset).

CREATE OR REPLACE FUNCTION match_document_chunks(
  query_embedding vector(1536),
  doc_id uuid,
  match_threshold float DEFAULT 0.6,
  match_count int DEFAULT 5
)
RETURNS TABLE (
  id uuid,
  chunk_index int,
  text text,
  page_number int,
  similarity float
)
LANGUAGE sql STABLE AS $$
  SELECT
    dc.id,
    dc.chunk_index,
    dc.text::text,
    dc.page_number,
    (1 - (dc.embedding <=> query_embedding))::float AS similarity
  FROM document_chunks dc
  WHERE dc.document_id = doc_id
    AND dc.embedding IS NOT NULL
    AND (1 - (dc.embedding <=> query_embedding)) > match_threshold
  ORDER BY dc.embedding <=> query_embedding
  LIMIT match_count;
$$;

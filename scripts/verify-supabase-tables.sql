-- Verify all public tables required by know-your-rights-backend exist.
-- Run in Supabase SQL Editor after applying supabase_schema.sql
--
-- Expected: 5 rows (one per required table).

WITH required(name) AS (
  VALUES
    ('profiles'),
    ('constitution_articles'),
    ('emergency_actions'),
    ('assessments'),
    ('saved_resources')
),
found AS (
  SELECT c.relname AS name
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relkind = 'r'
)
SELECT
  r.name AS required_table,
  (f.name IS NOT NULL) AS exists
FROM required r
LEFT JOIN found f ON f.name = r.name
ORDER BY r.name;

-- If any row shows exists = false, create the missing table from supabase_schema.sql

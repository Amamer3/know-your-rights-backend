-- Know Your Rights Ghana — core schema (run in Supabase SQL editor or via CLI)
-- PayStack is used for billing; IDs stored for webhook reconciliation.

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS constitution_articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter VARCHAR(100),
  chapter_title TEXT,
  article_number INT NOT NULL,
  article_title VARCHAR(500),
  full_text TEXT NOT NULL,
  article_content TEXT,
  embedding vector(1536),
  created_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT constitution_articles_article_number_key UNIQUE (article_number)
);

CREATE INDEX IF NOT EXISTS constitution_articles_embedding_idx
  ON constitution_articles USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

CREATE TABLE IF NOT EXISTS user_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  tier VARCHAR(20) NOT NULL DEFAULT 'free',
  prompts_limit INT NOT NULL DEFAULT 5,
  prompts_used INT NOT NULL DEFAULT 0,
  prompts_reset_at TIMESTAMP NOT NULL DEFAULT (NOW() + INTERVAL '1 month'),
  page_limit INT NOT NULL DEFAULT 20,
  paystack_customer_code VARCHAR(200),
  paystack_subscription_code VARCHAR(200),
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  filename VARCHAR(500),
  page_count INT,
  file_size_bytes BIGINT,
  storage_url TEXT,
  processing_status VARCHAR(50) DEFAULT 'pending',
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS document_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  chunk_index INT NOT NULL,
  text TEXT NOT NULL,
  embedding vector(1536),
  page_number INT,
  embedded_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS document_chunks_document_id_idx ON document_chunks(document_id);
CREATE INDEX IF NOT EXISTS document_chunks_embedding_idx
  ON document_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 50)
  WHERE embedding IS NOT NULL;

CREATE TABLE IF NOT EXISTS recordings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  storage_url TEXT,
  transcription TEXT,
  confidence REAL,
  duration_seconds REAL,
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
  recording_id UUID REFERENCES recordings(id) ON DELETE SET NULL,
  title VARCHAR(500),
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS conversation_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL,
  content TEXT NOT NULL,
  citations JSONB DEFAULT '[]',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS conversation_messages_conversation_id_idx ON conversation_messages(conversation_id);

CREATE TABLE IF NOT EXISTS usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type VARCHAR(100) NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS usage_logs_user_created_idx ON usage_logs(user_id, created_at);

ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE recordings ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users own their documents" ON documents;
CREATE POLICY "Users own their documents" ON documents FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users own their chunks" ON document_chunks;
CREATE POLICY "Users own their chunks" ON document_chunks FOR ALL USING (
  document_id IN (SELECT id FROM documents WHERE user_id = auth.uid())
);

DROP POLICY IF EXISTS "Users own their recordings" ON recordings;
CREATE POLICY "Users own their recordings" ON recordings FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users own their conversations" ON conversations;
CREATE POLICY "Users own their conversations" ON conversations FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users own their messages" ON conversation_messages;
CREATE POLICY "Users own their messages" ON conversation_messages FOR ALL USING (
  conversation_id IN (SELECT id FROM conversations WHERE user_id = auth.uid())
);

DROP POLICY IF EXISTS "Users own their subscription" ON user_subscriptions;
CREATE POLICY "Users own their subscription" ON user_subscriptions FOR ALL USING (auth.uid() = user_id);

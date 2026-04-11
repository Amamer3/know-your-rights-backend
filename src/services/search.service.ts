import OpenAI from 'openai';
import { supabase } from '../config/supabase.js';
import {
  getConstitutionCache,
  isConstitutionCacheLoaded,
  searchConstitutionInMemory,
} from './constitution-cache.service.js';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function embedQuery(text: string): Promise<number[]> {
  const res = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
  });
  const emb = res.data[0]?.embedding;
  if (!emb) throw new Error('Embedding failed');
  return emb;
}

export async function searchConstitution(query: string, topK = 5) {
  const embedding = await embedQuery(query);

  const cacheReady = isConstitutionCacheLoaded() && getConstitutionCache().length > 0;
  if (cacheReady) {
    return searchConstitutionInMemory(embedding, topK, 0.65);
  }

  const { data, error } = await supabase.rpc('match_constitution_articles', {
    query_embedding: embedding,
    match_threshold: 0.65,
    match_count: topK,
  });

  if (error) {
    console.warn('[search] match_constitution_articles RPC failed:', error.message);
    return [];
  }

  return data ?? [];
}

function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 2);
}

function scoreChunkKeywords(query: string, text: string): number {
  const qTerms = tokenize(query);
  if (qTerms.length === 0) return 0;
  const lower = text.toLowerCase();
  let score = 0;
  for (const t of qTerms) {
    if (lower.includes(t)) score += 1;
  }
  return score;
}

export async function searchDocument(documentId: string, query: string, topK = 5) {
  const embedding = await embedQuery(query);

  const { data: vectorResults, error: rpcErr } = await supabase.rpc('match_document_chunks', {
    query_embedding: embedding,
    doc_id: documentId,
    match_threshold: 0.55,
    match_count: topK,
  });

  if (rpcErr) {
    console.warn('[search] match_document_chunks RPC failed:', rpcErr.message);
  }

  const { data: pending } = await supabase
    .from('document_chunks')
    .select('id, text, page_number, chunk_index')
    .eq('document_id', documentId)
    .is('embedded_at', null)
    .limit(80);

  const keywordScored =
    pending
      ?.map((row) => ({
        id: row.id,
        chunk_index: row.chunk_index,
        text: row.text,
        page_number: row.page_number,
        similarity: scoreChunkKeywords(query, row.text ?? '') / Math.max(1, tokenize(query).length),
      }))
      .filter((r) => r.similarity > 0)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 3) ?? [];

  const vec = (vectorResults ?? []) as Array<{
    id: string;
    chunk_index: number;
    text: string;
    page_number: number | null;
    similarity: number;
  }>;

  return [...vec, ...keywordScored];
}

export async function fetchCaseLaw(query: string): Promise<string> {
  try {
    const url = `https://ghalii.org/search/?q=${encodeURIComponent(query)}&jurisdiction=gh`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return '';
    const html = await res.text();
    const caseMatches = [...html.matchAll(/<h3[^>]*>([^<]+)<\/h3>[\s\S]*?<p[^>]*>([^<]+)<\/p>/gi)].slice(
      0,
      3,
    );
    return caseMatches.map((m) => `${m[1].trim()}: ${m[2].trim()}`).join('\n\n');
  } catch {
    return '';
  }
}

import { supabase } from '../config/supabase.js';

export type CachedConstitutionArticle = {
  id: string;
  chapter: string | null;
  article_number: number;
  article_title: string | null;
  full_text: string;
  embedding: number[];
};

let cache: CachedConstitutionArticle[] = [];
let loaded = false;

function parseEmbedding(raw: unknown): number[] | null {
  if (!raw) return null;
  if (Array.isArray(raw) && typeof raw[0] === 'number') return raw as number[];
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw) as number[];
      return Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }
  return null;
}

export function isConstitutionCacheLoaded(): boolean {
  return loaded;
}

export function getConstitutionCache(): CachedConstitutionArticle[] {
  return cache;
}

export async function initConstitutionCache(): Promise<void> {
  try {
    const { data, error } = await supabase
      .from('constitution_articles')
      .select(
        'id, chapter, chapter_title, article_number, article_title, full_text, article_content, embedding',
      );

    if (error) {
      console.warn('[Constitution cache] Could not load:', error.message);
      loaded = true;
      return;
    }

    cache =
      data
        ?.map((row) => {
          const emb = parseEmbedding(row.embedding);
          if (!emb) return null;
          const r = row as Record<string, unknown>;
          const body =
            (typeof r.full_text === 'string' && r.full_text) ||
            (typeof r.article_content === 'string' && r.article_content) ||
            '';
          const chapterLabel =
            (typeof r.chapter_title === 'string' && r.chapter_title) ||
            (r.chapter != null ? String(r.chapter) : null);
          return {
            id: row.id as string,
            chapter: chapterLabel,
            article_number: row.article_number as number,
            article_title: row.article_title as string | null,
            full_text: body,
            embedding: emb,
          };
        })
        .filter((x): x is CachedConstitutionArticle => x !== null) ?? [];

    loaded = true;
    console.log(`[Constitution cache] Loaded ${cache.length} articles into memory.`);
  } catch (e) {
    console.warn('[Constitution cache] Init failed:', e);
    loaded = true;
  }
}

export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}

export function searchConstitutionInMemory(
  queryEmbedding: number[],
  topK: number,
  minSimilarity = 0.7,
): Array<{
  id: string;
  article_number: number;
  article_title: string | null;
  chapter: string | null;
  full_text: string;
  similarity: number;
}> {
  if (cache.length === 0) return [];

  const scored = cache
    .map((row) => ({
      id: row.id,
      article_number: row.article_number,
      article_title: row.article_title,
      chapter: row.chapter,
      full_text: row.full_text,
      similarity: cosineSimilarity(queryEmbedding, row.embedding),
    }))
    .filter((r) => r.similarity > minSimilarity)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, topK);

  return scored;
}

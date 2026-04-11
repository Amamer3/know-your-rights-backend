/**
 * One-time (or re-run) ingestion: PDF → articles → embeddings → constitution_articles.
 *
 * Usage:
 *   npx tsx scripts/ingest-constitution.ts
 *
 * Env:
 *   OPENAI_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   PDF source (pick one):
 *   - CONSTITUTION_PDF_URL — HTTPS URL (e.g. Supabase public object URL or signed URL)
 *   - CONSTITUTION_STORAGE_BUCKET + CONSTITUTION_STORAGE_OBJECT — Supabase Storage path
 *   - CONSTITUTION_PDF_PATH — local file (default tries scripts/ghana-constitution-1992.pdf)
 */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PDFParse } from 'pdf-parse';
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

interface ArticleChunk {
  chapter: string;
  article_number: number;
  article_title: string;
  full_text: string;
}

/** OpenAI embedding inputs are capped at 8192 tokens; stay under with a conservative char budget. */
const MAX_CHARS_PER_EMBEDDING_INPUT = 16_000;

/** Legacy table uses INTEGER chapter + TEXT chapter_title (see supabase_schema.sql). */
function parseChapterNumber(chapterHeading: string): number | null {
  const m = chapterHeading.match(/CHAPTER\s+(\d+)/i);
  return m ? parseInt(m[1], 10) : null;
}

function textForEmbedding(article: ArticleChunk): string {
  const prefix = `${article.article_title}: `;
  const budget = Math.max(512, MAX_CHARS_PER_EMBEDDING_INPUT - prefix.length);
  let body = article.full_text;
  if (body.length > budget) {
    body = `${body.slice(0, budget)}\n…`;
  }
  return prefix + body;
}

async function loadPdfFromUrl(url: string): Promise<Buffer> {
  const res = await fetch(url, {
    redirect: 'follow',
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) {
    throw new Error(`CONSTITUTION_PDF_URL fetch failed: ${res.status} ${res.statusText}`);
  }
  const ct = res.headers.get('content-type') || '';
  if (!ct.includes('pdf') && !ct.includes('octet-stream') && !url.toLowerCase().includes('.pdf')) {
    console.warn('[ingest] Unexpected Content-Type for PDF URL:', ct);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  const maxBytes = 40 * 1024 * 1024;
  if (buf.length > maxBytes) {
    throw new Error(`Downloaded file too large (${buf.length} bytes). Max ${maxBytes}.`);
  }
  if (buf.length < 5000) {
    throw new Error('Downloaded file is too small to be a constitution PDF.');
  }
  return buf;
}

async function loadPdfBuffer(): Promise<Buffer> {
  const pdfUrl = process.env.CONSTITUTION_PDF_URL?.trim();
  if (pdfUrl) {
    console.log('Loading PDF from CONSTITUTION_PDF_URL…');
    return loadPdfFromUrl(pdfUrl);
  }

  const bucket = process.env.CONSTITUTION_STORAGE_BUCKET?.trim();
  const objectPath = process.env.CONSTITUTION_STORAGE_OBJECT?.trim();
  if (bucket && objectPath) {
    console.log(`Loading PDF from Storage: ${bucket} / ${objectPath}`);
    const { data, error } = await supabase.storage.from(bucket).download(objectPath);
    if (error) throw new Error(`Storage download failed: ${error.message}`);
    return Buffer.from(await data.arrayBuffer());
  }

  const local =
    process.env.CONSTITUTION_PDF_PATH?.trim() ||
    path.join(__dirname, 'ghana-constitution-1992.pdf');
  if (fs.existsSync(local)) {
    console.log('Loading PDF from local file:', local);
    return fs.readFileSync(local);
  }

  throw new Error(
    [
      `No constitution PDF available.`,
      ``,
      `Add one of these to your .env (project root), then re-run:`,
      `  CONSTITUTION_PDF_URL=https://...your-project....supabase.co/storage/v1/object/public/<bucket>/<file>.pdf`,
      `  OR`,
      `  CONSTITUTION_STORAGE_BUCKET=<bucket>`,
      `  CONSTITUTION_STORAGE_OBJECT=<path/to/ghana-constitution-1992.pdf>`,
      `  OR`,
      `  CONSTITUTION_PDF_PATH=D:\\path\\to\\ghana-constitution-1992.pdf`,
      ``,
      `Default local path (missing): ${local}`,
    ].join('\n'),
  );
}

async function parseConstitutionByArticle(pdfBuffer: Buffer): Promise<ArticleChunk[]> {
  const parser = new PDFParse({ data: pdfBuffer });
  const textResult = await parser.getText();
  await parser.destroy();

  const text = textResult.text;
  const articles: ArticleChunk[] = [];

  const articleRegex =
    /ARTICLE\s+(\d+)[.\s—-]+([^\n]+)\n([\s\S]*?)(?=ARTICLE\s+\d+|CHAPTER\s+\d+|$)/gi;
  const chapterRegex = /CHAPTER\s+(\d+|[A-Z]+)[.\s—-]*([^\n]*)/gi;
  const chapterMatches = [...text.matchAll(chapterRegex)];

  let currentChapter = 'CHAPTER 1';
  let match: RegExpExecArray | null;
  while ((match = articleRegex.exec(text)) !== null) {
    const articleNumber = parseInt(match[1], 10);
    const articleTitle = match[2].trim();
    const articleText = match[3].trim();
    const articlePos = match.index;

    for (const cm of chapterMatches) {
      if (cm.index !== undefined && cm.index < articlePos) {
        currentChapter = cm[0].trim();
      }
    }

    if (articleText.length > 20) {
      articles.push({
        chapter: currentChapter,
        article_number: articleNumber,
        article_title: articleTitle,
        full_text: `${articleTitle}\n\n${articleText}`,
      });
    }
  }

  if (articles.length === 0) {
    // Fallback: same splitter as src/utils/pdf-processor (handles mixed casing)
    const fallbackRegex = /(?:Article|ARTICLE)\s+(\d+)/gi;
    const positions: { number: number; start: number }[] = [];
    let m: RegExpExecArray | null;
    while ((m = fallbackRegex.exec(text)) !== null) {
      positions.push({ number: parseInt(m[1], 10), start: m.index });
    }
    for (let i = 0; i < positions.length; i++) {
      const cur = positions[i];
      const next = positions[i + 1];
      const end = next ? next.start : text.length;
      const raw = text.slice(cur.start, end).trim();
      const lines = raw.split('\n');
      const firstLine = lines[0] ?? '';
      const title =
        firstLine.replace(/Article\s+\d+\.?\s*/i, '').trim() || `Article ${cur.number}`;
      const body = lines.slice(1).join('\n').trim() || raw;
      if (body.length > 20) {
        articles.push({
          chapter: currentChapter,
          article_number: cur.number,
          article_title: title,
          full_text: `${title}\n\n${body}`,
        });
      }
    }
  }

  console.log(`Parsed ${articles.length} articles from the Ghana Constitution`);
  return articles;
}

/** PDF parsing can emit the same article_number twice; Postgres upsert forbids duplicate keys in one statement. */
function dedupeArticlesByNumber(articles: ArticleChunk[]): ArticleChunk[] {
  const map = new Map<number, ArticleChunk>();
  for (const a of articles) {
    const prev = map.get(a.article_number);
    if (!prev || a.full_text.length > prev.full_text.length) {
      map.set(a.article_number, a);
    }
  }
  const removed = articles.length - map.size;
  if (removed > 0) {
    console.log(
      `Deduplicated ${removed} row(s) with duplicate article_number (kept longest full_text per number).`,
    );
  }
  return [...map.values()].sort((a, b) => a.article_number - b.article_number);
}

async function embedInBatches(articles: ArticleChunk[], batchSize = 50) {
  const results: Array<ArticleChunk & { embedding: number[] }> = [];

  for (let i = 0; i < articles.length; i += batchSize) {
    const batch = articles.slice(i, i + batchSize);
    console.log(
      `Embedding batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(articles.length / batchSize)}...`,
    );

    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: batch.map((a) => textForEmbedding(a)),
    });

    for (let j = 0; j < batch.length; j++) {
      const emb = response.data[j]?.embedding;
      if (!emb) continue;
      results.push({ ...batch[j], embedding: emb });
    }

    if (i + batchSize < articles.length) {
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  return results;
}

async function main() {
  if (!process.env.OPENAI_API_KEY || !supabaseUrl || !supabaseKey) {
    throw new Error('Missing OPENAI_API_KEY, SUPABASE_URL, or SUPABASE_SERVICE_ROLE_KEY');
  }

  console.log('Loading Ghana Constitution PDF...');
  const pdfBuffer = await loadPdfBuffer();

  console.log('Parsing articles...');
  const parsed = await parseConstitutionByArticle(pdfBuffer);
  const articles = dedupeArticlesByNumber(parsed);

  console.log('Generating embeddings...');
  const withEmbeddings = await embedInBatches(articles);

  console.log('Upserting into Supabase...');
  const { error } = await supabase.from('constitution_articles').upsert(
    withEmbeddings.map((a) => ({
      chapter: parseChapterNumber(a.chapter),
      chapter_title: a.chapter,
      article_number: a.article_number,
      article_title: a.article_title,
      full_text: a.full_text,
      article_content: a.full_text,
      embedding: a.embedding,
    })),
    { onConflict: 'article_number' },
  );

  if (error) throw error;
  console.log(`Successfully ingested ${withEmbeddings.length} unique constitution articles.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

import { Router } from 'express';
import multer from 'multer';
import { PDFParse } from 'pdf-parse';
import { authenticate } from '../middlewares/auth.middleware.js';
import { uploadLimiter } from '../middleware/rateLimiter.js';
import { getUserTier, getExpiresAt } from '../services/tier.service.js';
import { supabase } from '../config/supabase.js';
import { embedDocumentChunks } from '../services/document-embed.service.js';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

async function pdfFromBuffer(buffer: Buffer): Promise<{ text: string; numpages: number }> {
  const parser = new PDFParse({ data: buffer });
  const textResult = await parser.getText();
  await parser.destroy();
  return { text: textResult.text, numpages: textResult.total };
}

function smartChunk(text: string, pageCount: number): string[] {
  const chunks: string[] = [];
  const paragraphs = text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p.length > 40);

  let current = '';
  for (const para of paragraphs) {
    if ((current + para).length > 800) {
      if (current) chunks.push(current.trim());
      current = para;
    } else {
      current = `${current}\n\n${para}`.trim();
    }
  }
  if (current.trim()) chunks.push(current.trim());

  if (chunks.length === 0 && text.trim().length > 0) {
    chunks.push(text.trim().slice(0, 8000));
  }

  return chunks;
}

router.post('/', authenticate, uploadLimiter, upload.single('file'), async (req, res) => {
  const user = req.user;
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const file = req.file;
  if (!file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  if (file.mimetype !== 'application/pdf') {
    return res.status(400).json({ error: 'Only PDF files are accepted' });
  }

  try {
    const tier = await getUserTier(user.id);
    if (tier.prompts_used >= tier.prompts_limit) {
      return res.status(429).json({
        error: 'Prompt quota exceeded for this billing period.',
        code: 'QUOTA_EXCEEDED',
      });
    }

    const pdfData = await pdfFromBuffer(file.buffer);
    const pageCount = pdfData.numpages;

    if (pageCount > tier.page_limit) {
      return res.status(413).json({
        error: `Your document has ${pageCount} pages. Your ${tier.tier} plan supports up to ${tier.page_limit} pages.`,
        code: 'PAGE_LIMIT_EXCEEDED',
        upgrade_required: true,
      });
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    const send = (event: string, data: unknown) => {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    send('progress', {
      stage: 'validating',
      status: `File is ${pageCount} pages, ${(file.size / (1024 * 1024)).toFixed(2)}MB — OK`,
    });

    const chunks = smartChunk(pdfData.text, pageCount);
    send('progress', {
      stage: 'extracting',
      chunks_extracted: chunks.length,
      total_pages: pageCount,
    });

    const expiresAt = getExpiresAt(tier.tier);
    const { data: doc, error: docErr } = await supabase
      .from('documents')
      .insert({
        user_id: user.id,
        filename: file.originalname,
        page_count: pageCount,
        file_size_bytes: file.size,
        processing_status: 'embedding',
        expires_at: expiresAt,
      })
      .select('id')
      .single();

    if (docErr || !doc) {
      send('error', { message: docErr?.message ?? 'Could not save document' });
      res.end();
      return;
    }

    const docId = doc.id as string;

    const chunkRows = chunks.map((t, i) => ({
      document_id: docId,
      chunk_index: i,
      text: t,
      page_number: Math.max(1, Math.ceil(((i + 1) / chunks.length) * pageCount)),
    }));

    const { error: chunkErr } = await supabase.from('document_chunks').insert(chunkRows);
    if (chunkErr) {
      send('error', { message: chunkErr.message });
      res.end();
      return;
    }

    send('progress', {
      stage: 'embedding',
      status: 'Generating embeddings in background…',
      document_id: docId,
      total_chunks: chunks.length,
      chunks_embedded: 0,
    });

    send('complete', {
      document_id: docId,
      chunks: chunks.length,
      ready_to_query: true,
      estimate_time_remaining: Math.min(30_000, chunks.length * 400),
      filename: file.originalname,
      page_count: pageCount,
      expires_at: expiresAt,
    });

    res.end();

    void embedDocumentChunks(docId, chunks).catch((e) =>
      console.error('[documents] background embed failed', e),
    );
  } catch (err) {
    console.error('[documents]', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Document processing failed. Please try again.' });
    }
  }
});

export default router;

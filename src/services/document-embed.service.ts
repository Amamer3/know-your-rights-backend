import OpenAI from 'openai';
import { supabase } from '../config/supabase.js';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function embedDocumentChunks(documentId: string, chunks: string[]): Promise<void> {
  const batchSize = 50;

  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize);
    try {
      const response = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: batch,
      });

      for (let j = 0; j < batch.length; j++) {
        const emb = response.data[j]?.embedding;
        if (!emb) continue;
        const idx = i + j;
        await supabase
          .from('document_chunks')
          .update({
            embedding: emb,
            embedded_at: new Date().toISOString(),
          })
          .eq('document_id', documentId)
          .eq('chunk_index', idx);
      }
    } catch (e) {
      console.error('[embed] batch failed for document', documentId, e);
    }
  }

  await supabase
    .from('documents')
    .update({ processing_status: 'ready' })
    .eq('id', documentId);
}

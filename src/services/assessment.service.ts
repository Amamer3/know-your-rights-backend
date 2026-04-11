import OpenAI from 'openai';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import type { Response } from 'express';
import { searchConstitution, searchDocument, fetchCaseLaw } from './search.service.js';
import { supabase } from '../config/supabase.js';
import { getUserTier, getExpiresAt } from './tier.service.js';
import { AppError } from '../middleware/errorHandler.js';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

type Citation = Record<string, unknown>;

async function assertDocumentOwned(documentId: string, userId: string): Promise<void> {
  const { data, error } = await supabase
    .from('documents')
    .select('id')
    .eq('id', documentId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error || !data) {
    throw new AppError(404, 'Document not found', 'NOT_FOUND');
  }
}

async function assertRecordingOwned(recordingId: string, userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('recordings')
    .select('transcription')
    .eq('id', recordingId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error || !data) {
    throw new AppError(404, 'Recording not found', 'NOT_FOUND');
  }
  return (data.transcription as string) ?? null;
}

async function assertConversationOwned(conversationId: string, userId: string): Promise<void> {
  const { data, error } = await supabase
    .from('conversations')
    .select('id')
    .eq('id', conversationId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error || !data) {
    throw new AppError(404, 'Conversation not found', 'NOT_FOUND');
  }
}

async function getConversationHistory(conversationId: string): Promise<ChatCompletionMessageParam[]> {
  const { data } = await supabase
    .from('conversation_messages')
    .select('role, content')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
    .limit(20);

  return (
    data?.map((m) => ({
      role: m.role as 'user' | 'assistant' | 'system',
      content: m.content as string,
    })) ?? []
  );
}

function extractCitations(
  response: string,
  constitutionResults: Array<{
    article_number: number;
    article_title?: string | null;
    chapter?: string | null;
    full_text?: string;
  }>,
  documentResults: Array<{ id?: string; text?: string; page_number?: number | null }>,
): Citation[] {
  const citations: Citation[] = [];

  for (const article of constitutionResults) {
    const num = article.article_number;
    if (response.includes(`Article ${num}`) || response.includes(`article ${num}`)) {
      const quote =
        article.full_text?.slice(0, 280) ?? '';
      citations.push({
        type: 'constitution',
        article: num,
        chapter: article.chapter,
        title: article.article_title,
        quote,
      });
    }
  }

  for (const chunk of documentResults) {
    if (!chunk.id || !chunk.text) continue;
    const snippet = chunk.text.slice(0, 80).replace(/\s+/g, ' ');
    if (snippet.length > 20 && response.includes(snippet)) {
      citations.push({
        type: 'document',
        chunk_id: chunk.id,
        page_number: chunk.page_number,
        text: chunk.text.slice(0, 500),
      });
    }
  }

  const caseRegex = /([A-Z][A-Za-z0-9\s.,'-]+ v\. [A-Z][A-Za-z0-9\s.,'-]+)\s*\((\d{4})\)/g;
  let m: RegExpExecArray | null;
  while ((m = caseRegex.exec(response)) !== null) {
    citations.push({
      type: 'case',
      name: m[1].trim(),
      year: parseInt(m[2], 10),
    });
  }

  return citations;
}

async function saveConversationTurn(params: {
  userId: string;
  conversationId?: string;
  documentId?: string;
  recordingId?: string;
  userPrompt: string;
  assistantResponse: string;
  citations: Citation[];
}): Promise<string> {
  const sub = await getUserTier(params.userId);
  const expiresAt = getExpiresAt(sub.tier);

  let convId = params.conversationId;

  if (convId) {
    await assertConversationOwned(convId, params.userId);
  } else {
    const { data, error } = await supabase
      .from('conversations')
      .insert({
        user_id: params.userId,
        document_id: params.documentId ?? null,
        recording_id: params.recordingId ?? null,
        title: params.userPrompt.slice(0, 100),
        expires_at: expiresAt,
      })
      .select('id')
      .single();

    if (error || !data) {
      throw new Error(error?.message ?? 'Failed to create conversation');
    }
    convId = data.id as string;
  }

  await supabase.from('conversation_messages').insert([
    { conversation_id: convId, role: 'user', content: params.userPrompt, citations: [] },
    {
      conversation_id: convId,
      role: 'assistant',
      content: params.assistantResponse,
      citations: params.citations,
    },
  ]);

  await supabase
    .from('conversations')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', convId);

  return convId;
}

export async function streamAssessment(
  prompt: string,
  userId: string,
  res: Response,
  options: {
    documentId?: string;
    recordingId?: string;
    conversationId?: string;
  },
): Promise<void> {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  const sendEvent = (event: string, data: unknown) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  try {
    if (options.documentId) {
      await assertDocumentOwned(options.documentId, userId);
    }

    let recordingText: string | null = null;
    if (options.recordingId) {
      recordingText = await assertRecordingOwned(options.recordingId, userId);
    }

    if (options.conversationId) {
      await assertConversationOwned(options.conversationId, userId);
    }

    const recordingBlock =
      recordingText && recordingText.length > 0
        ? `USER VOICE NOTE (transcription):\n${recordingText}\n\n`
        : '';

    const [constitutionResults, documentResults, caseLaw, conversationHistory] = await Promise.all([
      searchConstitution(prompt),
      options.documentId ? searchDocument(options.documentId, prompt) : Promise.resolve([]),
      fetchCaseLaw(prompt),
      options.conversationId ? getConversationHistory(options.conversationId) : Promise.resolve([]),
    ]);

    const constitutionContext = constitutionResults
      .map(
        (a: { article_number: number; article_title?: string | null; full_text?: string }) =>
          `Article ${a.article_number} — ${a.article_title ?? ''}:\n${a.full_text ?? ''}`,
      )
      .join('\n\n');

    const documentContext =
      documentResults.length > 0
        ? documentResults
            .map(
              (c: { page_number?: number | null; text?: string }) =>
                `[Page ${c.page_number ?? '?'}]: ${c.text ?? ''}`,
            )
            .join('\n\n')
        : '';

    const systemPrompt = `You are a legal assistant helping Ghanaians understand their constitutional rights.
You ground every answer in the 1992 Constitution of Ghana and, when provided, real court case summaries.

Rules:
1. ALWAYS cite specific articles: "Article 12 of the Ghana Constitution states: [quote]"
2. If referencing a court case, include case name, year, and what the court held
3. Use simple, clear language — many users are not lawyers
4. Be empathetic — users may be in distress or facing injustice
5. Never invent statutes or cases — only use the context below
6. If the context is insufficient, say you recommend consulting a qualified lawyer for this situation

${constitutionContext ? `GHANA CONSTITUTION CONTEXT:\n${constitutionContext}` : ''}
${documentContext ? `USER DOCUMENT EXCERPTS:\n${documentContext}` : ''}
${caseLaw ? `CASE LAW SNIPPETS (verify before relying):\n${caseLaw}` : ''}`;

    const userContent = `${recordingBlock}User question:\n${prompt}`;

    const stream = await openai.chat.completions.create({
      model: 'gpt-4o',
      stream: true,
      messages: [
        { role: 'system', content: systemPrompt },
        ...conversationHistory,
        { role: 'user', content: userContent },
      ],
      max_tokens: 1500,
      temperature: 0.3,
    });

    let fullResponse = '';
    for await (const chunk of stream) {
      const text = chunk.choices[0]?.delta?.content ?? '';
      if (text) {
        fullResponse += text;
        sendEvent('response', text);
      }
    }

    const citations = extractCitations(fullResponse, constitutionResults, documentResults);
    for (const c of citations) {
      sendEvent('citation', c);
    }

    const conversationId = await saveConversationTurn({
      userId,
      conversationId: options.conversationId,
      documentId: options.documentId,
      recordingId: options.recordingId,
      userPrompt: prompt,
      assistantResponse: fullResponse,
      citations,
    });

    sendEvent('complete', {
      conversation_id: conversationId,
      citations_count: citations.length,
    });
    res.end();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.startsWith('QUOTA_EXCEEDED')) {
      sendEvent('error', {
        code: 'QUOTA_EXCEEDED',
        message: 'You have used all your prompts this month. Upgrade to continue.',
      });
    } else if (err instanceof AppError) {
      sendEvent('error', { code: err.code ?? 'APP_ERROR', message: err.message });
    } else {
      sendEvent('error', { code: 'SERVER_ERROR', message: 'Something went wrong. Please try again.' });
    }
    res.end();
  }
}

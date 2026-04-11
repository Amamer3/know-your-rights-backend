import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware.js';
import { assessLimiter } from '../middleware/rateLimiter.js';
import { validate, AssessSchema } from '../middleware/validateRequest.js';
import { checkAndIncrementPrompt } from '../services/tier.service.js';
import { streamAssessment } from '../services/assessment.service.js';
import { supabase } from '../config/supabase.js';

const router = Router();

router.post('/', authenticate, assessLimiter, validate(AssessSchema), async (req, res) => {
  try {
    await checkAndIncrementPrompt(req.user!.id);
    await streamAssessment(req.body.prompt, req.user!.id, res, {
      documentId: req.body.document_id,
      recordingId: req.body.recording_id,
      conversationId: req.body.conversation_id,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : '';
    if (!res.headersSent) {
      if (msg.startsWith('QUOTA_EXCEEDED')) {
        res.status(429).json({ error: 'Prompt quota exceeded', code: 'QUOTA_EXCEEDED' });
      } else {
        res.status(500).json({ error: 'Assessment failed. Please try again.' });
      }
    }
  }
});

router.get('/history', authenticate, async (req, res) => {
  const user = req.user!;
  try {
    const { data, error } = await supabase
      .from('conversations')
      .select('id, title, created_at, updated_at, document_id, recording_id')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(50);

    if (error) throw error;
    res.json({ data: data ?? [] });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to load history';
    res.status(500).json({ error: msg });
  }
});

router.get('/:id', authenticate, async (req, res) => {
  const user = req.user!;
  const { id } = req.params;
  try {
    const { data: conv, error: cErr } = await supabase
      .from('conversations')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (cErr || !conv) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    const { data: messages, error: mErr } = await supabase
      .from('conversation_messages')
      .select('*')
      .eq('conversation_id', id)
      .order('created_at', { ascending: true });

    if (mErr) throw mErr;
    res.json({ conversation: conv, messages: messages ?? [] });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to load conversation';
    res.status(500).json({ error: msg });
  }
});

export default router;

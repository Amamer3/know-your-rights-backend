import { Router } from 'express';
import multer from 'multer';
import OpenAI, { toFile } from 'openai';
import { authenticate } from '../middlewares/auth.middleware.js';
import { uploadLimiter } from '../middleware/rateLimiter.js';
import { supabase } from '../config/supabase.js';
import { getExpiresAt, getUserTier } from '../services/tier.service.js';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = new Set([
      'audio/wav',
      'audio/x-wav',
      'audio/mpeg',
      'audio/mp3',
      'audio/mp4',
      'audio/x-m4a',
      'audio/m4a',
    ]);
    if (allowed.has(file.mimetype)) cb(null, true);
    else cb(new Error('Only WAV, MP3, and M4A uploads are allowed'));
  },
});

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

router.post('/', authenticate, uploadLimiter, upload.single('audio'), async (req, res) => {
  const user = req.user;
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: 'No audio file provided' });
    }

    const tier = await getUserTier(user.id);
    const expiresAt = getExpiresAt(tier.tier);

    const uploadable = await toFile(file.buffer, file.originalname, { type: file.mimetype });

    const transcription = await openai.audio.transcriptions.create({
      file: uploadable,
      model: 'whisper-1',
      language: 'en',
    });

    const { data: recording, error } = await supabase
      .from('recordings')
      .insert({
        user_id: user.id,
        transcription: transcription.text,
        confidence: null,
        expires_at: expiresAt,
      })
      .select('id, transcription, expires_at')
      .single();

    if (error || !recording) {
      return res.status(500).json({ error: error?.message ?? 'Failed to save recording' });
    }

    res.json({
      recording_id: recording.id,
      transcription: recording.transcription,
      expires_at: recording.expires_at,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Transcription failed';
    if (msg.includes('Only WAV')) {
      return res.status(400).json({ error: msg });
    }
    console.error('[recordings]', err);
    res.status(500).json({ error: 'Transcription failed. Please try again.' });
  }
});

export default router;

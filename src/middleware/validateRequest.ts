import { z, type ZodSchema } from 'zod';
import type { Request, Response, NextFunction } from 'express';

export const validate =
  (schema: ZodSchema) => (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        error: 'Invalid request',
        details: result.error.flatten().fieldErrors,
      });
    }
    req.body = result.data;
    next();
  };

export const AssessSchema = z.object({
  prompt: z.string().min(5).max(2000),
  document_id: z.string().uuid().optional(),
  recording_id: z.string().uuid().optional(),
  conversation_id: z.string().uuid().optional(),
});

export const ConversationSchema = z.object({
  document_id: z.string().uuid().optional(),
  recording_id: z.string().uuid().optional(),
});

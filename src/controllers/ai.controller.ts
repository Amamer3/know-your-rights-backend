import { Request, Response } from 'express';
import { supabase } from '../config/supabase.js';
import { assessLegalSituation, getRelevantContext, transcribeAudio } from '../services/ai.service.js';
import fs from 'fs';

export const submitAssessment = async (req: Request, res: Response) => {
  const user = (req as any).user;
  let { description } = req.body;
  const audioFile = req.file;

  if (!description && !audioFile) {
    return res.status(400).json({ message: 'Description or audio file is required' });
  }

  try {
    // Handle voice transcription if audio file is present
    if (audioFile) {
      try {
        console.log('Transcribing audio file...');
        description = await transcribeAudio(audioFile.path);
        console.log('Transcription successful:', description);
        
        // Clean up audio file after transcription
        fs.unlinkSync(audioFile.path);
      } catch (transcriptionError: any) {
        // Still try to clean up if transcription fails
        if (fs.existsSync(audioFile.path)) fs.unlinkSync(audioFile.path);
        return res.status(500).json({ message: `Transcription failed: ${transcriptionError.message}` });
      }
    }

    let assessment: string;
    let isAIGenerated = true;

    try {
      assessment = await assessLegalSituation(description);
    } catch (aiError) {
      console.error('AI Service unavailable, falling back to manual search.');
      const context = await getRelevantContext(description);
      assessment = `Note: AI Assessment service is currently limited. Based on the Constitution of Ghana, here are some relevant articles found for your situation:\n\n${context}\n\nDisclaimer: This is a direct retrieval from the Constitution and not a customized AI assessment. Please consult a lawyer for professional advice.`;
      isAIGenerated = false;
    }

    // Save assessment to history
    const { data, error } = await supabase
      .from('assessments')
      .insert({
        user_id: user.id,
        description,
        assessment,
        is_ai_generated: isAIGenerated,
      })
      .select()
      .single();

    if (error) throw error;

    res.status(200).json({
      message: isAIGenerated ? 'Assessment generated successfully' : 'Manual assessment retrieved (AI service unavailable)',
      data,
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const getAssessmentHistory = async (req: Request, res: Response) => {
  const user = (req as any).user;

  try {
    const { data, error } = await supabase
      .from('assessments')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.status(200).json({
      message: 'Assessment history retrieved successfully',
      data,
    });
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};

export const getAssessmentById = async (req: Request, res: Response) => {
  const user = (req as any).user;
  const { id } = req.params;

  try {
    const { data, error } = await supabase
      .from('assessments')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (error) throw error;

    res.status(200).json({
      message: 'Assessment retrieved successfully',
      data,
    });
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};

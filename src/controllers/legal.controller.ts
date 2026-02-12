import { Request, Response } from 'express';
import { supabase } from '../config/supabase.js';

export const getConstitution = async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('constitution_articles')
      .select('id, chapter, chapter_title, article_number, article_title')
      .order('article_number', { ascending: true });

    if (error) throw error;

    res.status(200).json({
      message: 'Constitution structure retrieved successfully',
      data,
    });
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};

export const getArticleById = async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const { data, error } = await supabase
      .from('constitution_articles')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;

    res.status(200).json({
      message: 'Article retrieved successfully',
      data,
    });
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};

export const getEmergencyActions = async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('emergency_actions')
      .select('*')
      .order('id', { ascending: true });

    if (error) throw error;

    res.status(200).json({
      message: 'Emergency actions retrieved successfully',
      data,
    });
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};

export const searchLegalResources = async (req: Request, res: Response) => {
  const { query } = req.query;

  if (!query) {
    return res.status(400).json({ message: 'Search query is required' });
  }

  try {
    // Basic text search using Supabase
    const { data, error } = await supabase
      .from('constitution_articles')
      .select('*')
      .textSearch('article_content', query as string);

    if (error) throw error;

    res.status(200).json({
      message: 'Search results retrieved successfully',
      data,
    });
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};

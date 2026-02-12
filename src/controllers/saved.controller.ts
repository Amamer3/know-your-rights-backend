import { Request, Response } from 'express';
import { supabase } from '../config/supabase.js';

export const getSavedItems = async (req: Request, res: Response) => {
  const user = (req as any).user;

  try {
    const { data, error } = await supabase
      .from('saved_resources')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.status(200).json({
      message: 'Saved items retrieved successfully',
      data,
    });
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};

export const saveItem = async (req: Request, res: Response) => {
  const user = (req as any).user;
  const { resource_id, resource_type, title, content } = req.body;

  if (!resource_type || !title) {
    return res.status(400).json({ message: 'Resource type and title are required' });
  }

  try {
    const { data, error } = await supabase
      .from('saved_resources')
      .insert({
        user_id: user.id,
        resource_id, // Can be article ID or assessment ID
        resource_type, // 'article' or 'assessment'
        title,
        content,
        created_at: new Date(),
      })
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({
      message: 'Item saved successfully',
      data,
    });
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};

export const removeSavedItem = async (req: Request, res: Response) => {
  const user = (req as any).user;
  const { id } = req.params;

  try {
    const { error } = await supabase
      .from('saved_resources')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) throw error;

    res.status(200).json({ message: 'Item removed from saved list' });
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};

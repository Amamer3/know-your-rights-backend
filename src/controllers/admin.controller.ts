import { Request, Response } from 'express';
import { supabase } from '../config/supabase.js';

function toPositiveInt(value: unknown, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.floor(n);
}

export const bootstrapAdmin = async (req: Request, res: Response) => {
  const user = (req as any).user;
  const providedSecret =
    String(req.headers['x-admin-bootstrap-secret'] || '') ||
    String(req.body?.bootstrapSecret || '');
  const expectedSecret = process.env.ADMIN_BOOTSTRAP_SECRET || '';

  if (!user?.id) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  if (!expectedSecret) {
    return res.status(500).json({
      message: 'ADMIN_BOOTSTRAP_SECRET is not configured',
    });
  }

  if (!providedSecret || providedSecret !== expectedSecret) {
    return res.status(403).json({ message: 'Invalid bootstrap secret' });
  }

  try {
    // Bootstrap is one-time: if any admin exists already, block further bootstrapping.
    const { count, error: countError } = await supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .contains('preferences', { is_admin: true });
    if (countError) throw countError;
    if ((count || 0) > 0) {
      return res.status(409).json({
        message: 'Admin already bootstrapped. Use existing admin management flow.',
      });
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, email, preferences')
      .eq('id', user.id)
      .single();
    if (profileError) throw profileError;

    const existingPreferences =
      profile?.preferences && typeof profile.preferences === 'object' ? profile.preferences : {};

    const { data, error } = await supabase
      .from('profiles')
      .update({
        preferences: {
          ...existingPreferences,
          is_admin: true,
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id)
      .select('id, email, full_name, preferences')
      .single();
    if (error) throw error;

    res.status(200).json({
      message: 'Admin bootstrap successful',
      data,
    });
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};

export const getAdminDashboardStats = async (_req: Request, res: Response) => {
  try {
    const [
      profilesCount,
      assessmentsCount,
      savedCount,
      articlesCount,
      emergencyCount,
      recentUsers,
      recentAssessments,
    ] = await Promise.all([
      supabase.from('profiles').select('*', { count: 'exact', head: true }),
      supabase.from('assessments').select('*', { count: 'exact', head: true }),
      supabase.from('saved_resources').select('*', { count: 'exact', head: true }),
      supabase.from('constitution_articles').select('*', { count: 'exact', head: true }),
      supabase.from('emergency_actions').select('*', { count: 'exact', head: true }),
      supabase
        .from('profiles')
        .select('id, email, full_name, created_at')
        .order('created_at', { ascending: false })
        .limit(5),
      supabase
        .from('assessments')
        .select('id, user_id, description, created_at, is_ai_generated')
        .order('created_at', { ascending: false })
        .limit(5),
    ]);

    const firstError =
      profilesCount.error ||
      assessmentsCount.error ||
      savedCount.error ||
      articlesCount.error ||
      emergencyCount.error ||
      recentUsers.error ||
      recentAssessments.error;

    if (firstError) throw firstError;

    res.status(200).json({
      message: 'Admin dashboard stats retrieved successfully',
      data: {
        totals: {
          users: profilesCount.count || 0,
          assessments: assessmentsCount.count || 0,
          savedResources: savedCount.count || 0,
          constitutionArticles: articlesCount.count || 0,
          emergencyActions: emergencyCount.count || 0,
        },
        recentUsers: recentUsers.data || [],
        recentAssessments: recentAssessments.data || [],
      },
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const listUsers = async (req: Request, res: Response) => {
  const page = toPositiveInt(req.query.page, 1);
  const limit = Math.min(toPositiveInt(req.query.limit, 20), 100);
  const offset = (page - 1) * limit;
  const search = String(req.query.search || '').trim();

  try {
    let query = supabase
      .from('profiles')
      .select('id, email, full_name, preferences, created_at, updated_at', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (search) {
      query = query.or(`email.ilike.%${search}%,full_name.ilike.%${search}%`);
    }

    const { data, error, count } = await query;
    if (error) throw error;

    res.status(200).json({
      message: 'Users retrieved successfully',
      data: {
        items: data || [],
        pagination: {
          page,
          limit,
          total: count || 0,
          totalPages: count ? Math.ceil(count / limit) : 0,
        },
      },
    });
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};

export const getUserAdminDetails = async (req: Request, res: Response) => {
  const { userId } = req.params;
  try {
    const [profileRes, assessmentsRes, savedRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', userId).single(),
      supabase
        .from('assessments')
        .select('id, description, is_ai_generated, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(20),
      supabase
        .from('saved_resources')
        .select('id, resource_type, title, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(20),
    ]);

    if (profileRes.error) throw profileRes.error;
    if (assessmentsRes.error) throw assessmentsRes.error;
    if (savedRes.error) throw savedRes.error;

    res.status(200).json({
      message: 'User details retrieved successfully',
      data: {
        profile: profileRes.data,
        recentAssessments: assessmentsRes.data || [],
        recentSavedResources: savedRes.data || [],
      },
    });
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};

export const updateUserByAdmin = async (req: Request, res: Response) => {
  const { userId } = req.params;
  const { full_name, preferences } = req.body;
  try {
    const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (full_name !== undefined) payload.full_name = full_name;
    if (preferences !== undefined) payload.preferences = preferences;

    const { data, error } = await supabase
      .from('profiles')
      .update(payload)
      .eq('id', userId)
      .select('*')
      .single();

    if (error) throw error;
    res.status(200).json({ message: 'User updated successfully', data });
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};

export const deleteUserByAdmin = async (req: Request, res: Response) => {
  const { userId } = req.params;
  try {
    const [savedDelete, assessmentsDelete, profileDelete] = await Promise.all([
      supabase.from('saved_resources').delete().eq('user_id', userId),
      supabase.from('assessments').delete().eq('user_id', userId),
      supabase.from('profiles').delete().eq('id', userId),
    ]);

    const firstError = savedDelete.error || assessmentsDelete.error || profileDelete.error;
    if (firstError) throw firstError;

    res.status(200).json({
      message: 'User data deleted successfully',
      data: {
        userId,
        note: 'Auth user deletion requires Supabase Admin API and should be done from a secure backend service.',
      },
    });
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};

export const listAssessmentsAdmin = async (req: Request, res: Response) => {
  const page = toPositiveInt(req.query.page, 1);
  const limit = Math.min(toPositiveInt(req.query.limit, 20), 100);
  const offset = (page - 1) * limit;
  const userId = String(req.query.userId || '').trim();

  try {
    let query = supabase
      .from('assessments')
      .select('id, user_id, description, assessment, is_ai_generated, created_at', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (userId) query = query.eq('user_id', userId);

    const { data, error, count } = await query;
    if (error) throw error;

    res.status(200).json({
      message: 'Assessments retrieved successfully',
      data: {
        items: data || [],
        pagination: {
          page,
          limit,
          total: count || 0,
          totalPages: count ? Math.ceil(count / limit) : 0,
        },
      },
    });
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};

export const deleteAssessmentAdmin = async (req: Request, res: Response) => {
  const { assessmentId } = req.params;
  try {
    const { error } = await supabase.from('assessments').delete().eq('id', assessmentId);
    if (error) throw error;
    res.status(200).json({ message: 'Assessment deleted successfully' });
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};

export const listConstitutionArticlesAdmin = async (_req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('constitution_articles')
      .select('*')
      .order('article_number', { ascending: true });
    if (error) throw error;
    res.status(200).json({ message: 'Constitution articles retrieved successfully', data: data || [] });
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};

export const createConstitutionArticleAdmin = async (req: Request, res: Response) => {
  try {
    const { chapter, chapter_title, article_number, article_title, article_content } = req.body;
    const { data, error } = await supabase
      .from('constitution_articles')
      .insert({ chapter, chapter_title, article_number, article_title, article_content })
      .select('*')
      .single();
    if (error) throw error;
    res.status(201).json({ message: 'Constitution article created successfully', data });
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};

export const updateConstitutionArticleAdmin = async (req: Request, res: Response) => {
  const { articleId } = req.params;
  try {
    const { chapter, chapter_title, article_number, article_title, article_content } = req.body;
    const { data, error } = await supabase
      .from('constitution_articles')
      .update({ chapter, chapter_title, article_number, article_title, article_content })
      .eq('id', articleId)
      .select('*')
      .single();
    if (error) throw error;
    res.status(200).json({ message: 'Constitution article updated successfully', data });
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};

export const deleteConstitutionArticleAdmin = async (req: Request, res: Response) => {
  const { articleId } = req.params;
  try {
    const { error } = await supabase.from('constitution_articles').delete().eq('id', articleId);
    if (error) throw error;
    res.status(200).json({ message: 'Constitution article deleted successfully' });
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};

export const listEmergencyActionsAdmin = async (_req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('emergency_actions')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.status(200).json({ message: 'Emergency actions retrieved successfully', data: data || [] });
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};

export const createEmergencyActionAdmin = async (req: Request, res: Response) => {
  try {
    const { title, description, steps, contact_info } = req.body;
    const { data, error } = await supabase
      .from('emergency_actions')
      .insert({ title, description, steps, contact_info })
      .select('*')
      .single();
    if (error) throw error;
    res.status(201).json({ message: 'Emergency action created successfully', data });
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};

export const updateEmergencyActionAdmin = async (req: Request, res: Response) => {
  const { actionId } = req.params;
  try {
    const { title, description, steps, contact_info } = req.body;
    const { data, error } = await supabase
      .from('emergency_actions')
      .update({ title, description, steps, contact_info })
      .eq('id', actionId)
      .select('*')
      .single();
    if (error) throw error;
    res.status(200).json({ message: 'Emergency action updated successfully', data });
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};

export const deleteEmergencyActionAdmin = async (req: Request, res: Response) => {
  const { actionId } = req.params;
  try {
    const { error } = await supabase.from('emergency_actions').delete().eq('id', actionId);
    if (error) throw error;
    res.status(200).json({ message: 'Emergency action deleted successfully' });
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};

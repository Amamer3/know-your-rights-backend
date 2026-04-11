import { Request, Response, NextFunction } from 'express';
import { supabase, supabaseAuth } from '../config/supabase.js';

export const authenticate = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader =
    req.headers.authorization ??
    (typeof req.headers.Authorization === 'string' ? req.headers.Authorization : undefined);

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      message: 'No token provided',
      code: 'AUTH_HEADER_MISSING',
      hint: 'Send header: Authorization: Bearer <Supabase session.access_token>',
    });
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    return res.status(401).json({
      message: 'No token provided',
      code: 'AUTH_TOKEN_EMPTY',
      hint: 'Send header: Authorization: Bearer <Supabase session.access_token>',
    });
  }

  try {
    const {
      data: { user },
      error,
    } = await supabaseAuth.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({
        message: 'Invalid or expired token',
        code: 'AUTH_TOKEN_INVALID',
        hint: 'Refresh session with supabase.auth.refreshSession() or sign in again',
      });
    }

    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({
      message: 'Authentication failed',
      code: 'AUTH_ERROR',
      hint: 'Check SUPABASE_URL and SUPABASE_ANON_KEY on the server match your app project',
    });
  }
};

export const requireAdmin = async (req: Request, res: Response, next: NextFunction) => {
  const user = req.user;
  const adminListRaw = process.env.ADMIN_EMAILS || process.env.ADMIN_EMAIL || '';
  const adminEmails = adminListRaw
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

  if (!user?.email) {
    return res.status(403).json({ message: 'Admin access denied' });
  }

  // Fast path: env allow-list.
  if (adminEmails.includes(String(user.email).toLowerCase())) {
    return next();
  }

  // DB-backed admin flag path: profiles.preferences.is_admin = true
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('preferences')
      .eq('id', user.id)
      .single();

    if (error) throw error;

    const preferences = data?.preferences;
    const isAdmin =
      preferences !== null &&
      typeof preferences === 'object' &&
      Object.prototype.hasOwnProperty.call(preferences, 'is_admin') &&
      (preferences as any).is_admin === true;

    if (!isAdmin) {
      return res.status(403).json({ message: 'Admin access denied' });
    }

    next();
  } catch (_error) {
    return res.status(403).json({ message: 'Admin access denied' });
  }
};

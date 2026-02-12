import { Request, Response } from 'express';
import { supabase } from '../config/supabase.js';

export const signup = async (req: Request, res: Response) => {
  const { email, password, name } = req.body;

  try {
    // Check if user already exists in profiles
    const { data: existingUser } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', email)
      .single();

    if (existingUser) {
      return res.status(400).json({ message: 'User with this email already exists.' });
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: name,
        },
      },
    });

    if (error) throw error;

    res.status(201).json({
      message: 'User registered successfully. Please check your email for verification.',
      data,
    });
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};

export const login = async (req: Request, res: Response) => {
  const { email, password } = req.body;

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;

    res.status(200).json({
      message: 'Login successful',
      data,
    });
  } catch (error: any) {
    res.status(401).json({ message: error.message });
  }
};

export const logout = async (req: Request, res: Response) => {
  try {
    const { error } = await supabase.auth.signOut();

    if (error) throw error;

    res.status(200).json({ message: 'Logout successful' });
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};

export const refresh = async (req: Request, res: Response) => {
  const { refresh_token } = req.body;

  try {
    const { data, error } = await supabase.auth.refreshSession({
      refresh_token,
    });

    if (error) throw error;

    res.status(200).json({
      message: 'Token refreshed successfully',
      data,
    });
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};

export const forgotPassword = async (req: Request, res: Response) => {
  const { email } = req.body;

  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email);

    if (error) throw error;

    res.status(200).json({ message: 'Password reset email sent' });
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};

export const googleLogin = async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: process.env.GOOGLE_REDIRECT_URL || 'http://localhost:3000/api/auth/callback',
      },
    });

    if (error) throw error;

    res.status(200).json({
      message: 'Google login initiated',
      url: data.url,
    });
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};

export const googleCallback = async (req: Request, res: Response) => {
  // Supabase usually handles the redirect back to the site URL.
  // If this endpoint is hit, it means the user was redirected here.
  // We check for both 'code' (OAuth flow) and 'error' in the hash/query.
  const { code, error, error_description } = req.query;

  if (error) {
    return res.status(400).json({ 
      message: 'Google login error', 
      error, 
      description: error_description 
    });
  }

  // Note: Supabase often returns the session in a URL fragment (#access_token=...)
  // which is NOT visible to the server. The 'code' is only present if using
  // the 'exchangeCodeForSession' flow.
  if (!code) {
    return res.status(200).json({ 
      message: 'Callback received', 
      info: 'If you see this, Supabase might be sending tokens in the URL fragment (#). Ensure your GOOGLE_REDIRECT_URL is set correctly in both Render and Supabase.',
      query: req.query
    });
  }

  try {
    const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code as string);
    if (exchangeError) throw exchangeError;

    res.status(200).json({
      message: 'Google login successful',
      data,
    });
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};

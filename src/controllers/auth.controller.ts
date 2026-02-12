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
  // This endpoint would handle the redirect from Google if needed
  // Supabase usually handles the token exchange, but we can provide a landing page or redirect
  const { code } = req.query;

  if (!code) {
    return res.status(400).json({ message: 'No code provided' });
  }

  try {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code as string);
    if (error) throw error;

    // Redirect to frontend with tokens or set cookies
    res.status(200).json({
      message: 'Google login successful',
      data,
    });
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};

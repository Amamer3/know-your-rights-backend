import { Request, Response } from 'express';
import { supabase } from '../config/supabase.js';

export const getProfile = async (req: Request, res: Response) => {
  const user = (req as any).user;

  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 is 'no rows returned'
      throw error;
    }

    // If no profile exists in the database yet, return the auth user data
    res.status(200).json({
      message: 'Profile retrieved successfully',
      data: data || {
        id: user.id,
        email: user.email,
        user_metadata: user.user_metadata,
      },
    });
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};

export const updateProfile = async (req: Request, res: Response) => {
  const user = (req as any).user;
  const { name, preferences } = req.body;

  try {
    // Update auth metadata
    const { data: authData, error: authError } = await supabase.auth.updateUser({
      data: { full_name: name },
    });

    if (authError) throw authError;

    // Upsert to profiles table
    const { data, error } = await supabase
      .from('profiles')
      .upsert({
        id: user.id,
        full_name: name,
        preferences,
        updated_at: new Date(),
      })
      .select()
      .single();

    if (error) throw error;

    res.status(200).json({
      message: 'Profile updated successfully',
      data,
    });
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};

export const deleteAccount = async (req: Request, res: Response) => {
  const user = (req as any).user;

  try {
    // Note: Supabase Admin API is needed to delete a user from auth.users.
    // This typically requires a service role key.
    // For this example, we'll just delete the profile data and sign out.
    
    const { error: profileError } = await supabase
      .from('profiles')
      .delete()
      .eq('id', user.id);

    if (profileError) throw profileError;

    // In a real app, you'd use admin.deleteUser(user.id) with service role key
    
    res.status(200).json({ message: 'Account deactivated successfully' });
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};

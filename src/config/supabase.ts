import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase credentials are missing. Please check your .env file.');
}

// Service role for server-side DB (bypasses RLS).
export const supabase = createClient(supabaseUrl, supabaseServiceRoleKey || supabaseAnonKey);

/** Anon client for validating end-user JWTs (getUser). Prefer this in auth middleware. */
export const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey || supabaseServiceRoleKey);

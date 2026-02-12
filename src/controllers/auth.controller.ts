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
  const { code, error, error_description } = req.query;

  if (error) {
    return res.status(400).json({ 
      message: 'Google login error', 
      error, 
      description: error_description 
    });
  }

  // If we have a code, exchange it for a session (PKCE flow)
  if (code) {
    try {
      const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code as string);
      if (exchangeError) throw exchangeError;

      // After successful exchange, we still want to redirect to the app
      // We can pass the access_token and refresh_token in the hash
      const hash = `#access_token=${data.session?.access_token}&refresh_token=${data.session?.refresh_token}&expires_in=${data.session?.expires_in}&token_type=${data.session?.token_type}`;
      
      return res.send(`
        <html>
          <body style="font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background-color: #f0f2f5;">
            <div style="text-align: center; padding: 20px; background: white; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
              <h2 style="color: #1a73e8;">Authentication Successful</h2>
              <p>Redirecting you back to the app...</p>
              <script>
                const hash = "${hash}";
                window.location.href = "knowyourrightsgh://auth-callback" + hash;
                setTimeout(() => { window.close(); }, 3000);
              </script>
            </div>
          </body>
        </html>
      `);
    } catch (error: any) {
      return res.status(400).json({ message: error.message });
    }
  }

  // If no code, it might be the implicit flow (tokens in # fragment)
  // The server can't see the hash, so we use a client-side bridge to redirect
  res.send(`
    <html>
      <body style="font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background-color: #f0f2f5;">
        <div style="text-align: center; padding: 20px; background: white; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <h2 style="color: #1a73e8;">Authentication Successful</h2>
          <p>Redirecting you back to the app...</p>
          <script>
            // Grab the fragment (#) from the current URL which contains the tokens
            const hash = window.location.hash;
            // Redirect to the mobile app using its custom scheme
            window.location.href = "knowyourrightsgh://auth-callback" + hash;
            
            // Fallback: Close the window after a delay if redirect fails
            setTimeout(() => { window.close(); }, 3000);
          </script>
        </div>
      </body>
    </html>
  `);
};

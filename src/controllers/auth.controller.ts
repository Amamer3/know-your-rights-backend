import { Request, Response } from 'express';
import { supabase } from '../config/supabase.js';

export const signup = async (req: Request, res: Response) => {
  const { email, password, name, fullName } = req.body;
  const displayName = name || fullName;

  console.log('Signup attempt:', { email, displayName });

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
          full_name: displayName,
          name: displayName, // Add both just in case
        },
      },
    });

    if (error) throw error;

    res.status(201).json({
      message: 'User registered successfully. Please check your email for verification.',
      data,
    });
  } catch (error: any) {
    console.error('Signup error:', error);
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

    // After successful login, ensure the profile exists in the database
    // This is a fallback in case the trigger failed during signup
    if (data.user) {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', data.user.id)
        .single();

      if (profileError && profileError.code === 'PGRST116') {
        // Profile doesn't exist, create it
        const displayName = data.user.user_metadata?.full_name || 
                           data.user.user_metadata?.name || 
                           data.user.user_metadata?.displayName || '';
        
        await supabase.from('profiles').insert({
          id: data.user.id,
          email: data.user.email,
          full_name: displayName,
        });
      }
    }

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
        redirectTo: 'knowyourrights://auth/callback',
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

/** Encode query for deep link so Safari accepts the URL (raw ?code=… strings can be invalid). */
function buildKnowYourRightsOAuthUrl(req: Request): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(req.query)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      for (const v of value) params.append(key, String(v));
    } else {
      params.append(key, String(value));
    }
  }
  const qs = params.toString();
  return qs ? `knowyourrights://auth/callback?${qs}` : 'knowyourrights://auth/callback';
}

/**
 * Safari and many in-app browsers reject or mishandle HTTP 302 Location: custom schemes.
 * A short HTML page that navigates via JS reliably hands off to the native app.
 */
function sendSafariSafeDeepLink(res: Response, targetUrl: string): void {
  const urlLiteral = JSON.stringify(targetUrl);
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.status(200).send(`<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Return to app</title></head>
<body>
<script>
(function () {
  var u = ${urlLiteral};
  window.location.replace(u);
  setTimeout(function () { window.location.href = u; }, 100);
  setTimeout(function () { window.location.href = u; }, 400);
  setTimeout(function () { window.close(); }, 8000);
})();
</script>
<p style="font-family:system-ui,sans-serif;text-align:center;margin-top:2rem;color:#444">Opening Know Your Rights…</p>
<p style="font-family:system-ui,sans-serif;text-align:center;font-size:14px;color:#888">If nothing happens, return to the app manually.</p>
</body></html>`);
}

/**
 * Supabase uses "Site URL" when redirectTo is not allowed. That is often the API root,
 * so OAuth returns here as /?code=… or /?error=… instead of /api/auth/callback.
 */
export function redirectRootOAuthToApp(req: Request, res: Response): boolean {
  if (req.query.code == null && req.query.error == null) {
    return false;
  }
  sendSafariSafeDeepLink(res, buildKnowYourRightsOAuthUrl(req));
  return true;
}

export const googleCallback = async (req: Request, res: Response) => {
  const { error, error_description } = req.query;

  if (error) {
    const params = new URLSearchParams();
    params.set('error', String(error));
    if (error_description != null && String(error_description).length > 0) {
      params.set('error_description', String(error_description));
    }
    sendSafariSafeDeepLink(res, `knowyourrights://auth/callback?${params.toString()}`);
    return;
  }

  if (Object.keys(req.query).length > 0) {
    sendSafariSafeDeepLink(res, buildKnowYourRightsOAuthUrl(req));
    return;
  }

  // Implicit flow: tokens live in the URL hash; the server never sees them — bridge in the browser only.
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.send(`<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Return to app</title></head>
<body>
<script>
(function () {
  var hash = window.location.hash || '';
  var base = 'knowyourrights://auth/callback';
  var url = hash ? base + hash : base;
  window.location.replace(url);
  setTimeout(function () { window.location.href = url; }, 300);
  setTimeout(function () { window.close(); }, 5000);
})();
</script>
<p style="font-family:system-ui,sans-serif;text-align:center;margin-top:2rem">Opening app…</p>
</body></html>`);
};

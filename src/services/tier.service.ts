import { supabase } from '../config/supabase.js';

export type UserSubscriptionRow = {
  id: string;
  user_id: string;
  tier: string;
  prompts_limit: number;
  prompts_used: number;
  prompts_reset_at: string;
  page_limit: number;
  paystack_customer_code?: string | null;
  paystack_subscription_code?: string | null;
  expires_at?: string | null;
};

export const TIER_DEFAULTS: Record<string, { prompts_limit: number; page_limit: number }> = {
  free: { prompts_limit: 5, page_limit: 20 },
  pro: { prompts_limit: 20, page_limit: 100 },
  premium: { prompts_limit: 100, page_limit: 100 },
};

export type PaidTier = 'pro' | 'premium';

export async function setUserSubscriptionTier(
  userId: string,
  tier: keyof typeof TIER_DEFAULTS | string,
  opts?: {
    paystack_customer_code?: string | null;
    paystack_subscription_code?: string | null;
    reset_prompt_usage?: boolean;
  },
): Promise<UserSubscriptionRow> {
  await getUserTier(userId);
  const key = (tier || 'free').toLowerCase();
  const lim = TIER_DEFAULTS[key] ?? TIER_DEFAULTS.free;

  const patch: Record<string, unknown> = {
    tier: key,
    prompts_limit: lim.prompts_limit,
    page_limit: lim.page_limit,
    prompts_reset_at: nextResetIso(),
    updated_at: new Date().toISOString(),
  };
  if (opts?.reset_prompt_usage) patch.prompts_used = 0;
  if (opts && 'paystack_customer_code' in opts) {
    patch.paystack_customer_code = opts.paystack_customer_code;
  }
  if (opts && 'paystack_subscription_code' in opts) {
    patch.paystack_subscription_code = opts.paystack_subscription_code;
  }

  const { error } = await supabase.from('user_subscriptions').update(patch).eq('user_id', userId);
  if (error) throw new Error(error.message);

  const row = await getUserTier(userId);
  return row;
}

function nextResetIso(): string {
  return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
}

export async function getUserTier(userId: string): Promise<UserSubscriptionRow> {
  const defaults = TIER_DEFAULTS.free;
  const seed = {
    user_id: userId,
    tier: 'free',
    prompts_limit: defaults.prompts_limit,
    page_limit: defaults.page_limit,
    prompts_used: 0,
    prompts_reset_at: nextResetIso(),
  };

  const { data: existing, error: fetchError } = await supabase
    .from('user_subscriptions')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (fetchError) {
    console.error('[tier] fetch subscription:', fetchError.message);
  }

  let row = existing as UserSubscriptionRow | null;

  if (!row) {
    const { data: inserted, error: insertError } = await supabase
      .from('user_subscriptions')
      .insert(seed)
      .select('*')
      .single();

    if (insertError) {
      const { data: retry } = await supabase
        .from('user_subscriptions')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();
      if (!retry) throw new Error(insertError.message);
      row = retry as UserSubscriptionRow;
    } else {
      row = inserted as UserSubscriptionRow;
    }
  }

  if (row.prompts_reset_at && new Date(row.prompts_reset_at) < new Date()) {
    const tierKey = (row.tier || 'free').toLowerCase();
    const lim = TIER_DEFAULTS[tierKey] ?? TIER_DEFAULTS.free;
    const { data: updated, error: updErr } = await supabase
      .from('user_subscriptions')
      .update({
        prompts_used: 0,
        prompts_reset_at: nextResetIso(),
        prompts_limit: lim.prompts_limit,
        page_limit: lim.page_limit,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .select('*')
      .single();

    if (!updErr && updated) {
      row = updated as UserSubscriptionRow;
    }
  }

  return row!;
}

export async function checkAndIncrementPrompt(userId: string): Promise<UserSubscriptionRow> {
  const sub = await getUserTier(userId);
  if (sub.prompts_used >= sub.prompts_limit) {
    throw new Error(`QUOTA_EXCEEDED:${sub.tier}:${sub.prompts_limit}`);
  }

  const { error: updErr } = await supabase
    .from('user_subscriptions')
    .update({
      prompts_used: sub.prompts_used + 1,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId);

  if (updErr) throw new Error(updErr.message);

  const { error: logErr } = await supabase.from('usage_logs').insert({
    user_id: userId,
    event_type: 'prompt_used',
    metadata: { tier: sub.tier },
  });
  if (logErr) {
    console.warn('[tier] usage_logs insert:', logErr.message);
  }

  return { ...sub, prompts_used: sub.prompts_used + 1 };
}

export function getExpiresAt(tier: string): string | null {
  if (tier === 'free') {
    return new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
  }
  return null;
}

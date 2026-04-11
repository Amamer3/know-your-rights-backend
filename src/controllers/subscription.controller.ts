import type { Request, Response } from 'express';
import { getUserTier, TIER_DEFAULTS } from '../services/tier.service.js';

/** Current plan + limits (from user_subscriptions). */
export async function getSubscription(req: Request, res: Response): Promise<void> {
  const user = req.user;
  if (!user?.id) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    const sub = await getUserTier(user.id);
    res.status(200).json({
      tier: sub.tier,
      prompts_limit: sub.prompts_limit,
      prompts_used: sub.prompts_used,
      prompts_reset_at: sub.prompts_reset_at,
      page_limit: sub.page_limit,
      paystack_customer_code: sub.paystack_customer_code ?? null,
      has_active_paystack_customer: Boolean(sub.paystack_customer_code),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed to load subscription';
    res.status(500).json({ error: msg });
  }
}

/** Same data shaped for usage meters (mobile / dashboard). */
export async function getUsage(req: Request, res: Response): Promise<void> {
  const user = req.user;
  if (!user?.id) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    const sub = await getUserTier(user.id);
    res.status(200).json({
      prompts: {
        used: sub.prompts_used,
        limit: sub.prompts_limit,
        remaining: Math.max(0, sub.prompts_limit - sub.prompts_used),
        resets_at: sub.prompts_reset_at,
      },
      documents: {
        page_limit: sub.page_limit,
      },
      tier: sub.tier,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed to load usage';
    res.status(500).json({ error: msg });
  }
}

/** Public tier definitions for pricing UI (no secrets). */
export function listPublicPlans(_req: Request, res: Response): void {
  const proPesewas = process.env.PAYSTACK_PRO_AMOUNT_PESOWAS?.trim();
  const premiumPesewas = process.env.PAYSTACK_PREMIUM_AMOUNT_PESOWAS?.trim();

  res.status(200).json({
    currency: 'GHS',
    tiers: [
      {
        id: 'free',
        prompts_per_month: TIER_DEFAULTS.free.prompts_limit,
        max_document_pages: TIER_DEFAULTS.free.page_limit,
        amount_pesewas: null,
      },
      {
        id: 'pro',
        prompts_per_month: TIER_DEFAULTS.pro.prompts_limit,
        max_document_pages: TIER_DEFAULTS.pro.page_limit,
        amount_pesewas: proPesewas ? parseInt(proPesewas, 10) : null,
      },
      {
        id: 'premium',
        prompts_per_month: TIER_DEFAULTS.premium.prompts_limit,
        max_document_pages: TIER_DEFAULTS.premium.page_limit,
        amount_pesewas: premiumPesewas ? parseInt(premiumPesewas, 10) : null,
      },
    ],
    paystack_public_key: process.env.PAYSTACK_PUBLIC_KEY?.trim() || null,
  });
}

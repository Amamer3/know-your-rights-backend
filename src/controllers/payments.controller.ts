import { createHmac, timingSafeEqual } from 'crypto';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { setUserSubscriptionTier, type PaidTier } from '../services/tier.service.js';
import { supabase } from '../config/supabase.js';

const InitializeSchema = z.object({
  tier: z.enum(['pro', 'premium']),
});

const VerifySchema = z.object({
  reference: z.string().min(8),
});

function paystackSecret(): string | undefined {
  return process.env.PAYSTACK_SECRET_KEY?.trim() || undefined;
}

function tierAmountPesewas(tier: PaidTier): number | null {
  const key = tier === 'pro' ? 'PAYSTACK_PRO_AMOUNT_PESOWAS' : 'PAYSTACK_PREMIUM_AMOUNT_PESOWAS';
  const raw = process.env[key]?.trim();
  if (!raw) return null;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function verifySignature(rawBody: Buffer, signature: string | undefined, secret: string): boolean {
  if (!signature) return false;
  const hash = createHmac('sha512', secret).update(rawBody).digest('hex');
  if (hash.length !== signature.length) return false;
  try {
    const a = Buffer.from(hash, 'hex');
    const b = Buffer.from(signature, 'hex');
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/** Start a one-off Paystack transaction; client opens authorization_url. */
export async function initializePaystack(req: Request, res: Response): Promise<void> {
  const secret = paystackSecret();
  if (!secret) {
    res.status(503).json({ error: 'Payments are not configured', code: 'PAYMENTS_DISABLED' });
    return;
  }

  const callbackUrl = process.env.PAYSTACK_CALLBACK_URL?.trim();
  if (!callbackUrl) {
    res.status(503).json({ error: 'PAYSTACK_CALLBACK_URL is not set', code: 'PAYMENTS_MISCONFIGURED' });
    return;
  }

  const parsed = InitializeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid body', details: parsed.error.flatten().fieldErrors });
    return;
  }

  const user = req.user;
  if (!user?.id || !user.email) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const tier = parsed.data.tier;
  const amount = tierAmountPesewas(tier);
  if (amount == null) {
    res.status(503).json({
      error: `Set PAYSTACK_${tier.toUpperCase()}_AMOUNT_PESOWAS in environment (amount in pesewas, e.g. 5000 = 50 GHS)`,
      code: 'PAYMENTS_MISCONFIGURED',
    });
    return;
  }

  try {
    const paystackRes = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secret}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: user.email,
        amount,
        currency: 'GHS',
        callback_url: callbackUrl,
        metadata: {
          user_id: user.id,
          tier,
        },
      }),
    });

    const json = (await paystackRes.json()) as {
      status?: boolean;
      message?: string;
      data?: { authorization_url?: string; reference?: string; access_code?: string };
    };

    if (!paystackRes.ok || !json.status || !json.data?.authorization_url) {
      res.status(502).json({
        error: json.message ?? 'Paystack initialize failed',
        code: 'PAYSTACK_ERROR',
      });
      return;
    }

    res.status(200).json({
      authorization_url: json.data.authorization_url,
      reference: json.data.reference,
      access_code: json.data.access_code,
      tier,
      amount_pesewas: amount,
    });
  } catch (e) {
    console.error('[payments] initialize', e);
    res.status(500).json({ error: 'Failed to start payment', code: 'PAYSTACK_ERROR' });
  }
}

/** Call after redirect from Paystack if webhook is slow; idempotent tier upgrade. */
export async function verifyPaystackTransaction(req: Request, res: Response): Promise<void> {
  const secret = paystackSecret();
  if (!secret) {
    res.status(503).json({ error: 'Payments are not configured', code: 'PAYMENTS_DISABLED' });
    return;
  }

  const parsed = VerifySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid body', details: parsed.error.flatten().fieldErrors });
    return;
  }

  const user = req.user;
  if (!user?.id) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    const paystackRes = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(parsed.data.reference)}`,
      { headers: { Authorization: `Bearer ${secret}` } },
    );

    const json = (await paystackRes.json()) as {
      status?: boolean;
      message?: string;
      data?: {
        status?: string;
        metadata?: Record<string, unknown>;
        customer?: { customer_code?: string };
        amount?: number;
      };
    };

    if (!paystackRes.ok || !json.status || json.data?.status !== 'success') {
      res.status(400).json({
        error: json.message ?? 'Payment not successful',
        status: json.data?.status ?? null,
      });
      return;
    }

    const meta = json.data?.metadata ?? {};
    const userId = typeof meta.user_id === 'string' ? meta.user_id : null;
    const tierRaw = typeof meta.tier === 'string' ? meta.tier.toLowerCase() : '';
    if (userId !== user.id || (tierRaw !== 'pro' && tierRaw !== 'premium')) {
      res.status(403).json({ error: 'This payment does not belong to the current user' });
      return;
    }

    const expectedAmount = tierAmountPesewas(tierRaw as PaidTier);
    const paid = json.data?.amount;
    if (expectedAmount != null && paid != null && paid !== expectedAmount) {
      res.status(400).json({ error: 'Amount mismatch', code: 'AMOUNT_MISMATCH' });
      return;
    }

    await setUserSubscriptionTier(user.id, tierRaw, {
      paystack_customer_code: json.data?.customer?.customer_code ?? null,
      reset_prompt_usage: true,
    });

    res.status(200).json({ ok: true, tier: tierRaw });
  } catch (e) {
    console.error('[payments] verify', e);
    res.status(500).json({ error: 'Verification failed', code: 'PAYSTACK_ERROR' });
  }
}

/** Paystack webhook — must receive raw JSON body (see app.ts). */
export async function paystackWebhook(req: Request, res: Response): Promise<void> {
  const secret = paystackSecret();
  if (!secret) {
    res.status(503).send('disabled');
    return;
  }

  const signature = req.headers['x-paystack-signature'];
  const sigStr = Array.isArray(signature) ? signature[0] : signature;
  const raw = req.body as Buffer;
  if (!Buffer.isBuffer(raw) || raw.length === 0) {
    res.status(400).send('invalid body');
    return;
  }

  if (!verifySignature(raw, sigStr, secret)) {
    res.status(400).send('invalid signature');
    return;
  }

  let event: { event?: string; data?: Record<string, unknown> };
  try {
    event = JSON.parse(raw.toString('utf8')) as { event?: string; data?: Record<string, unknown> };
  } catch {
    res.status(400).send('invalid json');
    return;
  }

  try {
    if (event.event === 'charge.success') {
      const data = event.data ?? {};
      const meta = (data.metadata ?? {}) as Record<string, unknown>;
      const userId = typeof meta.user_id === 'string' ? meta.user_id : null;
      const tierRaw = typeof meta.tier === 'string' ? meta.tier.toLowerCase() : '';
      if (userId && (tierRaw === 'pro' || tierRaw === 'premium')) {
        const customer = data.customer as { customer_code?: string } | undefined;
        await setUserSubscriptionTier(userId, tierRaw, {
          paystack_customer_code: customer?.customer_code ?? null,
          reset_prompt_usage: true,
        });
      }
    }

    if (event.event === 'subscription.disable' || event.event === 'subscription.not_renew') {
      const data = event.data ?? {};
      const customer = data.customer as { customer_code?: string } | undefined;
      const code = customer?.customer_code;
      if (code) {
        const { data: sub } = await supabase
          .from('user_subscriptions')
          .select('user_id')
          .eq('paystack_customer_code', code)
          .maybeSingle();
        const uid = sub?.user_id as string | undefined;
        if (uid) {
          await setUserSubscriptionTier(uid, 'free', { reset_prompt_usage: false });
        }
      }
    }

    res.status(200).json({ received: true });
  } catch (e) {
    console.error('[payments] webhook handler', e);
    res.status(500).json({ error: 'webhook processing failed' });
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeHtmlAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/**
 * Paystack redirects the customer’s browser here after payment (GET ?reference=&trxref=).
 *
 * iOS Safari often shows “address is invalid” if JavaScript auto-navigates to a custom scheme
 * (e.g. knowyourrights://) when the app isn’t registered or Expo Go doesn’t own that scheme.
 * So we use a visible “Open app” tap target (user gesture) and optional HTTPS auto-redirect only.
 *
 * Env:
 * - PAYSTACK_MOBILE_RETURN_URL — deep link base (default knowyourrights://paystack-return)
 * - PAYSTACK_WEB_CONTINUE_URL — optional https URL; if set, we also show “Continue on the web”
 */
export function paystackCallbackRedirect(req: Request, res: Response): void {
  const q = req.query;
  const reference =
    (typeof q.reference === 'string' && q.reference) ||
    (typeof q.trxref === 'string' && q.trxref) ||
    '';

  const base =
    process.env.PAYSTACK_MOBILE_RETURN_URL?.trim() || 'knowyourrights://paystack-return';
  const sep = base.includes('?') ? '&' : '?';
  const appUrl = `${base}${sep}reference=${encodeURIComponent(reference)}`;
  const appUrlJson = JSON.stringify(appUrl);
  const webContinue = process.env.PAYSTACK_WEB_CONTINUE_URL?.trim();
  const webHref =
    webContinue &&
    `${webContinue}${webContinue.includes('?') ? '&' : '?'}reference=${encodeURIComponent(reference)}`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.status(200).send(`<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Payment complete</title></head>
<body style="margin:0;padding:16px;font-family:system-ui,-apple-system,sans-serif;background:#f4f4f5;">
<p style="text-align:center;margin-top:1.5rem;font-size:18px;font-weight:600;">Payment complete</p>
<p style="text-align:center;color:#52525b;font-size:15px;">Return to the app to finish. On iPhone, tap the button below (Safari blocks automatic opens for custom links).</p>
<p style="text-align:center;margin:1.5rem 0;">
  <a href="${escapeHtmlAttr(appUrl)}" style="display:inline-block;padding:14px 24px;background:#16a34a;color:#fff;text-decoration:none;border-radius:10px;font-weight:600;">Open app</a>
</p>
${
  webHref
    ? `<p style="text-align:center;"><a href="${escapeHtmlAttr(webHref)}" style="color:#2563eb;">Continue on the web</a></p>`
    : ''
}
<p style="text-align:center;font-size:13px;color:#71717a;word-break:break-all;">Reference: ${escapeHtml(reference || '—')}</p>
<script>
(function () {
  var u = ${appUrlJson};
  if (u.indexOf('https://') === 0) {
    window.location.replace(u);
  }
})();
</script>
</body></html>`);
}

import { supabase } from '../config/supabase.js';

export async function runRetentionCleanup(): Promise<void> {
  const now = new Date().toISOString();
  console.log('[Retention] Running cleanup job...');

  const { error: docErr, count: docsDeleted } = await supabase
    .from('documents')
    .delete({ count: 'exact' })
    .lt('expires_at', now);

  if (docErr) console.error('[Retention] documents:', docErr.message);

  const { error: recErr, count: recsDeleted } = await supabase
    .from('recordings')
    .delete({ count: 'exact' })
    .lt('expires_at', now);

  if (recErr) console.error('[Retention] recordings:', recErr.message);

  const { error: convErr, count: convsDeleted } = await supabase
    .from('conversations')
    .delete({ count: 'exact' })
    .lt('expires_at', now);

  if (convErr) console.error('[Retention] conversations:', convErr.message);

  console.log(
    `[Retention] Deleted: ${docsDeleted ?? 0} docs, ${recsDeleted ?? 0} recordings, ${convsDeleted ?? 0} conversations`,
  );
}

let intervalId: ReturnType<typeof setInterval> | undefined;

export function startRetentionSchedule(): void {
  if (intervalId) return;
  void runRetentionCleanup();
  intervalId = setInterval(() => {
    void runRetentionCleanup();
  }, 6 * 60 * 60 * 1000);
}

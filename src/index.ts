import 'dotenv/config';
import { validateEnv } from './lib/validateEnv.js';

validateEnv();

async function main() {
  const { default: app } = await import('./app.js');
  const { initConstitutionCache } = await import('./services/constitution-cache.service.js');
  const { startRetentionSchedule } = await import('./jobs/retention.job.js');

  await initConstitutionCache();
  startRetentionSchedule();

  const PORT = Number(process.env.PORT) || 3000;
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

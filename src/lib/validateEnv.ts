import { z } from 'zod';

const EnvSchema = z.object({
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(10),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(10),
  OPENAI_API_KEY: z.string().min(10),
  CLIENT_URL: z.string().optional(),
});

export function validateEnv(): void {
  const result = EnvSchema.safeParse(process.env);
  if (!result.success) {
    console.error('Missing environment variables:', result.error.flatten().fieldErrors);
    process.exit(1);
  }
}

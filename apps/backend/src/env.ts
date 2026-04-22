import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

// process.loadEnvFile is a Node 20.12+ built-in; missing file is intentionally ignored
const __dirname = resolve(fileURLToPath(import.meta.url), "..");
try { process.loadEnvFile(resolve(__dirname, "../../../.env")); }
catch (err: unknown) { if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err; }

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  FRONTEND_URL: z.string().url("FRONTEND_URL must be a valid URL"),
  BACKEND_PORT: z.coerce.number().int().positive().default(3001),
  REDIS_URL: z.string().min(1, "REDIS_URL is required").default("redis://localhost:6379"),
});

export type Env = z.infer<typeof envSchema>;

let _env: Env | null = null;

export function loadEnv(): Env {
  if (_env) return _env;

  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error("Invalid environment variables:");
    for (const issue of result.error.issues) {
      console.error(`  ${issue.path.join(".")}: ${issue.message}`);
    }
    process.exit(1);
  }

  _env = result.data;
  return _env;
}

export function getEnv(): Env {
  if (!_env) {
    throw new Error("Environment not loaded. Call loadEnv() first.");
  }
  return _env;
}

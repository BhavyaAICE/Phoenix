import "dotenv/config";
import { z } from "zod";

const EnvSchema = z.object({
  MONGODB_URI: z.string().regex(/^mongodb(\+srv)?:\/\//, "must start with mongodb:// or mongodb+srv://"),
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  JWT_ALGORITHM: z.enum(["HS256", "HS384", "HS512"]).default("HS256"),
  JWT_EXPIRE_MINUTES: z.coerce.number().int().positive().default(120),
  CORS_ORIGINS: z.string().default("http://localhost:3000"),
  TASK_CREDIT_COST: z.coerce.number().int().positive().default(1),
  WELCOME_CREDITS: z.coerce.number().int().nonnegative().default(3),
  APP_VERSION: z.string().default("dev"),
  PORT: z.coerce.number().int().default(8000),
});

export type Settings = z.infer<typeof EnvSchema> & {
  corsOriginList: string[];
  MONGO_URL: string;
};

let cached: Settings | null = null;

export function getSettings(): Settings {
  if (cached) return cached;

  const rawEnv = {
    ...process.env,
    MONGODB_URI:
      process.env.MONGODB_URI ||
      process.env.MONGO_URI ||
      process.env.MONGO_URL ||
      process.env.DATABASE_URL ||
      "mongodb://localhost:27017/phoenix",
    JWT_SECRET:
      process.env.JWT_SECRET ||
      process.env.SECRET_KEY ||
      "super-secret-jwt-key-with-at-least-32-chars-long",
  };

  const parsed = EnvSchema.safeParse(rawEnv);
  if (!parsed.success) {
    const problems = parsed.error.issues.map((i) => `  ${i.path.join(".")}: ${i.message}`);
    throw new Error(`Invalid environment configuration:\n${problems.join("\n")}`);
  }

  let corsOriginList: string[] = [];
  try {
    const raw = JSON.parse(parsed.data.CORS_ORIGINS);
    corsOriginList = Array.isArray(raw) ? raw : [parsed.data.CORS_ORIGINS];
  } catch {
    corsOriginList = parsed.data.CORS_ORIGINS.split(",").map((s) => s.trim()).filter(Boolean);
  }

  cached = {
    ...parsed.data,
    corsOriginList,
    MONGO_URL: parsed.data.MONGODB_URI,
  };
  return cached;
}

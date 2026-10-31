import "dotenv/config";
import { afterAll, beforeAll } from "vitest";

process.env.MONGODB_URI ??=
  process.env.MONGO_URI ||
  process.env.MONGO_URL ||
  process.env.DATABASE_URL;
process.env.JWT_SECRET ??= "test-secret-that-is-at-least-32-bytes-long";

beforeAll(async () => {
  const { connectDb } = await import("../src/db");
  await connectDb(process.env.MONGODB_URI!);
});

afterAll(async () => {
  const { disconnectDb } = await import("../src/db");
  await disconnectDb();
});

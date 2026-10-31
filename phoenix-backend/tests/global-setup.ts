// Smoke tests need a DISPOSABLE MongoDB database (it is wiped):
//   MONGODB_URI=mongodb://localhost:27017/phoenix_test npm test
import "dotenv/config";
import { execSync } from "node:child_process";

export default function setup() {
  process.env.MONGODB_URI ??=
    process.env.MONGO_URI ||
    process.env.MONGO_URL ||
    process.env.DATABASE_URL;
  if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI must point at a disposable test DB");
  process.env.JWT_SECRET ??= "test-secret-that-is-at-least-32-bytes-long";
  execSync("npx tsx scripts/seed.ts --reset", { stdio: "inherit", env: process.env });
}

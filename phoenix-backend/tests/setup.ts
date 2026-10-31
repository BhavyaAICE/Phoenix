import "dotenv/config";
import { connectDb, disconnectDb } from "../src/db";

export default async function setup() {
  process.env.MONGODB_URI ??=
    process.env.MONGO_URI ||
    process.env.MONGO_URL ||
    process.env.DATABASE_URL ||
    "mongodb://localhost:27017/phoenix_test";
  process.env.JWT_SECRET ??= "test-secret-that-is-at-least-32-bytes-long";
  await connectDb(process.env.MONGODB_URI);
  return async () => {
    await disconnectDb();
  };
}

import type { Request, Response } from "express";
import { createApp } from "../src/app";
import { getSettings } from "../src/config";
import { connectDb } from "../src/db";

let isConnected = false;
const app = createApp();

export default async function handler(req: Request, res: Response) {
  if (!isConnected) {
    const settings = getSettings();
    await connectDb(settings.MONGO_URL || settings.MONGODB_URI);
    isConnected = true;
  }
  return app(req, res);
}

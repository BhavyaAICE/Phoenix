import { Router } from "express";
import mongoose from "mongoose";
import { getSettings } from "../config";

export const healthRouter = Router();

healthRouter.get(["/api/health", "/health"], async (_req, res) => {
  const isConnected = mongoose.connection.readyState === 1;
  if (!isConnected) {
    res.status(503).json({ status: "error", version: getSettings().APP_VERSION, db: "error" });
    return;
  }
  try {
    if (mongoose.connection.db) {
      await mongoose.connection.db.admin().ping();
    }
    res.json({ status: "ok", version: getSettings().APP_VERSION, db: "ok" });
  } catch {
    res.status(503).json({ status: "error", version: getSettings().APP_VERSION, db: "error" });
  }
});

import dns from "node:dns";
import mongoose from "mongoose";
import { CreditLedger, Project, Task, User, Workspace, WorkspaceMember } from "./models";

mongoose.set("strictQuery", true);
mongoose.set("autoIndex", true);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const ALL_MODELS: mongoose.Model<any>[] = [User, Workspace, WorkspaceMember, Project, Task, CreditLedger];

export async function connectDb(uri: string): Promise<void> {
  try {
    await mongoose.connect(uri);
  } catch (err: unknown) {
    const errStr = String(err);
    if (uri.startsWith("mongodb+srv://") && (errStr.includes("ECONNREFUSED") || errStr.includes("querySrv"))) {
      try {
        dns.setServers(["8.8.8.8", "8.8.4.4", "1.1.1.1"]);
        await mongoose.connect(uri);
      } catch {
        throw err;
      }
    } else {
      throw err;
    }
  }
  await Promise.all(ALL_MODELS.map((m) => m.init()));
}

export async function disconnectDb(): Promise<void> {
  await mongoose.disconnect();
}

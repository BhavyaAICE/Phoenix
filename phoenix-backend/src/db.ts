import mongoose from "mongoose";
import { CreditLedger, Project, Task, User, Workspace, WorkspaceMember } from "./models";

mongoose.set("strictQuery", true);
mongoose.set("autoIndex", true);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const ALL_MODELS: mongoose.Model<any>[] = [User, Workspace, WorkspaceMember, Project, Task, CreditLedger];

export async function connectDb(uri: string): Promise<void> {
  await mongoose.connect(uri);
  await Promise.all(ALL_MODELS.map((m) => m.init()));
}

export async function disconnectDb(): Promise<void> {
  await mongoose.disconnect();
}

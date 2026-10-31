import mongoose, { Schema } from "mongoose";

export const ROLES = ["owner", "admin", "member"] as const;
export type Role = (typeof ROLES)[number];

export interface IWorkspace {
  _id: mongoose.Types.ObjectId;
  name: string;
  owner: mongoose.Types.ObjectId;
  owner_id?: mongoose.Types.ObjectId;
  credits: number;
  createdAt: Date;
}

const workspaceSchema = new Schema<IWorkspace>(
  {
    name: { type: String, required: true, trim: true },
    owner: { type: Schema.Types.ObjectId, ref: "User", required: true },
    owner_id: { type: Schema.Types.ObjectId, ref: "User" },
    credits: { type: Number, default: 0, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

workspaceSchema.pre("validate", function (next) {
  const anyThis = this as unknown as { owner?: unknown; owner_id?: unknown };
  if (anyThis.owner_id && !anyThis.owner) {
    anyThis.owner = anyThis.owner_id;
  }
  if (anyThis.owner && !anyThis.owner_id) {
    anyThis.owner_id = anyThis.owner;
  }
  next();
});

export const Workspace: mongoose.Model<IWorkspace> =
  (mongoose.models.Workspace as mongoose.Model<IWorkspace>) ||
  mongoose.model<IWorkspace>("Workspace", workspaceSchema);

export interface IWorkspaceMember {
  _id: mongoose.Types.ObjectId;
  workspace: mongoose.Types.ObjectId;
  workspace_id?: mongoose.Types.ObjectId;
  user: mongoose.Types.ObjectId;
  user_id?: mongoose.Types.ObjectId;
  role: Role;
}

const memberSchema = new Schema<IWorkspaceMember>({
  workspace: { type: Schema.Types.ObjectId, ref: "Workspace", required: true },
  workspace_id: { type: Schema.Types.ObjectId, ref: "Workspace" },
  user: { type: Schema.Types.ObjectId, ref: "User", required: true },
  user_id: { type: Schema.Types.ObjectId, ref: "User" },
  role: { type: String, enum: ROLES, required: true, default: "member" },
});
memberSchema.index({ workspace: 1, user: 1 }, { unique: true });

memberSchema.pre("validate", function (next) {
  const anyThis = this as unknown as { workspace?: unknown; workspace_id?: unknown; user?: unknown; user_id?: unknown };
  if (anyThis.workspace_id && !anyThis.workspace) anyThis.workspace = anyThis.workspace_id;
  if (anyThis.workspace && !anyThis.workspace_id) anyThis.workspace_id = anyThis.workspace;
  if (anyThis.user_id && !anyThis.user) anyThis.user = anyThis.user_id;
  if (anyThis.user && !anyThis.user_id) anyThis.user_id = anyThis.user;
  next();
});

export const WorkspaceMember: mongoose.Model<IWorkspaceMember> =
  (mongoose.models.WorkspaceMember as mongoose.Model<IWorkspaceMember>) ||
  mongoose.model<IWorkspaceMember>("WorkspaceMember", memberSchema);

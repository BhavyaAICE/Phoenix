import mongoose, { Schema } from "mongoose";

export interface IProject {
  _id: mongoose.Types.ObjectId;
  workspace: mongoose.Types.ObjectId;
  workspace_id?: mongoose.Types.ObjectId;
  name: string;
  description: string;
  createdAt: Date;
}

const projectSchema = new Schema<IProject>(
  {
    workspace: { type: Schema.Types.ObjectId, ref: "Workspace", required: true, index: true },
    workspace_id: { type: Schema.Types.ObjectId, ref: "Workspace" },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

projectSchema.pre("validate", function (next) {
  const anyThis = this as unknown as { workspace?: unknown; workspace_id?: unknown };
  if (anyThis.workspace_id && !anyThis.workspace) {
    anyThis.workspace = anyThis.workspace_id;
  }
  if (anyThis.workspace && !anyThis.workspace_id) {
    anyThis.workspace_id = anyThis.workspace;
  }
  next();
});

export const Project: mongoose.Model<IProject> =
  (mongoose.models.Project as mongoose.Model<IProject>) ||
  mongoose.model<IProject>("Project", projectSchema);

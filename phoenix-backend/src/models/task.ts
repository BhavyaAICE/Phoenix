import mongoose, { Schema } from "mongoose";

export const TASK_STATUSES = ["todo", "in_progress", "done"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export interface ITask {
  _id: mongoose.Types.ObjectId;
  project: mongoose.Types.ObjectId;
  project_id?: mongoose.Types.ObjectId;
  title: string;
  status: TaskStatus;
  createdBy: mongoose.Types.ObjectId;
  created_by_id?: mongoose.Types.ObjectId;
  assignee: mongoose.Types.ObjectId | null;
  assignee_id?: mongoose.Types.ObjectId | null;
  createdAt: Date;
}

const taskSchema = new Schema<ITask>({
  project: { type: Schema.Types.ObjectId, ref: "Project", required: true },
  project_id: { type: Schema.Types.ObjectId, ref: "Project" },
  title: { type: String, required: true, trim: true },
  status: {
    type: String,
    enum: ["todo", "in_progress", "doing", "done"],
    required: true,
    default: "todo",
    set: (v: string) => (v === "doing" ? "in_progress" : v),
  },
  createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  created_by_id: { type: Schema.Types.ObjectId, ref: "User" },
  assignee: { type: Schema.Types.ObjectId, ref: "User", default: null },
  assignee_id: { type: Schema.Types.ObjectId, ref: "User", default: null },
  createdAt: { type: Date, required: true, default: () => new Date() },
});
taskSchema.index({ project: 1, createdAt: -1, _id: -1 });

taskSchema.pre("validate", function (next) {
  const anyThis = this as unknown as {
    project?: unknown;
    project_id?: unknown;
    createdBy?: unknown;
    created_by?: unknown;
    created_by_id?: unknown;
    assignee?: unknown;
    assignee_id?: unknown;
  };
  if (anyThis.project_id && !anyThis.project) anyThis.project = anyThis.project_id;
  if (anyThis.project && !anyThis.project_id) anyThis.project_id = anyThis.project;
  if (anyThis.created_by && !anyThis.createdBy) anyThis.createdBy = anyThis.created_by;
  if (anyThis.created_by_id && !anyThis.createdBy) anyThis.createdBy = anyThis.created_by_id;
  if (anyThis.createdBy && !anyThis.created_by_id) anyThis.created_by_id = anyThis.createdBy;
  if (anyThis.assignee_id && !anyThis.assignee) anyThis.assignee = anyThis.assignee_id;
  if (anyThis.assignee && !anyThis.assignee_id) anyThis.assignee_id = anyThis.assignee;
  next();
});

export const Task: mongoose.Model<ITask> =
  (mongoose.models.Task as mongoose.Model<ITask>) ||
  mongoose.model<ITask>("Task", taskSchema);

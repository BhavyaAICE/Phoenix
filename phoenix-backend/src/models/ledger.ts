import mongoose, { Schema } from "mongoose";

export interface ICreditLedger {
  _id: mongoose.Types.ObjectId;
  workspace: mongoose.Types.ObjectId;
  workspace_id?: mongoose.Types.ObjectId;
  delta: number;
  reason: string;
  task: mongoose.Types.ObjectId | null;
  idempotencyKey?: string;
  idempotency_key?: string;
  createdAt: Date;
}

/** Append-only credit history. */
const ledgerSchema = new Schema<ICreditLedger>(
  {
    workspace: { type: Schema.Types.ObjectId, ref: "Workspace", required: true, index: true },
    workspace_id: { type: Schema.Types.ObjectId, ref: "Workspace" },
    delta: { type: Number, required: true },
    reason: { type: String, required: true },
    task: { type: Schema.Types.ObjectId, ref: "Task", default: null },
    idempotencyKey: { type: String, default: undefined },
    idempotency_key: { type: String, default: undefined },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);
ledgerSchema.index(
  { workspace: 1, idempotencyKey: 1 },
  { unique: true, partialFilterExpression: { idempotencyKey: { $type: "string" } } }
);

ledgerSchema.pre("validate", function (next) {
  const anyThis = this as unknown as {
    workspace?: unknown;
    workspace_id?: unknown;
    idempotencyKey?: unknown;
    idempotency_key?: unknown;
  };
  if (anyThis.workspace_id && !anyThis.workspace) anyThis.workspace = anyThis.workspace_id;
  if (anyThis.workspace && !anyThis.workspace_id) anyThis.workspace_id = anyThis.workspace;
  if (anyThis.idempotency_key && !anyThis.idempotencyKey) anyThis.idempotencyKey = anyThis.idempotency_key;
  if (anyThis.idempotencyKey && !anyThis.idempotency_key) anyThis.idempotency_key = anyThis.idempotencyKey;
  next();
});

export const CreditLedger: mongoose.Model<ICreditLedger> =
  (mongoose.models.CreditLedger as mongoose.Model<ICreditLedger>) ||
  mongoose.model<ICreditLedger>("CreditLedger", ledgerSchema);

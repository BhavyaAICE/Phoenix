import mongoose, { Schema } from "mongoose";

export interface IUser {
  _id: mongoose.Types.ObjectId;
  email: string;
  fullName: string;
  full_name?: string;
  passwordHash: string;
  password?: string;
  createdAt: Date;
}

export const userSchema = new Schema<IUser>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    fullName: { type: String, trim: true },
    full_name: { type: String, trim: true },
    passwordHash: { type: String },
    password: { type: String },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

userSchema.pre("validate", function (next) {
  const anyThis = this as unknown as Record<string, unknown>;
  if (!this.fullName && anyThis.full_name) {
    this.fullName = String(anyThis.full_name);
  }
  if (!anyThis.full_name && this.fullName) {
    anyThis.full_name = this.fullName;
  }
  if (!this.fullName) {
    this.invalidate("fullName", "Full name is required");
  }
  if (this.password && !this.passwordHash) {
    this.passwordHash = this.password;
  }
  if (this.passwordHash && !this.password) {
    this.password = this.passwordHash;
  }
  if (!this.passwordHash && !this.password) {
    this.invalidate("passwordHash", "Password is required");
  }
  next();
});

userSchema.virtual("displayName").get(function () {
  return this.fullName || (this as unknown as { full_name?: string }).full_name || this.email;
});

export const User: mongoose.Model<IUser> =
  (mongoose.models.User as mongoose.Model<IUser>) || mongoose.model<IUser>("User", userSchema);

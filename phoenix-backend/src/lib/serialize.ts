// The public JSON contract is snake_case with string ids.
import type { Types } from "mongoose";

type IdLike = Types.ObjectId | string;
const id = (v: IdLike | null | undefined) => (v ? String(v) : null);

export const userOut = (u: { _id: IdLike; email: string; fullName?: string; full_name?: string }) => ({
  id: String(u._id),
  email: u.email,
  full_name: u.fullName || u.full_name || "",
});

export const projectOut = (p: {
  _id: IdLike;
  workspace?: IdLike;
  workspace_id?: IdLike;
  name: string;
  description?: string | null;
  createdAt?: Date | string | null;
  created_at?: Date | string | null;
}) => {
  const rawDate = p.createdAt ?? p.created_at;
  const dateObj = rawDate ? (rawDate instanceof Date ? rawDate : new Date(rawDate)) : new Date();
  return {
    id: String(p._id),
    workspace_id: String(p.workspace || p.workspace_id),
    name: p.name,
    description: p.description ?? "",
    created_at: dateObj.toISOString(),
  };
};

export const taskOut = (t: {
  _id: IdLike;
  project?: IdLike;
  project_id?: IdLike;
  title: string;
  status: string;
  createdBy?: IdLike;
  created_by?: IdLike;
  created_by_id?: IdLike;
  assignee?: IdLike | null;
  assignee_id?: IdLike | null;
  createdAt?: Date | string | null;
  created_at?: Date | string | null;
}) => {
  const rawDate = t.createdAt ?? t.created_at;
  const dateObj = rawDate ? (rawDate instanceof Date ? rawDate : new Date(rawDate)) : new Date();
  return {
    id: String(t._id),
    project_id: String(t.project || t.project_id),
    title: t.title,
    status: t.status === "doing" ? "in_progress" : t.status,
    created_by_id: String(t.createdBy || t.created_by || t.created_by_id),
    assignee_id: id(t.assignee ?? t.assignee_id),
    created_at: dateObj.toISOString(),
  };
};

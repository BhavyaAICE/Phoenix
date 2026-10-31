import { Types } from "mongoose";
import { Project, User, Workspace, WorkspaceMember, type Role } from "../models";
import { asyncHandler, HttpError } from "./http";
import { decodeAccessToken } from "./security";

export type CurrentUser = { _id: Types.ObjectId; email: string; fullName: string };

export type MemberDoc = {
  _id: Types.ObjectId;
  workspace: Types.ObjectId;
  user: Types.ObjectId;
  role: Role;
};

export const requireUser = asyncHandler(async (req, res, next) => {
  const [scheme, token] = (req.headers.authorization ?? "").split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) {
    throw new HttpError(401, "Not authenticated");
  }
  let userId: string;
  try {
    userId = decodeAccessToken(token);
  } catch {
    throw new HttpError(401, "Invalid or expired token");
  }
  const user = /^[a-f0-9]{24}$/i.test(userId) ? await User.findById(userId).lean() : null;
  if (!user) throw new HttpError(401, "User no longer exists");
  res.locals.user = user;
  next();
});

export function currentUser(locals: Record<string, unknown>): CurrentUser {
  return locals.user as CurrentUser;
}

export async function requireMember(workspaceId: Types.ObjectId, user: CurrentUser): Promise<MemberDoc> {
  const member = await WorkspaceMember.findOne({ workspace: workspaceId, user: user._id }).lean();
  if (member) return member as MemberDoc;
  const ws = await Workspace.findById(workspaceId).lean();
  if (ws && String(ws.owner) === String(user._id)) {
    return { _id: new Types.ObjectId(), workspace: workspaceId, user: user._id, role: "owner" };
  }
  // 404 rather than 403 so we don't leak which workspace ids exist.
  throw new HttpError(404, "Workspace not found");
}

export async function requireAdmin(workspaceId: Types.ObjectId, user: CurrentUser): Promise<MemberDoc> {
  const member = await requireMember(workspaceId, user);
  if (member.role !== "owner" && member.role !== "admin") {
    throw new HttpError(403, "Admin role required");
  }
  return member;
}

export async function getProjectForUser(projectId: Types.ObjectId, user: CurrentUser) {
  const project = await Project.findById(projectId).lean();
  if (!project) throw new HttpError(404, "Project not found");
  try {
    await requireMember(project.workspace, user);
  } catch {
    throw new HttpError(404, "Project not found");
  }
  return project;
}

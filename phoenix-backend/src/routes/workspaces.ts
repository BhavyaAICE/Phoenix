import { Router } from "express";
import { getSettings } from "../config";
import { currentUser, requireAdmin, requireMember, requireUser } from "../lib/auth";
import { asyncHandler, HttpError, isDuplicateKey, parseBody, parseId } from "../lib/http";
import { MemberIn, TopUpIn, WorkspaceIn } from "../lib/schemas";
import { CreditLedger, User, Workspace, WorkspaceMember } from "../models";

export const workspacesRouter = Router();
workspacesRouter.use("/api/workspaces", requireUser);

const wsOut = (ws: { _id: unknown; name: string; owner: unknown }, role: string) => ({
  id: String(ws._id),
  name: ws.name,
  owner_id: String(ws.owner),
  role,
});

workspacesRouter.get(
  "/api/workspaces",
  asyncHandler(async (_req, res) => {
    const user = currentUser(res.locals);
    const memberships = await WorkspaceMember.find({ user: user._id }).lean();
    const wsIds = memberships.map((m) => m.workspace);
    const workspaces = await Workspace.find({ $or: [{ _id: { $in: wsIds } }, { owner: user._id }] })
      .sort({ _id: 1 })
      .lean();
    const roleOf = new Map(memberships.map((m) => [String(m.workspace), m.role]));
    res.json(
      workspaces.map((ws) =>
        wsOut(ws, roleOf.get(String(ws._id)) ?? (String(ws.owner) === String(user._id) ? "owner" : "member"))
      )
    );
  })
);

workspacesRouter.post(
  "/api/workspaces",
  asyncHandler(async (req, res) => {
    const user = currentUser(res.locals);
    const body = parseBody(WorkspaceIn, req.body);
    const welcome = getSettings().WELCOME_CREDITS;
    const ws = await Workspace.create({ name: body.name, owner: user._id, credits: welcome });
    await WorkspaceMember.create({ workspace: ws._id, user: user._id, role: "owner" });
    await CreditLedger.create({ workspace: ws._id, delta: welcome, reason: "welcome credits" });
    res.status(201).json(wsOut(ws, "owner"));
  })
);

workspacesRouter.get(
  "/api/workspaces/:workspaceId",
  asyncHandler(async (req, res) => {
    const user = currentUser(res.locals);
    const id = parseId(req.params.workspaceId, "Workspace");
    const member = await requireMember(id, user);
    const ws = await Workspace.findById(id).lean();
    if (!ws) throw new HttpError(404, "Workspace not found");
    res.json(wsOut(ws, member.role));
  })
);

workspacesRouter.get(
  "/api/workspaces/:workspaceId/members",
  asyncHandler(async (req, res) => {
    const user = currentUser(res.locals);
    const id = parseId(req.params.workspaceId, "Workspace");
    await requireMember(id, user);
    const members = await WorkspaceMember.find({ workspace: id })
      .populate<{ user: { _id: unknown; email: string; fullName: string } }>("user")
      .sort({ _id: 1 })
      .lean();
    const result = members
      .filter((m) => m.user)
      .map((m) => ({
        user_id: String(m.user._id),
        email: m.user.email,
        full_name: m.user.fullName || (m.user as { full_name?: string }).full_name || "",
        role: m.role,
      }));
    const ws = await Workspace.findById(id).lean();
    if (ws && !result.some((m) => m.user_id === String(ws.owner))) {
      const ownerUser = await User.findById(ws.owner).lean();
      if (ownerUser) {
        result.unshift({
          user_id: String(ownerUser._id),
          email: ownerUser.email,
          full_name: ownerUser.fullName || (ownerUser as { full_name?: string }).full_name || "",
          role: "owner",
        });
      }
    }
    res.json(result);
  })
);

workspacesRouter.post(
  "/api/workspaces/:workspaceId/members",
  asyncHandler(async (req, res) => {
    const user = currentUser(res.locals);
    const id = parseId(req.params.workspaceId, "Workspace");
    await requireAdmin(id, user);
    const body = parseBody(MemberIn, req.body);
    if (body.role === "owner") throw new HttpError(400, "A workspace has exactly one owner");
    const target = await User.findOne({ email: body.email.toLowerCase() }).lean();
    if (!target) throw new HttpError(404, "No user with that email");
    const ws = await Workspace.findById(id).lean();
    if (ws && String(ws.owner) === String(target._id)) {
      throw new HttpError(409, "User is already a member");
    }
    const alreadyMember = await WorkspaceMember.exists({ workspace: id, user: target._id });
    if (alreadyMember) throw new HttpError(409, "User is already a member");
    try {
      await WorkspaceMember.create({ workspace: id, user: target._id, role: body.role });
    } catch (err) {
      if (isDuplicateKey(err)) throw new HttpError(409, "User is already a member");
      throw err;
    }
    res.status(201).json({
      user_id: String(target._id),
      email: target.email,
      full_name: target.fullName || (target as { full_name?: string }).full_name || "",
      role: body.role,
    });
  })
);

workspacesRouter.get(
  "/api/workspaces/:workspaceId/credits",
  asyncHandler(async (req, res) => {
    const user = currentUser(res.locals);
    const id = parseId(req.params.workspaceId, "Workspace");
    await requireMember(id, user);
    const ws = await Workspace.findById(id, { credits: 1 }).lean();
    if (!ws) throw new HttpError(404, "Workspace not found");
    res.json({ workspace_id: String(id), balance: ws.credits ?? 0 });
  })
);

workspacesRouter.post(
  "/api/workspaces/:workspaceId/credits/topup",
  asyncHandler(async (req, res) => {
    const user = currentUser(res.locals);
    const id = parseId(req.params.workspaceId, "Workspace");
    const member = await requireMember(id, user);
    const ws = await Workspace.findById(id).lean();
    if (!ws) throw new HttpError(404, "Workspace not found");
    const isOwner = String(ws.owner) === String(user._id) || member.role === "owner";
    if (!isOwner) throw new HttpError(403, "Owner role required");
    const body = parseBody(TopUpIn, req.body);
    const updated = await Workspace.findByIdAndUpdate(id, { $inc: { credits: body.amount } }, { new: true }).lean();
    await CreditLedger.create({ workspace: id, delta: body.amount, reason: "top-up" });
    res.json({ workspace_id: String(id), balance: Number(updated?.credits ?? 0) });
  })
);

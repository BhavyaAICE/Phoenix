import { Router } from "express";
import { currentUser, requireUser } from "../lib/auth";
import { asyncHandler, HttpError, isDuplicateKey, parseBody } from "../lib/http";
import { LoginIn, RegisterIn } from "../lib/schemas";
import { createAccessToken, hashPassword, verifyPassword } from "../lib/security";
import { userOut } from "../lib/serialize";
import { User } from "../models";

export const authRouter = Router();

authRouter.post(
  "/api/auth/register",
  asyncHandler(async (req, res) => {
    const body = parseBody(RegisterIn, req.body);
    try {
      const passwordHash = hashPassword(body.password);
      const user = await User.create({
        email: body.email.toLowerCase(),
        fullName: body.full_name,
        passwordHash,
        password: passwordHash,
      });
      res.status(201).json({
        access_token: createAccessToken(String(user._id)),
        token_type: "bearer",
        user: userOut(user),
      });
    } catch (err) {
      if (isDuplicateKey(err)) throw new HttpError(409, "Email already registered");
      throw err;
    }
  })
);

authRouter.post(
  "/api/auth/login",
  asyncHandler(async (req, res) => {
    const body = parseBody(LoginIn, req.body);
    const user = await User.findOne({ email: body.email.toLowerCase() }).lean();
    const storedHash =
      (user as { passwordHash?: string; password?: string })?.passwordHash ||
      (user as { passwordHash?: string; password?: string })?.password;
    if (!user || !storedHash || !verifyPassword(body.password, storedHash)) {
      throw new HttpError(401, "Invalid email or password");
    }
    res.json({
      access_token: createAccessToken(String(user._id)),
      token_type: "bearer",
      user: userOut(user),
    });
  })
);

authRouter.get("/api/auth/me", requireUser, (_req, res) => {
  res.json(userOut(currentUser(res.locals)));
});

import { Router, Request, Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import {
  createUser,
  findUserByEmail,
  findUserById,
  updateUserProfile,
  toPublicUser,
} from "../db/queries/users";
import { authenticate, AuthRequest } from "../middleware/auth";
import { UserRole, Language } from "../types";

const router = Router();

const SALT_ROUNDS = 10;

function signToken(userId: string, email: string, role: UserRole): string {
  return jwt.sign(
    { userId, email, role },
    process.env.JWT_SECRET as string,
    { expiresIn: "7d" } as jwt.SignOptions
  );
}

// ── POST /api/auth/register ───────────────────────────────────
const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  name: z.string().min(1).max(100),
  role: z.enum(["solution_architect", "developer", "devops", "data_engineer"]),
  languagePreference: z.enum(["en", "hi", "hinglish"]).optional(),
});

router.post(
  "/register",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = registerSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.errors[0].message });
        return;
      }

      const { email, password, name, role, languagePreference } = parsed.data;

      // Check duplicate
      const existing = await findUserByEmail(email);
      if (existing) {
        res.status(409).json({ error: "Email already registered" });
        return;
      }

      const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
      const user = await createUser({ email, passwordHash, name, role, languagePreference });
      const token = signToken(user.id, user.email, user.role);

      res.status(201).json({ token, user: toPublicUser(user) });
    } catch (err) {
      next(err);
    }
  }
);

// ── POST /api/auth/login ──────────────────────────────────────
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

router.post(
  "/login",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = loginSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "Email and password are required" });
        return;
      }

      const { email, password } = parsed.data;
      const user = await findUserByEmail(email);

      // Constant-time comparison to prevent timing attacks
      const passwordMatch = user
        ? await bcrypt.compare(password, user.password_hash)
        : await bcrypt.compare(password, "$2b$10$invalidhashfortimingprotection");

      if (!user || !passwordMatch) {
        res.status(401).json({ error: "Invalid email or password" });
        return;
      }

      const token = signToken(user.id, user.email, user.role);
      res.json({ token, user: toPublicUser(user), isFirstLogin: user.is_first_login });
    } catch (err) {
      next(err);
    }
  }
);

// ── GET /api/auth/me ──────────────────────────────────────────
router.get(
  "/me",
  authenticate,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const user = await findUserById(req.user!.userId);
      if (!user) {
        res.status(404).json({ error: "User not found" });
        return;
      }
      res.json({ user: toPublicUser(user), isFirstLogin: user.is_first_login });
    } catch (err) {
      next(err);
    }
  }
);

// ── PATCH /api/auth/profile ───────────────────────────────────
// Updates role and/or language preference. Also clears is_first_login.
const profileSchema = z.object({
  role: z.enum(["solution_architect", "developer", "devops", "data_engineer"]).optional(),
  languagePreference: z.enum(["en", "hi", "hinglish"]).optional(),
});

router.patch(
  "/profile",
  authenticate,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const parsed = profileSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "Invalid profile data" });
        return;
      }

      const updated = await updateUserProfile(req.user!.userId, {
        role: parsed.data.role as UserRole | undefined,
        languagePreference: parsed.data.languagePreference as Language | undefined,
        isFirstLogin: false, // clear first-login flag on any profile update
      });

      if (!updated) {
        res.status(404).json({ error: "User not found" });
        return;
      }

      // Re-issue token if role changed (so JWT stays in sync)
      const token = signToken(updated.id, updated.email, updated.role);
      res.json({ token, user: toPublicUser(updated) });
    } catch (err) {
      next(err);
    }
  }
);

export default router;

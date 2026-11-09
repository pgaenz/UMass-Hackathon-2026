import { createHash, randomBytes, randomUUID } from "node:crypto";

import { hash, verify } from "@node-rs/argon2";
import { Prisma } from "@prisma/client";

import { prisma } from "./db";
import { dbUserToDomain } from "./db-mappers";
import type { Role, User } from "./types";

/**
 * Credential handling for email + password accounts (plan §6, Phase 4).
 *
 * Passwords are hashed with Argon2id (D5) and never stored, logged, or returned
 * in plain text. A `User` and its `Credential` are created in one transaction so
 * a half-registered account can never exist.
 */

// @node-rs/argon2 defaults to Argon2id; the costs below are the OWASP baseline.
const ARGON2_OPTIONS = {
  memoryCost: 19_456, // 19 MiB
  timeCost: 2,
  parallelism: 1,
} as const;

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

/** Emails are stored lowercased so lookups are case-insensitive. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: string): boolean {
  return email.length <= 254 && EMAIL_PATTERN.test(email);
}

/** Returns a user-facing message when the password is unacceptable, else null. */
export function validatePassword(password: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `Please use at least ${PASSWORD_MIN_LENGTH} characters.`;
  }
  if (password.length > PASSWORD_MAX_LENGTH) {
    return `Please use at most ${PASSWORD_MAX_LENGTH} characters.`;
  }
  return null;
}

export function hashPassword(password: string): Promise<string> {
  return hash(password, ARGON2_OPTIONS);
}

export async function verifyPassword(
  passwordHash: string,
  password: string,
): Promise<boolean> {
  try {
    return await verify(passwordHash, password);
  } catch {
    // A malformed stored hash must behave like a wrong password, not a crash.
    return false;
  }
}

/** Thrown when registration reuses an existing email. */
export class EmailTakenError extends Error {
  constructor() {
    super("An account with that email already exists.");
    this.name = "EmailTakenError";
  }
}

export async function registerUser(input: {
  role: Role;
  name: string;
  age: number;
  bio?: string;
  interests?: string[];
  email: string;
  password: string;
}): Promise<User> {
  const email = normalizeEmail(input.email);
  const passwordHash = await hashPassword(input.password);

  try {
    const row = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          id: `u-${randomUUID()}`,
          role: input.role,
          name: input.name.trim(),
          age: input.age,
          bio: input.bio?.trim() ?? "",
          interests: input.interests ?? [],
        },
      });
      await tx.credential.create({
        data: { userId: user.id, email, passwordHash },
      });
      return user;
    });
    return dbUserToDomain(row);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw new EmailTakenError();
    }
    throw err;
  }
}

/**
 * Verifies an email/password pair. Returns the user on success and `null` for
 * both an unknown email and a wrong password, so callers cannot tell them apart.
 */
export async function authenticate(
  email: string,
  password: string,
): Promise<User | null> {
  const credential = await prisma.credential.findUnique({
    where: { email: normalizeEmail(email) },
    include: { user: true },
  });
  if (!credential) return null;

  const ok = await verifyPassword(credential.passwordHash, password);
  if (!ok) return null;

  return dbUserToDomain(credential.user);
}

// ---------------------------------------------------------------------------
// One-time tokens (plan §5.2 / D6)
// ---------------------------------------------------------------------------

const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000; // 1 hour
const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/** Only the SHA-256 hash of a token is ever stored. */
function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** 32 random bytes encoded as base64url (matches the session-token shape). */
function newToken(): string {
  return randomBytes(32).toString("base64url");
}

/**
 * Issues a fresh password-reset token, invalidating any earlier unused ones so
 * at most one link is live at a time. The raw token is returned to the caller
 * (which emails it); it is never persisted.
 */
export async function createPasswordResetToken(userId: string): Promise<string> {
  const token = newToken();
  await prisma.$transaction([
    prisma.passwordResetToken.updateMany({
      where: { userId, usedAt: null },
      data: { usedAt: new Date() },
    }),
    prisma.passwordResetToken.create({
      data: {
        tokenHash: hashToken(token),
        userId,
        expiresAt: new Date(Date.now() + PASSWORD_RESET_TTL_MS),
      },
    }),
  ]);
  return token;
}

/** Same rules as the reset token, with a longer window to click the link. */
export async function createEmailVerificationToken(userId: string): Promise<string> {
  const token = newToken();
  await prisma.$transaction([
    prisma.emailVerificationToken.updateMany({
      where: { userId, usedAt: null },
      data: { usedAt: new Date() },
    }),
    prisma.emailVerificationToken.create({
      data: {
        tokenHash: hashToken(token),
        userId,
        expiresAt: new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS),
      },
    }),
  ]);
  return token;
}

function isExpired(row: { expiresAt: Date; usedAt: Date | null }): boolean {
  return Boolean(row.usedAt) || row.expiresAt.getTime() <= Date.now();
}

/**
 * Consumes a reset token and rotates the password in one transaction.
 *
 * A successful reset bumps `sessionVersion` and revokes every active session,
 * so a stolen session cannot survive the password change (D8). Returns the
 * user id on success and `null` for any invalid, used, or expired token.
 */
export async function resetPassword(
  token: string,
  newPassword: string,
): Promise<string | null> {
  const passwordHash = await hashPassword(newPassword);

  try {
    return await prisma.$transaction(async (tx) => {
      const row = await tx.passwordResetToken.findUnique({
        where: { tokenHash: hashToken(token) },
      });
      if (!row || isExpired(row)) return null;

      // Atomically claim the token so two concurrent requests cannot both use
      // it: the condition is re-checked under the row lock and only one wins.
      const claimed = await tx.passwordResetToken.updateMany({
        where: { tokenHash: row.tokenHash, usedAt: null, expiresAt: { gt: new Date() } },
        data: { usedAt: new Date() },
      });
      if (claimed.count !== 1) return null;

      await tx.credential.update({
        where: { userId: row.userId },
        data: { passwordHash },
      });
      await tx.user.update({
        where: { id: row.userId },
        data: { sessionVersion: { increment: 1 } },
      });
      await tx.session.updateMany({
        where: { userId: row.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      return row.userId;
    });
  } catch (err) {
    // A token whose credential disappeared is invalid, not a crash.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      return null;
    }
    throw err;
  }
}

export type PasswordChangeResult = "ok" | "wrong-password" | "missing-credential";

/**
 * Changes the password of a signed-in account after re-verifying the current
 * one. Like a reset, this bumps `sessionVersion` and revokes existing sessions;
 * the caller re-issues a session for the current device.
 */
export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
): Promise<PasswordChangeResult> {
  const credential = await prisma.credential.findUnique({ where: { userId } });
  if (!credential) return "missing-credential";

  const ok = await verifyPassword(credential.passwordHash, currentPassword);
  if (!ok) return "wrong-password";

  const passwordHash = await hashPassword(newPassword);
  await prisma.$transaction([
    prisma.credential.update({ where: { userId }, data: { passwordHash } }),
    prisma.user.update({
      where: { id: userId },
      data: { sessionVersion: { increment: 1 } },
    }),
    prisma.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ]);
  return "ok";
}

/**
 * Returns the signed-in owner's email and whether it is verified, or `null`
 * when the account has no credential. Only used on the owner's own profile;
 * the email is never part of `toPublicUser`.
 */
export async function getEmailVerificationStatus(
  userId: string,
): Promise<{ email: string; verified: boolean } | null> {
  const credential = await prisma.credential.findUnique({
    where: { userId },
    select: { email: true, emailVerifiedAt: true },
  });
  if (!credential) return null;
  return { email: credential.email, verified: Boolean(credential.emailVerifiedAt) };
}

/**
 * Consumes an email-verification token and stamps `emailVerifiedAt`. Returns
 * the user id on success and `null` for any invalid, used, or expired token.
 */
export async function markEmailVerified(token: string): Promise<string | null> {
  try {
    return await prisma.$transaction(async (tx) => {
      const row = await tx.emailVerificationToken.findUnique({
        where: { tokenHash: hashToken(token) },
      });
      if (!row || isExpired(row)) return null;

      const claimed = await tx.emailVerificationToken.updateMany({
        where: { tokenHash: row.tokenHash, usedAt: null, expiresAt: { gt: new Date() } },
        data: { usedAt: new Date() },
      });
      if (claimed.count !== 1) return null;

      await tx.credential.update({
        where: { userId: row.userId },
        data: { emailVerifiedAt: new Date() },
      });
      return row.userId;
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      return null;
    }
    throw err;
  }
}

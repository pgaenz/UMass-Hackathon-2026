import { headers } from "next/headers";

import { prisma } from "./db";

/**
 * Append-only trail of security-relevant account events (plan §5.2). Auditing is
 * best-effort: a failed write must never break sign-in or a password reset.
 */

export type AuthAuditEvent =
  | "login.success"
  | "login.failure"
  | "password.forgot"
  | "password.change"
  | "password.reset"
  | "email.verified";

export async function recordAuthAudit(
  event: AuthAuditEvent,
  userId: string | null = null,
): Promise<void> {
  try {
    let userAgent: string | null = null;
    let ip: string | null = null;
    try {
      const store = await headers();
      userAgent = store.get("user-agent");
      const forwarded = store.get("x-forwarded-for");
      ip = forwarded ? (forwarded.split(",")[0]?.trim() ?? null) : null;
    } catch {
      // No request context (e.g. a script) — record the event without metadata.
    }

    await prisma.authAudit.create({ data: { userId, event, userAgent, ip } });
  } catch (err) {
    console.error(`Failed to record auth audit event "${event}":`, err);
  }
}

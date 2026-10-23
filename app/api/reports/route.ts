import { createReport, type ReportTargetType } from "@/lib/reports";

export const runtime = "nodejs";

const TARGET_TYPES: ReportTargetType[] = ["question", "story", "answer", "message", "user"];

// POST /api/reports  { targetType, targetId, reason, details? }
export async function POST(request: Request): Promise<Response> {
  const body = (await request.json().catch(() => null)) as {
    targetType?: unknown;
    targetId?: unknown;
    reason?: unknown;
    details?: unknown;
  } | null;

  const targetType =
    typeof body?.targetType === "string" ? (body.targetType as ReportTargetType) : null;
  const targetId = typeof body?.targetId === "string" ? body.targetId.trim() : "";
  const reason = typeof body?.reason === "string" ? body.reason.trim() : "";
  const details = typeof body?.details === "string" ? body.details.trim() : "";

  if (!targetType || !TARGET_TYPES.includes(targetType)) {
    return Response.json({ error: "Invalid report target" }, { status: 400 });
  }
  if (!targetId) {
    return Response.json({ error: "Missing report target id" }, { status: 400 });
  }
  if (!reason) {
    return Response.json({ error: "Missing report reason" }, { status: 400 });
  }

  const report = await createReport({ targetType, targetId, reason, details });
  return Response.json({ report }, { status: 201 });
}

import { randomUUID } from "node:crypto";

import type { Report as DbReport } from "@prisma/client";

import { prisma } from "./db";

export type ReportTargetType = "question" | "story" | "answer" | "message" | "user";

export interface Report {
  id: string;
  targetType: ReportTargetType;
  targetId: string;
  reason: string;
  details: string;
  status: "open";
  createdAt: string;
}

function toDomain(row: DbReport): Report {
  return {
    id: row.id,
    targetType: row.targetType,
    targetId: row.targetId,
    reason: row.reason,
    details: row.details,
    status: "open",
    createdAt: row.createdAt.toISOString(),
  };
}

export async function createReport(input: {
  targetType: ReportTargetType;
  targetId: string;
  reason: string;
  details?: string;
}): Promise<Report> {
  const row = await prisma.report.create({
    data: {
      id: `r-${randomUUID()}`,
      targetType: input.targetType,
      targetId: input.targetId,
      reason: input.reason,
      details: input.details ?? "",
      status: "open",
    },
  });
  return toDomain(row);
}

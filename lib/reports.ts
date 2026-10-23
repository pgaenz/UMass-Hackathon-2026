import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

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

interface ReportsData {
  reports: Report[];
}

const DATA_DIR = path.join(process.cwd(), "data");
const REPORTS_PATH = path.join(DATA_DIR, "reports.json");

async function readReports(): Promise<ReportsData> {
  try {
    const raw = await fs.readFile(REPORTS_PATH, "utf8");
    const parsed = JSON.parse(raw) as ReportsData;
    return Array.isArray(parsed.reports) ? parsed : { reports: [] };
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return { reports: [] };
    }
    throw err;
  }
}

async function writeReports(data: ReportsData): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(REPORTS_PATH, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

export async function createReport(input: {
  targetType: ReportTargetType;
  targetId: string;
  reason: string;
  details?: string;
}): Promise<Report> {
  const data = await readReports();
  const report: Report = {
    id: `r-${randomUUID()}`,
    targetType: input.targetType,
    targetId: input.targetId,
    reason: input.reason,
    details: input.details ?? "",
    status: "open",
    createdAt: new Date().toISOString(),
  };
  data.reports.push(report);
  await writeReports(data);
  return report;
}

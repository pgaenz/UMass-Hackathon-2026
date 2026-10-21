import { setVisitor } from "@/lib/session";

export const runtime = "nodejs";

// POST /api/auth/visitor — read-only mode; no identity, cannot post.
export async function POST(): Promise<Response> {
  await setVisitor();
  return Response.json({ visitor: true });
}

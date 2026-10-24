import { buildPodcastPlan, PodcastError } from "@/lib/podcast";
import { PODCAST_MINUTES, type PodcastMinutes, type PodcastMode } from "@/lib/podcast-types";
import { authorize } from "@/lib/session";

export const runtime = "nodejs";
export const maxDuration = 180;

interface PodcastRequestBody {
  topics?: unknown;
  mode?: unknown;
  minutes?: unknown;
}

export async function POST(request: Request): Promise<Response> {
  const auth = await authorize(["river", "drop"]);
  if ("response" in auth) return auth.response;

  const body = (await request.json().catch(() => null)) as PodcastRequestBody | null;
  if (!body) {
    return Response.json({ error: "Invalid podcast request." }, { status: 400 });
  }

  const mode: PodcastMode = body.mode === "random" ? "random" : "interests";
  const minutes = PODCAST_MINUTES.includes(body.minutes as PodcastMinutes)
    ? (body.minutes as PodcastMinutes)
    : null;
  const topics = Array.isArray(body.topics)
    ? body.topics.filter((topic): topic is string => typeof topic === "string")
    : [];

  if (minutes === null) {
    return Response.json(
      { error: "Choose an episode length of 15, 30, or 45 minutes." },
      { status: 400 },
    );
  }
  if (mode === "interests" && topics.length === 0) {
    return Response.json(
      { error: "Choose at least one interest, or use Random." },
      { status: 400 },
    );
  }

  try {
    const plan = await buildPodcastPlan({
      topics,
      mode,
      minutes,
      userId: auth.session.userId,
    });
    return Response.json({ plan });
  } catch (error) {
    if (error instanceof PodcastError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    console.error("Podcast generation failed", error);
    return Response.json(
      { error: "We could not build that episode. Please try again." },
      { status: 502 },
    );
  }
}

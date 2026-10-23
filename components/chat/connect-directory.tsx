"use client";

import { useMemo, useState } from "react";

import { MessageButton } from "@/components/chat/message-button";
import { Badge } from "@/components/ui/badge";
import type { AgeBand, Topic } from "@/lib/types";

export interface DirectoryPerson {
  id: string;
  name: string;
  ageBand: AgeBand;
  bio: string;
  interests: string[];
  sharedInterests: string[];
}

function labelFor(topicId: string, topics: Topic[]): string {
  return topics.find((topic) => topic.id === topicId)?.label ?? topicId;
}

/** Directory of Rivers with an interest filter and shared-interest hints. */
export function ConnectDirectory({
  people,
  topics,
}: {
  people: DirectoryPerson[];
  topics: Topic[];
}) {
  const [interest, setInterest] = useState("all");

  const interests = useMemo(() => {
    const ids = new Set<string>();
    for (const person of people) {
      for (const id of person.interests) ids.add(id);
    }
    return [...ids].sort();
  }, [people]);

  const visible = useMemo(
    () =>
      interest === "all"
        ? people
        : people.filter((person) => person.interests.includes(interest)),
    [interest, people],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <label htmlFor="connect-interest" className="text-lg font-semibold text-ink">
          Filter by interest
        </label>
        <select
          id="connect-interest"
          value={interest}
          onChange={(event) => setInterest(event.target.value)}
          className="min-h-11 rounded-xl border-2 border-seaglass bg-white/80 px-3 text-lg text-ink focus:border-brand"
        >
          <option value="all">All interests</option>
          {interests.map((id) => (
            <option key={id} value={id}>
              {labelFor(id, topics)}
            </option>
          ))}
        </select>
        <span className="text-base text-ink/60" role="status">
          {visible.length === 1 ? "1 River" : `${visible.length} Rivers`}
        </span>
      </div>

      <ul className="space-y-5">
        {visible.map((person) => (
          <li
            key={person.id}
            className="lift flex flex-col gap-4 rounded-2xl glass shadow-water p-6 sm:flex-row sm:items-start sm:justify-between"
          >
            <div className="min-w-0 space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-2xl font-semibold text-ink">{person.name}</span>
                <Badge>River · {person.ageBand}</Badge>
                {person.sharedInterests.length > 0 ? (
                  <Badge className="bg-sunset/30 text-ocean">
                    {person.sharedInterests.length} in common
                  </Badge>
                ) : null}
              </div>

              {person.bio ? <p className="text-lg text-ink/80">{person.bio}</p> : null}

              {person.interests.length > 0 ? (
                <ul className="flex flex-wrap gap-2" aria-label="Interests">
                  {person.interests.map((id) => (
                    <li key={id}>
                      <Badge
                        className={
                          person.sharedInterests.includes(id)
                            ? "bg-sunset/40 text-ocean"
                            : undefined
                        }
                      >
                        {labelFor(id, topics)}
                        {person.sharedInterests.includes(id) ? " · shared" : ""}
                      </Badge>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>

            <div className="shrink-0">
              <MessageButton participantId={person.id} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

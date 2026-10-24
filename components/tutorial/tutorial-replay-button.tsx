"use client";

import { buttonClasses } from "@/components/ui/button";
import { useTutorial } from "@/components/tutorial/tutorial-provider";

/** Lets people run the welcome tour again from the Help page. */
export function TutorialReplayButton() {
  const { replay } = useTutorial();

  return (
    <button
      type="button"
      onClick={replay}
      className={buttonClasses({ variant: "secondary", size: "md" })}
    >
      Replay the welcome tour
    </button>
  );
}
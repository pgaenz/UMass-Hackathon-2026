"use client";

import type { FormEvent } from "react";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { textActionClass } from "@/lib/action-classes";
import type { ReportTargetType } from "@/lib/reports";

const REASONS = [
  "Disrespectful or hateful",
  "Spam or misleading",
  "Shares private information",
  "Something else",
];

/**
 * Lightweight moderation control: a native <dialog> keeps focus trapping and
 * Escape-to-close for free, and the report is stored via POST /api/reports.
 */
export function ReportButton({
  targetType,
  targetId,
}: {
  targetType: ReportTargetType;
  targetId: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [reason, setReason] = useState(REASONS[0]);
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const titleId = `report-title-${targetType}-${targetId}`;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetType, targetId, reason, details }),
      });
      if (!res.ok) throw new Error("Report failed");
      dialogRef.current?.close();
      setStatus("Thank you. A moderator will review this.");
      setDetails("");
      setReason(REASONS[0]);
    } catch {
      setStatus("We could not send that report. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={() => dialogRef.current?.showModal()}
        className={textActionClass}
      >
        Report
      </button>
      {status ? (
        <span role="status" className="text-sm text-ink/70">
          {status}
        </span>
      ) : null}

      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        className="w-[min(92vw,32rem)] rounded-2xl glass shadow-water p-0 shadow-xl"
      >
        <form onSubmit={handleSubmit} className="space-y-5 p-6">
          <div className="space-y-2">
            <h2 id={titleId} className="text-2xl font-bold text-ink">
              Report this {targetType}
            </h2>
            <p className="text-base text-ink/70">
              Reports are private. Tell us what is wrong and we will take a look.
            </p>
          </div>

          <fieldset className="space-y-3">
            <legend className="text-lg font-semibold text-ink">Reason</legend>
            {REASONS.map((option) => (
              <label
                key={option}
                className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-2 text-lg text-ink hover:bg-seaglass/25"
              >
                <input
                  type="radio"
                  name="reason"
                  value={option}
                  checked={reason === option}
                  onChange={() => setReason(option)}
                  className="h-5 w-5"
                />
                {option}
              </label>
            ))}
          </fieldset>

          <div className="space-y-2">
            <label htmlFor={`${titleId}-details`} className="text-lg font-semibold text-ink">
              More details (optional)
            </label>
            <textarea
              id={`${titleId}-details`}
              value={details}
              onChange={(event) => setDetails(event.target.value)}
              rows={3}
              className="w-full rounded-xl border-2 border-seaglass p-3 text-lg text-ink focus:border-brand"
            />
          </div>

          <div className="flex flex-wrap justify-end gap-3">
            <Button variant="secondary" onClick={() => dialogRef.current?.close()}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Sending…" : "Send report"}
            </Button>
          </div>
        </form>
      </dialog>
    </span>
  );
}

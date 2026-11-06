"use client";

import { useEffect, useId, useRef } from "react";

import { Button } from "@/components/ui/button";

/**
 * Shared confirmation dialog using the native <dialog>, which gives focus
 * trapping, Escape-to-close, and focus return for free. The safe option is
 * focused by default (plan/river-experience.md §8.4, §11).
 */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  busy = false,
  destructive = false,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  busy?: boolean;
  destructive?: boolean;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = `confirm-title-${useId().replace(/:/g, "")}`;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onClose={onCancel}
      className="w-[min(92vw,32rem)] rounded-2xl glass shadow-water p-0 shadow-xl"
    >
      {open ? (
        <div className="space-y-5 p-6">
          <h2 id={titleId} className="text-2xl font-bold text-ink">
            {title}
          </h2>
          <p className="text-lg text-ink/80">{message}</p>
          <div className="flex flex-wrap justify-end gap-3">
            <Button variant="primary" onClick={onCancel} disabled={busy} autoFocus>
              {cancelLabel}
            </Button>
            <Button
              variant="secondary"
              onClick={onConfirm}
              disabled={busy}
              className={destructive ? "border-coral text-coral" : undefined}
            >
              {busy ? "Working…" : confirmLabel}
            </Button>
          </div>
        </div>
      ) : null}
    </dialog>
  );
}

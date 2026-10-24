/**
 * Copies text to the clipboard, falling back to a hidden textarea when the
 * async Clipboard API is unavailable or its permission is denied.
 * `focusTarget` is focused again after the fallback so keyboard users are not
 * dropped at the top of the page.
 */
export async function writeToClipboard(
  text: string,
  focusTarget?: HTMLElement | null,
): Promise<void> {
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // Permission can be denied; fall through to the legacy approach.
    }
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.top = "0";
  textarea.style.left = "0";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  const copied = document.execCommand("copy");
  document.body.removeChild(textarea);

  // The temporary textarea takes focus; return it to the original control.
  focusTarget?.focus();
  if (!copied) throw new Error("Copy failed");
}

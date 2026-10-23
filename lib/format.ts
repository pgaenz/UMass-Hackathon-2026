export function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

export function getArticleTitle(article: string): string {
  const firstLine = article.split(/\r?\n/).find((line) => line.trim().length > 0) ?? "";
  return firstLine.replace(/^#+\s*/, "").replace(/\*\*/g, "").trim();
}

export function truncate(text: string, max = 70): string {
  const clean = text.trim();
  return clean.length > max ? `${clean.slice(0, max - 1).trimEnd()}…` : clean;
}

/** Strips the small subset of Markdown understood by `ArticleRenderer`. */
export function toPlainText(markdown: string): string {
  return markdown
    .split(/\r?\n/)
    .map((line) => line.replace(/^#{1,6}\s*/, "").replace(/^[-*]\s+/, ""))
    .join("\n")
    .replace(/\*\*/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

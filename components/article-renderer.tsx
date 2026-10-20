import type { ReactNode } from "react";

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  return text
    .split(/(\*\*[^*]+\*\*)/g)
    .filter(Boolean)
    .map((part, index) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return <strong key={`${keyPrefix}-b-${index}`}>{part.slice(2, -2)}</strong>;
      }
      return <span key={`${keyPrefix}-t-${index}`}>{part}</span>;
    });
}

/**
 * Minimal Markdown renderer for generated articles: headings, bullet lists and
 * paragraphs. Deliberately tiny — the MVP stores plain article text, not HTML.
 */
export function ArticleRenderer({ markdown }: { markdown: string }) {
  const blocks = markdown
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);

  return (
    <div className="space-y-5">
      {blocks.map((block, index) => {
        if (block.startsWith("## ")) {
          return (
            <h3 key={index} className="text-xl font-semibold text-ink">
              {renderInline(block.slice(3), `h3-${index}`)}
            </h3>
          );
        }
        if (block.startsWith("# ")) {
          return (
            <h2 key={index} className="text-2xl font-bold text-ink">
              {renderInline(block.slice(2), `h2-${index}`)}
            </h2>
          );
        }
        const lines = block.split(/\n/);
        if (lines.every((line) => /^[-*]\s+/.test(line))) {
          return (
            <ul key={index} className="list-disc space-y-2 pl-6 text-lg text-ink">
              {lines.map((line, lineIndex) => (
                <li key={lineIndex}>
                  {renderInline(line.replace(/^[-*]\s+/, ""), `li-${index}-${lineIndex}`)}
                </li>
              ))}
            </ul>
          );
        }
        return (
          <p key={index} className="text-lg leading-relaxed text-ink">
            {renderInline(block, `p-${index}`)}
          </p>
        );
      })}
    </div>
  );
}

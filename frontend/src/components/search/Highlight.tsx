/**
 * Highlights occurrences of `query` words within `text`.
 * Splits on whitespace, matches case-insensitively, wraps matches in <mark>.
 */

interface HighlightProps {
  text: string;
  query: string;
  className?: string;
}

export function Highlight({ text, query, className }: HighlightProps) {
  if (!query.trim()) return <span className={className}>{text}</span>;

  // Build a regex from each word in the query
  const words = query
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")); // escape regex chars

  if (!words.length) return <span className={className}>{text}</span>;

  const pattern = new RegExp(`(${words.join("|")})`, "gi");
  const parts = text.split(pattern);

  return (
    <span className={className}>
      {parts.map((part, i) =>
        pattern.test(part) ? (
          <mark
            key={i}
            className="bg-yellow-100 text-yellow-900 rounded px-0.5 not-italic font-medium"
          >
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </span>
  );
}

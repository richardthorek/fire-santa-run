/**
 * Component to highlight matching text in search results
 */

interface HighlightedTextProps {
  text: string;
  query: string;
  className?: string;
}

export function HighlightedText({ text, query, className }: HighlightedTextProps) {
  if (!query || query.trim() === '') {
    return <span className={className}>{text}</span>;
  }

  const normalizedQuery = query.toLowerCase().trim();
  const normalizedText = text.toLowerCase();
  const startIndex = normalizedText.indexOf(normalizedQuery);

  if (startIndex === -1) {
    return <span className={className}>{text}</span>;
  }

  const endIndex = startIndex + normalizedQuery.length;
  const before = text.slice(0, startIndex);
  const match = text.slice(startIndex, endIndex);
  const after = text.slice(endIndex);

  return (
    <span className={className}>
      {before}
      <mark style={{
        backgroundColor: '#FFF59D',
        color: 'inherit',
        padding: '0 2px',
        borderRadius: '2px',
        fontWeight: 600,
      }}>
        {match}
      </mark>
      {after}
    </span>
  );
}

/**
 * Fenced code with a language label and copy affordance.
 */
export interface CodeToken { text: string; /** A colour token name without the leading dashes, e.g. "tokyo-purple". */ color?: string; }
export interface CodeBlockProps {
  /** Shown top-left, uppercased. */
  lang?: string;
  /** Plain source; ignored when pre-tokenised spans are supplied. */
  code?: string;
  /** Pre-tokenised spans for hand-highlighted samples. */
  tokens?: CodeToken[] | null;
  style?: React.CSSProperties;
}
export function CodeBlock(props: CodeBlockProps): JSX.Element;

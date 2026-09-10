export interface PullQuoteProps {
  children?: React.ReactNode;
  cite?: string | null;
  /** rule = indented with a 2px accent left rule (essay, technical); display = large centred with accent quote marks (magazine). */
  variant?: "rule" | "display";
  style?: React.CSSProperties;
}
export function PullQuote(props: PullQuoteProps): JSX.Element;

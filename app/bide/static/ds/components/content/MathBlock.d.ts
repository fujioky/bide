export interface MathBlockProps {
  /** Display formula. Rendered by KaTeX in production; this preview sets it in the serif display face. */
  tex?: string;
  /** Equation number or caption. */
  label?: string | null;
  style?: React.CSSProperties;
}
export function MathBlock(props: MathBlockProps): JSX.Element;

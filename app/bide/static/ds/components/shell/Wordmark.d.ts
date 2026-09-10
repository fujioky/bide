export interface WordmarkProps {
  /** Font size in px. 16 in headers, 14 in footers, 96 in the home hero. */
  size?: number;
  /** Leading ◆ glyph in the accent colour. */
  showDiamond?: boolean;
  style?: React.CSSProperties;
}
export function Wordmark(props: WordmarkProps): JSX.Element;

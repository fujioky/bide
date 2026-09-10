export interface SectionBreakProps {
  /** asterism = "* * *" (essay); rule = hairline (technical, data). */
  variant?: "asterism" | "rule";
  style?: React.CSSProperties;
}
export function SectionBreak(props: SectionBreakProps): JSX.Element;

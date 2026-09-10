export interface BarChartRowProps {
  label: string;
  value: number;
  /** Scale maximum. */
  max?: number;
  /** Formatted value shown at the right, e.g. "€4,200". */
  display?: React.ReactNode;
  tone?: "accent" | "up" | "down" | "quiet";
  style?: React.CSSProperties;
}
export function BarChartRow(props: BarChartRowProps): JSX.Element;

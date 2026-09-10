/**
 * Single key figure for the infographic template's summary strip.
 */
export interface StatCardProps {
  value: React.ReactNode;
  label: string;
  note?: string | null;
  /** Colours the number only. */
  tone?: "neutral" | "up" | "down" | "accent";
  style?: React.CSSProperties;
}
export function StatCard(props: StatCardProps): JSX.Element;

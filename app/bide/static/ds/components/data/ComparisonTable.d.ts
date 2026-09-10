export interface ComparisonTableProps {
  columns: string[];
  /** Row-major cells; the first column is treated as the row label. */
  rows: React.ReactNode[][];
  zebra?: boolean;
  /** Per-column text alignment override. */
  align?: ("left" | "right" | "center")[] | null;
  style?: React.CSSProperties;
}
export function ComparisonTable(props: ComparisonTableProps): JSX.Element;

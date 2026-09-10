export interface ChartFrameProps {
  title?: string | null;
  /** Source / unit note, right aligned in the caption row. */
  note?: string | null;
  /** Reserved plot height in px, 300–500. Default 320. */
  height?: number;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}
export function ChartFrame(props: ChartFrameProps): JSX.Element;

/**
 * Wrapper marking a live, touchable widget inside an article.
 */
export interface DemoPanelProps {
  /** Uppercase label after the green dot. Default "交互". */
  label?: string;
  /** Optional plain-text description next to the label. */
  title?: string | null;
  /** Focus state — the border pulses with the accent glow. */
  focused?: boolean;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}
export function DemoPanel(props: DemoPanelProps): JSX.Element;

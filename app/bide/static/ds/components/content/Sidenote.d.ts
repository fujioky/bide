export interface SidenoteProps {
  /** Reference marker, matching the superscript in the body text. */
  marker?: string;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}
export function Sidenote(props: SidenoteProps): JSX.Element;

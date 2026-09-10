export interface PillProps {
  children?: React.ReactNode;
  /** Selected filter — accent fill. */
  active?: boolean;
  onClick?: () => void;
  style?: React.CSSProperties;
}
export function Pill(props: PillProps): JSX.Element;

import type { TocSection } from "./TocRail";
export interface TocPanelProps {
  sections: TocSection[];
  activeIndex?: number;
  /** Bottom sheet at 50% height instead of the 280px left slide-in. */
  mobile?: boolean;
  onClose?: () => void;
  style?: React.CSSProperties;
}
export function TocPanel(props: TocPanelProps): JSX.Element;

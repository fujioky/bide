/**
 * Collapsed table of contents — Lyra's signature dash rail.
 */
export interface TocSection { title: string; /** Relative length of the section, drives dash width. */ weight?: number; level?: 1 | 2; }
export interface TocRailProps {
  sections: TocSection[];
  /** Index of the section currently in view — its dash goes accent and 3px tall. */
  activeIndex?: number;
  onExpand?: () => void;
  style?: React.CSSProperties;
}
export function TocRail(props: TocRailProps): JSX.Element;

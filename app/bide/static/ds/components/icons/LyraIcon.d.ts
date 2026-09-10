export interface LyraIconProps {
  /** Lucide icon name, e.g. "rss", "arrow-up", "list", "sparkles". */
  name: string;
  /** Pixel box. Default 16. */
  size?: number;
  /** Stroke width. Default 1.75 — the Lyra hairline weight. */
  strokeWidth?: number;
  /** Stroke colour. Default currentColor. */
  color?: string;
  style?: React.CSSProperties;
}
export function LyraIcon(props: LyraIconProps): JSX.Element;

export interface ArticleHeaderProps {
  title: string;
  /** Meta chips joined by a middot, e.g. ["作者","2026-08-20","15 min read"]. */
  meta?: string[];
  /** Small accent eyebrow above the title. */
  kicker?: string | null;
  align?: "left" | "center";
  /** Use the theme heading face (serif in essay/magazine). */
  serif?: boolean;
  style?: React.CSSProperties;
}
export function ArticleHeader(props: ArticleHeaderProps): JSX.Element;

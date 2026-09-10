/**
 * Index card for one article. Four variants cover the whole home grid.
 */
export interface ArticleCardProps {
  title: string;
  summary?: string;
  category?: string;
  /** Short date, e.g. "08/21". */
  date?: string;
  tags?: string[];
  /** e.g. "8 min". */
  readTime?: string;
  /** default = text card; cover = 16:9 image on top; row = compact list row. */
  variant?: "default" | "cover" | "row";
  cover?: string;
  /** Admin-only unpublished article: dashed accent border, dimmed surface. */
  hidden?: boolean;
  /** Pinned/newest card — larger title. */
  feature?: boolean;
  onClick?: () => void;
  style?: React.CSSProperties;
}
export function ArticleCard(props: ArticleCardProps): JSX.Element;

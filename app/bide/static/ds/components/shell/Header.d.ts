/**
 * Fixed-geometry page header — the first half of the Shell Protocol.
 */
export interface HeaderProps {
  /** Nav labels, right aligned. Default ["首页","分类"]. */
  nav?: string[];
  /** Signed-in admin: the 登录 button becomes a UserMenu avatar. */
  admin?: boolean;
  /** <640px layout: wordmark + hamburger only, 52px tall. */
  mobile?: boolean;
  /** 0–100 reading progress; renders the 2px accent line on the bottom edge. Omit on the home page. */
  progress?: number | null;
  /** Scrolled-down state of the article-page hide-on-scroll behaviour. */
  hidden?: boolean;
  /** Article pages are sticky; the home page is static. */
  sticky?: boolean;
  style?: React.CSSProperties;
}
export function Header(props: HeaderProps): JSX.Element;

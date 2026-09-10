export interface FooterProps {
  mobile?: boolean;
  /** 回顶部 only appears once the reader has scrolled past ~1 viewport. */
  showBackToTop?: boolean;
  /** Utility links, text only. Default ["RSS"] — keep it to one or two. */
  links?: string[];
  style?: React.CSSProperties;
}
export function Footer(props: FooterProps): JSX.Element;

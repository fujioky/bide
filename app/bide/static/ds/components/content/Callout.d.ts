export interface CalloutProps {
  /** tip 提示 / warning 警告 / danger 危险 / best 最佳实践 — only the left border and label change colour. */
  kind?: "tip" | "warning" | "danger" | "best";
  /** Overrides the default Chinese label. */
  title?: string | null;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}
export function Callout(props: CalloutProps): JSX.Element;

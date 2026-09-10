/**
 * Collapsed Grok entry point — 48px accent pill, bottom right, 24px inset.
 */
export interface GrokLauncherProps {
  /** Optional "Ask" text next to the spark glyph; icon-only by default. */
  label?: string | null;
  /** Respects safe-area-inset-bottom. */
  mobile?: boolean;
  onClick?: () => void;
  style?: React.CSSProperties;
}
export function GrokLauncher(props: GrokLauncherProps): JSX.Element;

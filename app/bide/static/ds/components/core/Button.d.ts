/**
 * Lyra's single button primitive. Skin follows the active theme via tokens.
 */
export interface ButtonProps {
  /** solid = primary action; outline = secondary; ghost = header/footer links; quiet = surface-filled. Default "solid". */
  variant?: "solid" | "outline" | "ghost" | "quiet";
  /** Default "md". "sm" is the header/meta size. */
  size?: "sm" | "md" | "lg";
  full?: boolean;
  disabled?: boolean;
  /** Leading icon node — usually <LyraIcon />. */
  icon?: React.ReactNode;
  children?: React.ReactNode;
  onClick?: () => void;
  style?: React.CSSProperties;
}
export function Button(props: ButtonProps): JSX.Element;

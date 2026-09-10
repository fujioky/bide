export interface UserMenuProps {
  /** Admin display name; the avatar dot uses its first character. */
  name?: string;
  open?: boolean;
  onToggle?: () => void;
  style?: React.CSSProperties;
}
export function UserMenu(props: UserMenuProps): JSX.Element;

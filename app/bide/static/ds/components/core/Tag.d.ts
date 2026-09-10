export interface TagProps {
  children?: React.ReactNode;
  /** "accent" tints the tag and its dot with the theme accent. */
  tone?: "default" | "accent";
  /** Show the 5px leading category dot. */
  dot?: boolean;
  style?: React.CSSProperties;
}
export function Tag(props: TagProps): JSX.Element;

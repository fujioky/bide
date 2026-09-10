export interface FigureImageProps {
  src?: string | null;
  caption?: string | null;
  /** CSS aspect-ratio string. Default "16 / 9". */
  ratio?: string;
  /** Full-viewport-width magazine plate: square corners, no border, large vertical air. */
  bleed?: boolean;
  rounded?: boolean;
  style?: React.CSSProperties;
}
export function FigureImage(props: FigureImageProps): JSX.Element;
